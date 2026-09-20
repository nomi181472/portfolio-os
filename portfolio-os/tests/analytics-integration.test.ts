/**
 * tests/analytics-integration.test.ts
 *
 * End-to-end through the real SSR singleton (§3-§15, §50-51): the same object a
 * Next route imports. A day of traffic collapses to bounded aggregates over the
 * deployment row, and a fresh manager over the same MemoryStore sees the same
 * summary - proving restart survival without disk or network.
 *
 * The manager imports `server-only`; resolve it to its no-op empty.js with:
 *
 *   NODE_OPTIONS='--conditions=react-server' npx tsx --test tests/analytics-integration.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { AnalyticsManager, type Summary } from '../lib/analytics/singleton';
import {
  MemoryStore,
  type AnalyticsStore,
  type SerializedSnapshot,
} from '../lib/analytics/store';
import { normalizeEvent, type WireEvent } from '../lib/analytics/events';

/**
 * A roundtrip store: whatever is written is what a later manager reads back —
 * the serialize→restore restart contract (§13-§14), in memory only. No disk,
 * no network, bounded to one snapshot.
 */
class RoundtripStore implements AnalyticsStore {
  readonly kind = 'roundtrip';
  private snapshot: SerializedSnapshot | null = null;

  async write(data: SerializedSnapshot): Promise<void> {
    this.snapshot = data;
  }

  async read(): Promise<SerializedSnapshot | null> {
    return this.snapshot;
  }
}

function uuid(n: number): string {
  const hex = n.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex.slice(-12)}`;
}

function wire(partial: Partial<WireEvent> = {}): WireEvent {
  return {
    v: uuid(10),
    s: uuid(11),
    d: 'dev',
    ts: Date.UTC(2025, 0, 15, 9, 30),
    t: 'page_view',
    p: '/',
    ...partial,
  };
}

function event(partial: Partial<WireEvent> = {}): WireEvent {
  return wire(partial);
}

const ctx = {
  deploymentId: 'dev',
  country: 'US',
  browser: 'Chrome',
  os: 'Linux',
  device: 'desktop',
};

test('analytics integration: page views become bounded summary KPIs', () => {
  const manager = new AnalyticsManager({ store: new MemoryStore() });
  manager.track(normalizeEvent(event(), ctx));
  manager.track(normalizeEvent(event({ p: '/projects' }), ctx));

  const summary: Summary = manager.getSummary({ deploymentId: 'dev' });
  assert.equal(summary.deployment.id, 'dev', 'deployment id');
  assert.equal(summary.kpis.pageViews, 2, 'pageViews');
  assert.equal(summary.kpis.uniqueVisitors, 1, 'uniqueVisitors');
  assert.equal(summary.kpis.sessions, 1, 'sessions');
});

test('analytics integration: restart over a roundtrip store keeps the summary', async () => {
  const store = new RoundtripStore();
  const manager = new AnalyticsManager({ store });
  manager.track(normalizeEvent(event(), ctx));
  await manager.flush();

  const revived = new AnalyticsManager({ store });
  let second: Summary = revived.getSummary({ deploymentId: 'dev' });
  const deadline = Date.now() + 2_000;
  while (second.kpis.pageViews < 1 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5));
    second = revived.getSummary({ deploymentId: 'dev' });
  }

  assert.equal(second.kpis.pageViews, 1, 'restart keeps pageViews');
  assert.equal(second.kpis.uniqueVisitors, 1, 'restart keeps visitors');
});
