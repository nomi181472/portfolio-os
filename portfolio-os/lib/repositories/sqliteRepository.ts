/**
 * lib/repositories/sqliteRepository.ts
 *
 * SQLite implementation of IPortfolioRepository.
 * Server-only: wraps better-sqlite3 with the repository contract.
 */

import 'server-only';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import type {
  IPortfolioRepository,
  EntityRecord,
  ChunkRecord,
  SearchHit,
  RepositoryHealth,
} from './types';

export class SqlitePortfolioRepository implements IPortfolioRepository {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? resolve(process.cwd(), 'portfolio.db');
  }

  private open(): Database.Database {
    if (this.db) return this.db;
    if (!existsSync(this.dbPath)) {
      throw new Error(
        `portfolio.db not found at ${this.dbPath}. Run \`npm run index\` to generate it.`,
      );
    }
    this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
    return this.db;
  }

  getEntity(id: string): EntityRecord | null {
    const db = this.open();
    const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapEntity(row);
  }

  getAllEntities(): EntityRecord[] {
    const db = this.open();
    const rows = db.prepare('SELECT * FROM entities').all() as Record<string, unknown>[];
    return rows.map((r) => this.mapEntity(r));
  }

  getChunksByEntityId(entityId: string): ChunkRecord[] {
    const db = this.open();
    const rows = db.prepare('SELECT * FROM chunks WHERE entity_id = ?').all(entityId) as Record<string, unknown>[];
    return rows.map((r) => this.mapChunk(r));
  }

  getChunk(id: string): ChunkRecord | null {
    const db = this.open();
    const row = db.prepare('SELECT * FROM chunks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapChunk(row);
  }

  search(query: string, limit = 20): SearchHit[] {
    const db = this.open();
    const sanitised = this.sanitiseFtsQuery(query);
    if (!sanitised) return [];

    const rows = db
      .prepare(
        `SELECT c.id, c.entity_id, e.name as entity_name, e.canonical_url,
                c.chunk_type, c.title, c.content,
                c.content_hash, c.embedding_json, c.created_at, cf.rank
         FROM chunks_fts cf
         JOIN chunks c ON c.rowid = cf.rowid
         LEFT JOIN entities e ON e.id = c.entity_id
         WHERE chunks_fts MATCH ?
         ORDER BY cf.rank
         LIMIT ?`,
      )
      .all(sanitised, limit) as Array<{
        id: string;
        entity_id: string;
        entity_name: string;
        canonical_url: string | null;
        chunk_type: string;
        title: string;
        content: string;
        content_hash: string;
        embedding_json: string | null;
        created_at: string;
        rank: number;
      }>;

    return rows.map((r) => ({
      id: r.id,
      entityId: r.entity_id,
      entityName: r.entity_name,
      canonicalUrl: r.canonical_url,
      chunkType: r.chunk_type,
      title: r.title,
      content: r.content,
      contentHash: r.content_hash,
      embeddingJson: r.embedding_json,
      createdAt: r.created_at,
      rank: r.rank,
    }));
  }

  resolveEntityUrls(ids: string[]): Map<string, { name: string; type: string; canonical_url: string }> {
    if (ids.length === 0) return new Map();
    const db = this.open();
    const result = new Map<string, { name: string; type: string; canonical_url: string }>();

    for (const id of ids) {
      const row = db
        .prepare('SELECT id, name, type, canonical_url FROM entities WHERE id = ? AND canonical_url IS NOT NULL')
        .get(id) as { id: string; name: string; type: string; canonical_url: string } | undefined;
      if (row?.canonical_url) {
        result.set(id, { name: row.name, type: row.type, canonical_url: row.canonical_url });
      }
    }
    return result;
  }

  healthCheck(): RepositoryHealth {
    try {
      const db = this.open();
      const entityCount = (db.prepare('SELECT COUNT(*) as n FROM entities').get() as { n: number }).n;
      const chunkCount = (db.prepare('SELECT COUNT(*) as n FROM chunks').get() as { n: number }).n;
      return { ok: true, entityCount, chunkCount };
    } catch {
      return { ok: false, entityCount: 0, chunkCount: 0 };
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private sanitiseFtsQuery(raw: string): string | null {
    const tokens = raw
      .trim()
      .replace(/["""]/g, '')
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    if (tokens.length === 0) return null;
    return tokens.map((t) => `"${t}"`).join(' OR ');
  }

  private mapEntity(row: Record<string, unknown>): EntityRecord {
    return {
      id: String(row.id),
      type: String(row.type),
      name: String(row.name),
      slug: row.slug ? String(row.slug) : null,
      canonicalUrl: row.canonical_url ? String(row.canonical_url) : null,
      metadataJson: String(row.metadata_json),
      contentHash: String(row.content_hash),
      createdAt: row.created_at ? String(row.created_at) : undefined,
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    };
  }

  private mapChunk(row: Record<string, unknown>): ChunkRecord {
    return {
      id: String(row.id),
      entityId: String(row.entity_id),
      chunkType: String(row.chunk_type),
      title: String(row.title),
      content: String(row.content),
      contentHash: String(row.content_hash),
      embeddingJson: row.embedding_json ? String(row.embedding_json) : null,
      createdAt: row.created_at ? String(row.created_at) : undefined,
    };
  }
}
