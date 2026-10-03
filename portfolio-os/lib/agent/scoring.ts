/**
 * lib/agent/scoring.ts
 *
 * The arithmetic, stated once, in one place, with nothing hidden.
 *
 * Every weight in this file was chosen to be defensible to a hiring manager who
 * asks "why did it say 62%?". The formula is a weighted mean over requirements,
 * which means an unmet *required* item costs more than an unmet preferred one and
 * a single required gap is visible in the output rather than averaged away into
 * the noise.
 *
 * Two properties are deliberate and worth stating:
 *
 *  - **Unverified requirements count, at zero.** If a posting asks for five things
 *    and the portfolio documents four, the score is out of five, not out of four.
 *    Dropping unknown requirements from the denominator is how a chatbot reports
 *    100% for a candidate who meets a third of the posting.
 *
 *  - **Ambiguous terms are excluded from both numerator and denominator.** "AWS"
 *    resolving to five records is not a partial match, it is a question the agent
 *    cannot answer, and averaging it in would manufacture precision.
 */

import { classifyRecord, unverified, type EvidenceClassification, type MatchState } from './evidence';
import type { NormalisedTerm } from './normalize';
import type { KnowledgeRecord, PortfolioKnowledge } from './types';

/** How much a requirement of each level matters. Documented in PLAN.md §5. */
export const REQUIREMENT_WEIGHTS = {
  required: 1,
  preferred: 0.5,
  unknown: 0.5,
} as const;

/** What each evidence state contributes. */
export const STATE_WEIGHTS: Record<MatchState, number> = {
  strong: 1,
  partial: 0.5,
  'documented-uncorroborated': 0.25,
  unverified: 0,
};

export type ScoreGrade = 'strong' | 'partial' | 'documented-uncorroborated' | 'unverified';

export interface RequirementScore {
  term: string;
  raw: string;
  level: keyof typeof REQUIREMENT_WEIGHTS;
  state: ScoreGrade;
  weight: number;
  /** 0–1, the state weight. */
  ratio: number;
  /** The single best record supporting it, if any. */
  best: KnowledgeRecord | null;
  classification: EvidenceClassification;
  /** Set when the term meant several concepts and none was chosen. */
  ambiguous: boolean;
  /** Set when this was a family match rather than an exact concept. */
  family: string | null;
  familyMembers: string[];
  rationale: string;
}

export interface MatchResult {
  /** 0–100, truncated rather than rounded. Never overstates. */
  score: number;
  grade: ScoreGrade;
  requirements: RequirementScore[];
  /** Counted, and reported, so a gap cannot hide inside an average. */
  missingRequired: string[];
  missingPreferred: string[];
  /** Terms the portfolio does not document at all. */
  unverifiable: string[];
  /** Terms excluded from the arithmetic because they were ambiguous. */
  ambiguous: string[];
  /**
   * The score without unverifiable requirements in the denominator.
   *
   * Reported next to the headline, never instead of it. It answers "how well does
   * the documented part match" as distinct from "how much of the posting is
   * documented", and collapsing the two is the single easiest way to make this
   * number look better than it is.
   */
  documentedOnlyScore: number;
  /** 0–1. Share of requirement weight that is met. */
  coverage: number;
  basis: 'requirements' | 'empty';
}

/** Grades a 0–1 ratio using the same four states, so one vocabulary is used. */
function gradeFor(ratio: number): ScoreGrade {
  if (ratio >= 0.999) return 'strong';
  if (ratio >= 0.5) return 'partial';
  if (ratio > 0) return 'documented-uncorroborated';
  return 'unverified';
}

export interface ScoreOptions {
  /** Overrides the record a term is scored against. Injected for tests. */
  classify?: (record: KnowledgeRecord) => EvidenceClassification;
}

/**
 * One reading of a term that named several concepts.
 *
 * A separate type from `RequirementScore` on purpose. A reading is not scored — it
 * has no weight and takes no part in any arithmetic — it is evidence that was
 * computed and then thrown away by the scorer, kept so the answer can show it.
 */
export interface TermReading {
  /** The record this reading is about. */
  record: KnowledgeRecord;
  classification: EvidenceClassification;
  /**
   * How many records corroborate it. Never used to rank *strength* — see
   * `sortReadings` — but shown, because "14 receipts" is checkable and a bare
   * "strong" is not.
   */
  receipts: number;
}

/**
 * Every record a single term could have meant, each with its true evidence state.
 *
 * `scoreTerm` already computes this internally, then keeps only the best reading and
 * marks the term `ambiguous` so the arithmetic can exclude it. That is the right
 * behaviour for a *percentage* — one word with four meanings has no defensible
 * denominator — and it is the wrong behaviour for an *answer*, because it throws away
 * the evidence that was just computed. This is that evidence, returned intact.
 */
export function scoreReadings(
  term: NormalisedTerm,
  knowledge: PortfolioKnowledge,
  options: ScoreOptions = {},
): TermReading[] {
  const classify = options.classify ?? classifyRecord;
  const keys = term.canonicalIds.length > 0 ? term.canonicalIds : term.familyMembers;

  const readings: TermReading[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const record = knowledge.byKey.get(key);
    if (!record) continue;
    const classification = classify(record);
    readings.push({ record, classification, receipts: classification.receipts.length });
  }

  return sortReadings(readings);
}

/**
 * Orders readings by evidence strength first, receipt count second.
 *
 * The order of those two keys is the whole point of this function, and getting it
 * backwards is the flattering error: Docker resolves to Microservices with 14
 * receipts and to Docker Compose with 2. Ranking by count leads with the record that
 * merely appears most often and buries the one that names the thing asked about.
 * Ranking by state first leads with the honest reading and lets the count break ties
 * between readings of equal standing.
 */
export function sortReadings(readings: TermReading[]): TermReading[] {
  const rank: Record<ScoreGrade, number> = {
    strong: 0,
    partial: 1,
    'documented-uncorroborated': 2,
    unverified: 3,
  };
  return [...readings].sort((a, b) => {
    const byState = rank[a.classification.state] - rank[b.classification.state];
    if (byState !== 0) return byState;
    // More corroborating records first, then name, so the order is total and stable
    // rather than dependent on map iteration.
    if (b.receipts !== a.receipts) return b.receipts - a.receipts;
    return a.record.name.localeCompare(b.record.name);
  });
}

/**
 * Scores one normalised term.
 *
 * A term that names several records takes the best one, and says so. "AWS" is not
 * half-met because it appears on five records; it is either met by the best of
 * them or not met, and the caller is told the term was plural.
 */
export function scoreTerm(term: NormalisedTerm, knowledge: PortfolioKnowledge, options: ScoreOptions = {}): RequirementScore {
  const classify = options.classify ?? classifyRecord;
  const ambiguous = term.ambiguous || term.canonicalIds.length > 1;

  // A family term names a group rather than a record — "messaging" is not a
  // technology, Kafka is one of several things it could mean. Scoring it as zero
  // was wrong in the flattering direction: the portfolio does document members of
  // the family, and reporting `unverified` alongside those members on screen is a
  // contradiction the reader can see.
  //
  // The ceiling is `partial` and it is not negotiable. Holding RabbitMQ does not
  // satisfy a requirement for messaging, so no combination of family members may
  // reach `strong`, however well evidenced the best one is.
  const viaFamily = term.canonicalIds.length === 0 && term.familyMembers.length > 0;

  if (term.canonicalIds.length === 0 && !viaFamily) {
    const none = unverified(term.raw);
    return {
      term: term.term,
      raw: term.raw,
      level: term.level,
      state: 'unverified',
      weight: REQUIREMENT_WEIGHTS[term.level],
      ratio: 0,
      best: null,
      classification: none,
      ambiguous: false,
      family: term.family,
      familyMembers: term.familyMembers,
      rationale: none.rationale,
    };
  }

  let best: { record: KnowledgeRecord; classification: EvidenceClassification } | null = null;
  for (const key of viaFamily ? term.familyMembers : term.canonicalIds) {
    const record = knowledge.byKey.get(key);
    if (!record) continue;
    const classification = classify(record);
    if (!best || classification.weight > best.classification.weight) best = { record, classification };
  }

  if (!best) {
    return {
      term: term.term,
      raw: term.raw,
      level: term.level,
      state: 'unverified',
      weight: REQUIREMENT_WEIGHTS[term.level],
      ratio: 0,
      best: null,
      classification: unverified(term.raw),
      ambiguous,
      family: term.family,
      familyMembers: term.familyMembers,
      rationale: `The portfolio has a record under a different name for "${term.raw}" but no record that identifies it directly.`,
    };
  }

  const classification = viaFamily ? capAtPartial(best.classification) : best.classification;
  const ratio = classification.weight;

  return {
    term: term.term,
    raw: term.raw,
    level: term.level,
    state: classification.state,
    weight: REQUIREMENT_WEIGHTS[term.level],
    ratio,
    best: best.record,
    classification,
    ambiguous,
    family: term.family,
    familyMembers: term.familyMembers,
    rationale: viaFamily
      ? `The portfolio documents ${best.record.name}, which is in the same family as "${term.raw}", but no record identifies ${term.raw} directly.`
      : classification.rationale,
  };
}

/** Family evidence can be strong evidence *about a member*, and only partial evidence about the term. */
function capAtPartial(classification: EvidenceClassification): EvidenceClassification {
  if (classification.state !== 'strong') return classification;
  return {
    ...classification,
    state: 'partial',
    weight: STATE_WEIGHTS.partial,
    rationale: `Held at partial: "${classification.rationale}"`,
  };
}

export interface MatchInput {
  terms: readonly NormalisedTerm[];
  knowledge: PortfolioKnowledge;
  options?: ScoreOptions;
}

/**
 * The headline number.
 *
 * Truncated to a whole percent. 4.83 years must not become 4.9 and then get
 * quoted as five, and the same rule applies here: 61.8% is reported as 61%, not
 * 62%, because rounding always helps the number being reported.
 */
export function scoreMatch(input: MatchInput): MatchResult {
  const { knowledge } = input;
  const scored = input.terms.map((term) => scoreTerm(term, knowledge, input.options));

  // Ambiguous terms are held out of the arithmetic entirely.
  const countable = scored.filter((requirement) => !requirement.ambiguous);

  const missingRequired: string[] = [];
  const missingPreferred: string[] = [];
  const unverifiable: string[] = [];
  const ambiguous: string[] = [];

  let weighted = 0;
  let possible = 0;
  let documentedWeighted = 0;
  let documentedPossible = 0;

  for (const requirement of scored) {
    if (requirement.ambiguous) {
      ambiguous.push(requirement.raw);
      continue;
    }

    if (requirement.state === 'unverified') unverifiable.push(requirement.raw);

    weighted += requirement.ratio * requirement.weight;
    possible += requirement.weight;

    // The documented-only figure leaves unverified terms out of the denominator,
    // which is what makes it a different and lesser claim than the headline.
    if (requirement.state !== 'unverified') {
      documentedWeighted += requirement.ratio * requirement.weight;
      documentedPossible += requirement.weight;
    }

    if (requirement.level === 'required' && requirement.ratio < 0.999) missingRequired.push(requirement.raw);
    if (requirement.level === 'preferred' && requirement.ratio < 0.999) missingPreferred.push(requirement.raw);
  }

  const score = possible === 0 ? 0 : Math.floor((weighted / possible) * 100);
  const documentedOnlyScore =
    documentedPossible === 0 ? 0 : Math.floor((documentedWeighted / documentedPossible) * 100);

  return {
    score,
    grade: gradeFor(possible === 0 ? 0 : weighted / possible),
    requirements: scored,
    missingRequired,
    missingPreferred,
    unverifiable,
    ambiguous,
    documentedOnlyScore,
    coverage: possible === 0 ? 0 : weighted / possible,
    basis: scored.length === 0 ? 'empty' : 'requirements',
  };
}
