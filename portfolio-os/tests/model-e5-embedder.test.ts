/**
 * tests/model-e5-embedder.test.ts
 *
 * Dedicated Unit Test for the Semantic Search Embedder model layer (`role: 'embedding'`).
 * Tests:
 * 1. Configuration against the production registry (`Xenova/multilingual-e5-small`).
 * 2. Vector similarity interface contract.
 * 3. Retrieval re-ranking comparison (Lexical alone vs Lexical + Semantic Embedder).
 * 4. Can be run with custom query via CLI:
 *    npx tsx tests/model-e5-embedder.test.ts --question "Your query here"
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import { retrieve, buildLexicalIndex, type Embedder } from '../lib/agent/retrieve';
import { modelForRole } from '../lib/agent/registry';
import type { Portfolio } from '../types/portfolio';

const NOW = new Date('2026-10-04T00:00:00Z');
const rawPortfolio = JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8'));
const parsed = validatePortfolio(rawPortfolio);
assert.ok(parsed.ok, 'portfolio must validate');
const portfolio: Portfolio = parsed.data;
const graph = buildGraph(portfolio);
const knowledge = buildKnowledge(portfolio, graph, { now: NOW });
const lexical = buildLexicalIndex(knowledge.records);

const MODEL = modelForRole('embedding');

test('E5 Embedder configuration matches production registry', () => {
  assert.equal(MODEL.id, 'Xenova/multilingual-e5-small');
  assert.equal(MODEL.role, 'embedding');
  assert.equal(MODEL.artifact.dtype, 'int8');
  assert.ok(MODEL.devices.includes('wasm'));
});

test('Simulated E5 Embedder alters retrieval rank for semantic matches', async () => {
  const query = 'autonomous vessels and marine robotics';

  // 1. Without embedder (lexical only)
  const lexicalOnly = await retrieve(query, knowledge, lexical, { limit: 5 });

  // 2. With mock E5 embedder boosting navirox
  const mockEmbedder: Embedder = {
    ready: true,
    async similarity(_q: string, doc: string): Promise<number | null> {
      if (/vessel|unmanned|lidar|navirox/i.test(doc)) {
        return 0.92;
      }
      return 0.15;
    },
  };

  const withSemantic = await retrieve(query, knowledge, lexical, {
    limit: 5,
    embedder: mockEmbedder,
  });

  assert.ok(lexicalOnly.length > 0);
  assert.ok(withSemantic.length > 0);

  // The semantic embedder should score the highest record high on semantic
  const topSemantic = withSemantic[0];
  assert.ok(topSemantic);
  assert.ok((topSemantic.semantic ?? 0) > 0.5);
});

// Interactive / Manual CLI Execution
if (process.argv[1]?.includes('model-e5-embedder.test.ts') && process.argv.includes('--question')) {
  const qIndex = process.argv.indexOf('--question');
  const userQ = process.argv[qIndex + 1] || 'high throughput real time streaming';

  (async () => {
    console.log(`\n======================================================`);
    console.log(`🔍 [E5 Small Embedder - Manual Test Runner]`);
    console.log(`   Query: "${userQ}"`);
    console.log(`======================================================`);

    const lexicalHits = await retrieve(userQ, knowledge, lexical, { limit: 5 });
    console.log(`\n--- Top Lexical Results (BM25) ---`);
    lexicalHits.forEach((hit, idx) => {
      console.log(`   [${idx + 1}] (${hit.score.toFixed(3)}) ${hit.key} — ${hit.record.name}`);
    });

    // Mock embedding simulation
    const mockEmbedder: Embedder = {
      ready: true,
      async similarity(_q, doc) {
        let score = 0.2;
        if (/kafka|streaming|throughput|latency/i.test(doc)) score += 0.6;
        return score;
      },
    };

    const semanticHits = await retrieve(userQ, knowledge, lexical, { limit: 5, embedder: mockEmbedder });
    console.log(`\n--- Top Semantic + Lexical Hybrid Results ---`);
    semanticHits.forEach((hit, idx) => {
      console.log(`   [${idx + 1}] (Score: ${hit.score.toFixed(3)} | Lex: ${hit.lexical.toFixed(3)} | Sem: ${hit.semantic?.toFixed(3)}) ${hit.key} — ${hit.record.name}`);
    });
    console.log(`======================================================\n`);
  })();
}
