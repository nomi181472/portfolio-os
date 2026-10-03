/**
 * tests/agent-wire.test.ts
 *
 * The browser runs the engine, so the client has to rebuild the parts of
 * `PortfolioKnowledge` that JSON cannot carry. `Map` is the dangerous one:
 * serialising it yields `{}`, which passes a structural check and then answers
 * every question with "no evidence" instead of throwing.
 *
 * The second guarantee is that a payload which survived the route answers
 * *identically* to one built in-process. If those ever diverge, the widget shows
 * something the tests never checked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import { buildEngine, buildEngineFromKnowledge } from '../lib/agent/engine';
import { navigationRegistryFromTargets } from '../lib/agent/navigation';
import { assertNoMaps, canRetrieveLocally, rehydrateKnowledge } from '../lib/agent/wire';
import type { KnowledgePayload } from '../lib/agent/types';
import type { Portfolio } from '../types/portfolio';

const NOW = new Date('2026-09-30T00:00:00Z');
const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8'));
const parsed = validatePortfolio(raw);
assert.ok(parsed.ok, 'example content must be valid before the wire can be tested');
const portfolio: Portfolio = parsed.data;
const knowledge = buildKnowledge(portfolio, buildGraph(portfolio), { now: NOW });

const payload: KnowledgePayload = JSON.parse(
  JSON.stringify({
    profile: knowledge.profile,
    availability: knowledge.availability,
    services: knowledge.services,
    records: knowledge.records,
    experienceSpan: knowledge.experienceSpan,
    navigation: knowledge.navigation,
  }),
) as KnowledgePayload;

test('the payload round-trips through JSON without a Map surviving', () => {
  // Asserted on the *serialised* text, which is where a Map becomes `{}`.
  assertNoMaps(JSON.parse(JSON.stringify(payload)));
});

test('assertNoMaps rejects a Map rather than letting it pass as an object', () => {
  // The whole point: `{}` looks fine to every check a caller would write.
  assert.doesNotThrow(() => assertNoMaps({ a: 1, b: [{ c: 'x' }] }));
  assert.throws(() => assertNoMaps({ byKey: new Map([['skills:sk-k8s', {}]]) }), /Map or Set/);
  assert.throws(() => assertNoMaps({ nested: [{ deep: new Set() }] }), /Map or Set/);
});

test('rehydration rebuilds both indexes over the same records', () => {
  const rehydrated = rehydrateKnowledge(payload);

  assert.equal(rehydrated.byKey.size, knowledge.byKey.size);
  assert.ok(rehydrated.byKey instanceof Map, 'a Map that became {} would silently answer "no evidence"');

  for (const record of knowledge.records) {
    assert.equal(rehydrated.byKey.get(record.key)?.name, record.name);
  }

  const kinds = [...rehydrated.byKind.keys()].sort();
  assert.deepEqual(kinds, [...knowledge.byKind.keys()].sort());
  for (const [kind, bucket] of rehydrated.byKind) {
    assert.equal(bucket.length, knowledge.byKind.get(kind)?.length);
  }
});

test('a rehydrated engine answers exactly what the in-process one answers', async () => {
  const server = buildEngine({ portfolio, now: NOW });
  const client = buildEngineFromKnowledge(rehydratedKnowledge(), {
    navigation: navigationRegistryFromTargets(payload.navigation),
  });

  for (const question of [
    'Do you have experience with Kubernetes?',
    'Do you know Rust?',
    'Are you open to work?',
    'How long have you been working with Kafka?',
  ]) {
    const fromServer = await server.answer(question);
    const fromClient = await client.answer(question);

    assert.equal(fromClient.text, fromServer.text, `text differs for: ${question}`);
    assert.deepEqual(fromClient.match, fromServer.match, `match differs for: ${question}`);
    assert.deepEqual(
      fromClient.navigation.map((t) => t.href),
      fromServer.navigation.map((t) => t.href),
      `navigation differs for: ${question}`,
    );
  }
});

test('the lean payload is reported as not locally retrievable', () => {
  assert.equal(canRetrieveLocally(payload), true);

  const lean: KnowledgePayload = {
    ...payload,
    records: payload.records.map(({ text: _text, ...rest }) => rest),
  };
  assert.equal(canRetrieveLocally(lean), false);
  // It still has to build, or the widget cannot answer anything at all without
  // the corpus. Missing haystack is a reduced capability, not a broken engine.
  assert.doesNotThrow(() => rehydrateKnowledge(lean));
});

function rehydratedKnowledge() {
  return rehydrateKnowledge(payload);
}
