/**
 * tests/content.test.ts
 *
 * The content pipeline is the part of this system that a forked user touches
 * most and understands least, so it is the part that is tested (§119). Node's
 * built-in runner is used deliberately — a portfolio should not carry a test
 * framework it does not need (§114).
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePortfolio } from '../lib/validate';
import { exportPortfolio, importPortfolio } from '../lib/transfer';
import { stableStringify } from '../lib/stable-json';
import { diff, summarise } from '../lib/diff';
import { safeUrl, SCHEMA_VERSION } from '../lib/schema';

const raw = readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8');
const example = JSON.parse(raw) as Record<string, unknown>;

test('the bundled example content is valid', () => {
  const result = validatePortfolio(example);
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.issues, null, 2));
});

test('the bundled example content has no duplicate slugs', () => {
  const result = validatePortfolio(example);
  assert.ok(result.ok);
  assert.deepEqual(result.warnings, []);
});

test('a missing required field names its own path', () => {
  const broken = structuredClone(example) as { products: { name?: string }[] };
  delete broken.products[0]!.name;
  const result = validatePortfolio(broken);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.issues.some((issue) => issue.path === 'products[0].name'));
});

test('an unsupported status value is rejected with its path', () => {
  const broken = structuredClone(example) as { research: { state?: string }[] };
  broken.research[0]!.state = 'probably-true';
  const result = validatePortfolio(broken);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.issues.some((issue) => issue.path.startsWith('research[0].state')));
});

test('dangerous URL protocols are refused', () => {
  assert.equal(safeUrl.safeParse('https://example.com').success, true);
  assert.equal(safeUrl.safeParse('mailto:someone@example.com').success, true);
  assert.equal(safeUrl.safeParse('/media/diagram.svg').success, true);
  assert.equal(safeUrl.safeParse('javascript:alert(1)').success, false);
  assert.equal(safeUrl.safeParse('data:text/html;base64,PHNjcmlwdD4=').success, false);
});

test('import → export → import preserves the document exactly', () => {
  const first = importPortfolio(raw);
  assert.ok(first.ok);

  const exported = exportPortfolio(first.data);
  assert.ok(exported.ok);

  const second = importPortfolio(exported.json);
  assert.ok(second.ok);

  assert.deepEqual(second.data, first.data, 'a round trip must not lose or invent a field');

  const reExported = exportPortfolio(second.data);
  assert.ok(reExported.ok);
  assert.equal(reExported.json, exported.json, 'the serialisation must be byte-stable across trips');
});

test('export stamps the current schema version', () => {
  const exported = exportPortfolio({ ...example, schemaVersion: '0.9' });
  assert.ok(exported.ok);
  assert.equal(JSON.parse(exported.json).schemaVersion, SCHEMA_VERSION);
});

test('export refuses to emit invalid content', () => {
  const broken = structuredClone(example) as { products: { slug?: string }[] };
  broken.products[0]!.slug = 'Not A Slug';
  const exported = exportPortfolio(broken);
  assert.equal(exported.ok, false);
  assert.ok(!exported.ok && exported.report.includes('products[0].slug'));
});

test('import reports unparseable files without throwing', () => {
  const result = importPortfolio('{ "schemaVersion": ');
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.issues[0]!.path === '(file)');
});

test('serialisation is deterministic regardless of key order', () => {
  const a = { b: 1, a: { d: [1, 2], c: 'x' } };
  const b = { a: { c: 'x', d: [1, 2] }, b: 1 };
  assert.equal(stableStringify(a), stableStringify(b));
});

test('array order is preserved — it is authored, not incidental', () => {
  assert.equal(stableStringify({ list: ['b', 'a'] }), stableStringify({ list: ['b', 'a'] }));
  assert.notEqual(stableStringify({ list: ['b', 'a'] }), stableStringify({ list: ['a', 'b'] }));
});

test('diff reports added, modified and removed at a usable path', () => {
  const before = { products: [{ name: 'A', links: [{ url: 'https://a.test' }] }], awards: [{ name: 'X' }] };
  const after = { products: [{ name: 'A', links: [{ url: 'https://b.test' }] }, { name: 'B' }], awards: [] };
  const changes = diff(before, after);

  assert.ok(changes.some((c) => c.type === 'modified' && c.path === 'products[0].links[0].url'));
  assert.ok(changes.some((c) => c.type === 'added' && c.path === 'products[1]'));
  assert.ok(changes.some((c) => c.type === 'removed' && c.path === 'awards[0]'));
  assert.equal(summarise([]), 'No changes');
});

test('an unchanged document produces no diff', () => {
  assert.deepEqual(diff(example, structuredClone(example)), []);
});
