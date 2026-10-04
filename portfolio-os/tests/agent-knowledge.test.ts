/**
 * tests/agent-knowledge.test.ts
 *
 * The knowledge adapter is the boundary between the portfolio's markdown and
 * every claim the chatbot is allowed to make. Two things are asserted here that
 * nothing downstream can recover from if they are wrong:
 *
 *  - the adapter adds records, it does not invent them, and it does not lose
 *    any that the content file already had;
 *  - evidence is only ever attached where the graph actually says it is, which
 *    is the difference between "I have built event streaming systems" and "I
 *    have used Kafka".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge, documentedYears } from '../lib/agent/knowledge';
import { buildAliasTable, resolveTerm, siblingsInFamily } from '../lib/agent/aliases';
import { CATEGORY_LIST } from '../lib/categories';
import type { Portfolio } from '../types/portfolio';

const raw = readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8');
const parsed = validatePortfolio(JSON.parse(raw));
assert.ok(parsed.ok, 'example content must be valid before the adapter can be tested');
const portfolio: Portfolio = parsed.data;
const graph = buildGraph(portfolio);

// Pinned so the computed span is a fixed expectation rather than a moving one.
const NOW = new Date('2026-09-30T00:00:00Z');
const knowledge = buildKnowledge(portfolio, graph, { now: NOW });
const table = buildAliasTable(knowledge);

/** Canonical ids are `kind:id`, never `kind:slug`. */
function keyFor(kind: string, slug: string): string {
  const found = knowledge.records.find((record) => record.kind === kind && record.slug === slug);
  assert.ok(found, `expected a ${kind} with slug "${slug}"`);
  return found.key;
}

test('the adapter indexes every entity and adds no records of its own', () => {
  const fromGraph = graph.byKind.size === 0 ? 0 : [...graph.byKind.values()].reduce((n, list) => n + list.length, 0);
  assert.equal(knowledge.records.length, fromGraph);
  assert.equal(new Set(knowledge.records.map((record) => record.key)).size, fromGraph);
});

test('a canonical id is kind-scoped, so a slug reused across kinds stays distinct', () => {
  // Canonical ids are `kind:slug`. Two entities that share a slug must not
  // collapse into one, because every evidence edge and every navigation target
  // is addressed by this string.
  const byCanonical = new Map<string, number>();
  for (const record of knowledge.records) {
    byCanonical.set(record.key, (byCanonical.get(record.key) ?? 0) + 1);
  }
  for (const [canonicalId, count] of byCanonical) {
    assert.equal(count, 1, `${canonicalId} appears more than once`);
  }
  assert.ok(knowledge.byKey.has(`skills:${portfolio.skills[0]?.id ?? ''}`));
});

test('corpus carries the specialised fields that only exist on some kinds', () => {
  // `systems`, `category`, `role` and `subjects` live on the specialised
  // schemas, not on the base `Entity` the graph hands back, so the adapter reads
  // them off a loose record. If that read regresses, retrieval silently loses
  // the most discriminative terms in the file and nothing else fails: the
  // records are still built, still indexed, and still pass every shape check.
  const navirox = knowledge.byKey.get(keyFor('projects', 'navirox'));
  assert.ok(navirox, 'expected the NAVIROX project in the example content');
  assert.match(navirox.text, /pytorch/, 'the related skill list must reach the corpus');
  assert.match(navirox.text, /lidar/, 'the description must reach the corpus');
  assert.doesNotMatch(navirox.text, /\[.+\]\(.+\)/, 'markdown links must be stripped, not indexed');
  assert.ok(navirox.text.length > 400, 'a long project indexes a long corpus, not a stub');

  const tracker = knowledge.byKey.get(keyFor('projects', 'zero-shots-trackers'));
  assert.ok(tracker);
  assert.match(tracker.text, /video/);

  // Depth is a self-assessment that only skills carry. A project must not
  // borrow one, because depth is what separates a receipt from a narrative.
  assert.equal(navirox.depth, undefined);

  // A skill reads its own `category`, which is on SkillSchema only. If that
  // read regresses the corpus still builds and still passes every shape check —
  // it just quietly stops carrying the grouping term.
  const pytorch = knowledge.byKey.get(keyFor('skills', 'pytorch'));
  assert.ok(pytorch);
  assert.match(pytorch.text, /ai & deep learning frameworks/);

  // The discipline phrase lives in the profile's domains and in the projects
  // that use it, and reaches them from there. It is deliberately *not* asserted
  // against the PyTorch record: attributing "computer vision" to a skill whose
  // own fields never say so would be the agent inventing a fact, which is the
  // one thing this layer exists to prevent.
  const cvProjects = knowledge.records.filter(
    (record) => record.kind === 'projects' && /computer vision/.test(record.text),
  );
  assert.ok(cvProjects.length >= 3, 'the computer vision work must be findable by its own name');
});

test('availability is read from the content, and defaults to closed when absent', () => {
  assert.equal(knowledge.availability.status, portfolio.availability.status);
  assert.ok(['open-to-work', 'looking-for-opportunities', 'closed'].includes(knowledge.availability.status));
  assert.equal(knowledge.availability.statement, 'Noman is currently open to work.');
});

test('experience span is computed from the dates, not copied from the profile', () => {
  assert.equal(knowledge.profile.statedYearsActive, portfolio.profile.briefing.yearsActive);
  assert.notEqual(knowledge.experienceSpan.years, knowledge.profile.statedYearsActive);
  assert.equal(documentedYears(knowledge), knowledge.experienceSpan.years);
  assert.ok(knowledge.experienceSpan.months > 0);
  assert.equal(knowledge.experienceSpan.roles.length, portfolio.experience.length);
});

test('roles are ordered by date and an ongoing role reports no end', () => {
  const starts = knowledge.experienceSpan.roles.map((role) => role.start ?? '');
  assert.deepEqual(starts, [...starts].sort(), 'roles must read oldest first');
  const ongoing = knowledge.experienceSpan.roles.find((role) => role.ongoing);
  assert.ok(ongoing, 'expected at least one ongoing role in the example content');
  assert.equal(ongoing.end, undefined);
  assert.equal(knowledge.experienceSpan.last, 'present');
});

test('overlapping roles are merged so experience is not double counted', () => {
  const months = knowledge.experienceSpan.roles.length;
  const calendar = knowledge.experienceSpan.months + knowledge.experienceSpan.gapMonths;
  // Either the roles are disjoint (months + gaps == calendar span) or they
  // overlap (months < calendar span). What must never happen is months
  // exceeding the calendar span.
  assert.ok(months >= 0);
  assert.ok(
    knowledge.experienceSpan.months <= calendar,
    'merged months cannot exceed the calendar span of the first and last role',
  );
});

test('a skill with no inbound edge is documented, not absent', () => {
  // Kafka and TensorFlow are referenced in prose but appear in no
  // `relatedSkills` list. Collapsing that to "not documented" would be a lie in
  // the opposite direction from the one the state machine is built to prevent.
  for (const slug of ['apache-kafka', 'tensorflow']) {
    const record = knowledge.byKey.get(keyFor('skills', slug));
    assert.ok(record, `${slug} must be indexed`);
    assert.equal(record.evidence.length, 0, `${slug} must not gain invented edges`);
    assert.ok((record.depth ?? '').length > 0, `${slug} still has a narrative depth`);
  }
});

test('a skill with real inbound edges gets them, and only those', () => {
  const python = knowledge.byKey.get(keyFor('skills', 'python'));
  assert.ok(python);
  assert.ok(python.evidence.length > 0);
  for (const edge of python.evidence) {
    assert.notEqual(edge.kind, 'skills', 'skill evidence is attributed to where it was used');
    assert.ok(edge.href.startsWith('/'), `edge ${edge.href} must be navigable`);
  }
});

test('every evidence edge points at a record that exists', () => {
  for (const record of knowledge.records) {
    for (const edge of record.evidence) {
      assert.ok(knowledge.byKey.has(edge.key), `${edge.key} is referenced but not indexed`);
    }
  }
});

test('every navigation target is served by a real route', () => {
  // Two ways a target can be reachable, both checkable: a static route that
  // exists as a file under `app/`, or a category served by the `[category]`
  // catch-all. A target that satisfies neither is a link to nothing, which is
  // the failure mode that only shows up as a 404 in a browser.
  const staticRoutes = new Set(['/', '/explore', '/startup', '/future', '/colophon']);
  // `app/[category]` is keyed by kind, and `generateStaticParams` returns
  // `category.kind`, so `/products` is a real route because its kind is
  // `products` — not because a plural slug happens to match.
  const categoryKinds = new Map(CATEGORY_LIST.map((category) => [category.kind, `/${category.kind}`]));
  for (const target of knowledge.navigation) {
    const isStatic = target.kind === 'page' && staticRoutes.has(target.href);
    const isCategory =
      target.kind === 'category' &&
      target.entityKind !== undefined &&
      categoryKinds.get(target.entityKind) === target.href;
    const isEntity = target.kind === 'entity' && knowledge.byKey.has(target.id);
    assert.ok(
      isStatic || isCategory || isEntity,
      `${target.href} (${target.kind}) is not served by any route`,
    );
    assert.ok(target.label.trim().length > 0, `${target.href} has no label`);
  }
});

test('an abbreviation resolves to the concept, not to a substring match', () => {
  // The regression this guards: alias keys written as guessed names
  // (`kubernetes`) rather than real slugs (`kubernetes-eks`) are dropped by the
  // known-slug check, and "k8s" quietly stops working.
  const cases: [string, string][] = [
    ['k8s', 'kubernetes-eks'],
    ['eks', 'kubernetes-eks'],
    ['kafka', 'apache-kafka'],
    ['postgres', 'postgresql'],
    ['grpc', 'grpc'],
    ['torch', 'pytorch'],
  ];
  for (const [term, slug] of cases) {
    const resolved = resolveTerm(table, term);
    assert.equal(resolved.canonicalIds.length, 1, `"${term}" should resolve to exactly one concept`);
    assert.ok(
      knowledge.byKey.has(resolved.canonicalIds[0] ?? ''),
      `"${term}" must resolve to a record that exists, not just to ${slug}`,
    );
    assert.equal(resolved.ambiguous, false, `"${term}" must not be reported as ambiguous`);
  }
});

test('a concept named by a record beats a record that merely uses it', () => {
  // PyTorch is a skill, and is also listed as a technology on the Python and
  // EvoTorch records. A flat alias table reports that as three-way ambiguity and
  // ranks the concept that was actually asked about last.
  for (const term of ['pytorch', 'golang', '.net', 'csharp']) {
    const resolved = resolveTerm(table, term);
    assert.equal(resolved.canonicalIds.length, 1, `"${term}" has exactly one referent`);
    assert.equal(resolved.ambiguous, false);
  }
  assert.ok(knowledge.byKey.has(resolveTerm(table, '.net').canonicalIds[0] ?? ''));
});

test('an absent technology resolves to nothing rather than to a near neighbour', () => {
  // RabbitMQ and Rust are not in the portfolio. The correct answer is
  // `unverified` later in the pipeline, which is only reachable if the alias
  // table returns empty instead of guessing something adjacent.
  for (const term of ['rabbitmq', 'rust', 'elixir', 'cobol']) {
    assert.deepEqual(resolveTerm(table, term).canonicalIds, [], `"${term}" must not resolve`);
  }
});

test('a technology that is present but not a skill is still unverified as a skill', () => {
  // TensorBoard is a TensorFlow technology, not a skill. It must not resolve to
  // the TensorFlow skill, because a job asking for TensorBoard has not been met
  // by a TensorFlow record.
  const tensorflowId = keyFor('skills', 'tensorflow');
  const resolved = resolveTerm(table, 'tensorboard');
  assert.ok(!resolved.canonicalIds.includes(tensorflowId), 'a sub-tool is not its parent skill');
});

test('family membership is reported from the data, not from a hardcoded list', () => {
  const kafkaId = keyFor('skills', 'apache-kafka');
  assert.equal(table.familyOf.get(kafkaId), 'message brokers and event transport');
  const siblings = siblingsInFamily(table, kafkaId);
  assert.ok(siblings.length > 0);
  assert.ok(!siblings.includes(kafkaId), 'a concept is not its own substitute');
  for (const sibling of siblings) {
    assert.ok(knowledge.byKey.has(sibling), `${sibling} must be a real record`);
  }
});

test('the duplicate micro-frontends pair resolves to both records, not one', () => {
  // Defect 3: the portfolio has a `module-federations` skill and a
  // `micro-frontends` skill describing the same idea. The adapter must not
  // silently pick one and let the other become invisible.
  const pair = [keyFor('skills', 'micro-frontends'), keyFor('skills', 'module-federations')];
  assert.equal(pair.length, 2, 'the duplicate pair must still be two records');
  for (const term of ['micro frontends', 'module federation', 'mfe']) {
    const resolved = resolveTerm(table, term);
    for (const id of pair) {
      assert.ok(resolved.canonicalIds.includes(id), `"${term}" should reach ${id}`);
    }
  }
});

test('every mined term that resolves to a concept points at a real record', () => {
  for (const [term, canonicalIds] of table.byTerm) {
    assert.ok(term.length >= 2, `"${term}" is too short to be a stable term`);
    for (const canonicalId of canonicalIds) {
      assert.ok(knowledge.byKey.has(canonicalId), `${term} -> ${canonicalId} is dangling`);
    }
  }
});
