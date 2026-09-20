/**
 * lib/analytics/shared.ts
 *
 * Constants and tiny pure helpers shared by the server (validation, aggregation)
 * and the browser (client.ts). Nothing in here touches Node or DOM globals so it
 * can be imported from both sides.
 */

export const ANALYTICS_KEY_PREFIX = 'portfolio_analytics:';
export const VISITOR_KEY = `${ANALYTICS_KEY_PREFIX}vid`;
export const SESSION_KEY = `${ANALYTICS_KEY_PREFIX}sid`;

/** Naming that mirrors the POST body keys in events.ts (short for payload weight). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EVENT_TYPES = [
  'page_view',
  'session_start',
  'session_end',
  'section_enter',
  'section_exit',
  'section_view',
  'click',
  'project_open',
  'external_link_click',
  'resume_download',
  'scroll_depth',
  'heartbeat',
  'performance',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Memory bounds (§5, §51). Every dimension that could be driven by traffic or by
 * client input is capped here; beyond a cap the value collapses to a bucket such
 * as 'other' so the number of in-memory structures never grows with traffic.
 */
export const DIMENSION_CAPS = {
  sections: 4096,
  targets: 512,
  namespaces: 64,
  countries: 320,
  browsers: 32,
  operatingSystems: 32,
  devices: 8,
  referrerHosts: 64,
  utmSources: 64,
  deployments: 8,
} as const;

/** Devices we bucket everything into. */
export const DEVICES = ['desktop', 'mobile', 'tablet', 'other'] as const;
export type Device = (typeof DEVICES)[number];

/** Scroll depth buckets, in percent. The last one is the session maximum. */
export const SCROLL_BUCKETS = [25, 50, 75, 90, 100] as const;

/** Session inactivity timeout (ms). Configurable, 30 minutes by default. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Heartbeat TTL for the real-time presence set (ms). */
export const HEARTBEAT_TTL_MS = 35 * 1000;

/** Heartbeat frequency sent by the browser (ms). */
export const HEARTBEAT_INTERVAL_MS = 25 * 1000;

/** Client batching: flush after N queued events or T seconds, whichever first. */
export const CLIENT_BATCH_LIMIT = 20;
export const CLIENT_BATCH_INTERVAL_MS = 10 * 1000;

/** Per-request ingestion caps (payload body in bytes, events per body). */
export const MAX_BODY_BYTES = 10 * 1024;
export const MAX_EVENTS_PER_REQUEST = 20;

/** Bounded in-memory LRU caps. */
export const VISITOR_LRU_CAP = 8192;
export const SESSION_LRU_CAP = 4096;
export const SECTION_SKETCH_CAP = 1024;

/** Retention windows for the ring structures. */
export const HOUR_BUCKETS = 24 * 7; // last 7 days of hourly buckets
export const DAY_BUCKETS = 90; // last 90 daily buckets

/** Duration histogram bins (seconds) per section, capped → approx median. */
export const DURATION_HIST_BINS = [2, 5, 15, 30, 60, 120, 240, 600] as const;

export type ReferrerCategory =
  | 'direct'
  | 'search'
  | 'github'
  | 'linkedin'
  | 'social'
  | 'other';

const SEARCH_HOSTS = ['google', 'bing', 'duckduckgo', 'yahoo', 'baidu', 'brave', 'ecosia'];
const SOCIAL_HOSTS = ['facebook', 'x.com', 'twitter', 'instagram', 'reddit', 'youtube', 'tiktok', 'whatsapp', 'linkedin'];

/** Pure, dependency-free referrer bucketing. `sameOrigin` suppresses direct->self. */
export function categorizeReferrer(referrer: string | undefined | null, sameOrigin: string | null = null): {
  category: ReferrerCategory;
  host: string;
} {
  if (!referrer) return { category: 'direct', host: 'direct' };
  let parsed: URL;
  try {
    parsed = new URL(referrer);
  } catch {
    return { category: 'other', host: 'other' };
  }
  if (sameOrigin && parsed.hostname === sameOrigin) return { category: 'direct', host: 'direct' };
  const host = parsed.hostname.replace(/^www\./, '');
  const lowered = host.toLowerCase();
  if (SEARCH_HOSTS.some((s) => lowered.includes(s))) return { category: 'search', host };
  if (lowered === 'github.com' || lowered.endsWith('.github.com')) return { category: 'github', host };
  if (lowered.includes('linkedin')) return { category: 'linkedin', host };
  if (SOCIAL_HOSTS.some((s) => lowered.includes(s))) return { category: 'social', host };
  return { category: 'other', host };
}

/** Map an event type to the namespace used for "clicked namespaces". */
export function namespaceForType(type: EventType): string {
  switch (type) {
    case 'project_open':
      return 'project';
    case 'resume_download':
      return 'identity';
    case 'external_link_click':
      return 'external';
    case 'click':
      return 'interaction';
    default:
      return type;
  }
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Truncate + sanitise arbitrary strings before they become map keys. */
export function sanitizeKey(value: string, max = 64): string {
  return value.replace(/[^\w\-.:/@%\s]/g, '').trim().slice(0, max) || 'other';
}