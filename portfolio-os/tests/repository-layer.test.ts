/**
 * tests/repository-layer.test.ts
 *
 * Unit and integration tests for the repository layer architecture,
 * dependency injection, loose coupling, and vector/SQLite abstractions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ClientRepositoryContainer,
  getVectorPersistenceRepository,
  InMemoryVectorRepository,
  InMemoryVectorPersistenceRepository,
  type IPortfolioRepository,
  type EntityRecord,
  type ChunkRecord,
  type SearchHit,
  type RepositoryHealth,
} from '../lib/repositories';
import {
  ServerRepositoryContainer,
  getPortfolioRepository,
  getVectorRepository,
} from '../lib/repositories/server';
import { SqlitePortfolioRepository } from '../lib/repositories/sqliteRepository';
import { JsonVectorRepository } from '../lib/repositories/vectorRepository';

test('Default container resolves SqlitePortfolioRepository and JsonVectorRepository', () => {
  const portfolioRepo = getPortfolioRepository();
  assert.ok(portfolioRepo instanceof SqlitePortfolioRepository);

  const vectorRepo = getVectorRepository();
  assert.ok(vectorRepo instanceof JsonVectorRepository);
});

test('SqlitePortfolioRepository fulfills IPortfolioRepository contracts', () => {
  const repo = getPortfolioRepository();
  const health = repo.healthCheck();
  assert.equal(health.ok, true);
  assert.ok(health.entityCount > 50);

  const entity = repo.getEntity('prod-verseye');
  assert.ok(entity);
  assert.equal(entity.id, 'prod-verseye');
  assert.equal(entity.canonicalUrl, '/products/verseye');

  const hits = repo.search('Kubernetes', 5);
  assert.ok(hits.length > 0);
  assert.ok(hits.some((h) => h.content.toLowerCase().includes('kubernetes') || h.title.toLowerCase().includes('kubernetes')));

  const urls = repo.resolveEntityUrls(['prod-verseye', 'sk-python', 'non-existent']);
  assert.equal(urls.has('prod-verseye'), true);
  assert.equal(urls.has('sk-python'), true);
  assert.equal(urls.has('non-existent'), false);
});

test('JsonVectorRepository loads and performs cosine search over vectors', async () => {
  const repo = getVectorRepository();
  const health = await repo.healthCheck();
  assert.equal(health.ok, true);
  assert.ok(health.vectorCount && health.vectorCount > 50);

  const vectors = await repo.getVectors();
  assert.ok(vectors.length > 50);
  assert.equal(vectors[0].vector.length, 384);

  // Search using the first vector itself (should return itself with similarity ~1.0)
  const hits = await repo.searchByVector(vectors[0].vector, 3);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].id, vectors[0].id);
  assert.ok(hits[0].similarity > 0.99);
});

test('Dependency Injection: Custom IPortfolioRepository mock swaps cleanly into container', () => {
  class MockPortfolioRepository implements IPortfolioRepository {
    getEntity(id: string): EntityRecord | null {
      if (id === 'mock-id') {
        return {
          id: 'mock-id',
          type: 'project',
          name: 'Mock Project',
          slug: 'mock-project',
          canonicalUrl: '/projects/mock-project',
          metadataJson: '{}',
          contentHash: 'hash123',
        };
      }
      return null;
    }

    getAllEntities(): EntityRecord[] {
      return [];
    }

    getChunksByEntityId(_entityId: string): ChunkRecord[] {
      return [];
    }

    getChunk(_id: string): ChunkRecord | null {
      return null;
    }

    search(query: string, _limit = 10): SearchHit[] {
      return [
        {
          id: 'chunk-mock-1',
          entityId: 'mock-id',
          entityName: 'Mock Project',
          canonicalUrl: '/projects/mock-project',
          chunkType: 'summary',
          title: `Hit for ${query}`,
          content: 'Mock content',
          contentHash: 'hash123',
          rank: -1.0,
        },
      ];
    }

    resolveEntityUrls(ids: string[]): Map<string, { name: string; type: string; canonical_url: string }> {
      const map = new Map<string, { name: string; type: string; canonical_url: string }>();
      if (ids.includes('mock-id')) {
        map.set('mock-id', { name: 'Mock Project', type: 'project', canonical_url: '/projects/mock-project' });
      }
      return map;
    }

    healthCheck(): RepositoryHealth {
      return { ok: true, entityCount: 1, chunkCount: 1 };
    }
  }

  const container = ServerRepositoryContainer.getInstance();
  const originalRepo = container.getPortfolioRepository();

  try {
    const mockRepo = new MockPortfolioRepository();
    container.setPortfolioRepository(mockRepo);

    const activeRepo = getPortfolioRepository();
    assert.equal(activeRepo, mockRepo);

    const entity = activeRepo.getEntity('mock-id');
    assert.equal(entity?.name, 'Mock Project');

    const searchHits = activeRepo.search('DI test');
    assert.equal(searchHits[0].title, 'Hit for DI test');
  } finally {
    // Restore
    container.setPortfolioRepository(originalRepo);
  }
});

test('Dependency Injection: InMemoryVectorPersistenceRepository persists and restores vectors correctly', async () => {
  const persistenceRepo = new InMemoryVectorPersistenceRepository();
  const hash = 'test-corpus-hash-123';
  const model = 'test-model';
  const testVectors = new Map<string, Float32Array[]>([
    ['record-1', [new Float32Array([0.1, 0.2, 0.3])]],
  ]);

  await persistenceRepo.persistVectors(hash, model, 'cpu', testVectors);

  const restored = await persistenceRepo.restoreVectors(hash, model, 3);
  assert.ok(restored);
  assert.equal(restored.has('record-1'), true);
  assert.deepEqual(restored.get('record-1')?.[0], new Float32Array([0.1, 0.2, 0.3]));

  // Rejection on dimension mismatch
  const mismatched = await persistenceRepo.restoreVectors(hash, model, 4);
  assert.equal(mismatched, null);

  await persistenceRepo.clear();
  const cleared = await persistenceRepo.restoreVectors(hash, model, 3);
  assert.equal(cleared, null);
});
