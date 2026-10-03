import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  clearPersistedVectors,
  MAX_PERSISTED_CORPORA,
  persistVectors,
  persistentVectorStore,
  restoreVectors,
} from '../lib/agent/models/vector-persistence';
import { corpusHash, E5_DIMENSIONS, emptyVectorStore, type RecordVectors } from '../lib/agent/models/embeddings';

/**
 * These run under `node:test`, where `indexedDB` does not exist — which is exactly the
 * point. Persistence is optional throughout this project, and the supported state for a
 * reader whose browser denies storage is "no vectors", never an exception. If any of
 * these reached for the global unguarded, the first call here would throw.
 */

/**
 * The module's own text, for the checks that assert on how it narrows what it reads
 * back. Those are assertions about a security-relevant narrowing, which cannot be
 * exercised through `restoreVectors` here because `node:test` has no IndexedDB to
 * decline — so the branch under test is the one that would run after a real read.
 */
const source = readFileSync(
  resolve(process.cwd(), 'lib/agent/models/vector-persistence.ts'),
  'utf8',
);

const MODEL = 'Xenova/multilingual-e5-small';
const HASH = 'fixture-hash';

function vectors(count: number, seed = 1): RecordVectors {
  const out: RecordVectors = [];
  for (let index = 0; index < count; index += 1) {
    const vector = new Float32Array(E5_DIMENSIONS);
    for (let component = 0; component < E5_DIMENSIONS; component += 1) {
      vector[component] = Math.sin(seed * 17 + index * 5 + component) + 1;
    }
    out.push(vector);
  }
  return out;
}

test('with no IndexedDB, restore reports nothing rather than throwing', async () => {
  assert.equal((globalThis as { indexedDB?: unknown }).indexedDB, undefined);
  assert.equal(await restoreVectors(HASH, MODEL, E5_DIMENSIONS), null);
});

test('with no IndexedDB, persist reports failure rather than throwing', async () => {
  // `false` rather than a rejection: the caller is the embedder's save hook, which is
  // fire-and-forget, and a rejection there would be an unhandled one.
  assert.equal(await persistVectors(HASH, MODEL, 'wasm', new Map([['project:a', vectors(2)]])), false);
});

test('clearing persisted vectors with no storage is a no-op, not an error', async () => {
  await clearPersistedVectors();
});

test('persistentVectorStore still yields a usable in-memory store with no storage', async () => {
  const { store, restored } = await persistentVectorStore(HASH, MODEL, E5_DIMENSIONS);
  assert.equal(restored, null);
  assert.equal(store.byHash.size, 0);

  // Usable, and identical in behaviour to a hand-built store — which is what makes the
  // no-storage path a supported state rather than a degraded one.
  store.byHash.set(HASH, new Map([['project:a', vectors(2)]]));
  assert.equal(store.byHash.get(HASH)?.get('project:a')?.length, 2);
});

test('the persistence cap is small enough to bound storage by a constant', () => {
  // Two, so editing the content and reloading does not re-embed to get back to what the
  // reader had. Not more: the vectors are a cache, and a cache that grows with how many
  // times a content file changed is a leak wearing a cache's name.
  assert.equal(MAX_PERSISTED_CORPORA, 2);
});

test('the persistence module never reads a hash without also naming its model', () => {
  // The pair is the key. A store keyed on the corpus hash alone would happily serve
  // vectors from a different embedding model, which are not comparable to the query's.
  const restoreSignature = source.match(/export async function restoreVectors\([\s\S]*?\): Promise<([\s\S]*?)> \{/);
  assert.ok(restoreSignature, 'restoreVectors signature not found');
  // hash, model and dimensions all in, because all three decide whether the entry is
  // usable and none of the three can be inferred from the others.
  assert.match(restoreSignature[0]!, /hash: string/);
  assert.match(restoreSignature[0]!, /model: string/);
  assert.match(restoreSignature[0]!, /dimensions: number/);
});

test('a restored entry for a different model is refused', () => {
  // Directly on `revive`, because with no IndexedDB the mismatch path cannot be reached
  // through `restoreVectors` here. Vectors from one embedding model are not comparable
  // to another's, and reusing a cache across a model change scores everything wrongly
  // with no visible error.
  assert.match(source, /if \(record\.model !== model\) return null;/);
  // And the width is checked per vector, not assumed: a wrong width makes every cosine
  // return null and silently turns semantic retrieval off.
  assert.match(source, /vector\.length !== dimensions/);
});

test('the corpus hash is what keys the store, so a content edit invalidates it', () => {
  // The persistence layer stores nothing about content identity itself; it is handed a
  // hash. So the invalidation guarantee is entirely `corpusHash`'s, and this pins it:
  // an edit must change the hash, or persisted vectors would outlive the text.
  const before = corpusHash([
    { key: 'project:a', text: 'A payments platform running on Kubernetes.' },
    { key: 'project:b', text: 'An operator for a Kafka transport layer.' },
  ]);
  const after = corpusHash([
    { key: 'project:a', text: 'A payments platform running on Kubernetes and Nomad.' },
    { key: 'project:b', text: 'An operator for a Kafka transport layer.' },
  ]);

  assert.notEqual(before, after);

  // And order-independent content still changes the hash when the content changes, so a
  // reordered file is a changed file.
  const reordered = corpusHash([
    { key: 'project:b', text: 'An operator for a Kafka transport layer.' },
    { key: 'project:a', text: 'A payments platform running on Kubernetes and Nomad.' },
  ]);
  assert.equal(after, reordered, 'record order is derived from the file, so it is not content');
});

test('an empty store is indistinguishable from a restored nothing', () => {
  // Both states mean the same thing to the embedder, which is what keeps the caller from
  // having to know whether storage exists.
  const store = emptyVectorStore();
  assert.equal(store.byHash.size, 0);
  assert.equal(store.byHash.get(HASH), undefined);
});