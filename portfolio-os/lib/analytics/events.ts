/**
 * lib/analytics/events.ts
 *
 * The wire contract for client events plus the pure validate→normalize stage
 * (§41). Normalization happens entirely server-side so a client can never write
 * arbitrary aggregation keys or inflate totals — every dimension is checked
 * against the registry before it becomes a counter.
 */
import { z } from 'zod';
import {
  EVENT_TYPES,
  UUID_RE,
  clampInt,
  categorizeReferrer,
  sanitizeKey,
  DURATION_HIST_BINS,
  type EventType,
} from './shared';
import {
  normalizeSection,
  normalizeTarget,
  normalizeNamespace,
  parseUserAgent,
  normalizeCountry,
  knownDevice,
} from './registry';

export const WireEventSchema = z.object({
  v: z.string().regex(UUID_RE, 'invalid visitor id'),
  s: z.string().regex(UUID_RE, 'invalid session id'),
  d: z.string().min(1).max(64).transform((value) => sanitizeKey(value, 40)),
  t: z.enum(EVENT_TYPES),
  ts: z.number().int().min(0).max(9_999_999_999_999),
  p: z.string().max(240).optional().default('/'),
  r: z.string().max(800).optional(),
  sec: z.string().max(80).optional(),
  tgt: z.string().max(80).optional(),
  ns: z.string().max(60).optional(),
  dur: z.number().int().min(0).max(86_400_000).optional(),
  sc: z.number().int().min(0).max(100).optional(),
  u: z.string().max(300).optional(),
  perf: z
    .object({
      ttfb: z.number().int().min(0).max(120_000).optional(),
      fcp: z.number().int().min(0).max(120_000).optional(),
      lcp: z.number().int().min(0).max(300_000).optional(),
      cls: z.number().min(0).max(1).optional(),
      inp: z.number().int().min(0).max(120_000).optional(),
    })
    .optional(),
});

export type WireEvent = z.infer<typeof WireEventSchema>;

export interface PerfValues {
  ttfb?: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  inp?: number;
}

export interface NormalizedEvent {
  type: EventType;
  ts: number;
  path: string;
  referrerCategory: string;
  referrerHost: string;
  section: string;
  target: string;
  namespace: string;
  duration: number;
  scroll: number;
  utmSource: string;
  country: string;
  browser: string;
  os: string;
  device: string;
  deploymentId: string;
  visitorId: string;
  sessionId: string;
  perf: PerfValues;
}

/** Server-side context attached at the endpoint, derived from trusted headers. */
export interface NormalizeContext {
  deploymentId: string;
  country: string;
  browser: string;
  os: string;
  device: string;
  /** Site host (e.g. noman.dev) used to treat self-referrers as direct. */
  sameOriginHost?: string;
}

const UTM_SOURCE_RE = /(?:^|[?&])(?:utm_source|ref)=([^&]+)/i;

/** Extract the (capped) acquisition source from a raw UTM/ref string. */
export function utmSource(raw: string | undefined): string {
  if (!raw) return '';
  const match = UTM_SOURCE_RE.exec(raw);
  const value = match?.[1] ? sanitizeKey(decodeURIComponent(match[1]), 48).toLowerCase() : '';
  return value || '';
}

/** Pure, testable normalization. Never throws on malformed-but-typed input. */
export function normalizeEvent(raw: WireEvent, ctx: NormalizeContext): NormalizedEvent {
  const referrer = categorizeReferrer(raw.r, ctx.sameOriginHost ?? null);
  return {
    type: raw.t,
    ts: raw.ts,
    path: sanitizeKey(raw.p ?? '/', 120).slice(0, 120) || '/',
    referrerCategory: referrer.category,
    referrerHost: referrer.host,
    section: normalizeSection(raw.sec),
    target: normalizeTarget(raw.tgt),
    namespace: normalizeNamespace(raw.ns),
    duration: raw.dur ?? 0,
    scroll: clampInt(raw.sc ?? 0, 0, 100),
    utmSource: utmSource(raw.u),
    country: normalizeCountry(ctx.country),
    browser: sanitizeKey(ctx.browser, 24) || 'other',
    os: sanitizeKey(ctx.os, 24) || 'other',
    device: knownDevice(ctx.device as never),
    deploymentId: raw.d,
    visitorId: raw.v,
    sessionId: raw.s,
    perf: raw.perf ?? {},
  };
}

/** The section duration histogram bin index for a duration in ms. */
export function durationBinIndex(durationMs: number): number {
  const seconds = durationMs / 1000;
  for (let i = 0; i < DURATION_HIST_BINS.length; i += 1) {
    if (seconds < DURATION_HIST_BINS[i]!) return i;
  }
  return DURATION_HIST_BINS.length - 1;
}

export { parseUserAgent, normalizeCountry };