import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { AnalyticsManager } from '../lib/analytics/singleton';
import { MemoryStore } from '../lib/analytics/store';
import { normalizeEvent, WireEventSchema } from '../lib/analytics/events';

test('analytics-collect: wire batch validation and ingestion', () => {
  const manager = new AnalyticsManager({ store: new MemoryStore() });

  const rawBatch = [
    {
      v: '00000000-0000-4000-8000-000000000001',
      s: '00000000-0000-4000-8000-000000000002',
      d: 'dev',
      ts: Date.now(),
      t: 'page_view',
      p: '/',
    },
    {
      v: '00000000-0000-4000-8000-000000000001',
      s: '00000000-0000-4000-8000-000000000002',
      d: 'dev',
      ts: Date.now(),
      t: 'section_view',
      p: '/',
      sec: 'featured',
      dur: 3200,
    },
    {
      v: '00000000-0000-4000-8000-000000000001',
      s: '00000000-0000-4000-8000-000000000002',
      d: 'dev',
      ts: Date.now(),
      t: 'click',
      p: '/',
      tgt: 'project:portfolio-os',
      ns: 'entity',
      sec: 'featured',
    },
    {
      v: '00000000-0000-4000-8000-000000000001',
      s: '00000000-0000-4000-8000-000000000002',
      d: 'dev',
      ts: Date.now(),
      t: 'scroll_depth',
      p: '/',
      sc: 50,
      sec: 'featured',
    },
    {
      v: '00000000-0000-4000-8000-000000000001',
      s: '00000000-0000-4000-8000-000000000002',
      d: 'dev',
      ts: Date.now(),
      t: 'resume_download',
      p: '/',
      tgt: 'resume.pdf',
    },
  ];

  const batchSchema = z.array(WireEventSchema);
  const parsed = batchSchema.safeParse(rawBatch);
  assert.equal(parsed.success, true, 'Wire batch parsed successfully');

  if (parsed.success) {
    const ctx = {
      deploymentId: 'dev',
      country: 'PK',
      browser: 'Chrome',
      os: 'Linux',
      device: 'desktop',
    };

    for (const wire of parsed.data) {
      manager.track(normalizeEvent(wire, ctx));
    }
  }

  const summary = manager.getSummary({ deploymentId: 'dev' });
  assert.equal(summary.kpis.pageViews, 1, 'Page views recorded');
  assert.equal(summary.kpis.uniqueVisitors, 1, 'Unique visitors recorded');
  assert.equal(summary.kpis.sectionViews, 1, 'Section views recorded');
  assert.equal(summary.kpis.clicks, 1, 'Clicks recorded');
  assert.equal(summary.kpis.resumeDownloads, 1, 'Resume downloads recorded');

  // Check section summary
  const featuredSec = summary.sections.find((s) => s.section === 'featured');
  assert.ok(featuredSec, 'Featured section captured');
  assert.equal(featuredSec?.views, 1);

  // Check targets
  const target = summary.targets.find((t) => t.key.includes('portfolio-os'));
  assert.ok(target, 'Target captured');

  // Check scroll
  const scroll50 = summary.scroll.find((s) => s.bucket === 50);
  assert.ok(scroll50 && scroll50.count >= 1, 'Scroll depth 50% recorded');
});
