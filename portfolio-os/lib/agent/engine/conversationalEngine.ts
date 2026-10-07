/**
 * lib/agent/engine/conversationalEngine.ts
 *
 * Dedicated 100% conversational engine for local LLM models (e.g. Qwen2.5 0.5B Instruct).
 *
 * Distinct from the standard deterministic/retrieval engine (engineBuilder.ts):
 * - Does not intercept user queries with code-level canned templates (premiseAnswer,
 *   availabilityAnswer, relevanceAnswer, orientationAnswer, noTermsAnswer).
 * - 100% of responses are synthesized by the local LLM conversation layer.
 * - Hallucinations, false premises, out-of-scope technologies, and prompt injections
 *   are handled strictly through prompt grounding, truth rules, and facts context rather than code blocks.
 * - Retrieves relevant knowledge records (via embeddings or lexical BM25) and passes
 *   rich ground-truth facts to the LLM.
 * - Maintains multi-turn conversation memory and resolves navigation card actions.
 */

import { buildAliasTable } from '../aliases';
import { normalisePosting, normaliseQuestion } from '../normalize';
import { looksLikeJobDescription, splitPosting } from '../intent';
import { buildLexicalIndex, retrieve, type Embedder } from '../retrieve';
import {
  checkActions,
  navigationRegistryFromTargets,
  resolveAction,
  type CheckedAction,
  type ResolvedAction,
} from '../navigation';
import { scoreMatch } from '../scoring';
import { buildKnowledge } from '../knowledge';
import type { EntityRef, KnowledgeRecord, PortfolioKnowledge } from '../types';
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
import { navigationFor } from './specialAnswers';

/**
 * Build the conversational engine from a raw portfolio (used in server/tests).
 */
export function buildConversationalEngine(options: BuildEngineOptions): Engine {
  const graph = options.graph ?? buildGraph(options.portfolio);
  const knowledge = buildKnowledge(options.portfolio, graph, {
    now: options.now,
  });
  return buildConversationalEngineFromKnowledge(knowledge, {
    navigation: navigationRegistryFromTargets(knowledge.navigation),
    embedder: options.embedder ?? null,
  });
}

/**
 * Build the conversational engine from rehydrated client knowledge.
 */
export function buildConversationalEngineFromKnowledge(
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

  const remember = (question: string, text: string, cards: readonly EntityRef[]): void => {
    while (history.length >= 6) {
      history.shift();
    }
    history.push({
      question,
      answer: text,
      keys: cards.slice(0, 3).map((card) => card.key),
    });
  };

  async function answer(
    question: string,
    answerOptions: { embedder?: Embedder | null; conversation?: ConversationLayer | null } = {},
  ): Promise<AgentAnswer> {
    const trimmed = question.trim();
    const normalised = normaliseQuestion(trimmed, aliases);

    const posting = looksLikeJobDescription(trimmed) ? splitPosting(trimmed) : null;
    const terms = posting
      ? normalisePosting(posting.requirements, posting.preferred, aliases)
      : normalised.terms;
    const match = posting ? scoreMatch({ terms, knowledge }) : undefined;

    // Retrieve verified knowledge records relevant to the user query
    const relevant = await retrieve(trimmed, knowledge, lexical, {
      embedder: answerOptions.embedder ?? options.embedder ?? null,
      limit: 10,
    });

    const candidateRecords = relevant.slice(0, 8).map((hit) => {
      const evidenceState = hit.record.evidence.length > 0 ? 'corroborated' : 'documented';
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

    // Provide verified ground-truth context to the prompt
    const facts = {
      profile: {
        name: knowledge.profile.name,
        discipline: knowledge.profile.discipline,
        focus: knowledge.profile.focus,
        email: knowledge.profile.email,
        links: knowledge.profile.links,
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
      ...(posting && match
        ? {
            matchResult: {
              score: match.score,
              documentedOnlyScore: match.documentedOnlyScore,
              strong: match.requirements.filter((t) => t.state === 'strong').map((t) => t.term),
              partial: match.requirements.filter((t) => t.state === 'partial').map((t) => t.term),
              uncorroborated: match.requirements
                .filter((t) => t.state === 'documented-uncorroborated')
                .map((t) => t.term),
              missing: match.unverifiable,
            },
          }
        : {}),
    };

    let text: string;
    let modelActions: readonly CheckedAction[] | undefined;
    let selectedKeys: readonly string[] = [];

    // 100% Conversational path:
    // Prompt instructions govern hallucination, truth boundaries, and false premise correction.
    if (answerOptions.conversation) {
      try {
        const selection = await answerOptions.conversation.select(
          trimmed,
          candidateRecords,
          history,
          facts,
        );

        if (selection.text && selection.text.trim().length > 0) {
          text = selection.text.trim();
        } else {
          const candidateName = knowledge.profile.name || 'the candidate';
          text = `I am here to answer any questions about ${candidateName}'s software engineering, architecture, and technical experience. What would you like to know?`;
        }

        selectedKeys = selection.keys;
      } catch (err: unknown) {
        const errorDetail = err instanceof Error ? err.message : String(err);
        console.error('ConversationalEngine processing error:', err);
        text = `I encountered an issue processing your question conversationally.\n\nError details: ${errorDetail}`;
      }
    } else {
      const candidateName = knowledge.profile.name || 'the candidate';
      text = `I am ${candidateName}'s conversational assistant. Please load and enable the conversational local model to chat with me.`;
    }

    // Determine displayed evidence cards:
    // Use keys selected by model if present, otherwise top relevant records.
    const chosenKeys = selectedKeys.length > 0
      ? selectedKeys
      : relevant.slice(0, 3).map((r) => r.key);

    const cards: EntityRef[] = chosenKeys
      .map((k) => knowledge.byKey.get(k))
      .filter((rec): rec is KnowledgeRecord => Boolean(rec))
      .map((rec) => ({
        key: rec.key,
        kind: rec.kind,
        id: rec.id,
        name: rec.name,
        href: rec.href,
        summary: rec.summary,
        evidence: rec.evidence,
      }));

    const nav = navigationFor(cards, navigation, knowledge);

    // Save turn to conversational memory
    remember(trimmed, text, cards);

    return {
      question: trimmed,
      intent: posting ? 'job-match' : 'general',
      routing: {
        intent: posting ? 'job-match' : 'general',
        confidence: 1,
        signals: [],
        uncertain: false,
      },
      normalised: posting ? normaliseQuestion(trimmed, aliases) : normalised,
      text,
      cards,
      navigation: nav,
      empty: cards.length === 0,
      caveats: [],
      ...(match ? { match } : {}),
      ...(modelActions !== undefined ? { actions: modelActions } : {}),
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
