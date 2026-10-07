/**
 * lib/agent/engine/composer.ts
 *
 * Deterministic text composition helpers:
 * - plural, agreement, nameOf, joinList
 * - composeAnswer: Writes score, breakdown, evidence, and career span
 * - composeReadingsAnswer: Ambiguous term answers with multiple readings
 * - readingsAnswerFor: Resolves ambiguous readings
 */

import type { EntityRef, PortfolioKnowledge } from '../types';
import type { MatchResult, RequirementScore, TermReading } from '../scoring';
import { scoreReadings } from '../scoring';
import type { NormalisedTerm } from '../normalize';

/**
 * "1 role" / "2 roles". The count belongs in the phrase.
 */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Just the verb, for a subject the sentence has already named.
 */
export function agreement(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * How a requirement should be named in prose.
 */
export function nameOf(term: { raw: string; best?: { name: string } | null }): string {
  return term.best?.name ?? term.raw;
}

/** `A`, `A and B`, `A, B and C`. Naive joins read as a bug when they collide. */
export function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Writes the reply for scored requirement matches.
 *
 * Every sentence is assembled from a state, a name and a count. There is no free
 * text here and no interpolation of anything the reader typed, so the output
 * cannot contain a claim that is not in the payload.
 */
export function composeAnswer(
  terms: readonly RequirementScore[],
  match: MatchResult,
  cards: readonly EntityRef[],
  knowledge: PortfolioKnowledge,
): string {
  if (terms.length === 0) {
    return 'No requirements were found in that, so there is nothing to score.';
  }

  const parts: string[] = [];
  const headline = `${match.score}% against the requirements that could be read.`;
  parts.push(headline);

  if (match.ambiguous.length > 0) {
    parts.push(
      `${joinList(match.ambiguous)} could mean more than one thing here, so ${agreement(match.ambiguous.length, 'it is', 'they are')} left out of the score.`,
    );
  }

  const strong = terms.filter((t) => t.state === 'strong');
  const partial = terms.filter((t) => t.state === 'partial');
  const uncorroborated = terms.filter((t) => t.state === 'documented-uncorroborated');
  const missing = terms.filter((t) => t.state === 'unverified');

  for (const [group, one, many] of [
    [strong, 'is documented with projects behind it', 'are documented with projects behind them'],
    [partial, 'is mentioned, with less behind it than the claim usually implies', 'are mentioned, with less behind them than the claim usually implies'],
    [uncorroborated, 'has a record here, but nothing that shows where it was used', 'have a record here, but nothing that shows where they were used'],
  ] as const) {
    if (group.length === 0) continue;
    const names = group.map((t) => t.best?.name ?? t.raw).join(', ');
    parts.push(`${names} ${group.length === 1 ? one : many}.`);
  }

  if (missing.length > 0) {
    const candidateName = knowledge.profile.name || 'the candidate';
    parts.push(
      `${missing.map((t) => t.raw).join(', ')} ${agreement(missing.length, 'is', 'are')} not documented on this site. That is a gap in the portfolio, not a finding about ${candidateName}.`,
    );
  }

  const requiredUndocumented = match.requirements
    .filter((t) => t.level === 'required' && t.state === 'unverified' && !t.ambiguous)
    .map(nameOf);
  const requiredThin = match.requirements
    .filter((t) => t.level === 'required' && t.state !== 'strong' && t.state !== 'unverified' && !t.ambiguous)
    .map(nameOf);
  if (requiredUndocumented.length > 0) {
    parts.push(`Required and not documented anywhere on this site: ${requiredUndocumented.join(', ')}.`);
  }
  if (requiredThin.length > 0) {
    parts.push(`Required, with weaker evidence than the wording implies: ${requiredThin.join(', ')}.`);
  }

  if (cards.length > 0) {
    const where = cards
      .slice(0, 3)
      .map((card) => card.name)
      .join(', ');
    parts.push(`The evidence is in ${where}${cards.length > 3 ? ` and ${cards.length - 3} more` : ''}.`);
  }

  if (knowledge.experienceSpan.months > 0) {
    parts.push(
      `The documented career is ${knowledge.experienceSpan.years} years, from ${knowledge.experienceSpan.first} to ${knowledge.experienceSpan.last}.`,
    );
  }

  return parts.join(' ');
}

/**
 * The reply for a question whose terms are all ambiguous.
 */
export function composeReadingsAnswer(
  sections: readonly { term: NormalisedTerm; readings: readonly TermReading[] }[],
  knowledge: PortfolioKnowledge,
): string {
  const parts: string[] = [];

  parts.push(
    sections.length === 1
      ? `${sections[0]!.term.raw} could mean more than one thing here, so ${agreement(sections[0]!.readings.length, 'it is', 'they are')} reported separately and nothing is scored.`
      : `${sections.map((section) => section.term.raw).join(' and ')} could each mean more than one thing here, so ${agreement(sections.length, 'it is', 'they are')} reported separately and nothing is scored.`,
  );

  const documented = new Map<string, TermReading>();
  for (const section of sections) {
    const documentedHere = section.readings.filter(
      (reading) => reading.classification.state !== 'unverified',
    );
    if (documentedHere.length === 0) {
      parts.push(`No record on this site identifies ${section.term.raw} directly.`);
      continue;
    }
    for (const reading of documentedHere) {
      if (!documented.has(reading.record.key)) documented.set(reading.record.key, reading);
    }
  }

  for (const reading of documented.values()) {
    const name = reading.record.name;
    const { state, receipts: receiptRefs } = reading.classification;
    const count = receiptRefs.length;
    const behind = count === 0 ? '' : `, with ${plural(count, 'record', 'records')} behind ${count === 1 ? 'it' : 'them'}`;

    if (state === 'strong') {
      parts.push(`${name}: documented${behind}.`);
    } else if (state === 'partial') {
      parts.push(`${name}: related rather than the same thing${behind}.`);
    } else {
      parts.push(`${name}: a record here, but nothing that shows where it was used.`);
    }
  }

  if (knowledge.experienceSpan.months > 0) {
    parts.push(
      `The documented career is ${knowledge.experienceSpan.years} years, from ${knowledge.experienceSpan.first} to ${knowledge.experienceSpan.last}.`,
    );
  }

  return parts.join(' ');
}

/** The strongest reading's record, or null when nothing is documented. */
function readingSubject(readings: readonly TermReading[]): string | undefined {
  const documented = readings.find((reading) => reading.classification.state !== 'unverified');
  return documented?.record.name;
}

function readingCards(readings: readonly TermReading[]): EntityRef[] {
  const cards: EntityRef[] = [];
  const seen = new Set<string>();
  for (const reading of readings) {
    const key = reading.record.key;
    if (seen.has(key)) continue;
    seen.add(key);
    const { name, kind, id, href } = reading.record;
    cards.push({ key, kind, id, name, href });
  }
  return cards;
}

/**
 * The ambiguous-terms answer, or null when this question is not actually all-ambiguous.
 */
export function readingsAnswerFor(
  terms: readonly NormalisedTerm[],
  knowledge: PortfolioKnowledge,
): { text: string; cards: EntityRef[]; subject: string | undefined; empty: boolean } | null {
  const ambiguous = terms.filter(
    (term) => term.ambiguous || term.canonicalIds.length > 1 || term.familyMembers.length > 0,
  );
  if (ambiguous.length === 0 || ambiguous.length !== terms.length) return null;

  const sections: { term: NormalisedTerm; readings: readonly TermReading[] }[] = [];
  for (const term of ambiguous) {
    const readings = scoreReadings(term, knowledge);
    if (readings.length === 0) continue;
    sections.push({ term, readings });
  }
  if (sections.length === 0) return null;

  const cards = readingCards(sections.flatMap((section) => section.readings));

  return {
    text: composeReadingsAnswer(sections, knowledge),
    cards,
    subject: readingSubject(sections.flatMap((section) => section.readings)),
    empty: sections.every((section) =>
      section.readings.every((reading) => reading.classification.state === 'unverified'),
    ),
  };
}
