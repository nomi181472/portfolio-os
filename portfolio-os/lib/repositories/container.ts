/**
 * lib/repositories/container.ts
 *
 * Client-safe repository container for browser-accessible repositories.
 */

import type { IVectorPersistenceRepository } from './types';
import { IndexedDbVectorPersistenceRepository } from './vectorPersistenceRepository';

export class ClientRepositoryContainer {
  private static instance: ClientRepositoryContainer | null = null;
  private vectorPersistenceRepo: IVectorPersistenceRepository | null = null;

  static getInstance(): ClientRepositoryContainer {
    if (!ClientRepositoryContainer.instance) {
      ClientRepositoryContainer.instance = new ClientRepositoryContainer();
    }
    return ClientRepositoryContainer.instance;
  }

  static resetInstance(): void {
    ClientRepositoryContainer.instance = null;
  }

  getVectorPersistenceRepository(): IVectorPersistenceRepository {
    if (!this.vectorPersistenceRepo) {
      this.vectorPersistenceRepo = new IndexedDbVectorPersistenceRepository();
    }
    return this.vectorPersistenceRepo;
  }

  setVectorPersistenceRepository(repo: IVectorPersistenceRepository | null): void {
    this.vectorPersistenceRepo = repo;
  }
}

/** Convenience helper for dependency injection of Vector Persistence Repository */
export function getVectorPersistenceRepository(): IVectorPersistenceRepository {
  return ClientRepositoryContainer.getInstance().getVectorPersistenceRepository();
}
