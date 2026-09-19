/**
 * tests/graph.test.ts
 *
 * References are the only thing in the content model that can be wrong without
 * the schema noticing: `"relatedSkills": ["kubernets"]` is a perfectly valid
 * string. These tests cover resolution, the derived backlinks, and the promise
 * made in §68 — a missing reference degrades, it does not crash.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePortfolio } from '../lib/validate';
import { buildGraph, evidenceForSkill, hrefFor } from '../lib/graph';
import { buildIndex, search } from '../lib/search';
import type { Portfolio } from '../types/portfolio';

const raw = readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8');
const parsed = validatePortfolio(JSON.parse(raw));
assert.ok(parsed.ok, 'example content must be valid before the graph can be tested');
const portfolio: Portfolio = parsed.data;
const graph = buildGraph(portfolio);

test('every entity in the content file is indexed by kind and by slug', () => {
  for (const product of portfolio.products) {
    assert.ok(graph.get('products', product.slug), `products/${product.slug} is missing`);
    assert.ok(graph.get('products', product.id), `products#${product.id} is missing`);
  }
  assert.equal(graph.list('products').length, portfolio.products.length);
});

test('the example content contains no dangling references', () => {
  assert.deepEqual(graph.warnings, []);
});

test('a dangling reference is reported, not thrown', () => {
  const broken = structuredClone(portfolio);
  broken.products[0]!.relatedSkills = ['a-skill-that-does-not-exist'];
  const result = validatePortfolio(broken);
  assert.ok(result.ok);

  const brokenGraph = buildGraph(result.data);
  assert.ok(brokenGraph.warnings.some((warning) => warning.includes('a-skill-that-does-not-exist')));

  const entity = brokenGraph.get('products', broken.products[0]!.slug);
  assert.ok(entity, 'the entity itself must still resolve');
  assert.ok(entity.danglingRefs.some((ref) => ref === 'relatedSkills: a-skill-that-does-not-exist'));
  assert.ok(
    brokenGraph.neighbours(entity).every((edge) => edge.href && edge.name),
    'a dangling reference is dropped from the edges, not rendered as a broken link',
  );
});

test('relationships are navigable in both directions', () => {
  const testPortfolio = structuredClone(portfolio);
  if (!testPortfolio.products.some((product) => (product.relatedSkills ?? []).length > 0)) {
    testPortfolio.products[0]!.relatedSkills = [testPortfolio.skills[0]!.id];
  }
  const testGraph = buildGraph(testPortfolio);
  const withSkills = testPortfolio.products.find((product) => (product.relatedSkills ?? []).length > 0)!;

  const skillId = withSkills.relatedSkills![0]!;
  const skill = testGraph.get('skills', skillId);
  assert.ok(skill, `skill ${skillId} should resolve`);

  const backlinks = testGraph.neighbours(skill).map((edge) => edge.id);
  assert.ok(backlinks.includes(withSkills.id), 'the product should appear as a backlink on the skill');
});

test('skill evidence answers "where was this actually used"', () => {
  const testPortfolio = structuredClone(portfolio);
  if (!testPortfolio.skills.some((candidate) => testPortfolio.products.some((p) => (p.relatedSkills ?? []).includes(candidate.id)))) {
    testPortfolio.products[0]!.relatedSkills = [testPortfolio.skills[0]!.id];
  }
  const testGraph = buildGraph(testPortfolio);
  const skill = testPortfolio.skills.find((candidate) =>
    testPortfolio.products.some((product) => (product.relatedSkills ?? []).includes(candidate.id)),
  )!;
  assert.ok(skill);

  const evidence = evidenceForSkill(testGraph, skill.id);
  assert.ok(evidence.length > 0);
  assert.ok(evidence.every((edge) => edge.kind !== 'skills'), 'a skill is not evidence for itself');
});

test('siblings give every entity a previous and a next without wrapping off the ends', () => {
  const list = graph.list('products');
  assert.ok(list.length >= 2, 'the example content needs at least two products for this test');

  const first = graph.siblings(list[0]!);
  const last = graph.siblings(list[list.length - 1]!);

  assert.equal(first.previous, undefined);
  assert.equal(first.next?.data.slug, list[1]!.data.slug);
  assert.equal(last.next, undefined);
});

test('hrefs are stable and match the routing table', () => {
  assert.equal(hrefFor('products', 'lockkeyz'), '/products/lockkeyz');
  assert.equal(hrefFor('research', 'identity-drift'), '/research/identity-drift');
});

test('search finds entities by name and reports their kind', () => {
  const index = buildIndex(portfolio);
  const target = portfolio.products[0]!;

  const results = search(index, target.name);
  assert.ok(results.length > 0);
  assert.equal(results[0]!.id, target.id);
  assert.equal(results[0]!.kind, 'products');
  assert.equal(results[0]!.href, `/products/${target.slug}`);
});

test('search matches on technologies, not only titles', () => {
  const index = buildIndex(portfolio);
  const technology = portfolio.products.flatMap((product) => product.technologies ?? [])[0];
  assert.ok(technology, 'the example content should list technologies');
  assert.ok(search(index, technology).length > 0);
});

test('search returns nothing for nonsense rather than everything', () => {
  const index = buildIndex(portfolio);
  assert.equal(search(index, 'zzzqqqxxx').length, 0);
});
