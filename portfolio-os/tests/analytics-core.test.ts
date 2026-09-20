/**
 * tests/analytics-core.test.ts
 *
 * Unit coverage for the embedded, zero-dependency analytics engine (§2).
 * These tests exercise only the pure modules (sketch, lru, aggregate, events,
 * metrics, shared, registry) — the same ones a no-DB, memory-bound singleton
 * is built from — and pin down the two properties the planner cares about:
 *
 *   1. CORRECTNESS — the HLL sketch agrees with known inputs, wire events
 *      normalize predictably, and the metric helpers return expected values.
 *   2. BOUNDEDNESS (§51) — rings and the LRU never grow past their caps no
 *      matter how much synthetic traffic is pumped through them.
 *
 * The managerial singleton itself is intentionally NOT imported here: it is
 * guarded by `server-only` and belongs in server/route coverage. What is
 * bounded inside the manager (day/hour rings, visitor LRU, HLL sketches) is
 * exactly what this file proves stays bounded.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { Hll, mergeHlls } from '../lib/analytics/sketch';
import { Lru } from '../lib/analytics/lru';
import { DAY_BUCKETS, HOUR_BUCKETS } from '../lib/analytics/shared';
import { DayRing, HourRing } from '../lib/analytics/aggregate';
import { normalizeEvent, type WireEvent } from '../lib/analytics/events';
import { averageSessionDurationMs, returningPercent } from '../lib/analytics/metrics';

function uuid(n: number): string {
  const hex = n.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex.slice(-12)}`;
}

function wire(partial: Partial<WireEvent> = {}): WireEvent {
  return {
    v: uuid(1),
    s: uuid(2),
    d: 'dev',
    ts: Date.UTC(2025, 0, 15, 9, 30),
    t: 'page_view',
    p: '/projects',
    ...partial,
  };
}

const ctx = { deploymentId: 'dev', country: 'US', browser: 'Chrome', os: 'Linux', device: 'desktop' };

test('HLL estimates distinct values within tolerance', () => {
  const sketch = new Hll();
  for (let i = 0; i < 20_000; i += 1) sketch.add(`visitor-${i}`);
  const estimate = sketch.estimate();
  assert.ok(estimate > 19_000 && estimate < 21_000, `estimate ${estimate}`);
});

test('HLL merge is additive over disjoint sets', () => {
  const a = new Hll();
  const b = new Hll();
  for (let i = 0; i < 5_000; i += 1) a.add(`a-${i}`);
  for (let i = 0; i < 7_000; i += 1) b.add(`b-${i}`);
  const merged = mergeHlls([a, b]);
  const estimate = merged.estimate();
  assert.ok(estimate > 11_500 && estimate < 12_500, `estimate ${estimate}`);
});

test('bounded aggregation rings never exceed their caps (§51)', () => {
  const days = new DayRing();
  const hours = new HourRing();
  const start = Date.UTC(2025, 0, 1);
  for (let i = 0; i < 500; i += 1) {
    days.forDate(new Date(start + i * 86_400_000));
    hours.forDate(new Date(start + i * 3_600_000));
  }
  assert.ok(days.list().length <= DAY_BUCKETS, `days ${days.list().length}`);
  assert.ok(hours.list().length <= HOUR_BUCKETS, `hours ${hours.list().length}`);
});

test('LRU never grows past its capacity', () => {
  const cache = new Lru<string, number>(64);
  for (let i = 0; i < 10_000; i += 1) cache.set(`k-${i}`, i);
  assert.ok(cache.size <= 64, `size ${cache.size}`);
});

test('wire event normalization is safe and predictable', () => {
  const event = normalizeEvent(wire(), ctx);
  assert.equal(event.type, 'page_view');
  assert.equal(event.path, '/projects');
  assert.equal(event.section, 'other'); // unknown sections collapse to a stable bucket (§40)
  assert.equal(event.country, 'US');
  assert.equal(event.browser, 'Chrome');
  assert.equal(event.deploymentId, 'dev');
});

test('session metric helpers return expected values', () => {
  assert.equal(averageSessionDurationMs(120_000, 4), 30_000);
  assert.equal(returningPercent(30, 100), 30);
});
