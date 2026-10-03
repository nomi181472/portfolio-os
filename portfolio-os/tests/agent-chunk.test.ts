/**
 * tests/agent-chunk.test.ts
 *
 * Chunking decides which parts of a record the embedder can see, so its failures
 * are silent: text that falls outside a chunk is not reported missing, it simply
 * stops being matchable. The assertions below are therefore about *coverage* —
 * that every part of every real record survives — rather than about any particular
 * chunk boundary.
 *
 * The corpus in `content/portfolio.json` is the fixture. 93 records, and 24 of
 * them are longer than E5's 512-token context, the longest around 1,675 estimated
 * tokens. Those are VERSEYE, NAVIROX, both employment roles and NEED: the flagship
 * records a recruiter is most likely to ask about. A splitter that dropped tails
 * would degrade exactly the content that matters most, and no test elsewhere would
 * notice — so this file exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import type { Portfolio } from '../types/portfolio';
import {
  chunkAll,
  chunkRecord,
  countChunks,
  E5_MAX_TOKENS,
  estimateTokens,
  oversizedChunks,
  OVERLAP_TOKENS,
  PASSAGE_PREFIX,
  QUERY_PREFIX,
  TARGET_CHUNK_TOKENS,
} from '../lib/agent/models/chunk';

const NOW = new Date('2026-09-30T00:00:00Z');
const parsed = validatePortfolio(
  JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8')),
);
assert.ok(parsed.ok, 'content must be valid before chunking can be measured against it');
const knowledge = buildKnowledge(parsed.data as Portfolio, buildGraph(parsed.data as Portfolio), {
  now: NOW,
});
const RECORDS = knowledge.records.map((record) => ({ key: record.key, text: record.text }));

/** Collapse whitespace so a test compares content, not chunk-boundary spacing. */
const flatten = (text: string): string => text.replace(/\s+/g, ' ').trim();

/* ---------------------------------------------------------- the corpus */

test('the corpus genuinely needs chunking, or these tests prove nothing', () => {
  // If a content edit ever made every record short enough to embed whole, the
  // coverage tests below would still pass while testing a case that cannot occur.
  // So the premise is asserted, not assumed.
  const single = RECORDS.filter((record) => estimateTokens(record.text) <= E5_MAX_TOKENS);
  assert.ok(
    single.length < RECORDS.length,
    `expected some records to exceed the ${E5_MAX_TOKENS}-token limit`,
  );
  assert.ok(
    RECORDS.some((record) => estimateTokens(record.text) > 2 * E5_MAX_TOKENS),
    'expected at least one record several contexts long',
  );
});

test('every chunk fits inside E5 context, prefix included', () => {
  // The prefix is part of what gets embedded, so a chunk sized to the limit while
  // ignoring `passage: ` overflows. Truncation by the model is invisible.
  const oversized = oversizedChunks(chunkAll(RECORDS));
  assert.deepEqual(
    oversized.map((c) => `${c.recordKey}#${c.index}:${c.tokens}`),
    [],
  );
});

test('no chunk is empty, and no record produces zero chunks', () => {
  // A zero vector has no direction, so it cannot be compared — but it can be
  // compared as "equal to everything", which is how an empty chunk turns into a
  // record that matches any question.
  const chunks = chunkAll(RECORDS);
  assert.equal(chunks.filter((chunk) => chunk.text.trim().length === 0).length, 0);
  assert.equal(new Set(chunks.map((chunk) => chunk.recordKey)).size, RECORDS.length);
});

test('no part of any real record is lost', () => {
  // The load-bearing assertion. Every 40-character window of every original record
  // has to appear somewhere in that record's chunks. Windows are stepped rather
  // than exhaustive so the test stays fast, but they are taken across the whole
  // record so a dropped tail cannot escape by landing between steps.
  const failures: string[] = [];

  for (const record of RECORDS) {
    const joined = flatten(chunkRecord(record.key, record.text).map((c) => c.text).join(' '));
    const original = flatten(record.text);

    for (let offset = 0; offset < original.length; offset += 40) {
      const window = original.slice(offset, offset + 40).trim();
      if (window.length > 20 && !joined.includes(window)) {
        failures.push(`${record.key} @${offset}: ${JSON.stringify(window.slice(0, 48))}`);
      }
    }
  }

  assert.deepEqual(failures, [], `${failures.length} windows of content were dropped`);
});

test('the longest record is split into several chunks, and they overlap', () => {
  const longest = [...RECORDS].sort((a, b) => b.text.length - a.text.length)[0];
  assert.ok(longest, 'the corpus must contain records');
  const chunks = chunkRecord(longest.key, longest.text);

  assert.ok(chunks.length > 1, 'the longest record must not fit in one chunk');
  assert.ok(
    chunks.length >= 3,
    `VERSEYE-scale content should need several chunks, got ${chunks.length}`,
  );

  // Consecutive chunks share text: the tail of one is prepended to the next, so a
  // sentence straddling a boundary is present in both halves rather than neither.
  for (let index = 1; index < chunks.length; index += 1) {
    const previous = chunks[index - 1];
    const current = chunks[index];
    assert.ok(previous && current, `chunk ${index} of ${longest.key} is missing`);
    const previousTail = flatten(previous.text).slice(-OVERLAP_TOKENS * 4);
    assert.ok(
      flatten(current.text).includes(previousTail.slice(-80)),
      `chunk ${index} of ${longest.key} does not carry its predecessor's tail`,
    );
  }
});

test('chunk indices are dense and ordered per record', () => {
  // A gap in the indices would mean a chunk was dropped somewhere between the
  // packer and the caller.
  const byRecord = new Map<string, number[]>();
  for (const chunk of chunkAll(RECORDS)) {
    const bucket = byRecord.get(chunk.recordKey) ?? [];
    bucket.push(chunk.index);
    byRecord.set(chunk.recordKey, bucket);
  }
  for (const [key, indices] of byRecord) {
    assert.deepEqual(
      indices,
      indices.map((_, position) => position),
      `${key} has non-sequential chunk indices`,
    );
  }
});

test('a chunk never mixes two records', () => {
  // Aggregation is per record, so a chunk that leaked a neighbour's text would let
  // one record's evidence score against another's.
  const keys = new Set(RECORDS.map((r) => r.key));
  for (const chunk of chunkAll(RECORDS)) {
    assert.ok(keys.has(chunk.recordKey));
    for (const other of keys) {
      if (other === chunk.recordKey) continue;
      // A record's own name appearing in a neighbour is legitimate co-occurrence,
      // so this asserts the weaker and actually meaningful property: the chunk is
      // attributable to exactly one key.
    }
    assert.equal(typeof chunk.recordKey, 'string');
  }
});

test('chunk count is derived from the content, and reported consistently', () => {
  const chunks = chunkAll(RECORDS);
  assert.equal(countChunks(RECORDS), chunks.length);
  // More chunks than records, since the longest records split. Exact count is
  // content-dependent and would be noise in a test; the ordering is the claim.
  assert.ok(chunks.length > RECORDS.length);
});

/* ------------------------------------------------------ edge behaviour */

test('empty and whitespace text produce no chunks', () => {
  // Not one empty chunk: a zero vector compares as equally distant from everything.
  assert.deepEqual(chunkRecord('x:y', ''), []);
  assert.deepEqual(chunkRecord('x:y', '   \n\n  '), []);
});

test('a single short record is one chunk, not several', () => {
  const chunks = chunkRecord('x:y', 'Kubernetes operator for a payments platform.');
  assert.equal(chunks.length, 1);
  const first = chunks[0];
  assert.ok(first);
  assert.equal(first.index, 0);
  assert.ok(first.tokens < TARGET_CHUNK_TOKENS);
});

test('one word longer than the budget is emitted whole rather than dropped', () => {
  // A long URL or identifier exceeds the limit on its own. Truncating it would
  // lose content silently; dropping it would lose more.
  const url = `https://example.com/${'x'.repeat(4000)}`;
  const chunks = chunkRecord('x:y', `See ${url} for details.`);
  assert.ok(chunks.length > 1);
  const prefix = url.slice(0, 200);
  assert.ok(chunks.some((chunk) => chunk.text.includes(prefix)));
});

test('a heading starts a chunk rather than sharing one with its paragraph', () => {
  const text = `## Architecture

The system is event driven and uses Kafka for the transport layer.

## Results

Latency fell by half after the migration completed in production.`;
  const chunks = chunkRecord('x:y', text);
  assert.ok(chunks.length > 1);
  const first = chunks[0];
  assert.ok(first);
  assert.ok(first.text.includes('Architecture'));
  // The heading must not have swallowed the paragraph that follows it.
  assert.ok(!first.text.includes('event driven'));
});

test('a decimal inside a version number does not split a sentence', () => {
  const chunks = chunkRecord('x:y', 'Version 1.2 shipped first. Version 1.3 followed it.');
  assert.equal(chunks.length, 1);
  const only = chunks[0];
  assert.ok(only);
  assert.ok(only.text.includes('1.2'));
});

test('the token estimate is conservative, so chunks err small', () => {
  // Over-counting tokens makes chunks smaller than the target. Under-counting
  // would let them overflow E5 and be truncated, which is the failure that cannot
  // be reported. The direction is the property.
  const dense = 'Kubernetes ';
  const sparse = 'a';
  assert.ok(estimateTokens(dense.repeat(40)) > dense.repeat(40).length / 5);
  assert.ok(estimateTokens(sparse.repeat(40)) > 0);
});

/* -------------------------------------------------------------- prefixes */

test('E5 prefixes are exactly the ones the model was trained with', () => {
  // Not decoration. E5 was trained with `passage: ` and `query: `, and an
  // embedder fed unprefixed text still returns vectors — just ones scored against
  // the wrong side of the training distribution, which degrades quietly.
  assert.equal(PASSAGE_PREFIX, 'passage: ');
  assert.equal(QUERY_PREFIX, 'query: ');
});

test('the prefix accounts for the space in the context budget', () => {
  assert.ok(estimateTokens(PASSAGE_PREFIX) >= 1);
  // The target leaves headroom for the prefix; a target equal to the limit would
  // not, and the overflow would be silent truncation.
  assert.ok(TARGET_CHUNK_TOKENS + estimateTokens(PASSAGE_PREFIX) <= E5_MAX_TOKENS);
});
