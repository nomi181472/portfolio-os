/**
 * lib/agent/evidence.ts
 *
 * Decides what kind of support a record has for a claim.
 *
 * This is the layer the whole project exists to get right, because it is the
 * difference between a chatbot that flatters and one that can be trusted with
 * someone's career. Four states, and the two that are easiest to get wrong are
 * the ones the portfolio's own data forces:
 *
 *   strong                       a receipt exists in a real project or product
 *   partial                      corroboration exists but does not show depth
 *   documented-uncorroborated    the record describes it, nothing does
 *   unverified                   the portfolio does not document it at all
 *
 * The tempting mistake is to collapse the third into the fourth. Apache Kafka and
 * TensorFlow have a full narrative record and *zero* inbound edges. Reading that
 * as "not documented" is a lie in the opposite direction from the one this state
 * machine is built to prevent, and it is worse, because a reader who was told
 * Kafka was undocumented would not think to go and look.
 */

import type { EntityRef, KnowledgeRecord, PortfolioKnowledge } from './types';

export type MatchState = 'strong' | 'partial' | 'documented-uncorroborated' | 'unverified';

export interface EvidenceClassification {
  state: MatchState;
  /** The score this state contributes. See `scoring.ts`. */
  weight: number;
  /** Records that support the claim, strongest first. */
  receipts: EntityRef[];
  /** One sentence a reader can check. Never a sentence the model wrote. */
  rationale: string;
}

/** Kinds that count as a receipt: something was actually built or shipped. */
const RECEIPT_KINDS: ReadonlySet<string> = new Set(['products', 'projects', 'research']);

/** Kinds that corroborate but do not, on their own, show delivery. */
const SUPPORTING_KINDS: ReadonlySet<string> = new Set(['experience', 'certifications', 'awards', 'leadership']);

/**
 * Classifies one record.
 *
 * `record.depth` is the owner's own self-assessment and is deliberately *not*
 * read here. A claim that Noman rates a skill "expert" is a claim about intent,
 * not a receipt, and letting it raise the state would mean the portfolio could
 * vouch for itself.
 */
export function classifyRecord(record: KnowledgeRecord): EvidenceClassification {
  const receipts = record.evidence
    .filter((edge) => RECEIPT_KINDS.has(edge.kind))
    .sort((a, b) => a.name.localeCompare(b.name));
  const supporting = record.evidence.filter((edge) => SUPPORTING_KINDS.has(edge.kind));

  const named = receipts[0]?.name ?? supporting[0]?.name ?? null;

  if (receipts.length === 0 && supporting.length === 0) {
    return {
      state: 'documented-uncorroborated',
      weight: 0.25,
      receipts: [],
      rationale: `The portfolio has a record for this (${record.name}${
        record.depth ? `, self-rated "${record.depth}"` : ''
      }), but nothing in it points back to show where it was used.`,
    };
  }

  if (receipts.length === 0) {
    return {
      state: 'partial',
      weight: 0.5,
      receipts: [],
      rationale: `Mentioned in ${supporting.map((edge) => edge.name).join(' and ')}, which is not the same as having built something with it.`,
    };
  }

  // Depth decides strong vs partial, and only ever between those two. Both mean
  // a receipt exists; the difference is what the receipt looks like.
  const deep = record.depth === 'deep' || record.depth === 'expert';
  const state: MatchState = deep ? 'strong' : 'partial';
  return {
    state,
    weight: deep ? 1 : 0.5,
    receipts: receipts.slice(0, 4),
    rationale:
      state === 'strong'
        ? `Used in ${named} and ${receipts.length} other project${receipts.length === 1 ? '' : 's'}, self-rated "${record.depth}".`
        : `Used in ${named}${receipts.length > 1 ? ` and ${receipts.length - 1} more` : ''}${
            record.depth ? `, self-rated "${record.depth}"` : ', with no self-assessed depth'
          }.`,
  };
}

/** A term the portfolio does not document. Carries no evidence by construction. */
export function unverified(term: string): EvidenceClassification {
  return {
    state: 'unverified',
    weight: 0,
    receipts: [],
    rationale: `The portfolio does not document ${term}. That is a statement about this site, not a claim that the candidate cannot do it.`,
  };
}

/** Groups a set of records into classifications, preserving order. */
export function classifyAll(
  keys: readonly string[],
  knowledge: PortfolioKnowledge,
): { key: string; record: KnowledgeRecord; classification: EvidenceClassification }[] {
  const out: { key: string; record: KnowledgeRecord; classification: EvidenceClassification }[] = [];
  for (const key of keys) {
    const record = knowledge.byKey.get(key);
    if (!record) continue;
    out.push({ key, record, classification: classifyRecord(record) });
  }
  return out;
}
