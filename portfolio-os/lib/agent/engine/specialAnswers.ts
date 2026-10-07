/**
 * lib/agent/engine/specialAnswers.ts
 *
 * Dedicated answer generators for distinct conversational intents:
 * - premiseAnswer: Handling instructions to assume/repeat or ungrounded targets
 * - availabilityAnswer: Direct responses about availability statement and career span
 * - relevanceAnswer: Adjacency explanations when a queried technology/skill is absent
 * - orientationAnswer: Broad introductory profile replies ("Who is Noman?")
 * - noTermsAnswer: Clear absence notices when no valid search terms are identified
 * - cardsFor & navigationFor: Destination/evidence cards and navigation targets
 */

import type { AliasTable } from '../aliases';
import { normaliseQuestion, type NormalisedQuestion } from '../normalize';
import type { IntentRoute } from '../intent';
import type { Premise } from '../premise';
import { relevanceForSubject } from '../relevance';
import { resolveAction, type NavigationRegistry } from '../navigation';
import type { RequirementScore } from '../scoring';
import type { ScoredRecord } from '../retrieve';
import type { EntityRef, NavigationTarget, PortfolioKnowledge } from '../types';
import type { AgentAnswer } from './types';
import { joinList, plural } from './composer';

const BACKING_KINDS: ReadonlySet<string> = new Set(['projects', 'products', 'experience']);

/**
 * The reply when the reader hands over a fact and asks the agent to repeat it.
 */
export function premiseAnswer(
  question: string,
  knowledge: PortfolioKnowledge,
  normalised: NormalisedQuestion,
  routing: IntentRoute,
  navigation: NavigationRegistry,
  premise: Premise,
  aliases: AliasTable,
): AgentAnswer {
  const lines: string[] = [];
  const caveats: string[] = [];
  let cards: EntityRef[] = [];

  if (premise.kind === 'injected-fact') {
    lines.push(
      premise.claim
        ? `I won't repeat the ${premise.claim} figure — I only state what a record here supports, and being asked to say it is not a reason to.`
        : "I won't take instructions to state something the portfolio does not record. I answer from the records on this site, not from the request.",
    );
    const span = knowledge.experienceSpan;
    if (span.months > 0) {
      lines.push(
        `What is documented: ${span.years} years across ${plural(span.roles.length, 'role', 'roles')} between ${span.first} and ${span.last}.`,
      );
      cards = span.roles.map((role) => ({
        key: role.key,
        kind: 'experience' as const,
        id: role.key.slice('experience:'.length),
        name: role.name,
        href: role.href,
      }));
    } else {
      lines.push('No dated experience is recorded here, so there is no documented career length to give.');
    }
    caveats.push('The figure was declined because it has no supporting record, not because it was judged wrong.');
  }

  if (premise.kind === 'asserted-fact') {
    lines.push('An assumption is not something I can treat as a finding, so I have not adopted it.');

    const subject = premise.subject ?? premise.claim;
    if (subject) {
      const asked = normaliseQuestion(subject, aliases);
      const resolved = asked.terms.filter((term) => term.matchKind === 'exact' || term.matchKind === 'family');
      const records = resolved
        .map((term) => term.canonicalIds[0])
        .filter((id): id is string => id !== undefined)
        .map((id) => knowledge.byKey.get(id))
        .filter((record): record is NonNullable<typeof record> => record !== undefined);

      const candidateName = knowledge.profile.name || 'the candidate';
      lines.push(
        records.length === 0
          ? `On ${subject} itself: the portfolio does not document it. That is a statement about this site, not a claim that ${candidateName} cannot do it.`
          : `On ${subject} itself, the portfolio does document it: ${joinList(records.map((record) => record.name))}.`,
      );
      cards = records
        .filter((record) => record.kind !== 'skills' || records.length === 1)
        .slice(0, 4)
        .map((record) => ({ key: record.key, kind: record.kind, id: record.id, name: record.name, href: record.href }));
    }
  }

  if (premise.kind === 'absent-target') {
    const named = premise.subject;
    lines.push(
      named
        ? `There is no ${named} project, product or role documented on this site, so there is no link to give. Not having one here is not a claim it does not exist.`
        : 'Nothing of that name is documented on this site, so there is no link to give.',
    );

    const records = [
      ...(knowledge.byKind.get('projects') ?? []),
      ...(knowledge.byKind.get('products') ?? []),
    ];
    const offered = records.slice(0, 4);
    if (offered.length > 0) {
      lines.push(`What is here instead: ${joinList(offered.map((record) => record.name))}.`);
      cards = offered.map((record) => ({
        key: record.key,
        kind: record.kind,
        id: record.id,
        name: record.name,
        href: record.href,
      }));
    }
  }

  return {
    question,
    intent: routing.intent,
    routing,
    normalised,
    text: lines.join(' '),
    cards,
    navigation: navigationFor(cards, navigation, knowledge),
    empty: false,
    caveats,
  };
}

export function availabilityAnswer(
  question: string,
  knowledge: PortfolioKnowledge,
  normalised: NormalisedQuestion,
  routing: IntentRoute,
  navigation: NavigationRegistry,
): AgentAnswer {
  const statement = knowledge.availability.statement;
  const span = knowledge.experienceSpan;

  const lines: string[] = [];
  if (statement) {
    lines.push(statement);
  } else {
    lines.push('The portfolio does not state an availability status, so there is nothing here to report on that.');
  }
  if (span.months > 0) {
    lines.push(
      `What is documented: ${span.years} years across ${plural(span.roles.length, 'role', 'roles')} between ${span.first} and ${span.last}.`,
    );
  }

  const cards = span.roles.map((role) => ({
    key: role.key,
    kind: 'experience' as const,
    id: role.key.slice('experience:'.length),
    name: role.name,
    href: role.href,
  }));

  return {
    question,
    intent: 'availability',
    routing,
    normalised,
    text: lines.join(' '),
    cards,
    navigation: navigationFor(cards, navigation, knowledge),
    empty: statement === null && span.months === 0,
    caveats: statement === null ? ['Availability is `closed` in the content file, which is not the same as unavailable.'] : [],
  };
}

export function relevanceAnswer(
  question: string,
  knowledge: PortfolioKnowledge,
  normalised: NormalisedQuestion,
  routing: IntentRoute,
  navigation: NavigationRegistry,
  subject: string,
  caveats: string[],
): AgentAnswer {
  const { records } = relevanceForSubject(subject, knowledge);

  const gap = `Nothing on this site documents ${subject}.`;
  const cards: EntityRef[] = [];

  if (records.length === 0) {
    return {
      question,
      intent: routing.intent,
      routing,
      normalised,
      text: `${gap} Nothing documented here is adjacent to it either, so I have nothing further to add rather than something merely nearby.`,
      cards: [],
      navigation: [],
      empty: true,
      caveats,
    };
  }

  const named = records.map(
    (item) => `${item.record.name} (${item.via === 'tag' ? `tagged "${item.bridge}"` : `used alongside it in ${item.bridge}`})`,
  );

  const text =
    `${gap} What is documented is adjacent to it, which is not the same as ` +
    `${subject} itself: ${joinList(named)}.`;

  caveats.push(
    `Adjacency only. Nothing below is evidence of ${subject} experience, and nothing below is scored.`,
  );

  for (const item of records) {
    cards.push({
      key: item.record.key,
      kind: item.record.kind,
      id: item.record.id,
      name: item.record.name,
      href: item.record.href,
    });
    for (const receipt of item.record.evidence.filter((edge) => BACKING_KINDS.has(edge.kind)).slice(0, 2)) {
      cards.push(receipt);
    }
  }

  return {
    question,
    intent: routing.intent,
    routing,
    normalised,
    text,
    cards: cards.slice(0, 8),
    navigation: navigationFor(cards.slice(0, 8), navigation, knowledge),
    empty: true,
    caveats,
  };
}

export function orientationAnswer(
  question: string,
  knowledge: PortfolioKnowledge,
  normalised: NormalisedQuestion,
  routing: IntentRoute,
  navigation: NavigationRegistry,
  caveats: string[],
): AgentAnswer {
  const profile = knowledge.profile;
  const span = knowledge.experienceSpan;

  const lines: string[] = [];
  const identity = [profile.name, profile.discipline].filter(Boolean).join(', ');
  if (identity) lines.push(`${identity}.`);
  if (profile.focus) lines.push(profile.focus);
  if (span.months > 0) {
    lines.push(
      `That is ${span.years} years across ${plural(span.roles.length, 'role', 'roles')} between ${span.first} and ${span.last}, and I can only report the span the content documents.`,
    );
  }
  if (knowledge.availability.statement) {
    lines.push(knowledge.availability.statement);
  }

  const cards: EntityRef[] = span.roles.map((role) => ({
    key: role.key,
    kind: 'experience' as const,
    id: role.key.slice('experience:'.length),
    name: role.name,
    href: role.href,
  }));

  return {
    question,
    intent: routing.intent,
    routing,
    normalised,
    text: lines.join(' '),
    cards,
    navigation: navigationFor(cards, navigation, knowledge),
    empty: cards.length === 0 && lines.length === 0,
    caveats: knowledge.availability.statement
      ? []
      : ['The portfolio does not state an availability status, so none is claimed here.'],
  };
}

export function noTermsAnswer(normalised: NormalisedQuestion): string {
  if (normalised.unresolvedTerms.length === 0) {
    return 'I could not tell what to look up. Name a technology, a project, or paste a job description.';
  }
  return `Nothing on this site covers ${normalised.unresolvedTerms.join(', ')}. I would rather say that than guess which record you meant.`;
}

export function cardsFor(terms: readonly RequirementScore[], relevant: readonly ScoredRecord[]): EntityRef[] {
  const seen = new Set<string>();
  const cards: EntityRef[] = [];

  for (const requirement of terms) {
    for (const receipt of requirement.classification.receipts) {
      if (seen.has(receipt.key)) continue;
      seen.add(receipt.key);
      cards.push(receipt);
    }
  }

  for (const hit of relevant) {
    if (cards.length >= 8) break;
    if (seen.has(hit.key)) continue;
    seen.add(hit.key);
    cards.push({ key: hit.key, kind: hit.record.kind, id: hit.record.id, name: hit.record.name, href: hit.record.href });
  }

  return cards.slice(0, 8);
}

export function navigationFor(
  cards: readonly EntityRef[],
  navigation: NavigationRegistry,
  knowledge: PortfolioKnowledge,
): NavigationTarget[] {
  const byKey = new Map(knowledge.records.map((record) => [record.key, record]));
  const hasEntity = (key: string): boolean => byKey.has(key);
  const hrefForKey = (key: string): string | undefined => byKey.get(key)?.href;

  const out: NavigationTarget[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.key)) continue;
    seen.add(card.key);

    const direct = navigation.byId.get(card.key);
    if (direct) {
      out.push(direct);
      continue;
    }

    const resolved = resolveAction(
      { kind: 'navigate', targetId: card.key, label: card.name },
      navigation,
      hasEntity,
      hrefForKey,
    );
    if (resolved.ok && resolved.href) {
      out.push({
        id: card.key,
        label: resolved.label,
        href: resolved.href,
        kind: 'entity',
        entityKind: card.kind,
      });
    }
  }
  return out;
}
