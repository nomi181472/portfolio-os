/**
 * lib/repositories/vectorRepository.ts
 *
 * Vector repository implementations for precomputed static embeddings.
 *
 * Implements IVectorRepository:
 *  - JsonVectorRepository: Reads public/data/vectors.json (Node.js filesystem / static loader)
 *  - InMemoryVectorRepository: For testing and in-memory mock setups.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IVectorRepository, VectorChunk, RepositoryHealth } from './types';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function resolveVectorsPath(): string {
  const candidates = [
    resolve(process.cwd(), 'public/data/vectors.json'),
    resolve(process.cwd(), 'portfolio-os/public/data/vectors.json'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

export class JsonVectorRepository implements IVectorRepository {
  private cachedVectors: VectorChunk[] | null = null;
  private readonly vectorsPath: string;

  constructor(vectorsPath?: string) {
    this.vectorsPath = vectorsPath ?? resolveVectorsPath();
  }

  async getVectors(): Promise<VectorChunk[]> {
    if (this.cachedVectors) return this.cachedVectors;
    if (!existsSync(this.vectorsPath)) {
      return [];
    }
    const raw = readFileSync(this.vectorsPath, 'utf-8');
    this.cachedVectors = JSON.parse(raw) as VectorChunk[];
    return this.cachedVectors;
  }

  async getVectorsByEntityId(entityId: string): Promise<VectorChunk[]> {
    const vectors = await this.getVectors();
    return vectors.filter((v) => v.entityId === entityId);
  }

  async searchByVector(vector: number[], limit = 10): Promise<Array<VectorChunk & { similarity: number }>> {
    const vectors = await this.getVectors();
    const scored = vectors.map((item) => ({
      ...item,
      similarity: cosineSimilarity(vector, item.vector),
    }));
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  async healthCheck(): Promise<RepositoryHealth> {
    try {
      const vectors = await this.getVectors();
      return {
        ok: vectors.length > 0,
        entityCount: new Set(vectors.map((v) => v.entityId)).size,
        chunkCount: vectors.length,
        vectorCount: vectors.length,
      };
    } catch {
      return { ok: false, entityCount: 0, chunkCount: 0, vectorCount: 0 };
    }
  }
}

export class InMemoryVectorRepository implements IVectorRepository {
  private vectors: VectorChunk[];

  constructor(initialVectors: VectorChunk[] = []) {
    this.vectors = [...initialVectors];
  }

  async getVectors(): Promise<VectorChunk[]> {
    return this.vectors;
  }

  async getVectorsByEntityId(entityId: string): Promise<VectorChunk[]> {
    return this.vectors.filter((v) => v.entityId === entityId);
  }

  async searchByVector(vector: number[], limit = 10): Promise<Array<VectorChunk & { similarity: number }>> {
    const scored = this.vectors.map((item) => ({
      ...item,
      similarity: cosineSimilarity(vector, item.vector),
    }));
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  async healthCheck(): Promise<RepositoryHealth> {
    return {
      ok: true,
      entityCount: new Set(this.vectors.map((v) => v.entityId)).size,
      chunkCount: this.vectors.length,
      vectorCount: this.vectors.length,
    };
  }
}
