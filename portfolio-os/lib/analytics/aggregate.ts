/**
 * lib/analytics/aggregate.ts
 *
 * The bounded counter structures behind the singleton (§4, §5, §51). The only
 * collections are fixed-cap buckets (day ring, hour ring), fixed-cap CounterMaps
 * and fixed-size HyperLogLog sketches. There are no arrays, maps or sets that
 * grow with traffic.
 */
import { CapMap } from './registry';
import { Hll } from './sketch';
import {
  DAY_BUCKETS,
  HOUR_BUCKETS,
  SCROLL_BUCKETS,
  EVENT_TYPES,
  type EventType,
} from './shared';
import { DURATION_HIST_BINS } from './shared';

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function hourKey(date: Date): string {
  return date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

export interface ScalarCounters {
  pageViews: number;
  sessions: number;
  returningSessions: number;
  clicks: number;
  resumeDownloads: number;
  github: number;
  linkedin: number;
  email: number;
  contact: number;
  projectOpens: number;
  researchPaper: number;
  externalLinks: number;
}

export const zeroScalars = (): ScalarCounters => ({
  pageViews: 0,
  sessions: 0,
  returningSessions: 0,
  clicks: 0,
  resumeDownloads: 0,
  github: 0,
  linkedin: 0,
  email: 0,
  contact: 0,
  projectOpens: 0,
  researchPaper: 0,
  externalLinks: 0,
});

export interface BucketScalars extends ScalarCounters {
  totalSessionDurMs: number;
  sessionDurSamples: number;
}

export const zeroBucketScalars = (): BucketScalars => ({
  ...zeroScalars(),
  totalSessionDurMs: 0,
  sessionDurSamples: 0,
});

export interface PerfAccumulator {
  ttfb: [number, number]; // [samples, sum]
  fcp: [number, number];
  lcp: [number, number];
  cls: [number, number];
  inp: [number, number];
}

export const zeroPerf = (): PerfAccumulator => ({
  ttfb: [0, 0],
  fcp: [0, 0],
  lcp: [0, 0],
  cls: [0, 0],
  inp: [0, 0],
});

export interface DayBucket {
  key: string;
  scalars: BucketScalars;
  sectionViews: CapMap;
  sectionDurationMs: CapMap;
  clicksByNamespace: CapMap;
  clicksByTarget: CapMap;
  scroll: number[];
  exitSections: CapMap;
  countries: CapMap;
  devices: CapMap;
  browsers: CapMap;
  oss: CapMap;
  referrers: CapMap;
  referrerHosts: CapMap;
  utm: CapMap;
  perf: PerfAccumulator;
  /** Unique visitors for that day (bounded sketch). */
  sketch: Hll;
}

const SCALAR_KEYS = [
  'pageViews',
  'sessions',
  'returningSessions',
  'clicks',
  'resumeDownloads',
  'github',
  'linkedin',
  'email',
  'contact',
  'projectOpens',
  'researchPaper',
  'externalLinks',
] as const;

const PERF_KEYS: (keyof PerfAccumulator)[] = ['ttfb', 'fcp', 'lcp', 'cls', 'inp'];

export function createDayBucket(key: string): DayBucket {
  return {
    key,
    scalars: zeroBucketScalars(),
    sectionViews: new CapMap(4096),
    sectionDurationMs: new CapMap(4096),
    clicksByNamespace: new CapMap(64),
    clicksByTarget: new CapMap(512),
    scroll: Array.from({ length: SCROLL_BUCKETS.length }, () => 0),
    exitSections: new CapMap(4096),
    countries: new CapMap(320),
    devices: new CapMap(8),
    browsers: new CapMap(32),
    oss: new CapMap(32),
    referrers: new CapMap(12),
    referrerHosts: new CapMap(64),
    utm: new CapMap(64),
    perf: zeroPerf(),
    sketch: new Hll(),
  };
}

export interface HourBucket {
  key: string;
  pageViews: number;
  sessions: number;
  clicks: number;
  resumeDownloads: number;
  totalSessionDurMs: number;
  sessionDurSamples: number;
  sectionViews: CapMap;
  clicksByNamespace: CapMap;
  countries: CapMap;
  sketch: Hll;
}

export function createHourBucket(key: string): HourBucket {
  return {
    key,
    pageViews: 0,
    sessions: 0,
    clicks: 0,
    resumeDownloads: 0,
    totalSessionDurMs: 0,
    sessionDurSamples: 0,
    sectionViews: new CapMap(4096),
    clicksByNamespace: new CapMap(64),
    countries: new CapMap(320),
    sketch: new Hll(),
  };
}

/** A bounded collection of day buckets (worst case: DAY_BUCKETS entries). */
export class DayRing {
  readonly buckets = new Map<string, DayBucket>();

  private evict(): void {
    while (this.buckets.size > DAY_BUCKETS) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) break;
      this.buckets.delete(oldest.value);
    }
  }

  forDate(date: Date): DayBucket {
    const key = dayKey(date);
    const existing = this.buckets.get(key);
    if (existing) return existing;
    const bucket = createDayBucket(key);
    this.buckets.set(key, bucket);
    this.evict();
    return bucket;
  }

  list(): DayBucket[] {
    return [...this.buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
}

/** A bounded collection of hour buckets (worst case: HOUR_BUCKETS entries). */
export class HourRing {
  readonly buckets = new Map<string, HourBucket>();

  private evict(): void {
    while (this.buckets.size > HOUR_BUCKETS) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) break;
      this.buckets.delete(oldest.value);
    }
  }

  forDate(date: Date): HourBucket {
    const key = hourKey(date);
    const existing = this.buckets.get(key);
    if (existing) return existing;
    const bucket = createHourBucket(key);
    this.buckets.set(key, bucket);
    this.evict();
    return bucket;
  }

  list(): HourBucket[] {
    return [...this.buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
}

/** A capped map from section → duration histogram for approx. median. */
export class SectionHistograms {
  private hist = new Map<string, number[]>();
  private cap: number;

  constructor(cap = 3000) {
    this.cap = cap;
  }

  add(section: string, durationMs: number): void {
    const seconds = durationMs / 1000;
    let bin = 0;
    for (let i = 0; i < DURATION_HIST_BINS.length; i += 1) {
      if (seconds < DURATION_HIST_BINS[i]!) break;
      bin = i;
    }
    let arr = this.hist.get(section);
    if (!arr) {
      if (this.hist.size >= this.cap) {
        const oldest = this.hist.keys().next();
        if (!oldest.done) this.hist.delete(oldest.value);
      }
      arr = Array.from({ length: DURATION_HIST_BINS.length }, () => 0);
      this.hist.set(section, arr);
    }
    arr[bin] = (arr[bin] ?? 0) + 1;
  }

  medianMs(section: string): number | null {
    const arr = this.hist.get(section);
    if (!arr) return null;
    const total = arr.reduce((acc, n) => acc + n, 0);
    if (total === 0) return null;
    const halfway = total / 2;
    let acc = 0;
    for (let i = 0; i < arr.length; i += 1) {
      acc += arr[i] ?? 0;
      if (acc >= halfway) {
        const upper = DURATION_HIST_BINS[i]! * 1000;
        const lower = i === 0 ? 0 : DURATION_HIST_BINS[i - 1]! * 1000;
        return Math.round((lower + upper) / 2);
      }
    }
    return null;
  }

  size(): number {
    return this.hist.size;
  }
}

/** A capped map section → HyperLogLog for unique visitors per section. */
export class SectionSketches {
  private sketches = new Map<string, Hll>();
  private cap: number;

  constructor(cap = 1024) {
    this.cap = cap;
  }

  for(section: string): Hll {
    const existing = this.sketches.get(section);
    if (existing) return existing;
    if (this.sketches.size >= this.cap) {
      const oldest = this.sketches.keys().next();
      if (!oldest.done) this.sketches.delete(oldest.value);
    }
    const sketch = new Hll();
    this.sketches.set(section, sketch);
    return sketch;
  }

  estimate(section: string): number {
    return this.sketches.get(section)?.estimate() ?? 0;
  }

  size(): number {
    return this.sketches.size;
  }
}

export { SCROLL_BUCKETS, EVENT_TYPES, SCALAR_KEYS, PERF_KEYS, DURATION_HIST_BINS };

/** Increment a scalar counter by type (shared by buckets). */
export function bumpScalar(scalars: ScalarCounters, type: EventType): void {
  switch (type) {
    case 'page_view':
      scalars.pageViews += 1;
      break;
    case 'resume_download':
      scalars.resumeDownloads += 1;
      break;
    case 'click':
      scalars.clicks += 1;
      break;
    case 'project_open':
      scalars.projectOpens += 1;
      scalarClick(scalars);
      break;
    case 'external_link_click':
      scalars.externalLinks += 1;
      scalarClick(scalars);
      break;
    default:
      break;
  }
}

function scalarClick(scalars: ScalarCounters): void {
  scalars.clicks += 1;
}

export function bumpSpecific(scalars: ScalarCounters, namespace: string, target: string): void {
  const id = `${namespace}:${target}`.toLowerCase();
  if (id.includes('github')) scalars.github += 1;
  else if (id.includes('linkedin')) scalars.linkedin += 1;
  else if (id.includes(':email') || id === 'contact:email') scalars.email += 1;
  else if (namespace === 'contact') scalars.contact += 1;
  else if (target.includes('paper') || namespace === 'research') scalars.researchPaper += 1;
}