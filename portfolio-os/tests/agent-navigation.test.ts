/**
 * tests/agent-navigation.test.ts
 *
 * Two things are under test, both about the same guarantee: the agent cannot
 * produce a link that does not work.
 *
 *  - `lib/agent/navigation.ts` refuses targets that are malformed, unknown, or
 *    real-but-unlinkable, and says which of the three happened.
 *  - `app/api/agent/knowledge/route.ts` emits JSON. The specific risk is a `Map`
 *    surviving to the browser as `{}`, which would not throw — it would arrive
 *    looking like a deliberate empty collection. So the serialised payload is
 *    inspected for the absence of Maps rather than only for the presence of what
 *    it should contain.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';

import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import {
  buildNavigationRegistry,
  checkActions,
  resolveAction,
  STATIC_PAGE_HREFS,
} from '../lib/agent/navigation';
import { CATEGORY_LIST } from '../lib/categories';
import { GET, dynamic as routeDynamic } from '../app/api/agent/knowledge/route';
import type { Portfolio } from '../types/portfolio';

const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8'));
const parsed = validatePortfolio(raw);
assert.ok(parsed.ok, 'example content must be valid before navigation can be tested');
const portfolio: Portfolio = parsed.data;
const graph = buildGraph(portfolio);
const knowledge = buildKnowledge(portfolio, graph, { now: new Date('2026-09-30T00:00:00Z') });
const registry = buildNavigationRegistry(portfolio);

const hasEntity = (key: string): boolean => knowledge.byKey.has(key);
const hrefForKey = (key: string): string | undefined => knowledge.byKey.get(key)?.href;

test('every static page in the registry has a route file behind it', () => {
  // The registry is the only place the agent learns these hrefs, so a page added
  // there without a matching route is a 404 the tests should catch first.
  for (const href of STATIC_PAGE_HREFS) {
    if (href === '/') {
      assert.ok(existsSync(resolve(process.cwd(), 'app/page.tsx')), '/ has no page');
      continue;
    }
    assert.ok(
      existsSync(resolve(process.cwd(), `app${href}/page.tsx`)),
      `${href} is in the navigation registry but app${href}/page.tsx does not exist`,
    );
  }
});

test('a category target points at the kind the route actually keys on', () => {
  // `app/[category]` parametrises by `category.kind`, not by a plural slug.
  for (const category of CATEGORY_LIST) {
    const target = registry.byId.get(category.kind);
    assert.ok(target, `${category.kind} is missing from the registry`);
    assert.equal(target.kind, 'category');
    assert.equal(target.href, `/${category.kind}`);
    assert.equal(target.label, category.label);
  }
});

test('a conditional page is omitted when the content does not have it', () => {
  // `/startup` is only offered when `portfolio.startup` exists, so the agent
  // cannot send a reader to an empty page.
  assert.ok(buildNavigationRegistry(portfolio).byId.has('startup'));
  const { startup: _omitted, ...rest } = portfolio;
  assert.equal(portfolio.startup !== undefined, true, 'the example content must have a startup record');
  assert.equal(buildNavigationRegistry(rest as Portfolio).byId.has('startup'), false);
});

test('an unknown target is rejected, not guessed at', () => {
  const result = resolveAction({ kind: 'navigate', targetId: 'skills:sk-kubernetes' }, registry, hasEntity, hrefForKey);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason.code, 'unknown-target');
});

test('a plausible but non-existent registry id is rejected the same way', () => {
  // The shape is valid and the id reads like a real page, which is exactly the
  // case where a lenient resolver would emit a dead link.
  const result = resolveAction({ kind: 'navigate', targetId: 'contact' }, registry, hasEntity, hrefForKey);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason.code, 'malformed-target');
});

test('malformed input is rejected before it can probe the registry', () => {
  for (const targetId of ['', '   ', '../etc/passwd', 'javascript:alert(1)', 'skills:', 'a:b:c', '__proto__']) {
    const result = resolveAction({ kind: 'navigate', targetId }, registry, hasEntity, hrefForKey);
    assert.equal(result.ok, false, `${JSON.stringify(targetId)} must not resolve`);
  }
});

test('a valid registry target resolves to its href', () => {
  const result = resolveAction({ kind: 'navigate', targetId: 'projects' }, registry, hasEntity, hrefForKey);
  assert.equal(result.ok, true);
  assert.equal(result.ok === true && result.href, '/projects');
  assert.equal(result.ok === true && result.label, 'Projects');
});

test('a valid entity target resolves to the href the graph generated', () => {
  const key = 'skills:sk-python';
  assert.ok(knowledge.byKey.has(key));
  const result = resolveAction({ kind: 'navigate', targetId: key }, registry, hasEntity, hrefForKey);
  assert.equal(result.ok, true);
  assert.equal(result.ok === true && result.href, knowledge.byKey.get(key)?.href);
});

test('no kind may link to a record with no route', () => {
  // A record with no page of its own must not be linked to, by any action kind. This
  // used to be split in two: `highlight` was allowed to resolve with a null href,
  // because the promise was to point at the record *in place*. Nothing rendered such a
  // highlight, so the split only produced an action that resolved successfully and then
  // did nothing. Every kind now requires a destination, and `none` is how a model
  // declines.
  const key = 'skills:sk-python';
  const noRoute = (): string | undefined => undefined;

  for (const kind of ['navigate', 'compare'] as const) {
    const resolved = resolveAction({ kind, targetId: key }, registry, hasEntity, noRoute);
    assert.equal(resolved.ok, false, `${kind} must not resolve without a route`);
    assert.equal(resolved.ok === false && resolved.reason.code, 'not-navigable');
  }
});

test('highlight is gone from the action kinds', () => {
  // It resolved for most of the build and nothing ever rendered it. Asserted here so
  // that re-adding it to `ActionKind` without a renderer fails here rather than
  // shipping as another silent no-op.
  assert.equal(
    checkActions([{ kind: 'highlight' as never, targetId: 'skills:sk-python' }], registry, hasEntity, () => '/x').length,
    0,
    'an unrecognised kind must be dropped, not coerced',
  );
});

test('every navigable entity record has an href that matches the routing table', () => {
  for (const record of knowledge.records) {
    if (!record.href) continue;
    assert.match(record.href, /^\/[a-z]+(\/[a-z0-9-]+)?$/, `${record.key} has an odd href: ${record.href}`);
  }
});

/* ------------------------------------------------------------------- wire */

function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return GET(new NextRequest(new Request(url, { headers })) as never);
}

test('the payload is JSON with no Map or Set anywhere in it', async () => {
  const response = await get('http://localhost/api/agent/knowledge');
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;

  assert.equal(typeof body.corpusIncluded, 'boolean');
  assert.ok(Array.isArray(body.records));
  assert.ok(Array.isArray(body.navigation));
  assert.ok(typeof body.experienceSpan === 'object');

  // `byKey` and `byKind` are Maps on the server object. A Map that reaches
  // JSON.stringify becomes `{}`, which is indistinguishable from a legitimately
  // empty collection, so the check is on the keys being absent entirely.
  assert.equal('byKey' in body, false, 'byKey must not be serialised');
  assert.equal('byKind' in body, false, 'byKind must not be serialised');

  const scan = (value: unknown, path: string): void => {
    if (value instanceof Map || value instanceof Set) {
      assert.fail(`${path} reached the wire as a ${value.constructor.name}`);
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => scan(item, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) scan(child, `${path}.${key}`);
    }
  };
  scan(body, 'payload');
});

test('records survive serialisation with their identity and evidence intact', async () => {
  const response = await get('http://localhost/api/agent/knowledge');
  const body = (await response.json()) as { records: { key: string; href: string; evidence: unknown[]; text: string }[] };
  assert.equal(body.records.length, knowledge.records.length);
  for (const record of body.records) {
    const local = knowledge.byKey.get(record.key);
    assert.ok(local, `${record.key} was invented by serialisation`);
    assert.equal(record.href, local.href);
    assert.equal(record.evidence.length, local.evidence.length);
  }
});

test('the lean variant drops the corpus and reports what it withheld', async () => {
  const fullResponse = await get('http://localhost/api/agent/knowledge');
  const fullBytes = (await fullResponse.text()).length;

  const leanResponse = await get('http://localhost/api/agent/knowledge?corpus=none');
  const leanText = await leanResponse.text();
  const lean = JSON.parse(leanText) as {
    corpusIncluded: boolean;
    corpusBytes: number;
    records: { text?: string }[];
  };

  assert.equal(lean.corpusIncluded, false);
  assert.ok(lean.corpusBytes > 0, 'the withheld size must be reported, not hidden');
  assert.ok(
    lean.records.every((record) => record.text === undefined),
    'the lean variant must not leak a partial corpus',
  );
  assert.equal(
    lean.corpusBytes,
    knowledge.records.reduce((sum, record) => sum + record.text.length, 0),
    'the reported size must match what was actually withheld',
  );
  assert.ok(leanText.length < fullBytes, 'the lean variant must actually be smaller');

  // The option is only worth having while the corpus is the largest single
  // component. If it stopped being one, `?corpus=none` would be a rounding
  // error and should be deleted rather than documented.
  const evidenceBytes = knowledge.records.reduce(
    (sum, record) => sum + JSON.stringify(record.evidence).length,
    0,
  );
  assert.ok(
    lean.corpusBytes > evidenceBytes,
    `corpus (${lean.corpusBytes}) should be the largest component, but evidence is ${evidenceBytes}`,
  );
});

test('the two variants advertise different ETags', async () => {
  // Same variant name hashing, different content: if these collided a shared
  // cache would serve the lean body to a client that asked for the corpus.
  const full = await get('http://localhost/api/agent/knowledge');
  const lean = await get('http://localhost/api/agent/knowledge?corpus=none');
  assert.notEqual(full.headers.get('etag'), lean.headers.get('etag'));
  assert.ok(full.headers.get('etag'));
});

test('a matching If-None-Match gets a 304 and no body', async () => {
  const first = await get('http://localhost/api/agent/knowledge');
  const etag = first.headers.get('etag');
  assert.ok(etag);
  const second = await get('http://localhost/api/agent/knowledge', { 'if-none-match': etag });
  assert.equal(second.status, 304);
  assert.equal(await second.text(), '');
});

test('a stale If-None-Match gets the payload, not a 304', async () => {
  const response = await get('http://localhost/api/agent/knowledge', { 'if-none-match': '"not-the-etag"' });
  assert.equal(response.status, 200);
});

test('the route is dynamic, or Next would snapshot it at build time', () => {
  // A GET handler that touches no dynamic API is statically rendered, and every
  // visitor would get the build-time portfolio forever — including a computed
  // experience span frozen at deploy time.
  assert.equal(routeDynamic, 'force-dynamic');
});
