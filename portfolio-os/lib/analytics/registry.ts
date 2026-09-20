/**
 * lib/analytics/registry.ts
 *
 * The control point for every dimension that could otherwise become an
 * unbounded aggregation key (§40): section ids, click targets, browsers, OSes,
 * devices, countries. Anything that is not "known" collapses to a stable bucket
 * ('other'), and even known keys are kept inside hard CapMaps.
 */
import { DIMENSION_CAPS, DEVICES, sanitizeKey, type Device } from './shared';
import { ENTITY_KINDS } from '@/types/portfolio';

/* ----------------------------------------------------------- CapMap */

/** A string→number counter with a hard key cap. Overflow increments 'other'. */
export class CapMap {
  private counts = new Map<string, number>();
  private other = 0;

  constructor(private readonly cap: number) {}

  incr(key: string, amount = 1): void {
    const existing = this.counts.get(key);
    if (existing !== undefined) {
      this.counts.set(key, existing + amount);
      return;
    }
    if (this.counts.size >= this.cap) {
      this.other += amount;
      return;
    }
    this.counts.set(key, amount);
  }

  get(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  get size(): number {
    return this.counts.size;
  }

  /** Non-destructive read snapshot of entries, sorted by count descending. */
  top(limit = 50): { key: string; value: number }[] {
    const entries = [...this.counts.entries()].map(([key, value]) => ({ key, value }));
    entries.sort((a, b) => b.value - a.value);
    const result = entries.slice(0, limit);
    if (this.other > 0) {
      const idx = result.findIndex((e) => e.key === 'other');
      const item = { key: 'other', value: this.other + (idx >= 0 ? result[idx]!.value : 0) };
      if (idx >= 0) result[idx] = item;
      else result.push(item);
    }
    return result;
  }

  keys(): string[] {
    return [...this.counts.keys()];
  }

  /** Raw [key, count] entries including the overflow bucket, unsorted. */
  entries(): [string, number][] {
    const entries: [string, number][] = [...this.counts.entries()];
    if (this.other > 0) {
      const idx = entries.findIndex(([key]) => key === 'other');
      if (idx >= 0) entries[idx]![1] += this.other;
      else entries.push(['other', this.other]);
    }
    return entries;
  }

  /** Rebuild from a raw entry list (used when restoring a snapshot). */
  load(entries: [string, number][]): void {
    this.counts.clear();
    this.other = 0;
    for (const [key, value] of entries) this.incr(key, value);
  }
}

/* ------------------------------------------------------ sections */

const HOME_SECTIONS = ['hero', 'map', 'briefing', 'featured', 'recognition', 'open', 'explore'];
const PAGE_SECTIONS = ['future', 'startup', 'copy', 'edit', 'colophon', 'not-found'];
const READING_SECTIONS = ['research-body', 'publications-body'];

export const KNOWN_SECTIONS: ReadonlySet<string> = new Set([
  ...HOME_SECTIONS,
  ...PAGE_SECTIONS,
  ...READING_SECTIONS,
  ...ENTITY_KINDS,
]);

const SLUG_RE = /^[a-z0-9-]{1,60}$/;

/** Validate/normalize a client-supplied section id. Unknown → 'other'. */
export function normalizeSection(section: string | undefined): string {
  if (!section) return 'other';
  const clean = sanitizeKey(section, 72).toLowerCase();
  if (KNOWN_SECTIONS.has(clean)) return clean;
  const [kind, slug] = clean.split(':');
  if (kind && slug && ENTITY_KINDS.includes(kind as (typeof ENTITY_KINDS)[number]) && SLUG_RE.test(slug)) {
    return clean;
  }
  return 'other';
}

/* ------------------------------------------------------- targets */

/** Validate/normalize a click target id. Unknown non-empty → capped bucket. */
export function normalizeTarget(target: string | undefined): string {
  if (!target) return 'other';
  return sanitizeKey(target, 48).toLowerCase() || 'other';
}

/** Normalize the namespace/type a click belongs to. */
export function normalizeNamespace(raw: string | undefined): string {
  const clean = sanitizeKey(raw ?? 'other', 48).toLowerCase();
  return clean || 'other';
}

/* ------------------------------------------------------- browsers */

const BROWSER_KNOWN = ['chrome', 'firefox', 'safari', 'edge', 'opera', 'samsung-internet'] as const;

/** Dependency-free user-agent bucketing. Unknown → 'other'. */
export function parseUserAgent(ua: string | null): { browser: string; os: string; device: Device } {
  const value = (ua ?? '').toLowerCase();
  const browser = (() => {
    if (/edg[ea]?[ /]/.test(value)) return 'edge';
    if (/opr[ /]|opera/.test(value)) return 'opera';
    if (/samsungbrowser|samsung mobile/.test(value)) return 'samsung-internet';
    if (/firefox|fxios/.test(value)) return 'firefox';
    if (/chrome|crios/.test(value)) return 'chrome';
    if (/safari/.test(value)) return 'safari';
    return 'other';
  })();
  const os = (() => {
    if (/windows nt/.test(value)) return 'windows';
    if (/iphone|ipod|ipad/.test(value)) return 'ios';
    if (/android/.test(value)) return 'android';
    if (/mac os x|macintosh/.test(value)) return 'macos';
    if (/linux|ubuntu|debian|fedora|arch/.test(value)) return 'linux';
    return 'other';
  })();
  const device: Device = (() => {
    if (/ipad|tablet|playbook|kindle|silk|windows nt 10.0.*touch/i.test(value)) return 'tablet';
    if (/mobi|iphone|ipod|android.*mobile|windows phone|opera mini|blackberry|iemobile/i.test(value)) return 'mobile';
    return 'desktop';
  })();
  const keepBrowser = BROWSER_KNOWN.includes(browser as (typeof BROWSER_KNOWN)[number]) ? browser : 'other';
  return { browser: keepBrowser, os, device };
}

/* ------------------------------------------------------- countries */

/** 2-letter country code, uppercased. Anything else collapses to 'XX'. */
export function normalizeCountry(code: string | null | undefined): string {
  if (!code) return 'XX';
  const clean = code.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(clean) ? clean : 'XX';
}

/* ------------------------------------------------------- referrers */

export const COUNTRY_CAP = DIMENSION_CAPS.countries;
export const BROWSER_CAP = DIMENSION_CAPS.browsers;
export const OS_CAP = DIMENSION_CAPS.operatingSystems;
export const DEVICE_CAP = DIMENSION_CAPS.devices;

export function knownDevice(device: Device): Device {
  return DEVICES.includes(device) ? device : 'other';
}