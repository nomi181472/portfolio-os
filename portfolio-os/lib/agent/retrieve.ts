/**
 * lib/agent/retrieve.ts
 *
 * Ranking records against a question. The lexical half runs with no dependencies
 * and is always available; the semantic half is injected and is optional.
 *
 * That split is the reason the whole thing works before any model is downloaded.
 * Transformers.js is a ~600 kB–580 MB download depending on what it pulls, and
 * a reader who has not finished it — or is on a phone, or has WebGPU disabled —
 * still gets real answers from the lexical scorer. The embedder only ever adds to
 * a result set that already exists.
 *
 * Both halves are pure functions over injected state, so the ranking is
 * testable without a model, reproducible without one, and the model's absence is
 * a quality difference rather than an outage.
 */

import { normaliseTerm } from './text';
import type { KnowledgeRecord, PortfolioKnowledge } from './types';

export interface ScoredRecord {
  key: string;
  record: KnowledgeRecord;
  /** 0–1. Contribution from the lexical scorer. */
  lexical: number;
  /** 0–1, or null when no embedder is loaded. */
  semantic: number | null;
  /** The combined score actually used for ranking. */
  score: number;
  /** Why it matched, for the answer's rationale. */
  matchedTerms: string[];
}

export interface Embedder {
  /** Must be already loaded. Loading is the caller's problem, deliberately. */
  readonly ready: boolean;
  /** Cosine similarity in 0–1. `null` when the embedder cannot handle the text. */
  similarity(query: string, document: string): Promise<number | null>;
  /**
   * Optional: score a whole corpus at once, by record key.
   *
   * Present on `E5Embedder` and absent on simpler embedders, which is what keeps this
   * interface backwards compatible. The distinction matters by a factor of 125: the
   * per-record path calls `similarity` once per record per question, and an
   * E5-backed implementation would re-embed the entire corpus for every question
   * asked. When present, `retrieve` prefers it.
   *
   * Returns `null` when the embedder cannot answer for this corpus — not indexed,
   * wrong vector width, or the model refused the query. `retrieve` reads that as
   * "no semantic half".
   */
  scoresFor?(
    query: string,
    records: readonly { key: string; text: string }[],
  ): Promise<Map<string, number> | null>;
}

export interface RetrieveOptions {
  limit?: number;
  kinds?: readonly string[];
  embedder?: Embedder | null;
  /**
   * How much the embedder is allowed to move a result, 0–1.
   *
   * Deliberately below 0.5. A semantic model will happily rank a document as
   * similar because it is about the same *topic*, and this agent is not a topic
   * matcher — it is answering "does this portfolio say he has done X". Letting
   * embeddings outweigh the lexical match is how "tell me about your computer
   * vision work" returns a document about a different vision.
   */
  semanticWeight?: number;
  /** Records must clear this to be returned at all. */
  minScore?: number;
  /**
   * Fraction of the top score a hit must reach to be shown. Guards the card list
   * against filling with documents that merely co-occur with the question.
   */
  backfillRatio?: number;
}

const DEFAULTS = {
  limit: 8,
  semanticWeight: 0.35,
  minScore: 0.12,
  /**
   * Backfill threshold, as a fraction of the top hit.
   *
   * A card list is an argument, not a search result page. At `minScore` alone the
   * backfill for a Kafka question filled with LangGraph, TensorFlow and Semantic
   * Kernel — documents that merely co-occur with the term. Half the top score is
   * arbitrary but it is a real floor: anything that scored less than half as well
   * as the best match is not evidence for the thing asked about.
   */
  backfillRatio: 0.5,
} as const;

/**
 * BM25-lite over the record corpus.
 *
 * BM25 rather than tf-idf because record lengths here vary by 40x — a 3.7 kB
 * research body against a 60-character skill summary — and plain tf-idf lets the
 * long documents win every query purely by having more words in them. The length
 * normalisation is what stops a research paper from outranking a skill record
 * that actually names the technology.
 */
const K1 = 1.4;
const B = 0.72;

export interface LexicalIndex {
  /** term -> [recordIndex, frequency][] */
  postings: Map<string, Map<number, number>>;
  lengths: number[];
  averageLength: number;
}

/** Built once per knowledge set, not once per question. */
export function buildLexicalIndex(records: readonly KnowledgeRecord[]): LexicalIndex {
  const postings = new Map<string, Map<number, number>>();
  const lengths: number[] = [];

  records.forEach((record, index) => {
    const terms = record.text.split(/\s+/).filter(Boolean);
    lengths.push(terms.length);
    for (const term of terms) {
      let entry = postings.get(term);
      if (!entry) {
        entry = new Map();
        postings.set(term, entry);
      }
      entry.set(index, (entry.get(index) ?? 0) + 1);
    }
  });

  const averageLength =
    lengths.length === 0 ? 0 : lengths.reduce((sum, value) => sum + value, 0) / lengths.length;

  return { postings, lengths, averageLength };
}

function lexicalScores(index: LexicalIndex, queryTerms: readonly string[]): Map<number, number> {
  const scores = new Map<number, number>();
  const total = index.lengths.length;
  if (total === 0 || index.averageLength === 0) return scores;

  for (const term of queryTerms) {
    const entry = index.postings.get(term);
    if (!entry) continue;
    // Terms that appear in nearly every record carry no information. Without
    // this, "systems" pushes 60 records up the ranking and the reader gets a
    // wall of irrelevant results above the one that matters.
    const documentFrequency = entry.size;
    if (documentFrequency / total > 0.6) continue;

    const idf = Math.log(1 + (total - documentFrequency + 0.5) / (documentFrequency + 0.5));

    for (const [index_, frequency] of entry) {
      const length = index.lengths[index_] ?? 0;
      const denominator = frequency + K1 * (1 - B + (B * length) / index.averageLength);
      const contribution = idf * ((frequency * (K1 + 1)) / (denominator || 1));
      scores.set(index_, (scores.get(index_) ?? 0) + contribution);
    }
  }

  return scores;
}

/** Normalises a score set to 0–1 against its own maximum. */
function normalise(scores: Map<number, number>): Map<number, number> {
  let max = 0;
  for (const value of scores.values()) if (value > max) max = value;
  if (max === 0) return new Map();
  const out = new Map<number, number>();
  for (const [key, value] of scores) out.set(key, value / max);
  return out;
}

/**
 * Ranks records.
 *
 * Async because the embedder is async, but the lexical half is computed
 * synchronously first and the result is returned even if the embedder throws —
 * a model that fails mid-session must not take search down with it.
 */
export async function retrieve(
  question: string,
  knowledge: PortfolioKnowledge,
  index: LexicalIndex,
  options: RetrieveOptions = {},
): Promise<ScoredRecord[]> {
  const limit = options.limit ?? DEFAULTS.limit;
  const semanticWeight = options.semanticWeight ?? DEFAULTS.semanticWeight;
  const minScore = options.minScore ?? DEFAULTS.minScore;
  const embedder = options.embedder ?? null;

  const all = knowledge.records;
  const pool = options.kinds?.length
    ? all.filter((record) => options.kinds?.includes(record.kind))
    : all;
  const poolIndexes = new Set(pool.map((record) => all.indexOf(record)));

  const queryTerms = normaliseTerm(question).split(' ').filter((term) => term.length >= 2);
  const rawLexical = lexicalScores(index, queryTerms);
  const lexical = normalise(rawLexical);

  // Term-level matches, so the rationale can say *which* word hit.
  const matched = new Map<number, string[]>();
  for (const term of queryTerms) {
    const entry = index.postings.get(term);
    if (!entry) continue;
    for (const documentIndex of entry.keys()) {
      if (!poolIndexes.has(documentIndex)) continue;
      const list = matched.get(documentIndex) ?? [];
      list.push(term);
      matched.set(documentIndex, list);
    }
  }

  let semantic = new Map<number, number>();
  if (embedder?.ready) {
    try {
      // Keyed by record key on the way in, converted to record indexes here, because
      // `scoresFor` deals in keys (they are the cache identity) while scoring walks
      // an index into `all`.
      const raw = new Map<number, number>();

      if (embedder.scoresFor) {
        const byKey = await embedder.scoresFor(
          question,
          pool.map((record) => ({ key: record.key, text: record.text })),
        );
        if (byKey) {
          for (const [key, value] of byKey) {
            const position = pool.findIndex((record) => record.key === key);
            if (position !== -1) raw.set(all.indexOf(pool[position] as KnowledgeRecord), value);
          }
        }
      } else {
        const pairs = await Promise.all(
          pool.map(async (record, position) => ({
            position,
            value: await embedder.similarity(question, record.text),
          })),
        );
        for (const pair of pairs) {
          if (pair.value === null) continue;
          raw.set(all.indexOf(pool[pair.position] as KnowledgeRecord), pair.value);
        }
      }

      semantic = normalise(raw);
    } catch {
      // A model that throws is a model that is not answering. The lexical
      // ranking stands on its own, and reporting fewer results because the
      // optional half failed would be a worse outcome than reporting slightly
      // worse ones.
      semantic = new Map();
    }
  }

  const results: ScoredRecord[] = [];
  for (const record of pool) {
    const documentIndex = all.indexOf(record);
    const lexicalScore = lexical.get(documentIndex) ?? 0;
    const semanticScore = semantic.get(documentIndex) ?? null;
    if (lexicalScore === 0 && semanticScore === null) continue;

    const score =
      semanticScore === null
        ? lexicalScore
        : lexicalScore * (1 - semanticWeight) + semanticScore * semanticWeight;

    if (score < minScore) continue;

    results.push({
      key: record.key,
      record,
      lexical: lexicalScore,
      semantic: semanticScore,
      score,
      matchedTerms: matched.get(documentIndex) ?? [],
    });
  }

  results.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const top = results[0]?.score ?? 0;
  const floor = top * (options.backfillRatio ?? DEFAULTS.backfillRatio);
  return results.filter((result) => result.score >= floor).slice(0, limit);
}

/**
 * A null embedder, so callers never branch on "is there a model".
 *
 * Without this, every call site has to remember that a missing model is not an
 * error, and the first one that forgets turns an optional feature into a crash.
 */
export const NO_EMBEDDER: Embedder = {
  ready: false,
  async similarity() {
    return null;
  },
};
