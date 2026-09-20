/**
 * lib/analytics/client.ts
 *
 * Lightweight, zero-dependency first-party client analytics engine (§42, §44, §45).
 * - Anonymous UUID in localStorage for visitor ID (refresh-safe).
 * - Session ID in sessionStorage with 30-min inactivity timeout.
 * - Non-blocking event buffering with periodic flush and sendBeacon on exit.
 */
import {
  VISITOR_KEY,
  SESSION_KEY,
  SESSION_TIMEOUT_MS,
  type EventType,
} from './shared';
import type { WireEvent, PerfValues } from './events';

const LAST_ACTIVE_KEY = 'portfolio_analytics:last_active';
const BATCH_INTERVAL_MS = 3000;
const MAX_QUEUE_SIZE = 10;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ClientTracker {
  private visitorId: string = '';
  private sessionId: string = '';
  private deploymentId: string = '';
  private queue: WireEvent[] = [];
  private timer: number | null = null;
  private initialized = false;
  private currentPath = '/';
  private currentSection = '';
  private sessionStarted = false;
  private sessionStartTime = Date.now();

  init(options: { deploymentId?: string } = {}): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;
    this.deploymentId = options.deploymentId || (process.env.NEXT_PUBLIC_DEPLOYMENT_ID ?? 'dev');
    this.currentPath = window.location.pathname;

    this.resolveVisitorId();
    this.resolveSessionId();

    // Start batch flush timer
    this.timer = window.setInterval(() => this.flush(), BATCH_INTERVAL_MS);

    // Register visibility and unload listeners for reliable delivery (§44)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush(true);
      } else {
        this.resolveSessionId(); // check timeout
      }
    });

    window.addEventListener('pagehide', () => this.flush(true));
    window.addEventListener('beforeunload', () => this.flush(true));
  }

  private resolveVisitorId(): string {
    try {
      let vid = localStorage.getItem(VISITOR_KEY);
      if (!vid) {
        vid = generateUUID();
        localStorage.setItem(VISITOR_KEY, vid);
      }
      this.visitorId = vid;
      return vid;
    } catch {
      if (!this.visitorId) this.visitorId = generateUUID();
      return this.visitorId;
    }
  }

  private resolveSessionId(): string {
    const now = Date.now();
    try {
      let sid = sessionStorage.getItem(SESSION_KEY);
      const lastActive = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) ?? 0);

      if (!sid || (lastActive > 0 && now - lastActive > SESSION_TIMEOUT_MS)) {
        sid = generateUUID();
        sessionStorage.setItem(SESSION_KEY, sid);
        this.sessionStartTime = now;
        this.sessionStarted = true;
        this.enqueue({
          t: 'session_start',
          ts: now,
          p: this.currentPath,
          r: document.referrer || undefined,
        });
      }

      sessionStorage.setItem(LAST_ACTIVE_KEY, String(now));
      this.sessionId = sid;
      return sid;
    } catch {
      if (!this.sessionId) this.sessionId = generateUUID();
      return this.sessionId;
    }
  }

  private enqueue(partial: Omit<WireEvent, 'v' | 's' | 'd' | 'p'> & { p?: string }): void {
    if (!this.initialized) this.init();
    try {
      sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    } catch {}

    const wire: WireEvent = {
      v: this.visitorId || this.resolveVisitorId(),
      s: this.sessionId || this.resolveSessionId(),
      d: this.deploymentId,
      ...partial,
      p: partial.p ?? this.currentPath,
    };

    this.queue.push(wire);
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  flush(isExiting = false): void {
    if (this.queue.length === 0) return;
    const batch = [...this.queue];
    this.queue = [];

    const payload = JSON.stringify(batch);

    if (isExiting && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/analytics/collect', blob);
      if (sent) return;
    }

    try {
      void fetch('/api/analytics/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Analytics failures are non-fatal (§47)
      });
    } catch {
      /* ignore */
    }
  }

  pageView(path: string, referrer?: string): void {
    this.currentPath = path;
    this.enqueue({
      t: 'page_view',
      ts: Date.now(),
      p: path,
      r: referrer || (typeof document !== 'undefined' ? document.referrer : undefined),
    });
  }

  click(target: string, namespace: string = 'other', section?: string): void {
    this.enqueue({
      t: 'click',
      ts: Date.now(),
      tgt: target,
      ns: namespace,
      sec: section || this.currentSection || undefined,
    });
  }

  resumeDownload(target: string = 'resume.pdf'): void {
    this.enqueue({
      t: 'resume_download',
      ts: Date.now(),
      tgt: target,
      ns: 'download',
      sec: this.currentSection || undefined,
    });
  }

  sectionEnter(section: string): void {
    this.currentSection = section;
    this.enqueue({
      t: 'section_enter',
      ts: Date.now(),
      sec: section,
    });
  }

  sectionExit(section: string, durationMs: number): void {
    this.enqueue({
      t: 'section_exit',
      ts: Date.now(),
      sec: section,
      dur: Math.round(durationMs),
    });
  }

  sectionView(section: string, durationMs: number): void {
    this.currentSection = section;
    this.enqueue({
      t: 'section_view',
      ts: Date.now(),
      sec: section,
      dur: Math.round(durationMs),
    });
  }

  scrollDepth(depthPercent: number): void {
    this.enqueue({
      t: 'scroll_depth',
      ts: Date.now(),
      sc: Math.min(100, Math.max(0, Math.round(depthPercent))),
      sec: this.currentSection || undefined,
    });
  }

  performance(perf: PerfValues): void {
    this.enqueue({
      t: 'performance',
      ts: Date.now(),
      perf,
    });
  }

  heartbeat(section?: string): void {
    if (!this.visitorId || !this.sessionId) return;
    const sec = section || this.currentSection || undefined;
    try {
      void fetch('/api/analytics/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          v: this.visitorId,
          s: this.sessionId,
          sec,
          p: this.currentPath,
          d: this.deploymentId,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }
}

// Global browser instance
let trackerInstance: ClientTracker | null = null;

export function getClientTracker(): ClientTracker {
  if (!trackerInstance) {
    trackerInstance = new ClientTracker();
  }
  return trackerInstance;
}
