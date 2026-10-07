/**
 * tests/agent-retrieval.test.ts
 *
 * Unit tests for lexical BM25 retrieval, alias normalization, and match scoring.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import { buildAliasTable, resolveTerm } from '../lib/agent/aliases';
import { buildLexicalIndex, retrieve } from '../lib/agent/retrieve';
import { normalisePosting, normaliseQuestion } from '../lib/agent/normalize';
import { looksLikeJobDescription, splitPosting } from '../lib/agent/intent';
import { scoreMatch } from '../lib/agent/scoring';
import type { Portfolio } from '../types/portfolio';

const NOW = new Date('2026-10-04T00:00:00Z');
const rawPortfolio = JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8'));
const parsed = validatePortfolio(rawPortfolio);
assert.ok(parsed.ok, 'portfolio must validate');
const portfolio: Portfolio = parsed.data;
const graph = buildGraph(portfolio);
const knowledge = buildKnowledge(portfolio, graph, { now: NOW });
const aliases = buildAliasTable(knowledge);
const lexical = buildLexicalIndex(knowledge.records);

test('BM25 lexical index finds exact match records', async () => {
  const hits = await retrieve('Kubernetes', knowledge, lexical, { limit: 5 });
  assert.ok(hits.length > 0);
  assert.ok(hits.some((h) => h.record.name.toLowerCase().includes('kubernetes')));
});

test('aliases normalise common tech abbreviations', () => {
  const normalised = normaliseQuestion('Do you know Docker?', aliases);
  assert.ok(normalised.terms.length > 0);
  assert.ok((normalised.terms[0]?.canonicalIds?.length ?? 0) > 0);
});

test('job posting detection distinguishes postings from regular questions', () => {
  const normalQ = 'What did you build at Ktrade?';
  assert.equal(looksLikeJobDescription(normalQ), false);

  const posting = `We are looking for a Senior Engineer:
Requirements:
- Go
- Docker
- AWS`;
  assert.equal(looksLikeJobDescription(posting), true);

  const split = splitPosting(posting);
  assert.ok(split.requirements.length >= 3);
});

test('scoreMatch identifies strong, partial, and unverifiable skills', () => {
  const posting = `Requirements:
- Kubernetes
- NonExistentTechXYZ`;
  const split = splitPosting(posting);
  const terms = normalisePosting(split.requirements, '', aliases);
  const match = scoreMatch({ terms, knowledge });

  assert.ok(match.score > 0);
  assert.ok(match.unverifiable.length > 0);
  assert.ok(match.unverifiable.includes('NonExistentTechXYZ'));
});

test('dynamic aliases on skill records and taxonomy expand correctly', () => {
  const customPortfolio = structuredClone(portfolio);
  const k8sSkill = customPortfolio.skills.find((s) => s.slug === 'kubernetes-eks');
  if (k8sSkill) {
    k8sSkill.aliases = ['k8s-custom-test', 'kube-orchestrator'];
  }
  customPortfolio.taxonomy = {
    families: {
      'custom-mesh-family': ['kubernetes-eks'],
    },
    aliases: {
      'kubernetes-eks': ['dynamic-k8s-taxonomy-alias'],
    },
  };
  const dynamicKnowledge = buildKnowledge(customPortfolio, buildGraph(customPortfolio), { now: NOW });
  const k8sRecord = dynamicKnowledge.records.find((r) => r.slug === 'kubernetes-eks');

  const dynamicTable = buildAliasTable(dynamicKnowledge);
  const resolved = resolveTerm(dynamicTable, 'k8s-custom-test');
  assert.ok(resolved.canonicalIds.length > 0);
  assert.equal(resolved.canonicalIds[0], k8sRecord?.key);

  const taxResolved = resolveTerm(dynamicTable, 'dynamic-k8s-taxonomy-alias');
  assert.ok(taxResolved.canonicalIds.length > 0);
  assert.equal(taxResolved.canonicalIds[0], k8sRecord?.key);

  assert.ok(dynamicTable.families.has('custom-mesh-family'));
});

test('FastRuntimeEmbedder generates 64-d vectors and computes accurate cosine similarity', async () => {
  const { embedText64, cosine64, createFastRuntimeEmbedder, FAST_EMBEDDER_DIMENSIONS } = await import(
    '../lib/agent/models/fast-embedder'
  );

  const vec1 = embedText64('Kubernetes container orchestration');
  const vec2 = embedText64('Kubernetes cluster EKS');
  const vec3 = embedText64('Cooking recipes Italian pasta');

  assert.equal(vec1.length, FAST_EMBEDDER_DIMENSIONS);
  assert.equal(vec2.length, FAST_EMBEDDER_DIMENSIONS);
  assert.equal(vec3.length, FAST_EMBEDDER_DIMENSIONS);

  const simClose = cosine64(vec1, vec2);
  const simDistant = cosine64(vec1, vec3);

  assert.ok(simClose > simDistant, `Close concepts (${simClose}) should score higher than distant concepts (${simDistant})`);

  const embedder = createFastRuntimeEmbedder();
  assert.equal(embedder.ready, true);

  const hits = await retrieve('Kubernetes', knowledge, lexical, {
    embedder,
    limit: 5,
  });

  assert.ok(hits.length > 0);
  assert.ok(hits[0]!.semantic !== null, 'Semantic score should be computed from fast embedder');
  assert.ok(hits[0]!.score > 0);
});
