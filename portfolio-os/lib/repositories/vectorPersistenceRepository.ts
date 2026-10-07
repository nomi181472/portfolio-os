/**
 * lib/repositories/vectorPersistenceRepository.ts
 *
 * Implementation of IVectorPersistenceRepository for browser IndexedDB
 * and in-memory fallback.
 */

import type { IVectorPersistenceRepository } from './types';
import {
  restoreVectors,
  persistVectors,
} from '@/lib/agent/models/vector-persistence';

export class IndexedDbVectorPersistenceRepository implements IVectorPersistenceRepository {
  async restoreVectors(
    hash: string,
    model: string,
    expectedDimensions: number,
  ): Promise<Map<string, Float32Array[]> | null> {
    return restoreVectors(hash, model, expectedDimensions);
  }

  async persistVectors(
    hash: string,
    model: string,
    backend: string,
    vectors: Map<string, Float32Array[]>,
  ): Promise<boolean> {
    return persistVectors(hash, model, backend, vectors);
  }

  async clear(): Promise<boolean> {
    if (typeof indexedDB === 'undefined') return false;
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('portfolio-agent-vectors');
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    });
  }
}

export class InMemoryVectorPersistenceRepository implements IVectorPersistenceRepository {
  private store = new Map<string, Map<string, Float32Array[]>>();

  async restoreVectors(
    hash: string,
    _model: string,
    expectedDimensions: number,
  ): Promise<Map<string, Float32Array[]> | null> {
    const found = this.store.get(hash);
    if (!found) return null;

    // Validate dimensions
    for (const list of found.values()) {
      for (const vec of list) {
        if (vec.length !== expectedDimensions) return null;
      }
    }
    return found;
  }

  async persistVectors(
    hash: string,
    _model: string,
    _backend: string,
    vectors: Map<string, Float32Array[]>,
  ): Promise<boolean> {
    this.store.set(hash, vectors);
    return true;
  }

  async clear(): Promise<boolean> {
    this.store.clear();
    return true;
  }
}
