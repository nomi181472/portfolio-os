/**
 * lib/repositories/types.ts
 *
 * Repository contracts and domain types for Portfolio OS.
 *
 * Establishing formal repository interfaces decouples consumers (API routes,
 * agent components, search, and page controllers) from concrete storage engines
 * (better-sqlite3, IndexedDB, pre-rendered JSON vectors, in-memory mocks).
 */

export interface EntityRecord {
  id: string;
  type: string;
  name: string;
  slug: string | null;
  canonicalUrl: string | null;
  metadataJson: string;
  contentHash: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChunkRecord {
  id: string;
  entityId: string;
  chunkType: string;
  title: string;
  content: string;
  contentHash: string;
  embeddingJson?: string | null;
  createdAt?: string;
}

export interface SearchHit {
  id: string;
  entityId: string;
  entityName: string;
  canonicalUrl: string | null;
  chunkType: string;
  title: string;
  content: string;
  contentHash: string;
  embeddingJson?: string | null;
  createdAt?: string;
  rank: number;
}

export interface VectorChunk {
  id: string;
  entityId: string;
  chunkType: string;
  title: string;
  hash: string;
  vector: number[];
}

export interface RepositoryHealth {
  ok: boolean;
  entityCount: number;
  chunkCount: number;
  vectorCount?: number;
}

/**
 * Contract for relational & full-text search querying (SQLite / In-Memory).
 */
export interface IPortfolioRepository {
  getEntity(id: string): EntityRecord | null;
  getAllEntities(): EntityRecord[];
  getChunksByEntityId(entityId: string): ChunkRecord[];
  getChunk(id: string): ChunkRecord | null;
  search(query: string, limit?: number): SearchHit[];
  resolveEntityUrls(ids: string[]): Map<string, { name: string; type: string; canonical_url: string }>;
  healthCheck(): RepositoryHealth;
}

/**
 * Contract for vector embedding store & retrieval (Static JSON / IndexedDB / In-Memory).
 */
export interface IVectorRepository {
  getVectors(): Promise<VectorChunk[]>;
  getVectorsByEntityId(entityId: string): Promise<VectorChunk[]>;
  searchByVector(vector: number[], limit?: number): Promise<Array<VectorChunk & { similarity: number }>>;
  healthCheck(): Promise<RepositoryHealth> | RepositoryHealth;
}

/**
 * Contract for client-side vector persistence (IndexedDB / In-Memory).
 */
export interface IVectorPersistenceRepository {
  restoreVectors(
    hash: string,
    model: string,
    expectedDimensions: number,
  ): Promise<Map<string, Float32Array[]> | null>;

  persistVectors(
    hash: string,
    model: string,
    backend: string,
    vectors: Map<string, Float32Array[]>,
  ): Promise<boolean>;

  clear(): Promise<boolean>;
}
