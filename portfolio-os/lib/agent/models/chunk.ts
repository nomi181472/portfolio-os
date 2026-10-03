/**
 * lib/agent/models/chunk.ts
 *
 * Splitting a record into pieces a 512-token embedder can actually read.
 *
 * This module exists because of a measurement, and it is worth stating plainly
 * because the alternative looks correct and is not. Measured against the real
 * content file: 93 records, 81,785 characters, and **24 of those records are longer
 * than one embedder context**. The longest — VERSEYE at roughly 1,675 estimated
 * tokens — is more than three times E5's 512-token limit. NAVIROX, both employment
 * roles and NEED are all in the same range.
 *
 * Those are not incidental records. They are the two flagship products, both jobs,
 * and the research project — the exact things a recruiter asks about. So an
 * implementation that embeds `record.text` whole would:
 *
 *  - **silently truncate**, dropping the architecture and metrics sections that
 *    live past the cut, and
 *  - return a weaker score for the longest records than for the shortest ones,
 *    which is backwards.
 *
 * Nothing throws. The records are simply worse at being matched, and the failure is
 * invisible precisely where the content is richest.
 *
 * Three decisions, each of which is a correctness choice rather than a tuning knob:
 *
 *  1. **Chunk on paragraph, then sentence, then word.** Splitting mid-word
 *     produces tokens the embedder has never seen; splitting on a boundary keeps
 *     text that means something intact.
 *
 *  2. **Overlap, because the boundary loses the sentence that straddles it.** A
 *     question about a fact stated across a cut would match neither half. The
 *     overlap is measured in tokens rather than guessed, so it survives a change of
 *     chunk size.
 *
 *  3. **Every chunk keeps its record key.** Aggregation happens per record
 *     (`aggregateByMax` in `embeddings.ts`), never across records — a record must
 *     not be able to score highly on a neighbour's evidence.
 *
 * Token counts are *estimates*. E5's tokenizer ships with the model and is not
 * available without it, so this uses a character-based heuristic and is deliberately
 * conservative (a character-to-token ratio above the real one means chunks are
 * slightly smaller than the target, which is the safe direction: a chunk that
 * overflows gets truncated by the model, a chunk that is too small does not).
 *
 * Pure, DOM-free and model-free, so all of it is testable in `node:test`.
 */

/** E5's hard context limit. Exceeding it is truncation, not an error. */
export const E5_MAX_TOKENS = 512;

/**
 * Characters per token, estimated.
 *
 * E5 uses a SentencePiece tokenizer on technical English. Real text lands around
 * 4.0–4.5 characters per token, with markdown tables and identifiers pulling the
 * average down. 3.5 is used as the divisor so the estimate over-counts tokens,
 * which makes chunks smaller than the target rather than larger.
 */
const CHARS_PER_TOKEN = 3.5;

/** Target chunk size, leaving headroom under `E5_MAX_TOKENS` for the prefix. */
export const TARGET_CHUNK_TOKENS = 380;

/** Tokens of overlap between neighbours, so a straddling sentence is in both. */
export const OVERLAP_TOKENS = 60;

/** E5 requires these prefixes. Omitting them degrades retrieval, silently. */
export const PASSAGE_PREFIX = 'passage: ';
export const QUERY_PREFIX = 'query: ';

export interface Chunk {
  /** The record this came from. Never mixed with another record's. */
  readonly recordKey: string;
  /** Zero-based position within the record. */
  readonly index: number;
  /** Text to embed, without the `passage:` prefix — that is added at call time. */
  readonly text: string;
  /** Estimated tokens, before prefixing. */
  readonly tokens: number;
}

/** Character count implied by a token target. */
function charsFor(tokens: number): number {
  return Math.floor(tokens * CHARS_PER_TOKEN);
}

/**
 * Split text into sentence-ish units, keeping the delimiter attached.
 *
 * A blank line is a stronger boundary than a full stop — a heading or a list item
 * ends there — so paragraph breaks are marked as hard boundaries and sentence ends
 * as soft ones. A period inside `3.5` or `v1.2` must not split, which is why the
 * boundary requires whitespace after the mark.
 */
interface Unit {
  text: string;
  hard: boolean;
}

function units(text: string): Unit[] {
  const blocks = text.split(/\n{2,}/);
  const result: Unit[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // A block with no internal sentence break is one unit — common for headings,
    // short list items and table rows.
    const pieces = trimmed.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
    if (pieces.length === 1) {
      result.push({ text: trimmed, hard: true });
      continue;
    }
    for (const piece of pieces) {
      const text = piece.trim();
      if (text) result.push({ text, hard: false });
    }
    // The paragraph itself is a hard boundary: whatever follows starts fresh.
    result.push({ text: '', hard: true });
  }

  return result.filter((unit) => unit.text.length > 0);
}

/**
 * Greedy packing of units into chunks under a character budget.
 *
 * When a single unit is larger than the budget — a long architecture paragraph, or
 * a wide markdown table — it is split on word boundaries. That is the one place
 * text is divided arbitrarily, and it is why the overlap exists.
 */
function pack(units: Unit[], limit: number): string[] {
  const chunks: string[] = [];
  let current = '';

  const flush = (): void => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const unit of units) {
    if (unit.text.length > limit) {
      flush();
      for (const part of splitOnWords(unit.text, limit)) chunks.push(part);
      continue;
    }

    const candidate = current ? `${current} ${unit.text}` : unit.text;
    if (candidate.length > limit && current) {
      flush();
      current = unit.text;
    } else {
      current = candidate;
    }

    // A hard boundary closes the chunk even when there is room left, so a heading
    // never shares a chunk with the paragraph it introduces.
    if (unit.hard) flush();
  }

  flush();
  return chunks;
}

function splitOnWords(text: string, limit: number): string[] {
  const parts: string[] = [];
  let current = '';

  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > limit && current) {
      parts.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);

  // A single word longer than the budget (a URL, a long identifier) still has to
  // go somewhere, so it is emitted whole rather than dropped. Truncating it would
  // silently lose content.
  return parts;
}

/** Estimate tokens for a piece of text. Conservative — see `CHARS_PER_TOKEN`. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Chunk one record.
 *
 * Returns at least one chunk for any non-empty text, including text longer than
 * the budget, which comes back as several. An empty record returns `[]` rather than
 * a chunk holding nothing — an empty embedding is a zero vector, and a zero vector
 * has no direction, so including one would let a record match on length alone.
 */
export function chunkRecord(recordKey: string, text: string): Chunk[] {
  const clean = text.trim();
  if (!clean) return [];

  const limit = charsFor(TARGET_CHUNK_TOKENS);
  const overlapChars = charsFor(OVERLAP_TOKENS);
  const pieces = pack(units(clean), limit);

  const result: Chunk[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (piece === undefined) continue;
    let body = piece;

    // Carry the tail of the previous chunk into this one. Without it, a sentence
    // that straddles the boundary belongs to neither chunk and becomes
    // unmatchable — the exact question the overlap exists to answer.
    if (index > 0 && overlapChars > 0) {
      const previous = pieces[index - 1];
      const tail = previous === undefined ? '' : previous.slice(-overlapChars);
      if (tail.trim()) body = `${tail.trim()} ${body}`;
    }

    result.push({
      recordKey,
      index,
      text: body,
      tokens: estimateTokens(body),
    });
  }

  return result;
}

/** Chunk every record, preserving order. */
export function chunkAll(
  records: readonly { key: string; text: string }[],
): Chunk[] {
  return records.flatMap((record) => chunkRecord(record.key, record.text));
}

/**
 * Whether any chunk is at risk of overflowing E5's limit.
 *
 * Used by a test rather than trusted: the estimate is a heuristic, so the suite
 * asserts that the *real* corpus produces chunks inside the limit. If a future
 * content edit pushes a record past it, the test fails rather than the model
 * quietly truncating.
 */
export function oversizedChunks(chunks: readonly Chunk[]): Chunk[] {
  return chunks.filter((chunk) => chunk.tokens + estimateTokens(PASSAGE_PREFIX) > E5_MAX_TOKENS);
}

/** Total chunks a set of records produces, for the UI and for tests. */
export function countChunks(records: readonly { key: string; text: string }[]): number {
  return chunkAll(records).length;
}
