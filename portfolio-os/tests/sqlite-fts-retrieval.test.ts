/**
 * tests/sqlite-fts-retrieval.test.ts
 *
 * Unit and integration tests for SQLite FTS5 database, chunking,
 * canonical URL resolution, and anti-hallucination defenses according
 * to the specification.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { healthCheck, ftsSearch, getEntity, resolveEntityUrls } from '../lib/database/sqlite';

test('portfolio.db exists, is valid, and health check succeeds', () => {
  const health = healthCheck();
  assert.equal(health.ok, true, 'database health check must be ok');
  assert.ok(health.entityCount > 50, `must have indexed entities (got ${health.entityCount})`);
  assert.ok(health.chunkCount > 100, `must have generated chunks (got ${health.chunkCount})`);
});

test('FTS5 retrieves exact technical terms properly', () => {
  const k8sHits = ftsSearch('Kubernetes', 5);
  assert.ok(k8sHits.length > 0, 'Kubernetes search should return matches');
  assert.ok(
    k8sHits.some((h) => h.content.toLowerCase().includes('kubernetes') || h.title.toLowerCase().includes('kubernetes')),
    'Results must mention Kubernetes',
  );

  const pythonHits = ftsSearch('Python', 5);
  assert.ok(pythonHits.length > 0, 'Python search should return matches');
  assert.ok(
    pythonHits.some((h) => h.content.toLowerCase().includes('python') || h.title.toLowerCase().includes('python')),
    'Results must mention Python',
  );
});

test('FTS5 retrieves core products and entities (VERSEYE, QBS)', () => {
  const verseyeHits = ftsSearch('VERSEYE', 5);
  assert.ok(verseyeHits.length > 0, 'VERSEYE search must return hits');
  assert.ok(
    verseyeHits.some((h) => h.entity_id === 'prod-verseye' || h.title.includes('VERSEYE')),
    'VERSEYE must return prod-verseye record',
  );

  const qbsHits = ftsSearch('QBS', 5);
  assert.ok(qbsHits.length > 0, 'QBS search must return hits');
  assert.ok(
    qbsHits.some((h) => h.entity_id.includes('qbs') || h.content.includes('QBS')),
    'QBS must return relevant records',
  );
});

test('Canonical URL lookup resolves verified entity IDs without inventing URLs', () => {
  const resolved = resolveEntityUrls([
    'prod-verseye',
    'sk-python',
    'exp-qbs',
    'fake-project',
    'https://malicious.example.com',
  ]);

  // Verified records resolve to actual portfolio canonical routes
  assert.equal(resolved.has('prod-verseye'), true);
  assert.equal(resolved.get('prod-verseye')?.canonical_url, '/products/verseye');

  assert.equal(resolved.has('sk-python'), true);
  assert.equal(resolved.get('sk-python')?.canonical_url, '/skills/python');

  assert.equal(resolved.has('exp-qbs'), true);
  assert.equal(resolved.get('exp-qbs')?.canonical_url, '/experience/qbs-co-technical-lead');

  // Fake and injected URL IDs MUST BE DISCARDED
  assert.equal(resolved.has('fake-project'), false, 'fake-project ID must be discarded');
  assert.equal(resolved.has('https://malicious.example.com'), false, 'Injected URL must be discarded');
});

test('Missing technology yields no hallucinated entities (e.g. Rust, AWS Lambda)', () => {
  // If a technology is not in the portfolio, search shouldn't match unrelated entities with high relevance
  const rustHits = ftsSearch('Rust', 10);
  const falseMatches = rustHits.filter((h) => h.content.toLowerCase().split(/\W+/).includes('rust'));
  assert.equal(falseMatches.length, 0, 'Rust should not be found as a technology in the portfolio');
});

test('SQLite database and public/data/vectors.json contain valid pre-computed embeddings', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const Database = (await import('better-sqlite3')).default;

  const db = new Database(resolve(process.cwd(), 'portfolio.db'), { readonly: true });
  const row = db.prepare('SELECT embedding_json FROM chunks WHERE embedding_json IS NOT NULL LIMIT 1').get() as { embedding_json: string } | undefined;
  db.close();

  assert.ok(row, 'at least one chunk must have embedding_json');
  const parsed = JSON.parse(row.embedding_json);
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 384, 'all-MiniLM-L6-v2 Embedding vectors must have exactly 384 dimensions');

  const vectorsRaw = readFileSync(resolve(process.cwd(), 'public/data/vectors.json'), 'utf-8');
  const vectors = JSON.parse(vectorsRaw);
  assert.ok(Array.isArray(vectors) && vectors.length > 50, 'public/data/vectors.json must contain pre-computed vectors');
  assert.equal(vectors[0].vector.length, 384, 'Vector array elements must be 384 dimensions');
});

