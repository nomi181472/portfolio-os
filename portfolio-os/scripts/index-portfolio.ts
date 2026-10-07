/**
 * scripts/index-portfolio.ts
 *
 * Build-time indexer: reads portfolio.json → generates portfolio.db & public/data/vectors.json.
 *
 * Invoked as `npm run index` on your local PC.
 *
 * Pipeline:
 *   1. Validate portfolio.json with the Zod schema.
 *   2. Derive entities from validated data.
 *   3. Generate semantic chunks for each entity.
 *   4. Hash every chunk with SHA-256 and reuse existing embeddings when hashes match.
 *   5. If --with-embeddings or local environment:
 *      Uses Xenova/all-MiniLM-L6-v2 (model_int8) to compute 384-dim embeddings.
 *      Saves them in SQLite chunks.embedding_json and writes public/data/vectors.json.
 *   6. Write entities, chunks, FTS5 virtual table, and relationships to SQLite.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { pipeline } from '@huggingface/transformers';
import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';

/* ----------------------------------------------------------------- paths */

const PORTFOLIO_PATH = resolve(process.cwd(), 'content/portfolio.json');
const DB_PATH = resolve(process.cwd(), 'portfolio.db');
const VECTORS_PATH = resolve(process.cwd(), 'public/data/vectors.json');

/* ----------------------------------------------------------------- types */

interface Chunk {
  id: string;
  entityId: string;
  chunkType: string;
  title: string;
  content: string;
  contentHash: string;
  embeddingJson?: string | null;
}

interface EntityRow {
  id: string;
  type: string;
  name: string;
  slug: string | null;
  canonicalUrl: string | null;
  metadataJson: string;
  contentHash: string;
}

interface ExportedVectorItem {
  id: string;
  entityId: string;
  chunkType: string;
  title: string;
  hash: string;
  vector: number[];
}

/* ------------------------------------------------------------------ main */

async function main(): Promise<void> {
  const withEmbeddings = process.argv.includes('--with-embeddings') || !process.env.VERCEL;

  console.log('📖 Reading portfolio.json…');
  const raw = JSON.parse(readFileSync(PORTFOLIO_PATH, 'utf-8')) as unknown;

  console.log('✅ Validating schema…');
  const result = validatePortfolio(raw);
  if (!result.ok) {
    console.error('❌ portfolio.json validation failed:');
    console.error(result.issues);
    process.exit(1);
  }

  const portfolio = result.data;
  const graph = buildGraph(portfolio);
  const knowledge = buildKnowledge(portfolio, graph);

  console.log(`   Profile: ${knowledge.profile.name}`);
  console.log(`   Records: ${knowledge.records.length}`);

  /* ---------------------------------------------------------------- entities */

  console.log('\n🗂  Building entities…');
  const entityRows: EntityRow[] = [];

  // Profile as a special entity
  entityRows.push({
    id: 'profile',
    type: 'profile',
    name: knowledge.profile.name,
    slug: null,
    canonicalUrl: '/',
    metadataJson: JSON.stringify({
      discipline: knowledge.profile.discipline,
      positioning: knowledge.profile.positioning,
      location: knowledge.profile.location,
      email: knowledge.profile.email,
      focus: knowledge.profile.focus,
      domains: knowledge.profile.domains,
      industries: knowledge.profile.industries,
      specialisation: knowledge.profile.specialisation,
      philosophy: knowledge.profile.philosophy,
      links: knowledge.profile.links,
    }),
    contentHash: sha256(JSON.stringify(knowledge.profile)),
  });

  // Portfolio entity records
  for (const record of knowledge.records) {
    entityRows.push({
      id: record.key,
      type: record.kind,
      name: record.name,
      slug: record.slug,
      canonicalUrl: record.href,
      metadataJson: JSON.stringify({
        summary: record.summary,
        technologies: record.technologies,
        tags: record.tags,
        organisation: record.organisation,
        status: record.status,
        depth: record.depth,
        period: record.period,
        featured: record.featured,
        evidence: record.evidence,
        links: record.links,
      }),
      contentHash: sha256(record.text),
    });
  }

  // Bare entity IDs
  const bareEntityRows: EntityRow[] = [];
  for (const record of knowledge.records) {
    bareEntityRows.push({
      id: record.id,
      type: record.kind,
      name: record.name,
      slug: record.slug,
      canonicalUrl: record.href,
      metadataJson: JSON.stringify({
        summary: record.summary,
        technologies: record.technologies,
        tags: record.tags,
        organisation: record.organisation,
        status: record.status,
        depth: record.depth,
        period: record.period,
        featured: record.featured,
        evidence: record.evidence,
        links: record.links,
      }),
      contentHash: sha256(record.text),
    });
  }

  /* ---------------------------------------------------------------- chunks */

  console.log('🔪 Generating semantic chunks…');
  const chunks: Chunk[] = [];

  const prof = knowledge.profile;
  const profileChunks: Array<{ type: string; title: string; content: string }> = [
    {
      type: 'overview',
      title: `${prof.name} — Overview`,
      content: [prof.positioning, prof.discipline ? `Discipline: ${prof.discipline}` : ''].filter(Boolean).join('\n'),
    },
    {
      type: 'focus',
      title: `${prof.name} — Focus`,
      content: `Focus: ${prof.focus ?? 'Not specified.'}`,
    },
    {
      type: 'domains',
      title: `${prof.name} — Domains`,
      content: `Domains: ${prof.domains.join(', ')}.`,
    },
    {
      type: 'industries',
      title: `${prof.name} — Industries`,
      content: `Industries: ${prof.industries.join(', ')}.`,
    },
    {
      type: 'specialisation',
      title: `${prof.name} — Specialisation`,
      content: `Specialisation: ${prof.specialisation ?? 'Not specified.'}`,
    },
    {
      type: 'philosophy',
      title: `${prof.name} — Architecture Philosophy`,
      content: `Philosophy: ${prof.philosophy ?? 'Not specified.'}`,
    },
    {
      type: 'links',
      title: `${prof.name} — Contact & Links`,
      content: prof.links.map((link) => `${link.label}: ${link.url}`).join('\n'),
    },
  ];

  for (const pc of profileChunks) {
    if (!pc.content.trim() || pc.content.includes('Not specified.')) continue;
    chunks.push(makeChunk('profile', pc.type, pc.title, pc.content));
  }

  for (const record of knowledge.records) {
    const entityId = record.id;
    const chunks_for = buildEntityChunks(record);
    chunks.push(...chunks_for.map((c) => makeChunk(entityId, c.type, c.title, c.content)));
  }

  console.log(`   Entities: ${entityRows.length + bareEntityRows.length}`);
  console.log(`   Chunks:   ${chunks.length}`);

  /* ------------------------------------------------------ embeddings generation */

  const existingVectorMap = new Map<string, number[]>();
  if (existsSync(VECTORS_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(VECTORS_PATH, 'utf-8')) as ExportedVectorItem[];
      for (const item of prev) {
        if (item.hash && Array.isArray(item.vector)) {
          existingVectorMap.set(item.hash, item.vector);
        }
      }
      console.log(`   Loaded ${existingVectorMap.size} existing cached vector embeddings.`);
    } catch {
      // Ignored if invalid
    }
  }

  const exportedVectors: ExportedVectorItem[] = [];

  if (withEmbeddings) {
    console.log('\n🧠 Computing/verifying semantic embeddings (Xenova/all-MiniLM-L6-v2)...');
    let extractor: any = null;

    let reusedCount = 0;
    let newlyComputedCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const cached = existingVectorMap.get(chunk.contentHash);

      if (cached && cached.length === 384) {
        chunk.embeddingJson = JSON.stringify(cached);
        exportedVectors.push({
          id: chunk.id,
          entityId: chunk.entityId,
          chunkType: chunk.chunkType,
          title: chunk.title,
          hash: chunk.contentHash,
          vector: cached,
        });
        reusedCount++;
      } else {
        if (!extractor) {
          console.log('   Loading local Xenova/all-MiniLM-L6-v2 model...');
          extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            dtype: 'int8',
          });
        }

        const textToEmbed = `${chunk.title}\n${chunk.content}`;
        const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data as Float32Array);

        chunk.embeddingJson = JSON.stringify(vector);
        existingVectorMap.set(chunk.contentHash, vector);
        exportedVectors.push({
          id: chunk.id,
          entityId: chunk.entityId,
          chunkType: chunk.chunkType,
          title: chunk.title,
          hash: chunk.contentHash,
          vector,
        });
        newlyComputedCount++;
        if (newlyComputedCount % 25 === 0 || newlyComputedCount === 1) {
          process.stdout.write(`   Embedded ${newlyComputedCount} new chunks...\r`);
        }
      }
    }

    console.log(`\n   Embeddings complete: ${reusedCount} reused from cache, ${newlyComputedCount} freshly generated.`);
    writeFileSync(VECTORS_PATH, JSON.stringify(exportedVectors), 'utf-8');
    console.log(`   Exported static vector index to ${VECTORS_PATH} (${(readFileSync(VECTORS_PATH).length / 1024).toFixed(1)} KB)`);
  }

  /* ---------------------------------------------------------------- relationships */

  console.log('🔗 Building relationships…');
  const relationships: Array<{ sourceId: string; relationType: string; targetId: string }> = [];

  for (const record of knowledge.records) {
    for (const evidence of record.evidence) {
      relationships.push({
        sourceId: record.id,
        relationType: 'evidence',
        targetId: evidence.id,
      });
    }
    for (const tech of record.technologies) {
      relationships.push({
        sourceId: record.id,
        relationType: 'uses_technology',
        targetId: tech,
      });
    }
  }

  /* ---------------------------------------------------------------- write DB */

  console.log(`\n💾 Writing ${DB_PATH}…`);
  if (existsSync(DB_PATH)) {
    console.log('   (updating database)');
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    DROP TABLE IF EXISTS chunks_fts;
    DROP TABLE IF EXISTS relationships;
    DROP TABLE IF EXISTS chunks;
    DROP TABLE IF EXISTS entities;

    CREATE TABLE entities (
      id           TEXT PRIMARY KEY,
      type         TEXT NOT NULL,
      name         TEXT NOT NULL,
      slug         TEXT,
      canonical_url TEXT,
      metadata_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE chunks (
      id            TEXT PRIMARY KEY,
      entity_id     TEXT NOT NULL REFERENCES entities(id),
      chunk_type    TEXT NOT NULL,
      title         TEXT NOT NULL,
      content       TEXT NOT NULL,
      content_hash  TEXT NOT NULL,
      embedding_json TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_chunks_entity_id ON chunks(entity_id);
    CREATE INDEX idx_entities_type    ON entities(type);

    CREATE VIRTUAL TABLE chunks_fts USING fts5(
      title,
      content,
      content=chunks,
      content_rowid=rowid,
      tokenize='unicode61 remove_diacritics 1'
    );

    CREATE TABLE relationships (
      source_id     TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      target_id     TEXT NOT NULL,
      PRIMARY KEY (source_id, relation_type, target_id)
    );
  `);

  const now = new Date().toISOString();

  const insertEntity = db.prepare<[string, string, string, string | null, string | null, string, string, string, string]>(`
    INSERT OR REPLACE INTO entities
      (id, type, name, slug, canonical_url, metadata_json, content_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertChunk = db.prepare<[string, string, string, string, string, string, string | null, string]>(`
    INSERT OR REPLACE INTO chunks
      (id, entity_id, chunk_type, title, content, content_hash, embedding_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRel = db.prepare<[string, string, string]>(`
    INSERT OR IGNORE INTO relationships (source_id, relation_type, target_id)
    VALUES (?, ?, ?)
  `);

  const insertAll = db.transaction(() => {
    for (const row of [...entityRows, ...bareEntityRows]) {
      insertEntity.run(
        row.id,
        row.type,
        row.name,
        row.slug,
        row.canonicalUrl,
        row.metadataJson,
        row.contentHash,
        now,
        now,
      );
    }

    for (const chunk of chunks) {
      insertChunk.run(
        chunk.id,
        chunk.entityId,
        chunk.chunkType,
        chunk.title,
        chunk.content,
        chunk.contentHash,
        chunk.embeddingJson ?? null,
        now,
      );
    }

    for (const rel of relationships) {
      insertRel.run(rel.sourceId, rel.relationType, rel.targetId);
    }
  });

  insertAll();

  // Populate FTS5 index
  db.exec(`INSERT INTO chunks_fts(rowid, title, content) SELECT rowid, title, content FROM chunks`);

  db.close();

  console.log('✅ portfolio.db generated successfully.');
  console.log(`   Entities:      ${entityRows.length + bareEntityRows.length}`);
  console.log(`   Chunks:        ${chunks.length}`);
  console.log(`   Relationships: ${relationships.length}`);
  console.log(`   FTS5:          indexed`);
  console.log(`   Embeddings:    ${exportedVectors.length} saved in DB & public/data/vectors.json`);
}

/* ----------------------------------------------------------------- helpers */

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function makeChunk(entityId: string, type: string, title: string, content: string): Chunk {
  const id = `chunk-${entityId}-${type}`;
  return {
    id,
    entityId,
    chunkType: type,
    title,
    content,
    contentHash: sha256(content),
  };
}

function buildEntityChunks(
  record: ReturnType<typeof buildKnowledge>['records'][number],
): Array<{ type: string; title: string; content: string }> {
  const chunks: Array<{ type: string; title: string; content: string }> = [];
  const n = record.name;
  const k = record.kind;

  if (record.summary) {
    chunks.push({
      type: 'overview',
      title: `${n} — Overview`,
      content: `${n} (${k}): ${record.summary}`,
    });
  }

  if (record.technologies.length > 0) {
    chunks.push({
      type: 'technologies',
      title: `${n} — Technologies`,
      content: `${n} uses: ${record.technologies.join(', ')}.`,
    });
  }

  if (record.organisation) {
    chunks.push({
      type: 'organisation',
      title: `${n} — Organisation`,
      content: `${n} is associated with ${record.organisation}.`,
    });
  }

  if (record.period) {
    const start = record.period.start ?? 'unknown';
    const end = record.period.ongoing ? 'present' : (record.period.end ?? 'unknown');
    chunks.push({
      type: 'period',
      title: `${n} — Period`,
      content: `${n} period: ${start} to ${end}.`,
    });
  }

  if (record.tags.length > 0) {
    chunks.push({
      type: 'tags',
      title: `${n} — Tags`,
      content: `${n} tags: ${record.tags.join(', ')}.`,
    });
  }

  if (record.evidence.length > 0) {
    chunks.push({
      type: 'evidence',
      title: `${n} — Related Work`,
      content: `${n} is related to: ${record.evidence.map((e) => e.name).join(', ')}.`,
    });
  }

  if (record.links.length > 0) {
    chunks.push({
      type: 'links',
      title: `${n} — Links`,
      content: record.links.map((l) => `${l.label}: ${l.url}`).join('\n'),
    });
  }

  return chunks;
}

main().catch((err) => {
  console.error('Fatal error during indexing:', err);
  process.exit(1);
});
