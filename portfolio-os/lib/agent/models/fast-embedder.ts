/**
 * lib/agent/models/fast-embedder.ts
 *
 * Lightweight, zero-model 64-dimensional semantic runtime embedder.
 *
 * Designed to provide instant, sub-millisecond cosine similarity matching
 * for direct/without-model queries or low-resource environments:
 *  - Generates compact 64-dimensional dense semantic vectors using character n-grams,
 *    subword features, and random projection (hashing trick).
 *  - L2-normalises all vectors so cosine similarity is a simple, fast dot product.
 *  - Implements the `Embedder` interface (`similarity`, `scoresFor`, `ready`).
 *  - Works 100% locally in browser and Node.js without downloading weights or ONNX runtimes.
 */

import type { Embedder } from '../retrieve';
import { normaliseTerm } from '../text';

export const FAST_EMBEDDER_DIMENSIONS = 64;

/**
 * Deterministic Murmur-like 32-bit hash function for string tokens and n-grams.
 */
function hashString(str: string, seed = 0): number {
  let h = seed ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/**
 * L2-normalise a 64-dimensional Float32Array in place.
 */
export function l2Normalise64(vec: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    const val = vec[i] ?? 0;
    sumSq += val * val;
  }
  if (sumSq === 0) return vec;
  const invNorm = 1 / Math.sqrt(sumSq);
  for (let i = 0; i < vec.length; i++) {
    vec[i] = (vec[i] ?? 0) * invNorm;
  }
  return vec;
}

/**
 * Embed arbitrary text into a normalised 64-dimensional semantic projection vector.
 *
 * Captures:
 * 1. Unigrams and word tokens
 * 2. Character 3-grams and 4-grams (capturing morphology, typos, abbreviations)
 * 3. Word bigrams (capturing multi-word technical concepts like "event driven", "distributed systems")
 */
export function embedText64(text: string, dimensions = FAST_EMBEDDER_DIMENSIONS): Float32Array {
  const vec = new Float32Array(dimensions);
  const clean = normaliseTerm(text);
  if (!clean || clean.length === 0) return vec;

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return vec;

  // 1. Word unigrams
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const h = hashString(w, 0x12345678);
    const index = h % dimensions;
    const sign = (h & 0x80000000) === 0 ? 1 : -1;
    vec[index] = (vec[index] ?? 0) + sign * 2.0;

    // 2. Character n-grams (3 to 4 chars) within words
    if (w.length >= 3) {
      for (let n = 3; n <= 4; n++) {
        for (let j = 0; j <= w.length - n; j++) {
          const sub = w.slice(j, j + n);
          const sh = hashString(sub, 0x87654321);
          const sIdx = sh % dimensions;
          const sSign = (sh & 0x80000000) === 0 ? 1 : -1;
          vec[sIdx] = (vec[sIdx] ?? 0) + sSign * 0.75;
        }
      }
    }

    // 3. Word bigrams
    if (i < words.length - 1) {
      const bigram = `${w}_${words[i + 1]}`;
      const bh = hashString(bigram, 0x9e3779b9);
      const bIdx = bh % dimensions;
      const bSign = (bh & 0x80000000) === 0 ? 1 : -1;
      vec[bIdx] = (vec[bIdx] ?? 0) + bSign * 2.5;
    }
  }

  return l2Normalise64(vec);
}

/**
 * Cosine similarity between two 64-dimensional normalised vectors.
 * Returns a value in 0–1.
 */
export function cosine64(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  // Clamp to 0..1 range (non-negative relevance)
  return Math.max(0, Math.min(1, (dot + 1) / 2));
}

/**
 * Fast runtime embedder instance adhering to the `Embedder` interface.
 */
export class FastRuntimeEmbedder implements Embedder {
  readonly ready = true;
  private readonly recordVectorCache = new Map<string, Float32Array>();

  /**
   * Pre-embeds or retrieves cached 64-d vector for a record.
   */
  private getRecordVector(key: string, text: string): Float32Array {
    let vec = this.recordVectorCache.get(key);
    if (!vec) {
      vec = embedText64(text);
      this.recordVectorCache.set(key, vec);
    }
    return vec;
  }

  /**
   * Calculate cosine similarity between query and document.
   */
  async similarity(query: string, document: string): Promise<number | null> {
    if (!query || !document) return null;
    const qVec = embedText64(query);
    const dVec = embedText64(document);
    return cosine64(qVec, dVec);
  }

  /**
   * Batch scores a corpus of records against a query string.
   */
  async scoresFor(
    query: string,
    records: readonly { key: string; text: string }[],
  ): Promise<Map<string, number> | null> {
    if (!query || records.length === 0) return null;
    const qVec = embedText64(query);
    const scores = new Map<string, number>();

    for (const record of records) {
      const dVec = this.getRecordVector(record.key, record.text);
      const sim = cosine64(qVec, dVec);
      scores.set(record.key, sim);
    }

    return scores;
  }
}

/**
 * Factory creating a 64-d fast runtime embedder.
 */
export function createFastRuntimeEmbedder(): Embedder {
  return new FastRuntimeEmbedder();
}
