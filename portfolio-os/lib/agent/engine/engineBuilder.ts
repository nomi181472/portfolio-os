/**
 * lib/agent/engine/engineBuilder.ts
 *
 * Engine factory and answer orchestration:
 * - buildEngine: Full portfolio engine construction
 * - buildEngineFromKnowledge: Client-compatible knowledge payload builder
 * - Execution lifecycle: normalization, intent routing, premise detection, retrieval,
 *   model reordering & actions integration, scoring, and response formatting.
 */

import { buildAliasTable } from '../aliases';
import {
  normalisePosting,
  normaliseQuestion,
} from '../normalize';
import {
  looksLikeJobDescription,
  routeIntent,
  splitPosting,
} from '../intent';
import { detectPremise } from '../premise';
import { subjectFromUnresolved } from '../relevance';
import {
  buildLexicalIndex,
  retrieve,
  type Embedder,
} from '../retrieve';
import {
  checkActions,
  navigationRegistryFromTargets,
  resolveAction,
  type CheckedAction,
  type ResolvedAction,
} from '../navigation';
import { scoreMatch } from '../scoring';
import { buildKnowledge } from '../knowledge';
import type { EntityRef, PortfolioKnowledge } from '../types';
import { buildGraph } from '@/lib/graph';

import type {
  AgentAnswer,
  BuildEngineOptions,
  CardPlan,
  ConversationLayer,
  ConversationTurn,
  Engine,
  EngineFromKnowledgeOptions,
} from './types';
import { normaliseHref, planAction } from './planning';
import { composeAnswer, joinList, readingsAnswerFor } from './composer';
import {
  availabilityAnswer,
  cardsFor,
  navigationFor,
  noTermsAnswer,
  orientationAnswer,
  premiseAnswer,
  relevanceAnswer,
} from './specialAnswers';

export function buildEngine(options: BuildEngineOptions): Engine {
  const graph = options.graph ?? buildGraph(options.portfolio);
  const knowledge = buildKnowledge(options.portfolio, graph, { now: options.now });
  return buildEngineFromKnowledge(knowledge, {
    navigation: navigationRegistryFromTargets(knowledge.navigation),
    embedder: options.embedder ?? null,
  });
}

/**
 * The entry point the client uses.
 *
 * `buildEngine` needs a `Portfolio`, which only exists on the server: the browser
 * receives the derived knowledge payload.
 */
export function buildEngineFromKnowledge(
  knowledge: PortfolioKnowledge,
  options: EngineFromKnowledgeOptions,
): Engine {
  const aliases = buildAliasTable(knowledge);
  const lexical = buildLexicalIndex(knowledge.records);
  const navigation = options.navigation;

  const hasEntity = (key: string): boolean => knowledge.byKey.has(key);
  const hrefForKey = (key: string): string | undefined => knowledge.byKey.get(key)?.href;

  const plan = (answer: AgentAnswer, here: string): CardPlan[] => {
    const proposed = new Map((answer.actions ?? []).map((action) => [action.targetId, action]));
    const hereRecord = answer.cards.find((card) => normaliseHref(card.href) === normaliseHref(here));

    const plans: CardPlan[] = [];
    for (const card of answer.cards) {
      const modelAction = proposed.get(card.key);
      const action: ResolvedAction =
        modelAction === undefined
          ? resolveAction({ kind: 'navigate', targetId: card.key }, navigation, hasEntity, hrefForKey)
          : {
              ok: true,
              kind: modelAction.kind,
              href: modelAction.href,
              label: modelAction.label,
              targetId: modelAction.targetId,
            };

      plans.push({
        key: card.key,
        href: card.href,
        label: card.name,
        action: planAction(action, { here, entityHref: hereRecord?.href ?? null }),
      });
    }
    return plans;
  };

  const history: ConversationTurn[] = [];

  const remember = (question: string, text: string, cards: readonly EntityRef[] = []): void => {
    if (text.trim().length === 0) return;
    if (history.length >= 6) history.shift();
    history.push({ question, answer: text, keys: cards.slice(0, 3).map((card) => card.key) });
  };

  async function answer(
    question: string,
    answerOptions: { embedder?: Embedder | null; conversation?: ConversationLayer | null } = {},
  ): Promise<AgentAnswer> {
    const trimmed = question.trim();
    const normalised = normaliseQuestion(trimmed, aliases);
    let routing = routeIntent(normalised);
    const caveats: string[] = [];
    const conversation = answerOptions.conversation ?? null;

    const posting = looksLikeJobDescription(trimmed) ? splitPosting(trimmed) : null;
    if (posting) {
      routing = { ...routing, intent: 'job-match', uncertain: false, confidence: 1 };
    }
    const terms = posting
      ? normalisePosting(posting.requirements, posting.preferred, aliases)
      : normalised.terms;

    if (normalised.ambiguousTerms.length > 0) {
      caveats.push(
        `Left out of the score because each could mean several things here: ${joinList(normalised.ambiguousTerms)}.`,
      );
    }

    if (routing.intent === 'availability') {
      const answerResult = availabilityAnswer(trimmed, knowledge, normalised, routing, navigation);
      let text = answerResult.text;
      if (conversation) {
        try {
          const availFacts = {
            profile: {
              name: knowledge.profile.name,
              discipline: knowledge.profile.discipline,
              focus: knowledge.profile.focus,
            },
            availabilityStatement: knowledge.availability.statement ?? 'No availability statement is published.',
            experienceSpan: {
              years: knowledge.experienceSpan.years,
              first: knowledge.experienceSpan.first,
              last: knowledge.experienceSpan.last,
              roleCount: knowledge.experienceSpan.roles.length,
              roleNames: knowledge.experienceSpan.roles.map((r) => r.name).join(', '),
            },
            records: answerResult.cards.map((c) => ({
              key: c.key,
              name: c.name,
              kind: c.kind,
              summary: knowledge.byKey.get(c.key)?.summary,
            })),
          };
          const selection = await conversation.select(trimmed, availFacts.records, history, availFacts);
          if (selection.text && selection.text.trim().length > 0) {
            text = selection.text.trim();
          }
        } catch {
          // Fall back gracefully to deterministic answer
        }
      }
      remember(trimmed, text, answerResult.cards);
      return { ...answerResult, text };
    }

    const premise = detectPremise(trimmed);
    if (premise) {
      const answerResult = premiseAnswer(trimmed, knowledge, normalised, routing, navigation, premise, aliases);
      remember(trimmed, answerResult.text, answerResult.cards);
      return answerResult;
    }

    if (terms.length === 0 || routing.intent === 'general') {
      const { subject, allNoise } = subjectFromUnresolved(normalised.unresolvedTerms, knowledge);
      if (subject) {
        const answerResult = relevanceAnswer(trimmed, knowledge, normalised, routing, navigation, subject, caveats);
        let text = answerResult.text;
        if (conversation) {
          try {
            const relFacts = {
              profile: {
                name: knowledge.profile.name,
                discipline: knowledge.profile.discipline,
                focus: knowledge.profile.focus,
              },
              records: answerResult.cards.map((c) => ({
                key: c.key,
                name: c.name,
                kind: c.kind,
                summary: knowledge.byKey.get(c.key)?.summary,
              })),
            };
            const selection = await conversation.select(trimmed, relFacts.records, history, relFacts);
            if (selection.text && selection.text.trim().length > 0) {
              text = selection.text.trim();
            }
          } catch {}
        }
        remember(trimmed, text, answerResult.cards);
        return { ...answerResult, text };
      }

      if (allNoise) {
        const answerResult = orientationAnswer(trimmed, knowledge, normalised, routing, navigation, caveats);
        let text = answerResult.text;
        if (conversation) {
          try {
            const oriFacts = {
              profile: {
                name: knowledge.profile.name,
                discipline: knowledge.profile.discipline,
                focus: knowledge.profile.focus,
              },
              availabilityStatement: knowledge.availability.statement ?? 'No availability statement is published.',
              experienceSpan: {
                years: knowledge.experienceSpan.years,
                first: knowledge.experienceSpan.first,
                last: knowledge.experienceSpan.last,
                roleCount: knowledge.experienceSpan.roles.length,
                roleNames: knowledge.experienceSpan.roles.map((r) => r.name).join(', '),
              },
              records: answerResult.cards.map((c) => ({
                key: c.key,
                name: c.name,
                kind: c.kind,
                summary: knowledge.byKey.get(c.key)?.summary,
              })),
            };
            const selection = await conversation.select(trimmed, oriFacts.records, history, oriFacts);
            if (selection.text && selection.text.trim().length > 0) {
              text = selection.text.trim();
            }
          } catch {}
        }
        remember(trimmed, text, answerResult.cards);
        return { ...answerResult, text };
      }

      let text = noTermsAnswer(normalised);
      if (conversation) {
        try {
          const facts = {
            profile: {
              name: knowledge.profile.name,
              discipline: knowledge.profile.discipline,
              focus: knowledge.profile.focus,
              email: knowledge.profile.email,
              links: knowledge.profile.links,
            },
          };
          const selection = await conversation.select(trimmed, [], history, facts);
          if (selection.text && selection.text.trim().length > 0) {
            text = selection.text.trim();
          }
        } catch {}
      }

      remember(trimmed, text, []);
      return {
        question: trimmed,
        intent: routing.intent,
        routing,
        normalised,
        text,
        cards: [],
        navigation: [],
        empty: true,
        caveats,
      };
    }

    let relevant = await retrieve(trimmed, knowledge, lexical, {
      embedder: answerOptions.embedder ?? options.embedder ?? null,
      ...(routing.intent === 'skill-check' ? { limit: 10 } : {}),
    });

    const match = scoreMatch({ terms, knowledge });
    if (match.unverifiable.length > 0) {
      const candidateName = knowledge.profile.name || 'the candidate';
      caveats.push(
        `Not documented on this site, so not scored: ${match.unverifiable.join(', ')}. That is a statement about the portfolio, not about ${candidateName}.`,
      );
    }
    if (match.documentedOnlyScore > match.score) {
      caveats.push(
        `Of what the portfolio does document, the fit is ${match.documentedOnlyScore}%. The headline ${match.score}% also counts the undocumented requirements.`,
      );
    }

    const scoredTerms = match.requirements.filter((t) => !t.ambiguous);

    let modelActions: readonly CheckedAction[] | undefined;
    let modelText: string | undefined;
    if (conversation) {
      const candidateRecords = relevant.map((hit) => {
        const matchingTerm = scoredTerms.find(
          (t) => (t.best && t.best.key === hit.key) || t.familyMembers.includes(hit.key),
        );
        const evidenceState = matchingTerm
          ? matchingTerm.state
          : hit.record.evidence.length > 0
            ? 'corroborated'
            : 'documented';
        const receiptNames = hit.record.evidence.map((e) => e.name);
        return {
          key: hit.key,
          name: hit.record.name,
          summary: hit.record.summary,
          kind: hit.record.kind,
          evidenceState,
          receiptNames,
        };
      });

      const facts = {
        profile: {
          name: knowledge.profile.name,
          discipline: knowledge.profile.discipline,
          focus: knowledge.profile.focus,
        },
        availabilityStatement: knowledge.availability.statement ?? 'No availability statement is published.',
        experienceSpan: {
          years: knowledge.experienceSpan.years,
          first: knowledge.experienceSpan.first,
          last: knowledge.experienceSpan.last,
          roleCount: knowledge.experienceSpan.roles.length,
          roleNames: knowledge.experienceSpan.roles.map((r) => r.name).join(', '),
        },
        records: candidateRecords,
        ...(posting
          ? {
              matchResult: {
                score: match.score,
                documentedOnlyScore: match.documentedOnlyScore,
                strong: scoredTerms.filter((t) => t.state === 'strong').map((t) => t.term),
                partial: scoredTerms.filter((t) => t.state === 'partial').map((t) => t.term),
                uncorroborated: scoredTerms.filter((t) => t.state === 'documented-uncorroborated').map((t) => t.term),
                missing: match.unverifiable,
              },
            }
          : {}),
      };

      const selection = await conversation.select(trimmed, candidateRecords, history, facts);

      if (selection.text && selection.text.trim().length > 0) {
        modelText = selection.text.trim();
      }

      if (selection.proposals && selection.proposals.length > 0) {
        const retrieved = new Set(relevant.map((hit) => hit.key));
        const inScope = selection.proposals.filter((proposal) => retrieved.has(proposal.targetId.trim()));

        const checked = checkActions(inScope, navigation, hasEntity, hrefForKey);
        if (checked.length > 0) modelActions = checked;
      }

      if (selection.dropped && selection.dropped.length > 0) {
        caveats.push(
          `The model suggested ${selection.dropped.length === 1 ? 'a record' : `${selection.dropped.length} records`} that retrieval had not returned; ${selection.dropped.length === 1 ? 'it was' : 'they were'} left out.`,
        );
      }

      if (selection.keys.length > 0) {
        const chosen = new Set(selection.keys);
        relevant = [
          ...relevant.filter((hit) => chosen.has(hit.key)),
          ...relevant.filter((hit) => !chosen.has(hit.key)),
        ];
      }
    }

    if (scoredTerms.length === 0) {
      const readingsAnswer = readingsAnswerFor(normalised.terms, knowledge);
      if (readingsAnswer) {
        const cards = readingsAnswer.cards;
        const nav = navigationFor(cards, navigation, knowledge);
        const text = modelText ?? readingsAnswer.text;
        remember(trimmed, text, cards);
        return {
          question: trimmed,
          intent: routing.intent,
          routing,
          normalised,
          text,
          cards,
          navigation: nav,
          subject: readingsAnswer.subject,
          empty: readingsAnswer.empty,
          caveats,
        };
      }
    }

    const cards = cardsFor(scoredTerms, relevant);
    const nav = navigationFor(cards, navigation, knowledge);

    const text = modelText ?? composeAnswer(scoredTerms, match, cards, knowledge);
    remember(trimmed, text, cards);

    return {
      question: trimmed,
      intent: routing.intent,
      routing,
      normalised: posting ? normaliseQuestion(trimmed, aliases) : normalised,
      text,
      cards,
      navigation: nav,
      match,
      subject: scoredTerms.map((t) => t.best?.name).filter(Boolean).join(', ') || undefined,
      empty: scoredTerms.every((t) => t.state === 'unverified'),
      caveats,
      ...(modelActions === undefined ? {} : { actions: modelActions }),
    };
  }

  return {
    knowledge,
    aliases,
    lexical,
    navigation,
    history,
    clearHistory: () => {
      history.length = 0;
    },
    plan,
    answer,
  };
}
