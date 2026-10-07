/**
 * Persistent vector storage, so a reload does not re-embed the corpus.
 *
 * The motivation is measured rather than theoretical: indexing is tens of seconds of
 * the reader's time on every single open, and it happens after they have already
 * downloaded 118 MB of weights. Keeping the weights in the Cache API but throwing away
 * the vectors on reload means the expensive part is paid again for no reason.
 *
 * **IndexedDB, not localStorage.** The corpus is 125 chunks × 384 float32 values —
 * about 192 KB of raw vectors, or roughly 400 KB as JSON. localStorage is a string
 * store capped in the low megabytes and synchronous, so it would both block the main
 * thread while serialising and sit one oversized value away from a quota failure. The
 * vectors go in as typed arrays and come back as typed arrays, with no parse step.
 *
 * **Keyed by the corpus hash, which is the invalidation.** A vector only describes the
 * text it was computed from, so the key includes `corpusHash` — editing any record
 * produces a different key and the old entry is simply never looked up again. That is
 * why this needs no migration path and no comparison against stored content: the hash
 * is the content's identity. Stale entries are pruned by count rather than by age,
 * because which of two hashes is "newer" is not a question the storage layer should be
 * answering.
 *
 * Everything here is optional. A reader whose browser denies IndexedDB, or whose
 * storage is full, gets an in-memory store and normal service — persistence is an
 * optimisation, and the code that cannot persist must not be able to fail.
 */

import { emptyVectorStore, type RecordVectors, type VectorStore } from './embeddings';

const DATABASE_NAME = 'portfolio-agent-vectors';
const DATABASE_VERSION = 1;
const STORE_NAME = 'corpora';

/**
 * How many corpus entries to keep.
 *
 * One, really — only the current content's vectors are ever read — but keeping a
 * second means a reader who edits the content file and reloads does not re-embed to
 * get back to what they had. Two is enough for that and small enough that the storage
 * cost is bounded by a constant rather than by how many times the content changed.
 */
export const MAX_PERSISTED_CORPORA = 2;

/**
 * The narrow slice of IndexedDB this module uses.
 *
 * Declared structurally so the pure maths in `embeddings.ts` stays importable under
 * `node:test`, where `indexedDB` does not exist. Every call site treats these as
 * possibly-absent.
 */
interface IdbRequest<T> {
  result: T;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  error: Error | null;
}

interface IdbDatabase {
  transaction(store: string, mode: 'readonly' | 'readwrite'): {
    objectStore(name: string): {
      get(key: string): IdbRequest<unknown>;
      put(value: unknown, key: string): IdbRequest<unknown>;
      delete(key: string): IdbRequest<unknown>;
      getAllKeys(): IdbRequest<unknown>;
      clear(): IdbRequest<unknown>;
    };
  };
  close(): void;
}

interface PersistedCorpus {
  /** The corpus hash. Also the primary key, which is what makes it the cache key. */
  hash: string;
  /** Model id, so vectors from a different model are never read as if comparable. */
  model: string;
  /** Backend label, for diagnostics only — vectors are numerically backend-dependent. */
  backend: string;
  /** Chunk vectors, keyed by record. Stored as plain number arrays for structured clone. */
  vectors: Record<string, number[][]>;
  /** When written, epoch ms. Used only to prune, never to decide validity. */
  savedAt: number;
}

function indexedDbFactory(): IDBFactory | null {
  // `globalThis` rather than a bare `indexedDB`, so this module can be imported under
  // `node:test` without throwing at the reference itself.
  const candidate = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  return candidate ?? null;
}

function openDatabase(factory: IDBFactory): Promise<IdbDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      // Safari in private mode throws here rather than firing `onerror`.
      reject(error instanceof Error ? error : new Error('IndexedDB unavailable'));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result as IdbDatabase);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
    // A second tab upgrading the schema would otherwise block here indefinitely.
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

/** Turn a request into a promise. No transaction, so the request settles on its own. */
function fromRequest<T>(request: IdbRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * Rebuild the in-memory shape from what was stored.
 *
 * Narrowed on the way out rather than trusted: an entry written by an older build, or
 * corrupted on disk, has to read as "no vectors" rather than throw inside a scoring
 * call. A `Float32Array` of the wrong width would otherwise make every `cosine` return
 * `null` and silently switch semantic retrieval off with no visible error.
 */
function revive(entry: unknown, model: string, dimensions: number): Map<string, RecordVectors> | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Partial<PersistedCorpus>;

  // The model check is the important one. Vectors from one embedding model are not
  // comparable to another's, and a changed model id with a reused cache name is
  // exactly how that would otherwise happen.
  if (record.model !== model) return null;
  if (!record.hash || !record.vectors || typeof record.vectors !== 'object') return null;

  const out = new Map<string, RecordVectors>();
  for (const [recordKey, list] of Object.entries(record.vectors)) {
    if (!Array.isArray(list)) continue;
    const vectors: RecordVectors = [];
    for (const vector of list) {
      if (!Array.isArray(vector) || vector.length !== dimensions) continue;
      vectors.push(Float32Array.from(vector as number[]));
    }
    // A record whose every vector was the wrong width is dropped rather than stored
    // empty, because an empty list reads downstream as "nothing to compare".
    if (vectors.length > 0) out.set(recordKey, vectors);
  }

  return out.size > 0 ? out : null;
}

/**
 * Restore this corpus's vectors, or `null` when there is nothing usable.
 *
 * Never throws. Every failure mode — no IndexedDB, a blocked upgrade, a full disk, a
 * corrupt entry — is the same outcome from the caller's side: index from scratch.
 */
export async function restoreVectors(
  hash: string,
  model: string,
  dimensions: number,
): Promise<Map<string, RecordVectors> | null> {
  const factory = indexedDbFactory();
  if (!factory) return null;

  let db: IdbDatabase;
  try {
    db = await openDatabase(factory);
  } catch {
    return null;
  }

  try {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(hash);
    return revive(await fromRequest(request), model, dimensions);
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/**
 * Write this corpus's vectors, and prune anything past `MAX_PERSISTED_CORPORA`.
 *
 * Called after indexing rather than during it, because a partial index is written to
 * the in-memory store too and persisting it would mean the next reload trusts an index
 * that was never finished.
 *
 * `await`ed by the caller but never allowed to reject there — see the note on
 * `restoreVectors`.
 */
export async function persistVectors(
  hash: string,
  model: string,
  backend: string,
  vectors: Map<string, RecordVectors>,
): Promise<boolean> {
  const factory = indexedDbFactory();
  if (!factory || vectors.size === 0) return false;

  let db: IdbDatabase;
  try {
    db = await openDatabase(factory);
  } catch {
    return false;
  }

  try {
    // JSON-shaped because `structuredClone` handles plain arrays of numbers directly,
    // and the values are small enough that the difference does not justify a binary
    // format with its own decoder.
    const serialisable: Record<string, number[][]> = {};
    for (const [recordKey, list] of vectors) {
      serialisable[recordKey] = list.map((vector) => Array.from(vector));
    }

    const entry: PersistedCorpus = {
      hash,
      model,
      backend,
      vectors: serialisable,
      savedAt: Date.now(),
    };

    const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
    await fromRequest(store.put(entry, hash));

    // Prune by count. Keys are hashes with no inherent order, so "newest" is not
    // available without the timestamps — and this corpus was just written, so it is
    // the newest by definition and whatever has to go is whatever is left.
    const keys = (await fromRequest(store.getAllKeys())) as IDBValidKey[];
    if (keys.length > MAX_PERSISTED_CORPORA) {
      const stale = keys.slice(0, keys.length - MAX_PERSISTED_CORPORA);
      for (const key of stale) await fromRequest(store.delete(String(key)));
    }

    return true;
  } catch {
    // A full quota or a revoked permission. The vectors are in memory either way, so
    // this session is unaffected.
    return false;
  } finally {
    db.close();
  }
}

/** Drop everything. Exposed for the tests and for a reader clearing site data. */
export async function clearPersistedVectors(): Promise<void> {
  const factory = indexedDbFactory();
  if (!factory) return;
  try {
    const db = await openDatabase(factory);
    try {
      await fromRequest(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear());
    } finally {
      db.close();
    }
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/**
 * A store that restores on demand.
 *
 * `createE5Embedder` takes a `VectorStore`, and the in-memory lookup is synchronous —
 * which is what `cosine` needs. So the restore is pulled in before the embedder is
 * built rather than lazily inside it: the embedder's first `indexCorpus` call already
 * happens after a pipeline load, and awaiting one more promise there costs nothing the
 * reader can perceive.
 *
 * Returns the store itself plus the `await`ed restore, because the embedder has to be
 * constructed with the store that already holds the restored entries.
 */
export async function persistentVectorStore(
  hash: string,
  model: string,
  dimensions: number,
): Promise<{ store: VectorStore; restored: Map<string, RecordVectors> | null }> {
  const store = emptyVectorStore();
  const restored = await restoreVectors(hash, model, dimensions);
  if (restored) store.byHash.set(hash, restored);
  return { store, restored };
}