/**
 * lib/repositories/server.ts
 *
 * Server-side repository container and service locator for Portfolio OS.
 * Encapsulates Node.js / SQLite and filesystem vector storage.
 */

import 'server-only';
import type {
  IPortfolioRepository,
  IVectorRepository,
} from './types';
import { SqlitePortfolioRepository } from './sqliteRepository';
import { JsonVectorRepository } from './vectorRepository';

export { SqlitePortfolioRepository } from './sqliteRepository';
export { JsonVectorRepository } from './vectorRepository';

export interface ServerRepositoryContainerOptions {
  portfolioRepo?: IPortfolioRepository;
  vectorRepo?: IVectorRepository;
}

export class ServerRepositoryContainer {
  private static instance: ServerRepositoryContainer | null = null;

  private portfolioRepo: IPortfolioRepository | null = null;
  private vectorRepo: IVectorRepository | null = null;

  constructor(options: ServerRepositoryContainerOptions = {}) {
    if (options.portfolioRepo) this.portfolioRepo = options.portfolioRepo;
    if (options.vectorRepo) this.vectorRepo = options.vectorRepo;
  }

  static getInstance(): ServerRepositoryContainer {
    if (!ServerRepositoryContainer.instance) {
      ServerRepositoryContainer.instance = new ServerRepositoryContainer();
    }
    return ServerRepositoryContainer.instance;
  }

  static resetInstance(): void {
    ServerRepositoryContainer.instance = null;
  }

  getPortfolioRepository(): IPortfolioRepository {
    if (!this.portfolioRepo) {
      this.portfolioRepo = new SqlitePortfolioRepository();
    }
    return this.portfolioRepo;
  }

  setPortfolioRepository(repo: IPortfolioRepository | null): void {
    this.portfolioRepo = repo;
  }

  getVectorRepository(): IVectorRepository {
    if (!this.vectorRepo) {
      this.vectorRepo = new JsonVectorRepository();
    }
    return this.vectorRepo;
  }

  setVectorRepository(repo: IVectorRepository | null): void {
    this.vectorRepo = repo;
  }
}

/** Server-side helper for dependency injection of Portfolio Repository */
export function getPortfolioRepository(): IPortfolioRepository {
  return ServerRepositoryContainer.getInstance().getPortfolioRepository();
}

/** Server-side helper for dependency injection of Vector Repository */
export function getVectorRepository(): IVectorRepository {
  return ServerRepositoryContainer.getInstance().getVectorRepository();
}
