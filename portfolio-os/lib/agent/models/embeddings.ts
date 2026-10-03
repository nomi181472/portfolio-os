/**
 * lib/agent/models/embeddings.ts
 *
 * The semantic half of retrieval: E5 vectors, cached, and reduced to one score per
 * record.
 *
 * Three things this file is careful about, all of them consequences of E5's 512-token
 * context and of the shape of this corpus:
 *
 *  1. **Mean-pool, then L2-normalise.** E5's `pooling: 'mean'` output is a
 *     sequence-level vector where direction is meaningful and magnitude is not. Left
 *     unnormalised, cosine similarity divides by a length that encodes how long the
 *     passage was — so a 400-token chunk would score differently from a 40-token one
 *     for identical content. Normalising removes that, and it makes a dot product
 *     and a cosine similarity the same number, which is what lets the merge in
 *     `retrieve.ts` treat the score as 0–1.
 *
 *  2. **Aggregate chunks by max, per record.** A record is 125 chunks across 93
 *     records, and the longest records are the important ones (VERSEYE, NAVIROX,
 *     both roles). Taking the *mean* across chunks would let a question about one
 *     facet of a 9-chunk record be diluted by the other eight — precisely the
 *     long, substantive records that would suffer most. Max says: this record's best
 *     passage matches, which is the question being asked.
 *
 *  3. **Cache by content hash.** Vectors keyed only by record key would outlive the
 *     text they describe: edit a project description, and the old vector keeps
 *     answering for the new words. That is a silent correctness bug, so the key
 *     includes a hash of the content.
 *
 * The pipeline itself is loaded lazily through `brain.ts`-style detection and is
 * never imported from a server module. This file's *maths* — pooling, normalising,
 * aggregation, cache keys — is pure and tested in `node:test` with no model at all.
 */

import type { Embedder } from '../retrieve';
import { chunkAll, PASSAGE_PREFIX, QUERY_PREFIX, type Chunk } from './chunk';
import { modelForRole } from '../registry';
import { loadModel } from './brain';

/** E5-small emits 384 dimensions. Asserted rather than assumed at use sites. */
export const E5_DIMENSIONS = 384;

/** One record's vectors, one per chunk. */
export type RecordVectors = Float32Array[];

export interface VectorStore {
  /** hash -> recordKey -> chunk vectors */
  readonly byHash: Map<string, Map<string, RecordVectors>>;
}

/** An empty store. Not a special case: a cold start is the normal first run. */
export function emptyVectorStore(): VectorStore {
  return { byHash: new Map() };
}

/* --------------------------------------------------------------- hashing */

/**
 * A short content hash for cache keys.
 *
 * FNV-1a, chosen for being five lines rather than for being cryptographic — this
 * only needs to notice that text changed, not resist an adversary. A collision
 * returns a stale vector for edited content, which is a quality regression rather
 * than a security one, so 32 bits is proportionate. `length` is mixed in because
 * FNV alone is weak on short similar strings.
 */
export function contentHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  // Fold the length in so two same-prefix strings of different lengths differ.
  return `${(hash >>> 0).toString(36)}-${text.length.toString(36)}`;
}

/** The cache key for a whole corpus: one hash over every record's text. */
export function corpusHash(records: readonly { key: string; text: string }[]): string {
  // Order-independent, so a content edit that only reorders records still
  // invalidates — record order is derived from the file, and a reordered file is a
  // changed file.
  const parts = records
    .map((record) => `${record.key}:${contentHash(record.text)}`)
    .sort();
  return contentHash(parts.join('\n'));
}

/* ----------------------------------------------------------- the maths */

/**
 * Mean-pool a token embedding matrix into one vector.
 *
 * `rows` is `[tokens][dimensions]`. Masked positions are excluded rather than
 * averaged as zeros: E5's tokenizer pads short inputs, and including the padding
 * would drag the mean toward the pad embedding for exactly the short chunks, biasing
 * the comparison in proportion to how short the text was.
 */
export function meanPool(rows: readonly (readonly number[])[], mask?: readonly number[]): Float32Array {
  const first = rows[0];
  if (first === undefined) return new Float32Array(0);

  const dimensions = first.length;
  const out = new Float32Array(dimensions);
  let counted = 0;

  for (let row = 0; row < rows.length; row += 1) {
    if (mask?.[row] === 0) continue;
    counted += 1;
    const values = rows[row] ?? [];
    for (let column = 0; column < dimensions; column += 1) {
      const cell = out[column];
      if (cell === undefined) continue;
      out[column] = cell + (values[column] ?? 0);
    }
  }

  if (counted === 0) return out;
  for (let column = 0; column < dimensions; column += 1) {
    const cell = out[column];
    if (cell === undefined) continue;
    out[column] = cell / counted;
  }
  return out;
}

/**
 * L2-normalise in place.
 *
 * A zero vector is returned unchanged rather than divided by zero: `0/0` is `NaN`,
 * and a single `NaN` in a dot product poisons the whole comparison silently —
 * every record would score `NaN` against it and drop out of the results with no
 * error anywhere.
 */
export function l2Normalise(vector: Float32Array): Float32Array {
  let sum = 0;
  for (const value of vector) sum += value * value;
  if (sum === 0) return vector;
  const inverse = 1 / Math.sqrt(sum);
  for (let index = 0; index < vector.length; index += 1) {
    // Read through a local rather than `vector[index] *= …`: the indexed access is
    // typed as possibly undefined, and `undefined * n` is `NaN` — which is exactly
    // the silent corruption this function exists to prevent.
    const current = vector[index];
    if (current === undefined) continue;
    vector[index] = current * inverse;
  }
  return vector;
}

/** Cosine similarity of two normalised vectors. `null` if either is unusable. */
export function cosine(a: Float32Array, b: Float32Array): number | null {
  if (a.length === 0 || a.length !== b.length) return null;
  let dot = 0;
  for (let index = 0; index < a.length; index += 1) {
    // Read through locals, not `a[index]` inline: the indexed access is typed as
    // possibly undefined, and `undefined * n` is `NaN` — which would poison the whole
    // comparison in exactly the way this function is written to prevent.
    const left = a[index];
    const right = b[index];
    if (left === undefined || right === undefined) return null;
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    dot += left * right;
  }
  if (!Number.isFinite(dot)) return null;
  // Clamp: floating-point accumulation can put a self-similarity at 1.0000001, and
  // a score above 1 breaks the 0–1 contract the merge in `retrieve.ts` relies on.
  return Math.max(-1, Math.min(1, dot));
}

/**
 * One score per record: the best-matching chunk.
 *
 * Max, not mean — see the file header. A record whose ninth chunk answers the
 * question should score on that chunk, not be pulled down by the eight that do not.
 */
export function aggregateByMax(
  query: Float32Array,
  vectors: ReadonlyMap<string, RecordVectors>,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [recordKey, chunks] of vectors) {
    let best: number | null = null;
    for (const chunk of chunks) {
      const value = cosine(query, chunk);
      if (value === null) continue;
      if (best === null || value > best) best = value;
    }
    if (best !== null) scores.set(recordKey, best);
  }

  return scores;
}

/* ------------------------------------------------------- store access */

export function storeFor(store: VectorStore, hash: string): Map<string, RecordVectors> {
  const existing = store.byHash.get(hash);
  if (existing) return existing;
  const created: Map<string, RecordVectors> = new Map();
  store.byHash.set(hash, created);
  return created;
}

export function vectorsFor(
  store: VectorStore,
  hash: string,
  recordKey: string,
): RecordVectors | null {
  return store.byHash.get(hash)?.get(recordKey) ?? null;
}

/* -------------------------------------------------------- the embedder */

/**
 * The subset of a transformers.js `feature-extraction` pipeline this file uses.
 *
 * Structural rather than imported, for two reasons: the real return value is a
 * `Tensor` whose `data` may be several typed-array shapes depending on the runtime
 * build, and a hand-written interface lets the maths below be tested against a fake
 * without loading 118 MB of weights.
 */
export interface FeatureExtractionPipeline {
  (text: string, options?: Record<string, unknown>): Promise<{ data: ArrayLike<number> }>;
  dispose?: () => Promise<void>;
}

export interface EmbedderState {
  readonly ready: boolean;
  readonly backend: 'webgpu' | 'wasm';
  /** Chunks resolved so far, so progress reflects the model rather than a timer. */
  readonly embedded: number;
  readonly total: number;
  /** Chunks the model refused. Never hidden: a partial index is still an index. */
  readonly failed: number;
  /**
   * Set when the pipeline disagrees with E5's published shape.
   *
   * A wrong width would make every comparison `null` (see `cosine`) and quietly turn
   * off semantic retrieval with no visible error — so it is reported instead.
   */
  readonly error?: string;
}

export interface E5Embedder extends Embedder {
  readonly backend: 'webgpu' | 'wasm';
  /** Embed the corpus, reporting progress. Safe to call twice; the cache is reused. */
  indexCorpus(
    records: readonly { key: string; text: string }[],
    onProgress?: (state: EmbedderState) => void,
  ): Promise<void>;
  /**
   * Score the whole corpus for one question, from cached vectors.
   *
   * The path `retrieve.ts` actually takes. The per-record `similarity()` above would
   * embed 125 chunks for a single question.
   *
   * Returns `null` — "no semantic half" — when the corpus is not indexed for this
   * content, or when the pipeline disagrees about vector width.
   */
  scoresFor(
    question: string,
    records: readonly { key: string; text: string }[],
  ): Promise<Map<string, number> | null>;
  /** Release the pipeline. Cached vectors survive; they are plain arrays. */
  dispose(): Promise<void>;
  state(): EmbedderState;
}

export interface CreateEmbedderOptions {
  /** Injected in tests. Never a real model. */
  pipeline?: FeatureExtractionPipeline;
  backend?: 'webgpu' | 'wasm';
  /** Injectable so a test can observe what would have been downloaded. */
  load?: () => Promise<FeatureExtractionPipeline | null>;
  /**
   * Read previously-computed vectors for a corpus, so a reload does not re-embed.
   *
   * A hook rather than a direct IndexedDB call, so this module keeps no reference to
   * browser storage and stays importable — and testable — under `node:test`. The real
   * implementation is `vector-persistence.ts`; a caller with no persistence simply does
   * not pass it.
   *
   * Called with the corpus hash, which is also the invalidation: a hash that does not
   * match returns nothing, and stale vectors are never consulted.
   */
  restore?: (hash: string) => Promise<Map<string, RecordVectors> | null>;
  /** Write this corpus's vectors once indexing has finished. Never rejects. */
  save?: (hash: string, vectors: Map<string, RecordVectors>) => Promise<void>;
}

/**
 * The model id for a role, from the registry.
 *
 * Exported because persistence needs to know which model's vectors it is storing.
 * Reading the id from the registry rather than hardcoding it means a registry change
 * moves the cache with it — and `restore` refuses vectors whose stored model id does
 * not match, which is what stops a stale cache being read as comparable.
 */
export function modelIdForRole(role: 'embedding' | 'conversation'): string {
  return modelForRole(role).id;
}

/** Prefix and pooling, applied identically on both sides of every comparison. */
const EMBED_OPTIONS = { pooling: 'mean', normalize: true } as const;

/**
 * Build an embedder over E5.
 *
 * Returns `null` — not a throwing embedder — when no pipeline can be built, because a
 * missing model is a supported state throughout this project: the caller keeps lexical
 * search, which is the whole reason `retrieve.ts` treats the semantic half as optional.
 */
export async function createE5Embedder(
  store: VectorStore = emptyVectorStore(),
  options: CreateEmbedderOptions = {},
): Promise<E5Embedder | null> {
  const backend = options.backend ?? 'wasm';
  const model = modelForRole('embedding');

  const loaded =
    options.pipeline !== undefined
      ? options.pipeline
      : await (options.load ?? defaultLoader(model.id, backend))();

  if (!loaded) return null;
  // A separate binding on purpose: `loaded` is narrowed, and we want a definite
  // `FeatureExtractionPipeline` for the closures below.
  const pipeline = loaded as FeatureExtractionPipeline;

  let hash = '';
  let embedded = 0;
  let total = 0;
  let failed = 0;
  let error: string | undefined;

  const report = (): void => {
    currentState = { ready: true, backend, embedded, total, failed, ...(error ? { error } : {}) };
  };
  let currentState: EmbedderState = { ready: true, backend, embedded: 0, total: 0, failed: 0 };

  /** A vector of the width E5 is documented to emit, or `null` if it is not. */
  function adopt(raw: ArrayLike<number>): Float32Array | null {
    if (raw.length !== E5_DIMENSIONS) {
      error = `expected ${E5_DIMENSIONS}-dimension vectors, pipeline returned ${raw.length}`;
      return null;
    }
    // `normalize: true` already L2-normalises inside the runtime. Doing it again is
    // idempotent for a unit vector and covers a runtime that quietly ignores the
    // option, which would leave magnitude — and so passage length — inside the score.
    return l2Normalise(Float32Array.from(raw));
  }

  async function embedPassage(text: string): Promise<Float32Array | null> {
    try {
      const output = await pipeline(`${PASSAGE_PREFIX}${text}`, { ...EMBED_OPTIONS });
      return adopt(output.data);
    } catch {
      return null;
    }
  }

  async function embedQuery(question: string): Promise<Float32Array | null> {
    try {
      const output = await pipeline(`${QUERY_PREFIX}${question}`, { ...EMBED_OPTIONS });
      return adopt(output.data);
    } catch {
      return null;
    }
  }

  return {
    ready: true,
    backend,

    /**
     * `query:` and `passage:` are different prefixes, so the two sides are embedded by
     * separate helpers rather than one parameterised call — a single flag invites
     * passing the wrong one, and a wrong prefix degrades retrieval without failing.
     */
    async similarity(question: string, document: string): Promise<number | null> {
      try {
        const query = await embedQuery(question);
        const passage = await embedPassage(document);
        if (!query || !passage) return null;
        return cosine(query, passage);
      } catch {
        return null;
      }
    },

    async indexCorpus(
      records: readonly { key: string; text: string }[],
      onProgress?: (state: EmbedderState) => void,
    ): Promise<void> {
      hash = corpusHash(records);
      const target = storeFor(store, hash);
      const chunks = chunkAll(records);

      // Group once, so each record is embedded in one pass and progress is known up
      // front rather than accumulating as the loop runs.
      const byRecord = new Map<string, Chunk[]>();
      for (const chunk of chunks) {
        const bucket = byRecord.get(chunk.recordKey);
        if (bucket) bucket.push(chunk);
        else byRecord.set(chunk.recordKey, [chunk]);
      }

      /*
       * Restored vectors go in before the loop, so the per-record reuse check below
       * sees them and skips that record entirely. Seeding them afterwards would index
       * everything and then overwrite — paying the full cost the persistence was meant
       * to avoid.
       *
       * The count check is the guard that matters: a restored entry is compared against
       * how many chunks this corpus would produce, so a chunker change or a half-written
       * entry cannot be mistaken for a complete index.
       */
      if (options.restore && target.size === 0) {
        const restored = await options.restore(hash).catch(() => null);
        if (restored) {
          for (const [recordKey, vectors] of restored) {
            const wanted = byRecord.get(recordKey);
            if (wanted && vectors.length === wanted.length) target.set(recordKey, vectors);
          }
        }
      }

      total = chunks.length;
      embedded = 0;
      failed = 0;
      error = undefined;

      for (const record of records) {
        const wanted = byRecord.get(record.key);
        if (!wanted) continue;

        // Already embedded for this exact content: reuse. Compared by count, so a
        // half-finished record from an interrupted run is re-done rather than trusted.
        const existing = target.get(record.key);
        if (existing && existing.length === wanted.length) {
          embedded += wanted.length;
          report();
          onProgress?.(currentState);
          continue;
        }

        // `push`, never `bucket[index] = vector`: a failed chunk would leave a hole,
        // and a sparse array reaching `cosine` reads `undefined`, not "no score".
        const vectors: RecordVectors = [];
        for (const chunk of wanted) {
          const vector = await embedPassage(chunk.text);
          if (vector) vectors.push(vector);
          else failed += 1;

          // Advanced whether or not the chunk succeeded, so the bar cannot stall
          // below 100% on a record the model refused part-way through.
          embedded += 1;
          report();
          onProgress?.(currentState);
        }

        if (vectors.length > 0) target.set(record.key, vectors);
      }

      /*
       * Persist only after the loop, and only if nothing failed.
       *
       * A partial index is in `target` too, so writing mid-loop would persist an index
       * that was never finished — and the count check in the restore path would then
       * reject it anyway, meaning the entry costs storage and saves nothing. Skipping
       * the write entirely when any chunk failed keeps the stored copy a copy of
       * something that actually finished.
       */
      if (options.save && failed === 0 && target.size > 0) {
        // Deliberately not awaited into the reported state: persistence is invisible to
        // the reader, and a slow disk write should not hold the progress bar short of
        // ready. `save` is required not to reject.
        void options.save(hash, new Map(target));
      }
    },

    async scoresFor(
      question: string,
      records: readonly { key: string; text: string }[],
    ): Promise<Map<string, number> | null> {
      // Keyed on the content the caller actually passed, not on whatever corpus was
      // indexed last. A mismatch returns null so `retrieve.ts` falls back to lexical
      // rather than scoring a question against vectors for different text.
      const corpusKey = records.length > 0 ? corpusHash(records) : hash;
      const vectors = store.byHash.get(corpusKey);
      if (!vectors || vectors.size === 0) return null;

      const query = await embedQuery(question);
      if (!query) {
        report();
        return null;
      }

      const scores = aggregateByMax(query, vectors);
      report();
      return scores.size > 0 ? scores : null;
    },

    async dispose(): Promise<void> {
      try {
        await pipeline.dispose?.();
      } catch {
        // Best-effort. A pipeline that refuses to release memory is not something a
        // reader needs to be interrupted for.
      }
    },

    state() {
      report();
      return currentState;
    },
  };
}

/**
 * Load the real pipeline.
 *
 * Delegates to `brain.ts` rather than importing the library here, so the project has
 * exactly one import site for `@huggingface/transformers` — and therefore exactly one
 * place that can accidentally make it reachable from a server module. `brain.ts` owns
 * backend detection, the dtype decision, the ORT WASM path and the Cache API settings.
 *
 * Three settings are deliberate, and all three are set inside `brain.ts`:
 * `allowLocalModels = false` stops the runtime probing for weights in the bundle,
 * which would 404 for every file; `useBrowserCache` keeps the second visit off the
 * network; and `dtype` comes from the registry rather than being hardcoded, because
 * q4f16 on WASM is not merely slower than int8, it is a different model file at a
 * different size.
 */
function defaultLoader(
  modelId: string,
  backend: 'webgpu' | 'wasm',
): () => Promise<FeatureExtractionPipeline | null> {
  return async () => {
    // `modelId` is checked rather than assumed, because the pipeline this returns is
    // used as an embedder and silently loading the wrong model's weights would produce
    // 384-dimension vectors that score nothing correctly — a silent failure again.
    if (modelId !== modelForRole('embedding').id) return null;
    try {
      const loaded = await loadModel({ role: 'embedding', backend });
      return loaded.pipeline as FeatureExtractionPipeline;
    } catch {
      return null;
    }
  };
}

/**
 * Score a question against an already-indexed corpus.
 *
 * Kept separate from `E5Embedder` so the maths can be tested with plain vectors, and
 * used by `scoresFor` above. Returns `null` when the corpus is not indexed, which
 * `retrieve.ts` reads as "no semantic half".
 */
export function scoreCorpus(
  query: Float32Array,
  store: VectorStore,
  corpusKey: string,
): Map<string, number> | null {
  const vectors = store.byHash.get(corpusKey);
  if (!vectors || vectors.size === 0) return null;
  return aggregateByMax(query, vectors);
}
