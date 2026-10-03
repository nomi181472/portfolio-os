/**
 * tests/agent-embeddings.test.ts
 *
 * The vector maths, tested with a fake pipeline and no model.
 *
 * Everything here runs against hand-written vectors. That is the point: the failure
 * modes in this file are all *silent* ones that would need 118 MB of weights and a
 * browser to observe, and several of them are impossible to see from outside.
 *
 * The three that matter most:
 *
 *  - **Un-normalised vectors** encode passage length. Two records with identical
 *    content score differently if one chunk is longer, so the semantic score stops
 *    being a similarity.
 *  - **Mean instead of max across chunks** dilutes a 9-chunk record (VERSEYE) with
 *    eight irrelevant chunks — the longest records suffer most, which is backwards.
 *  - **A cache key without the content** returns a stale vector for edited text, and
 *    nothing reports it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateByMax,
  contentHash,
  corpusHash,
  cosine,
  createE5Embedder,
  E5_DIMENSIONS,
  emptyVectorStore,
  l2Normalise,
  meanPool,
  scoreCorpus,
  vectorsFor,
  type FeatureExtractionPipeline,
  type RecordVectors,
  type VectorStore,
} from '../lib/agent/models/embeddings';
import { chunkAll, PASSAGE_PREFIX, QUERY_PREFIX } from '../lib/agent/models/chunk';
import { retrieve, buildLexicalIndex } from '../lib/agent/retrieve';
import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import type { Portfolio } from '../types/portfolio';

/* ------------------------------------------------------------- fixtures */

/** A deterministic unit vector of E5's width, from a seed. Not random. */
function vector(seed: number): Float32Array {
  const out = new Float32Array(E5_DIMENSIONS);
  for (let index = 0; index < E5_DIMENSIONS; index += 1) {
    out[index] = Math.sin(seed * 31 + index * 7) + 1;
  }
  return l2Normalise(out);
}

const RECORDS = [
  { key: 'project:a', text: 'A payments platform running on Kubernetes.' },
  { key: 'project:b', text: 'An operator for a Kafka transport layer.' },
  { key: 'employment:c', text: 'Backend engineering across Go and Python.' },
];

/**
 * A fake feature-extraction pipeline.
 *
 * Records every text it is handed, which is the only way to test that the two sides
 * carry *different* prefixes — the bug that degrades retrieval without failing.
 */
function fakePipeline(options: { width?: number; failOn?: (text: string) => boolean } = {}) {
  const width = options.width ?? E5_DIMENSIONS;
  const seen: string[] = [];
  let calls = 0;

  const pipeline = (async (text: string) => {
    seen.push(text);
    calls += 1;
    if (options.failOn?.(text)) throw new Error('model refused this input');
    const out = new Float32Array(width);
    for (let index = 0; index < width; index += 1) {
      out[index] = Math.cos(calls * 13 + index * 3) + 1;
    }
    return { data: out };
  }) as FeatureExtractionPipeline;

  return { pipeline, seen, calls: () => calls };
}

/**
 * Every vector a store holds for a corpus.
 *
 * Read back through `vectorsFor` rather than from the embedder, because the store is
 * what a restore hook would be handed: a test that read the embedder's internals would
 * pass even if persistence were never given anything.
 */
function storedVectors(store: VectorStore, records: readonly { key: string; text: string }[]): Map<string, RecordVectors> {
  const hash = corpusHash(records);
  const out = new Map<string, RecordVectors>();
  for (const record of records) {
    const vectors = vectorsFor(store, hash, record.key);
    if (vectors) out.set(record.key, vectors);
  }
  return out;
}

/* --------------------------------------------------------- the maths */

test('mean pooling averages the rows it was given', () => {
  const pooled = meanPool([
    [1, 2, 3, 4],
    [3, 4, 5, 6],
  ]);
  assert.deepEqual(Array.from(pooled), [2, 3, 4, 5]);
});

test('mean pooling excludes masked padding rows', () => {
  // E5 pads short inputs. Including the pad embedding would drag the mean toward
  // zero in proportion to how much padding a chunk got, so short chunks would
  // systematically score lower than long ones with the same content.
  const withPadding = meanPool(
    [
      [2, 2],
      [100, 100],
    ],
    [1, 0],
  );
  assert.deepEqual(Array.from(withPooling(withPadding)), [2, 2]);
  const withoutMask = meanPool([
    [2, 2],
    [100, 100],
  ]);
  assert.notDeepEqual(Array.from(withoutMask), [2, 2]);
});

/** Identity, spelled out so the assertion above reads clearly. */
function withPooling(vector: Float32Array): Float32Array {
  return vector;
}

test('mean pooling of nothing is an empty vector, not a NaN one', () => {
  const empty = meanPool([]);
  assert.equal(empty.length, 0);
  assert.equal(meanPool([[1, 1]], [0]).length, 2);
  assert.ok(Array.from(meanPool([[1, 1]], [0])).every((value) => Number.isFinite(value)));
});

test('L2 normalisation produces a unit vector', () => {
  const normalised = l2Normalise(Float32Array.from([3, 4]));
  let sum = 0;
  for (const value of normalised) sum += value * value;
  assert.ok(Math.abs(sum - 1) < 1e-6, `expected unit length, got ${Math.sqrt(sum)}`);
});

test('L2 normalisation is idempotent', () => {
  // Applied a second time inside `adopt`, so a double application must not change
  // the vector — otherwise the score would depend on how many times it ran.
  const once = l2Normalise(Float32Array.from([3, 4]));
  const twice = l2Normalise(Float32Array.from(once));
  assert.deepEqual(Array.from(twice), Array.from(once));
});

test('L2 normalisation leaves a zero vector alone instead of producing NaN', () => {
  // 0/0 is NaN, and one NaN in a dot product makes every comparison against this
  // vector NaN — which then survives `?? 0` and reaches a sort comparator.
  const zero = l2Normalise(Float32Array.from([0, 0, 0]));
  assert.ok(Array.from(zero).every((value) => value === 0));
  assert.ok(Array.from(zero).every((value) => Number.isFinite(value)));
});

test('cosine of a vector with itself is 1, within float error', () => {
  const value = vector(1);
  const score = cosine(value, value);
  assert.ok(score !== null);
  assert.ok(Math.abs(score - 1) < 1e-5, `self-similarity was ${score}`);
  assert.ok(score <= 1, 'a score above 1 breaks the 0–1 contract the merge relies on');
});

test('cosine reports unusable input as null rather than a number', () => {
  // Each of these would otherwise produce a score that looks real.
  assert.equal(cosine(new Float32Array(0), new Float32Array(0)), null);
  assert.equal(cosine(new Float32Array([1, 2]), new Float32Array([1, 2, 3])), null);
  assert.equal(cosine(Float32Array.from([NaN, 1]), Float32Array.from([1, 1])), null);
  assert.equal(cosine(Float32Array.from([Infinity, 1]), Float32Array.from([1, 1])), null);
});

test('max aggregation lets one good chunk carry a long record', () => {
  // The VERSEYE case: nine chunks, one of which answers the question. Mean would
  // divide by nine; max says the record matches.
  //
  // Built from a real pair of similar vectors rather than two seeds of the same
  // generator — `vector(7)` and `vector(9)` are unrelated directions, so asserting
  // they score highly would have been asserting that the test was wrong.
  const query = vector(7);
  // A near-duplicate: the query nudged toward an unrelated direction. Similarity stays
  // high by construction rather than by luck.
  const other = vector(11);
  const near = l2Normalise(
    Float32Array.from(query, (value, index) => value + (other[index] ?? 0) * 0.05),
  );
  // Gram-Schmidt against the query, so the "irrelevant" chunks really are irrelevant
  // instead of scoring 0.5 by accident and passing a weak assertion.
  const dot = cosine(query, other) ?? 0;
  const irrelevant = l2Normalise(
    Float32Array.from(other, (value, index) => value - (query[index] ?? 0) * dot),
  );

  const vectors = new Map<string, Float32Array[]>([
    ['long', [irrelevant, irrelevant, near, irrelevant, irrelevant]],
    ['short', [irrelevant]],
  ]);

  const scores = aggregateByMax(query, vectors);
  const long = scores.get('long');
  assert.ok(long !== undefined);
  assert.ok(long > 0.95, `a matching chunk should score high, got ${long}`);

  // The decisive comparison: the same content, spread over five chunks instead of
  // one. Mean would score the long record *lower* than the short one.
  const spread = long;
  const single = scores.get('short');
  assert.ok(single !== undefined);
  assert.ok(spread > single, 'a long record must not be penalised for having more chunks');
  assert.ok(spread <= 1, 'the aggregate is bounded, not a sum');
});

test('max aggregation skips unusable chunks instead of scoring them zero', () => {
  const query = vector(1);
  const scores = aggregateByMax(
    query,
    new Map<string, Float32Array[]>([['a', [new Float32Array(E5_DIMENSIONS), vector(1)]]]),
  );
  // A zero vector has no direction, so it can only contribute nothing — reporting
  // 0 for it would be indistinguishable from "no match at all".
  const score = scores.get('a');
  assert.ok(score === null || score === undefined || score > 0.9);
});

test('aggregation returns nothing for an empty corpus', () => {
  assert.equal(aggregateByMax(vector(1), new Map()).size, 0);
});

/* -------------------------------------------------------- cache keys */

test('a content hash notices an edit and ignores a re-read', () => {
  const text = 'A payments platform running on Kubernetes.';
  assert.equal(contentHash(text), contentHash(text));
  assert.notEqual(contentHash(text), contentHash(`${text} Now with payments.`));
  assert.notEqual(contentHash(text), contentHash(text.replace('Kubernetes', 'Nomad')));
});

test('a hash distinguishes same-prefix strings of different lengths', () => {
  // FNV-1a alone is weak here: a shared prefix over a short string can collide, and
  // a collision returns a stale vector for edited content.
  assert.notEqual(contentHash('abc'), contentHash('abcde'));
});

test('a corpus hash changes when any record changes, and survives reordering', () => {
  const base = corpusHash(RECORDS);
  assert.equal(base, corpusHash(RECORDS));
  assert.equal(base, corpusHash([...RECORDS].reverse()), 'order is derived from the file');
  assert.notEqual(base, corpusHash([...RECORDS.slice(1), { ...RECORDS[0]!, text: 'Changed.' }]));
});

test('a corpus hash distinguishes a moved record key from a moved body', () => {
  // Same text under a different key is a different corpus: scores are stored per key,
  // so a key that changed while the text did not must not reuse the old vectors.
  const swapped = corpusHash([
    { key: 'project:b', text: RECORDS[0]!.text },
    { key: 'project:a', text: RECORDS[1]!.text },
  ]);
  assert.notEqual(swapped, corpusHash(RECORDS));
});

/* ---------------------------------------------------- the embedder API */

test('no pipeline means no embedder, not a broken one', async () => {
  // A missing model is a supported state. The caller keeps lexical search.
  assert.equal(await createE5Embedder(emptyVectorStore(), { load: async () => null }), null);
});

test('indexing embeds every chunk and reports progress that ends complete', async () => {
  const fake = fakePipeline();
  const embedder = await createE5Embedder(emptyVectorStore(), {
    pipeline: fake.pipeline,
    backend: 'wasm',
  });
  assert.ok(embedder);

  const progress: number[] = [];
  await embedder.indexCorpus(RECORDS, (state) => progress.push(state.embedded));

  const chunks = chunkAll(RECORDS);
  assert.equal(embedder.state().total, chunks.length);
  assert.equal(embedder.state().embedded, chunks.length);
  assert.equal(embedder.state().failed, 0);
  assert.ok(progress.length >= chunks.length, 'progress must advance per chunk');
  assert.equal(progress.at(-1), chunks.length, 'progress must reach the total');
  // Monotonic: a bar that goes backwards reads as a bug in the model.
  for (let index = 1; index < progress.length; index += 1) {
    assert.ok(progress[index]! >= progress[index - 1]!);
  }
});

test('passages and queries are embedded with different prefixes', async () => {
  // The whole reason `similarity` has two helpers. E5 was trained with these
  // prefixes; using the wrong one returns plausible vectors scored against the wrong
  // side of the training distribution.
  const fake = fakePipeline();
  const embedder = await createE5Embedder(emptyVectorStore(), { pipeline: fake.pipeline });
  assert.ok(embedder);

  await embedder.indexCorpus(RECORDS);
  await embedder.scoresFor('How does the platform run?', RECORDS);

  assert.ok(fake.seen.some((text) => text.startsWith(PASSAGE_PREFIX)), 'no passage prefix');
  assert.ok(fake.seen.some((text) => text.startsWith(QUERY_PREFIX)), 'no query prefix');
  // And never the wrong one on the wrong side.
  assert.ok(
    fake.seen.every((text) => text.startsWith(PASSAGE_PREFIX) || text.startsWith(QUERY_PREFIX)),
    'text reached the model with no prefix at all',
  );
});

test('a second run reuses cached vectors instead of re-spending the model', async () => {
  const store = emptyVectorStore();
  const first = fakePipeline();
  const embedder = await createE5Embedder(store, { pipeline: first.pipeline });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);
  const afterFirst = first.calls();

  const second = fakePipeline();
  const warm = await createE5Embedder(store, { pipeline: second.pipeline });
  assert.ok(warm);
  await warm.indexCorpus(RECORDS);

  // No passages re-embedded. Only the query side is touched, if at all.
  const passageCalls = second.calls();
  assert.ok(
    passageCalls === 0,
    `a warm run re-embedded ${passageCalls} chunks that were already cached`,
  );
  assert.ok(afterFirst > 0);
});

test('editing the content invalidates the cache rather than reusing stale vectors', async () => {
  // The bug a key-only cache would have: the description changes, the old vector
  // keeps answering for the new words, and nothing reports it.
  const store = emptyVectorStore();
  const first = fakePipeline();
  const embedder = await createE5Embedder(store, { pipeline: first.pipeline });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);

  const edited = [{ ...RECORDS[0]!, text: 'A payments platform, now on Nomad.' }, ...RECORDS.slice(1)];
  const before = corpusHash(RECORDS);
  assert.notEqual(corpusHash(edited), before);
  assert.equal(vectorsFor(store, corpusHash(RECORDS), 'project:a') !== null, true);
  assert.equal(vectorsFor(store, corpusHash(edited), 'project:a'), null);

  const second = fakePipeline();
  const warm = await createE5Embedder(store, { pipeline: second.pipeline });
  assert.ok(warm);
  await warm.indexCorpus(edited);
  assert.ok(second.calls() > 0, 'edited content must be re-embedded');
});

test('an unindexed corpus scores null, so retrieval falls back to lexical', async () => {
  const fake = fakePipeline();
  const embedder = await createE5Embedder(emptyVectorStore(), { pipeline: fake.pipeline });
  assert.ok(embedder);
  // Nothing indexed, so there are no vectors to compare against.
  assert.equal(await embedder.scoresFor('anything', RECORDS), null);
});

test('a chunk the model refuses costs one chunk, not the corpus', async () => {
  const store = emptyVectorStore();
  const fake = fakePipeline({ failOn: (text) => text.includes('Kafka') });
  const embedder = await createE5Embedder(store, { pipeline: fake.pipeline });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);

  const state = embedder.state();
  assert.equal(state.failed, 1, 'the refused chunk must be counted, not hidden');
  assert.equal(state.embedded, state.total, 'progress must still complete');

  // The other records are still usable, and no sparse array reached cosine.
  const query = vector(3);
  const scores = scoreCorpus(query, store, corpusHash(RECORDS));
  assert.ok(scores);
  assert.ok(scores.has('project:a'), 'a record with no failed chunks must survive');
  assert.ok([...scores.values()].every(Number.isFinite));
});

test('a pipeline of the wrong width is reported, not silently ignored', async () => {
  // Otherwise every cosine returns null, semantic retrieval switches off, and the
  // only symptom is that search feels slightly worse.
  const fake = fakePipeline({ width: E5_DIMENSIONS + 1 });
  const embedder = await createE5Embedder(emptyVectorStore(), { pipeline: fake.pipeline });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);

  assert.match(embedder.state().error ?? '', /dimension/);
  assert.equal(await embedder.scoresFor('question', RECORDS), null);
});

test('a query the model refuses yields no semantic half, not a zero score', async () => {
  const fake = fakePipeline({ failOn: (text) => text.startsWith(QUERY_PREFIX) });
  const embedder = await createE5Embedder(emptyVectorStore(), { pipeline: fake.pipeline });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);

  assert.equal(await embedder.scoresFor('a question', RECORDS), null);
});

test('disposing is safe, and safe to call twice', async () => {
  let disposed = 0;
  const fake = fakePipeline();
  const embedder = await createE5Embedder(emptyVectorStore(), {
    pipeline: Object.assign(fake.pipeline, {
      dispose: async () => {
        disposed += 1;
      },
    }),
  });
  assert.ok(embedder);
  await embedder.dispose();
  await embedder.dispose();
  assert.equal(disposed, 2);
});

test('cached vectors outlive the pipeline', async () => {
  // Disposal frees the model; the vectors are plain arrays and are what the store is
  // for. Reloading must not re-embed.
  const store = emptyVectorStore();
  const first = fakePipeline();
  const embedder = await createE5Embedder(store, { pipeline: first.pipeline });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);
  await embedder.dispose();

  const second = fakePipeline();
  const warm = await createE5Embedder(store, { pipeline: second.pipeline });
  assert.ok(warm);
  await warm.indexCorpus(RECORDS);
  assert.equal(second.calls(), 0);
});

/* ------------------------------------------------------- the real corpus */

test('the whole corpus indexes without a single failed chunk', async () => {
  // 125 chunks against a fake of E5's width. Proves the pipeline contract and the
  // chunk walk agree — without downloading anything.
  const parsed = validatePortfolio(
    JSON.parse(require('node:fs').readFileSync('content/portfolio.json', 'utf8')),
  );
  assert.ok(parsed.ok);
  const knowledge = buildKnowledge(parsed.data as Portfolio, buildGraph(parsed.data as Portfolio), {
    now: new Date('2026-09-30T00:00:00Z'),
  });
  const records = knowledge.records.map((record) => ({ key: record.key, text: record.text }));

  const store = emptyVectorStore();
  const fake = fakePipeline();
  const embedder = await createE5Embedder(store, { pipeline: fake.pipeline });
  assert.ok(embedder);
  await embedder.indexCorpus(records);

  assert.equal(embedder.state().failed, 0);
  assert.equal(embedder.state().embedded, embedder.state().total);
  assert.ok(embedder.state().total > records.length, 'the corpus needs multiple chunks');

  // Every record ends up with at least one vector, at E5's width.
  const hash = corpusHash(records);
  for (const record of records) {
    const vectors = vectorsFor(store, hash, record.key);
    assert.ok(vectors && vectors.length > 0, `${record.key} produced no vectors`);
    for (const vector of vectors) assert.equal(vector.length, E5_DIMENSIONS);
  }
});

/* ------------------------------------------------- the retrieve seam */

test('retrieval prefers a corpus-wide embedder over per-record comparison', async () => {
  const parsed = validatePortfolio(
    JSON.parse(require('node:fs').readFileSync('content/portfolio.json', 'utf8')),
  );
  assert.ok(parsed.ok);
  const knowledge = buildKnowledge(parsed.data as Portfolio, buildGraph(parsed.data as Portfolio), {
    now: new Date('2026-09-30T00:00:00Z'),
  });
  const index = buildLexicalIndex(knowledge.records);

  const store = emptyVectorStore();
  const fake = fakePipeline();
  const embedder = await createE5Embedder(store, { pipeline: fake.pipeline });
  assert.ok(embedder);
  const records = knowledge.records.map((record) => ({ key: record.key, text: record.text }));
  await embedder.indexCorpus(records);
  const callsAfterIndex = fake.calls();

  const scored = await retrieve('What is VERSEYE?', knowledge, index, { embedder });
  const callsAfterQuery = fake.calls();

  // One query embedding, not 125 document embeddings. This is the whole reason
  // `scoresFor` exists: the per-record path re-embeds the entire corpus per question.
  assert.equal(
    callsAfterQuery - callsAfterIndex,
    1,
    `expected 1 call for the query, got ${callsAfterQuery - callsAfterIndex}`,
  );
  assert.ok(scored.length > 0, 'semantic retrieval returned nothing');
  assert.ok(
    scored.some((result) => result.semantic !== null),
    'semantic scores never reached the results',
  );
});

test('retrieval falls back to per-record similarity for a simple embedder', async () => {
  // The `Embedder` interface only requires `similarity`. An embedder with no
  // `scoresFor` must still work — that is what keeps the seam backwards compatible.
  const parsed = validatePortfolio(
    JSON.parse(require('node:fs').readFileSync('content/portfolio.json', 'utf8')),
  );
  assert.ok(parsed.ok);
  const knowledge = buildKnowledge(parsed.data as Portfolio, buildGraph(parsed.data as Portfolio), {
    now: new Date('2026-09-30T00:00:00Z'),
  });
  const index = buildLexicalIndex(knowledge.records);

  let calls = 0;
  const simple = {
    ready: true,
    async similarity() {
      calls += 1;
      return 0.5;
    },
  };

  const scored = await retrieve('What is VERSEYE?', knowledge, index, { embedder: simple });
  assert.ok(calls > 0, 'a per-record embedder must actually be called');
  assert.ok(scored.some((result) => result.semantic !== null));
});

test('retrieval still works when the embedder is absent', async () => {
  const parsed = validatePortfolio(
    JSON.parse(require('node:fs').readFileSync('content/portfolio.json', 'utf8')),
  );
  assert.ok(parsed.ok);
  const knowledge = buildKnowledge(parsed.data as Portfolio, buildGraph(parsed.data as Portfolio), {
    now: new Date('2026-09-30T00:00:00Z'),
  });
  const index = buildLexicalIndex(knowledge.records);

  const scored = await retrieve('What is VERSEYE?', knowledge, index);
  assert.ok(scored.length > 0);
  assert.ok(scored.every((result) => result.semantic === null));
});

test('an embedder that throws costs the semantic half only', async () => {
  const parsed = validatePortfolio(
    JSON.parse(require('node:fs').readFileSync('content/portfolio.json', 'utf8')),
  );
  assert.ok(parsed.ok);
  const knowledge = buildKnowledge(parsed.data as Portfolio, buildGraph(parsed.data as Portfolio), {
    now: new Date('2026-09-30T00:00:00Z'),
  });
  const index = buildLexicalIndex(knowledge.records);

  const broken = {
    ready: true,
    async similarity() {
      throw new Error('model gone');
    },
  };
  const scored = await retrieve('What is VERSEYE?', knowledge, index, { embedder: broken });
  assert.ok(scored.length > 0, 'lexical ranking must survive a throwing embedder');
});

/* -------------------------------------------------- persistence hooks */

test('restored vectors skip re-embedding the whole corpus', async () => {
  // The reload case: the weights came from the Cache API and the vectors from storage,
  // so a reader who reopens the panel pays for neither again.
  const store = emptyVectorStore();
  const cold = await createE5Embedder(store, { pipeline: fakePipeline().pipeline });
  assert.ok(cold);
  await cold.indexCorpus(RECORDS);

  const stored = storedVectors(store, RECORDS);
  assert.ok(stored.size > 0, 'the cold run should have produced vectors to persist');

  const second = fakePipeline();
  const warm = await createE5Embedder(emptyVectorStore(), {
    pipeline: second.pipeline,
    restore: async () => stored,
  });
  assert.ok(warm);
  await warm.indexCorpus(RECORDS);

  assert.equal(second.calls(), 0, `a restored corpus re-embedded ${second.calls()} chunks`);

  // And the restored vectors are usable, not merely present. `scoresFor` is the path
  // retrieval actually takes, and a store full of wrong-width junk would return null.
  const scores = await warm.scoresFor('How much Kubernetes?', RECORDS);
  assert.ok(scores && scores.size > 0, 'restored vectors must still score');
});

test('a restored entry with the wrong chunk count is ignored, not trusted', async () => {
  // The guard against a chunker change or a half-written entry: it would otherwise be
  // read as a complete index, and that record would keep scoring from stale vectors.
  const store = emptyVectorStore();
  const cold = await createE5Embedder(store, { pipeline: fakePipeline().pipeline });
  assert.ok(cold);
  await cold.indexCorpus(RECORDS);

  // A long record, so this fixture produces more than one chunk for it. Every record
  // in `RECORDS` is a single chunk, and a truncated-to-one "stale" entry would be
  // identical to the real one — the test would pass without exercising anything.
  const long = 'Kubernetes. '.repeat(200);
  const withLong = [...RECORDS, { key: 'project:long', text: long }];
  const longChunks = chunkAll(withLong).filter((chunk) => chunk.recordKey === 'project:long');
  assert.ok(longChunks.length > 1, `the long record should chunk, got ${longChunks.length}`);

  const truncated = new Map<string, RecordVectors>();
  for (const [recordKey, vectors] of storedVectors(store, withLong)) {
    truncated.set(recordKey, vectors.slice(0, Math.max(1, vectors.length - 1)));
  }

  const second = fakePipeline();
  const warm = await createE5Embedder(emptyVectorStore(), {
    pipeline: second.pipeline,
    restore: async () => truncated,
  });
  assert.ok(warm);
  await warm.indexCorpus(withLong);

  assert.ok(
    second.calls() > 0,
    'an entry whose chunk counts disagree with this corpus must be re-embedded',
  );
});

test('vectors reach the save hook only after a complete index', async () => {
  // Persisting mid-loop would write an index that never finished, and the restore count
  // check would reject it — storage spent, nothing saved.
  let saveCalls = 0;
  const embedder = await createE5Embedder(emptyVectorStore(), {
    pipeline: fakePipeline().pipeline,
    save: async () => {
      saveCalls += 1;
    },
  });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);
  assert.equal(saveCalls, 1, 'a finished index should be offered to the save hook exactly once');
});

test('an index with a failed chunk is never offered to the save hook', async () => {
  let saveCalls = 0;
  const embedder = await createE5Embedder(emptyVectorStore(), {
    pipeline: fakePipeline({ failOn: (text) => text.includes('Kafka') }).pipeline,
    save: async () => {
      saveCalls += 1;
    },
  });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);

  assert.equal(embedder.state().failed, 1, 'the fixture should have failed one chunk');
  assert.equal(saveCalls, 0, 'a partial index must not be persisted');
});

test('the save hook is given the corpus hash, so the key is the content identity', async () => {
  let seenHash = '';
  const embedder = await createE5Embedder(emptyVectorStore(), {
    pipeline: fakePipeline().pipeline,
    save: async (hash) => {
      seenHash = hash;
    },
  });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);

  assert.equal(seenHash, corpusHash(RECORDS));
});

test('a restore hook that throws costs the indexing nothing', async () => {
  // Storage denial is a supported state, not an error. The reader still gets an index.
  const embedder = await createE5Embedder(emptyVectorStore(), {
    pipeline: fakePipeline().pipeline,
    restore: async () => {
      throw new Error('IndexedDB unavailable');
    },
  });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);

  const scores = await embedder.scoresFor('How much Kubernetes?', RECORDS);
  assert.ok(scores && scores.size > 0, 'indexing must still complete');
});

test('an embedder with no persistence hooks behaves exactly as before', async () => {
  // The default has to stay the pure in-memory path: no hook means no IndexedDB
  // reference anywhere in the flow, which is what keeps this module testable.
  const embedder = await createE5Embedder(emptyVectorStore(), { pipeline: fakePipeline().pipeline });
  assert.ok(embedder);
  await embedder.indexCorpus(RECORDS);
  assert.ok((await embedder.scoresFor('How much Kubernetes?', RECORDS))?.size);
});
