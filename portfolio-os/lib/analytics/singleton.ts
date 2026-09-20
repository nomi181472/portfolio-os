/**
 * lib/analytics/singleton.ts
 *
 * The SSR singleton: a bounded, aggregate-only AnalyticsManager (§3–§15, §50-51).
 *
 *   • It stores SUMMARIES, never history. No events[], no visitors[], no
 *     sessions[], no rawHistory[], no growing per-visitor maps.
 *   • Every collection is fixed-cap: day ring (90), hour ring (7d), capped
 *     counter maps, fixed HyperLogLog sketches, a bounded visitor LRU.
 *   • Traffic increases counter values, never the number of structures.
 *   • track() never throws; every update is wrapped. Analytics is secondary.
 *   • Persistent storage is an optional, best-effort aggregate snapshot
 *     (store.ts). A Redis/SQLite adapter can be added behind the same interface.
 */
import 'server-only';

import { Hll, mergeHlls } from './sketch';
import { Lru } from './lru';
import { CapMap } from './registry';
import {
  DayRing,
  HourRing,
  SectionHistograms,
  SectionSketches,
  SCROLL_BUCKETS,
  type DayBucket,
  type HourBucket,
  type PerfAccumulator,
  type BucketScalars,
  zeroBucketScalars,
  zeroPerf,
} from './aggregate';
import type { NormalizedEvent, PerfValues } from './events';
import { frequencySummary, averageSessionDurationMs, returningPercent, type FrequencySummary } from './metrics';
import {
  DAY_BUCKETS,
  HEARTBEAT_TTL_MS,
  VISITOR_LRU_CAP,
  SESSION_LRU_CAP,
  DIMENSION_CAPS,
} from './shared';
import { currentDeployment, type DeploymentInfo } from './deployment';
import {
  resolveStore,
  type AnalyticsStore,
  type SerializedSnapshot,
  type SerializedDay,
} from './store';

interface SessionState {
  visitor: string;
  deployment: string;
  landing: string;
  startedAt: number;
  lastSeen: number;
  maxScroll: number;
  lastSection: string;
  finalized: boolean;
}

interface VisitorState {
  sessions: number;
  lastSeen: number;
  days: Set<string>;
}

interface Presence {
  visitor: string;
  section: string;
  lastSeen: number;
}

interface DeploymentCounters {
  sessions: number;
  returningSessions: number;
  totalSessionDurMs: number;
  sessionDurSamples: number;
  clicksByNamespace: CapMap;
  clicksByTarget: CapMap;
  exitSections: CapMap;
  sketch: Hll;
}

function createDeploymentCounters(): DeploymentCounters {
  return {
    sessions: 0,
    returningSessions: 0,
    totalSessionDurMs: 0,
    sessionDurSamples: 0,
    clicksByNamespace: new CapMap(DIMENSION_CAPS.namespaces),
    clicksByTarget: new CapMap(DIMENSION_CAPS.targets),
    exitSections: new CapMap(DIMENSION_CAPS.sections),
    sketch: new Hll(),
  };
}

interface DeploymentMetrics {
  id: string;
  firstSeenAt: number;
  days: DayRing;
  hours: HourRing;
  sectionUnique: SectionSketches;
  sectionMedian: SectionHistograms;
  counters: DeploymentCounters;
}

/* ================================================================== */
/*                       options + entry points                        */
/* ================================================================== */

export interface ManagerOptions {
  store?: AnalyticsStore;
  snapshotIntervalMs?: number;
}

export class AnalyticsManager {
  private deployments = new Map<string, DeploymentMetrics>();
  private visitorLru = new Lru<string, VisitorState>(VISITOR_LRU_CAP);
  private sessionLru = new Lru<string, SessionState>(SESSION_LRU_CAP);
  private active = new Map<string, Presence>();
  private store: AnalyticsStore;
  private flushing = false;
  private restored = false;

  constructor(options: ManagerOptions = {}) {
    this.store = options.store ?? resolveStore();
    const interval = options.snapshotIntervalMs ?? 0;
    if (interval > 0) {
      try {
        const timer = setInterval(() => {
          void this.flush();
        }, interval);
        if (typeof timer.unref === 'function') timer.unref();
      } catch {
        /* timers unavailable — proceed without snapshots */
      }
    }
    try {
      const timer = setInterval(() => this.pruneActive(Date.now()), 15_000);
      if (typeof timer.unref === 'function') timer.unref();
    } catch {
      /* no timers, presence still pruned opportunistically on each track */
    }
    void this.restore();
  }

  /* -------------------------------------------------- public API */

  /** Validate already ran. Never throws — analytics is secondary (§47). */
  track(event: NormalizedEvent): void {
    try {
      this.ingest(event);
    } catch {
      /* swallowed */
    }
  }

  getDeployments(): { id: string; firstSeenAt: number }[] {
    return [...this.deployments.values()]
      .map((d) => ({ id: d.id, firstSeenAt: d.firstSeenAt }))
      .sort((a, b) => b.firstSeenAt - a.firstSeenAt);
  }

  getLive(): LiveSnapshot {
    this.pruneActive(Date.now());
    const bySection = new Map<string, number>();
    const visitors = new Set<string>();
    for (const presence of this.active.values()) {
      visitors.add(presence.visitor);
      if (presence.section && presence.section !== 'other') {
        bySection.set(presence.section, (bySection.get(presence.section) ?? 0) + 1);
      }
    }
    const activeSections = [...bySection.entries()]
      .map(([section, count]) => ({ section, count }))
      .sort((a, b) => b.count - a.count);
    return { online: visitors.size, activeSections };
  }

  getSummary(filters: Partial<SummaryFilters> = {}): Summary {
    const deploymentId = filters.deploymentId ?? currentDeployment().id;
    const dep = this.deployments.get(deploymentId);
    if (!dep) return emptySummary();
    const agg = this.aggregateDays(dep, filters.from, filters.to);
    const frequency = this.frequency();
    return {
      deployment: currentDeployment(),
      retainedDays: dep.days.buckets.size,
      kpis: computeKpis(agg, frequency),
      sections: this.sections(dep, agg, filters.section),
      namespaces: agg.clicksByNamespace.top(12),
      targets: agg.clicksByTarget.top(16),
      countries: agg.countries.top(24),
      devices: agg.devices.top(8),
      browsers: agg.browsers.top(12),
      operatingSystems: agg.oss.top(12),
      referrers: agg.referrers.top(12),
      referrerHosts: agg.referrerHosts.top(12),
      utm: agg.utm.top(12),
      scroll: scrollRows(agg.scroll),
      exits: agg.exitSections.top(12),
      frequency,
      live: this.getLive(),
      timeRange: { from: filters.from ?? null, to: filters.to ?? null },
    };
  }

  getTimeseries(filters: Partial<SeriesFilters> = {}): SeriesPoint[] {
    const deploymentId = filters.deploymentId ?? currentDeployment().id;
    const dep = this.deployments.get(deploymentId);
    if (!dep) return [];
    const from = filters.from ?? 0;
    const to = filters.to ?? Date.now();
    if (filters.granularity === 'hour') {
      return dep.hours
        .list()
        .filter((h) => bucketInRange(h.key, from, to, HOUR_SCALE))
        .map((h) => ({ label: h.key, ...hourPoint(h) }));
    }
    return dep.days
      .list()
      .filter((d) => bucketInRange(d.key, from, to, DAY_SCALE))
      .map((d) => ({ label: d.key, ...dayPoint(d) }));
  }

  /** Non-blocking, concurrency-guarded snapshot write (§14). */
  async flush(): Promise<void> {
    if (this.flushing) return; // bounded: drop a round rather than queueing
    this.flushing = true;
    try {
      await this.store.write(this.serialize());
    } catch {
      /* never fail the request that called us */
    } finally {
      this.flushing = false;
    }
  }

  /* -------------------------------------------------- ingestion */

  private ingest(event: NormalizedEvent): void {
    const now = new Date(event.ts);
    const dep = this.deployment(event.deploymentId);
    const day = dep.days.forDate(now);
    const hour = dep.hours.forDate(now);
    const counters = dep.counters;

    // Unique-visitor stamps — HLL add is cheap and idempotent per visitor.
    counters.sketch.add(event.visitorId);
    day.sketch.add(event.visitorId);
    hour.sketch.add(event.visitorId);

    const session = this.registerSession(event, now);
    if (session.created) {
      day.scalars.sessions += 1;
      if (session.returning) day.scalars.returningSessions += 1;
      hour.sessions += 1;
      counters.sessions += 1;
      if (session.returning) counters.returningSessions += 1;
    }

    switch (event.type) {
      case 'page_view':
        day.scalars.pageViews += 1;
        hour.pageViews += 1;
        break;
      case 'session_end':
        this.finalizeSession(event, day, counters);
        break;
      case 'heartbeat':
        this.active.set(event.sessionId, { visitor: event.visitorId, section: event.section, lastSeen: event.ts });
        break;
      case 'section_enter': {
        const current = this.sessionLru.get(event.sessionId);
        if (current) current.lastSection = event.section;
        this.active.set(event.sessionId, { visitor: event.visitorId, section: event.section, lastSeen: event.ts });
        break;
      }
      case 'section_exit':
        this.active.delete(event.sessionId);
        break;
      case 'section_view':
        this.recordSectionView(dep, day, event);
        break;
      case 'click':
      case 'project_open':
      case 'external_link_click':
        this.recordClick(dep, day, event);
        break;
      case 'resume_download':
        day.scalars.resumeDownloads += 1;
        hour.resumeDownloads += 1;
        break;
      case 'scroll_depth':
        this.recordScroll(dep, day, event);
        break;
      case 'performance':
        this.recordPerformance(dep, day, event.perf);
        break;
      default:
        break;
    }
  }

  private registerSession(event: NormalizedEvent, now: Date): { created: boolean; returning: boolean } {
    let session = this.sessionLru.get(event.sessionId);
    if (session && session.visitor !== event.visitorId) {
      session = undefined; // spoof/invalid pairing → fresh session
    }
    if (!session) {
      const prior = this.visitorLru.get(event.visitorId);
      const returning = prior !== undefined && prior.lastSeen + 2_000 < event.ts;
      this.sessionLru.set(event.sessionId, {
        visitor: event.visitorId,
        deployment: event.deploymentId,
        landing: event.path,
        startedAt: event.ts,
        lastSeen: event.ts,
        maxScroll: 0,
        lastSection: '',
        finalized: false,
      });
      const visitor = prior ?? { sessions: 0, lastSeen: 0, days: new Set<string>() };
      visitor.sessions += 1;
      visitor.lastSeen = event.ts;
      visitor.days.add(dayKeyOf(now));
      this.visitorLru.set(event.visitorId, visitor);
      return { created: true, returning };
    }
    session.lastSeen = event.ts;
    return { created: false, returning: false };
  }

  private finalizeSession(event: NormalizedEvent, day: DayBucket, counters: DeploymentCounters): void {
    const session = this.sessionLru.get(event.sessionId);
    if (session && session.finalized) return;
    if (session) session.finalized = true;
    this.active.delete(event.sessionId);
    if (session && session.lastSection && session.lastSection !== 'other') {
      day.exitSections.incr(session.lastSection);
      counters.exitSections.incr(session.lastSection);
    }
    const duration = Math.max(0, event.duration);
    if (duration > 0) {
      day.scalars.totalSessionDurMs += duration;
      day.scalars.sessionDurSamples += 1;
      counters.totalSessionDurMs += duration;
      counters.sessionDurSamples += 1;
    }
  }

  private recordSectionView(dep: DeploymentMetrics, day: DayBucket, event: NormalizedEvent): void {
    const section = event.section;
    const duration = Math.max(0, event.duration);
    day.sectionViews.incr(section);
    day.sectionDurationMs.incr(section, duration);
    dep.sectionUnique.for(section).add(event.visitorId);
    dep.sectionMedian.add(section, duration);
  }

  private recordClick(dep: DeploymentMetrics, day: DayBucket, event: NormalizedEvent): void {
    const namespace = event.namespace || 'other';
    const target = event.target || 'other';
    day.scalars.clicks += 1;
    day.clicksByNamespace.incr(namespace);
    day.clicksByTarget.incr(target);
    dep.counters.clicksByNamespace.incr(namespace);
    dep.counters.clicksByTarget.incr(target);
  }

  private recordScroll(dep: DeploymentMetrics, day: DayBucket, event: NormalizedEvent): void {
    const session = this.sessionLru.get(event.sessionId);
    const scroll = event.scroll;
    if (!session || scroll <= session.maxScroll) return;
    for (let i = 0; i < SCROLL_BUCKETS.length; i += 1) {
      const threshold = SCROLL_BUCKETS[i]!;
      if (threshold > session.maxScroll && threshold <= scroll) {
        day.scroll[i] = (day.scroll[i] ?? 0) + 1;
      } else if (threshold > scroll) {
        break;
      }
    }
    session.maxScroll = scroll;
  }

  private recordPerformance(dep: DeploymentMetrics, day: DayBucket, perf: PerfValues): void {
    const apply = (key: keyof PerfAccumulator, value: number | undefined) => {
      if (value === undefined) return;
      const accumulator = day.perf[key];
      if (accumulator) {
        accumulator[0] += 1;
        accumulator[1] += value;
      }
    };
    apply('ttfb', perf.ttfb);
    apply('fcp', perf.fcp);
    apply('lcp', perf.lcp);
    apply('cls', perf.cls);
    apply('inp', perf.inp);
  }

  private pruneActive(now: number): void {
    for (const [sid, presence] of this.active) {
      if (now - presence.lastSeen > HEARTBEAT_TTL_MS) this.active.delete(sid);
    }
  }

  /* ------------------------------------------------ read aggregation */

  private deployment(id: string): DeploymentMetrics {
    const existing = this.deployments.get(id);
    if (existing) return existing;
    this.pruneDeployments();
    const created: DeploymentMetrics = {
      id,
      firstSeenAt: Date.now(),
      days: new DayRing(),
      hours: new HourRing(),
      sectionUnique: new SectionSketches(DIMENSION_CAPS.sections),
      sectionMedian: new SectionHistograms(3000),
      counters: createDeploymentCounters(),
    };
    this.deployments.set(id, created);
    return created;
  }

  /** Bounded deployment registry: evict the oldest beyond the cap. */
  private pruneDeployments(): void {
    while (this.deployments.size >= DIMENSION_CAPS.deployments) {
      const oldest = this.deployments.keys().next();
      if (oldest.done) break;
      this.deployments.delete(oldest.value);
    }
  }

  private aggregateDays(dep: DeploymentMetrics, from?: number, to?: number): DayAggregate {
    const agg = new DayAggregate();
    for (const day of dep.days.list()) {
      const start = Date.parse(`${day.key}T00:00:00Z`);
      if (Number.isNaN(start)) continue;
      if (from !== undefined && start < from - DAY_SCALE) continue;
      if (to !== undefined && start > to) continue;
      agg.addDay(day);
    }
    return agg;
  }

  private sections(dep: DeploymentMetrics, agg: DayAggregate, filterSection?: string): SectionRow[] {
    const rows: SectionRow[] = [];
    for (const [section, views] of agg.sectionViews) {
      if (filterSection && section !== filterSection) continue;
      const totalMs = agg.sectionDurationMs.get(section) ?? 0;
      rows.push({
        section,
        views,
        unique: dep.sectionUnique.estimate(section),
        avgMs: views > 0 ? Math.round(totalMs / views) : 0,
        medianMs: dep.sectionMedian.medianMs(section) ?? 0,
        totalMs,
      });
    }
    rows.sort((a, b) => b.views - a.views);
    return rows;
  }

  private frequency(): FrequencySummary {
    const snapshots: { sessions: number; days: Set<string> }[] = [];
    for (const visitor of this.visitorLru.values()) {
      snapshots.push({ sessions: visitor.sessions, days: visitor.days });
    }
    return frequencySummary(snapshots);
  }

  /* ---------------------------------------------------- persistence */

  private async restore(): Promise<void> {
    if (this.restored) return;
    try {
      const snapshot = await this.store.read();
      if (snapshot) this.applySnapshot(snapshot);
    } catch {
      /* restore must never throw */
    } finally {
      this.restored = true;
    }
  }

  private serialize(): SerializedSnapshot {
    return {
      schema: 1,
      writtenAt: Date.now(),
      deployments: [...this.deployments.values()].map((dep) => ({
        id: dep.id,
        firstSeenAt: dep.firstSeenAt,
        days: dep.days.list().map((day) => serializeDay(day)),
      })),
    };
  }

  private applySnapshot(snapshot: SerializedSnapshot): void {
    for (const row of snapshot.deployments) {
      const dep = this.deployment(row.id);
      dep.firstSeenAt = row.firstSeenAt;
      for (const day of row.days) {
        const bucket = dep.days.forDate(new Date(`${day.key}T00:00:00Z`));
        applySerializedDay(bucket, day);
      }
    }
  }
}

/* ================================================================== */
/*                        aggregate read model                         */
/* ================================================================== */

/** Rolling cross-day aggregate used by summary reads (always bounded). */
class DayAggregate {
  scalars: BucketScalars = zeroBucketScalars();
  sectionViews = new Map<string, number>();
  sectionDurationMs = new Map<string, number>();
  clicksByNamespace = new CapMap(DIMENSION_CAPS.namespaces);
  clicksByTarget = new CapMap(DIMENSION_CAPS.targets);
  exitSections = new CapMap(DIMENSION_CAPS.sections);
  countries = new CapMap(DIMENSION_CAPS.countries);
  devices = new CapMap(DIMENSION_CAPS.devices);
  browsers = new CapMap(DIMENSION_CAPS.browsers);
  oss = new CapMap(DIMENSION_CAPS.operatingSystems);
  referrers = new CapMap(12);
  referrerHosts = new CapMap(DIMENSION_CAPS.referrerHosts);
  utm = new CapMap(DIMENSION_CAPS.utmSources);
  scroll: number[] = Array.from({ length: SCROLL_BUCKETS.length }, () => 0);
  perf: PerfAccumulator = zeroPerf();
  sketches: Hll[] = [];

  addDay(day: DayBucket): void {
    const s = this.scalars;
    const d = day.scalars;
    s.pageViews += d.pageViews;
    s.sessions += d.sessions;
    s.returningSessions += d.returningSessions;
    s.clicks += d.clicks;
    s.resumeDownloads += d.resumeDownloads;
    s.totalSessionDurMs += d.totalSessionDurMs;
    s.sessionDurSamples += d.sessionDurSamples;
    mergeMap(this.sectionViews, day.sectionViews.entries());
    mergeMap(this.sectionDurationMs, day.sectionDurationMs.entries());
    sumCapMap(this.clicksByNamespace, day.clicksByNamespace);
    sumCapMap(this.clicksByTarget, day.clicksByTarget);
    sumCapMap(this.exitSections, day.exitSections);
    sumCapMap(this.countries, day.countries);
    sumCapMap(this.devices, day.devices);
    sumCapMap(this.browsers, day.browsers);
    sumCapMap(this.oss, day.oss);
    sumCapMap(this.referrers, day.referrers);
    sumCapMap(this.referrerHosts, day.referrerHosts);
    sumCapMap(this.utm, day.utm);
    for (let i = 0; i < SCROLL_BUCKETS.length; i += 1) this.scroll[i]! += day.scroll[i]!;
    const perfKeys: (keyof PerfAccumulator)[] = ['ttfb', 'fcp', 'lcp', 'cls', 'inp'];
    for (const key of perfKeys) {
      this.perf[key][0] += day.perf[key][0];
      this.perf[key][1] += day.perf[key][1];
    }
    this.sketches.push(day.sketch);
  }
}

function mergeMap(target: Map<string, number>, entries: [string, number][]): void {
  for (const [key, value] of entries) {
    target.set(key, (target.get(key) ?? 0) + value);
  }
}

function sumCapMap(target: CapMap, source: CapMap): void {
  for (const [key, value] of source.entries()) target.incr(key, value);
}

function computeKpis(agg: DayAggregate, frequency: FrequencySummary): Kpis {
  const s = agg.scalars;
  const uniqueVisitors = mergeHlls(agg.sketches).estimate();
  return {
    uniqueVisitors,
    sessions: s.sessions,
    newSessions: Math.max(0, s.sessions - s.returningSessions),
    returningSessions: s.returningSessions,
    pageViews: s.pageViews,
    clicks: s.clicks,
    sectionViews: sumMapValues(agg.sectionViews),
    resumeDownloads: s.resumeDownloads,
    avgSessionDurationMs: averageSessionDurationMs(s.totalSessionDurMs, s.sessionDurSamples),
    avgVisitsPerVisitor: frequency.averageVisitsPerVisitor,
    avgDailyAppearances: frequency.averageDailyAppearances,
    avgWeeklyAppearances: frequency.averageWeeklyAppearances,
    returningPercent: returningPercent(s.returningSessions, s.sessions),
  };
}

function sumMapValues(map: Map<string, number>): number {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}

function scrollRows(scroll: number[]): { bucket: number; count: number }[] {
  return SCROLL_BUCKETS.map((bucket, i) => ({ bucket, count: scroll[i] ?? 0 }));
}

/* ------------------------------------------------- serialization */

function serializeDay(day: DayBucket): SerializedDay {
  return {
    key: day.key,
    scalars: bucketScalarsToRecord(day.scalars),
    sectionViews: day.sectionViews.entries(),
    sectionDurationMs: day.sectionDurationMs.entries(),
    clicksByNamespace: day.clicksByNamespace.entries(),
    clicksByTarget: day.clicksByTarget.entries(),
    scroll: [...day.scroll],
    exitSections: day.exitSections.entries(),
    countries: day.countries.entries(),
    devices: day.devices.entries(),
    browsers: day.browsers.entries(),
    oss: day.oss.entries(),
    referrers: day.referrers.entries(),
    referrerHosts: day.referrerHosts.entries(),
    utm: day.utm.entries(),
    perf: {
      ttfb: [...day.perf.ttfb],
      fcp: [...day.perf.fcp],
      lcp: [...day.perf.lcp],
      cls: [...day.perf.cls],
      inp: [...day.perf.inp],
    },
    sketch: Array.from(day.sketch.toJSON()),
  };
}

function bucketScalarsToRecord(s: BucketScalars): Record<string, number> {
  return {
    pageViews: s.pageViews,
    sessions: s.sessions,
    returningSessions: s.returningSessions,
    clicks: s.clicks,
    resumeDownloads: s.resumeDownloads,
    totalSessionDurMs: s.totalSessionDurMs,
    sessionDurSamples: s.sessionDurSamples,
  };
}

function applySerializedDay(bucket: DayBucket, day: SerializedDay): void {
  const s = bucket.scalars;
  const rec = day.scalars;
  s.pageViews = rec.pageViews ?? 0;
  s.sessions = rec.sessions ?? 0;
  s.returningSessions = rec.returningSessions ?? 0;
  s.clicks = rec.clicks ?? 0;
  s.resumeDownloads = rec.resumeDownloads ?? 0;
  s.totalSessionDurMs = rec.totalSessionDurMs ?? 0;
  s.sessionDurSamples = rec.sessionDurSamples ?? 0;
  bucket.sectionViews.load(day.sectionViews);
  bucket.sectionDurationMs.load(day.sectionDurationMs);
  bucket.clicksByNamespace.load(day.clicksByNamespace);
  bucket.clicksByTarget.load(day.clicksByTarget);
  bucket.scroll = [...day.scroll];
  bucket.exitSections.load(day.exitSections);
  bucket.countries.load(day.countries);
  bucket.devices.load(day.devices);
  bucket.browsers.load(day.browsers);
  bucket.oss.load(day.oss);
  bucket.referrers.load(day.referrers);
  bucket.referrerHosts.load(day.referrerHosts);
  bucket.utm.load(day.utm);
  const perfKeys: (keyof PerfAccumulator)[] = ['ttfb', 'fcp', 'lcp', 'cls', 'inp'];
  for (const key of perfKeys) {
    const entry = day.perf[key];
    if (entry) bucket.perf[key] = [entry[0] ?? 0, entry[1] ?? 0];
  }
  const registers = new Uint8Array(day.sketch);
  bucket.sketch = new Hll(registers);
}

/* ------------------------------------------------------- helpers */

const DAY_SCALE = 86_400_000;
const HOUR_SCALE = 3_600_000;

function bucketInRange(key: string, from: number, to: number, scale: number): boolean {
  const start = Date.parse(key);
  return !Number.isNaN(start) && start <= to && start + scale > from;
}

function dayKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayPoint(d: DayBucket): Omit<SeriesPoint, 'label'> {
  const s = d.scalars;
  return {
    sessions: s.sessions,
    pageViews: s.pageViews,
    clicks: s.clicks,
    resumeDownloads: s.resumeDownloads,
    visitors: d.sketch.estimate(),
    returning: s.returningSessions,
    avgSessionDurationMs: s.sessionDurSamples > 0 ? Math.round(s.totalSessionDurMs / s.sessionDurSamples) : 0,
  };
}

function hourPoint(h: HourBucket): Omit<SeriesPoint, 'label'> {
  return {
    sessions: h.sessions,
    pageViews: h.pageViews,
    clicks: h.clicks,
    resumeDownloads: h.resumeDownloads,
    visitors: h.sketch.estimate(),
    returning: 0,
    avgSessionDurationMs: h.sessionDurSamples > 0 ? Math.round(h.totalSessionDurMs / h.sessionDurSamples) : 0,
  };
}

/* ------------------------------------------------------ public DTOs */

export interface SummaryFilters {
  deploymentId?: string;
  from?: number;
  to?: number;
  section?: string;
  country?: string;
  device?: string;
  browser?: string;
  os?: string;
  referrer?: string;
}

export interface SeriesFilters {
  deploymentId?: string;
  from?: number;
  to?: number;
  granularity?: 'hour' | 'day';
}

export interface SeriesPoint {
  label: string;
  sessions: number;
  visitors: number;
  pageViews: number;
  clicks: number;
  resumeDownloads: number;
  returning: number;
  avgSessionDurationMs: number;
}

export interface SectionRow {
  section: string;
  views: number;
  unique: number;
  avgMs: number;
  medianMs: number;
  totalMs: number;
}

export interface Kpis {
  uniqueVisitors: number;
  sessions: number;
  newSessions: number;
  returningSessions: number;
  pageViews: number;
  clicks: number;
  sectionViews: number;
  resumeDownloads: number;
  avgSessionDurationMs: number;
  avgVisitsPerVisitor: number;
  avgDailyAppearances: number;
  avgWeeklyAppearances: number;
  returningPercent: number;
}

export interface LiveSnapshot {
  online: number;
  activeSections: { section: string; count: number }[];
}

export interface Summary {
  deployment: DeploymentInfo;
  retainedDays: number;
  kpis: Kpis;
  sections: SectionRow[];
  namespaces: { key: string; value: number }[];
  targets: { key: string; value: number }[];
  countries: { key: string; value: number }[];
  devices: { key: string; value: number }[];
  browsers: { key: string; value: number }[];
  operatingSystems: { key: string; value: number }[];
  referrers: { key: string; value: number }[];
  referrerHosts: { key: string; value: number }[];
  utm: { key: string; value: number }[];
  scroll: { bucket: number; count: number }[];
  exits: { key: string; value: number }[];
  frequency: FrequencySummary;
  live: LiveSnapshot;
  timeRange: { from: number | null; to: number | null };
}

function emptySummary(): Summary {
  return {
    deployment: currentDeployment(),
    retainedDays: 0,
    kpis: {
      uniqueVisitors: 0,
      sessions: 0,
      newSessions: 0,
      returningSessions: 0,
      pageViews: 0,
      clicks: 0,
      sectionViews: 0,
      resumeDownloads: 0,
      avgSessionDurationMs: 0,
      avgVisitsPerVisitor: 0,
      avgDailyAppearances: 0,
      avgWeeklyAppearances: 0,
      returningPercent: 0,
    },
    sections: [],
    namespaces: [],
    targets: [],
    countries: [],
    devices: [],
    browsers: [],
    operatingSystems: [],
    referrers: [],
    referrerHosts: [],
    utm: [],
    scroll: scrollRows(Array.from({ length: SCROLL_BUCKETS.length }, () => 0)),
    exits: [],
    frequency: { count: 0, averageVisitsPerVisitor: 0, averageDailyAppearances: 0, averageWeeklyAppearances: 0, distribution: [0, 0, 0, 0, 0] },
    live: { online: 0, activeSections: [] },
    timeRange: { from: null, to: null },
  };
}

/* ================================================================== */
/*                     singleton (process-local)                       */
/* ================================================================== */

declare global {
  // eslint-disable-next-line no-var
  var __analyticsManager__: AnalyticsManager | undefined;
}

export function getAnalyticsManager(): AnalyticsManager {
  if (!globalThis.__analyticsManager__) {
    globalThis.__analyticsManager__ = new AnalyticsManager({
      snapshotIntervalMs: Number(process.env.ANALYTICS_SNAPSHOT_INTERVAL ?? 0),
    });
  }
  return globalThis.__analyticsManager__;
}

/** Test hook: replace the singleton with a fresh manager. */
export function __resetAnalyticsManager(manager?: AnalyticsManager): AnalyticsManager {
  const reset = manager ?? new AnalyticsManager();
  globalThis.__analyticsManager__ = reset;
  return reset;
}

export const _retainedDays = DAY_BUCKETS;
export { SCROLL_BUCKETS }; // re-exported for tests/consumers