/**
 * lib/agent/engine/types.ts
 *
 * Core types and interfaces for the portfolio agent engine:
 * - ConversationLayer & ConversationTurn
 * - Engine & EngineFromKnowledgeOptions & BuildEngineOptions
 * - AgentAnswer & CardPlan
 * - ActionPlan
 */

import type { AliasTable } from '../aliases';
import type { NormalisedQuestion } from '../normalize';
import type { Intent, IntentRoute } from '../intent';
import type { Embedder, LexicalIndex } from '../retrieve';
import type {
  CheckedAction,
  NavigationRegistry,
  ProposedAction,
} from '../navigation';
import type { MatchResult } from '../scoring';
import type { BuildKnowledgeOptions } from '../knowledge';
import type { EntityRef, NavigationTarget, PortfolioKnowledge } from '../types';
import type { Portfolio } from '@/types/portfolio';
import type { PortfolioGraph } from '@/lib/graph';

/**
 * The optional reordering layer.
 *
 * Declared structurally here rather than imported, so the engine stays free of the
 * model modules and the whole engine remains importable with no runtime. Its authority
 * is one method, and what it returns is a set of keys that is *already* restricted to
 * what retrieval returned — so the strongest thing it can do is change which verified
 * records are shown first. It cannot add a record, a fact, a score or a URL.
 */
export interface ConversationLayer {
  select(
    question: string,
    retrieved: readonly {
      key: string;
      name: string;
      summary?: string;
      kind?: string;
      evidenceState?: string;
      receiptNames?: readonly string[];
    }[],
    history: readonly ConversationTurn[],
    facts?: Record<string, unknown>,
    onToken?: (token: string) => void,
  ): Promise<{
    keys: readonly string[];
    dropped?: readonly { key: string; reason: string }[];
    /**
     * Optional 100% model-generated prose synthesized by Qwen models following the system prompt.
     * When present and non-empty, the engine uses this text directly for the answer,
     * while retaining deterministic fallback when no conversational model is active.
     */
    text?: string;
    /**
     * Actions the model proposed, unresolved.
     *
     * Optional because a caller may supply only ordering — which is all this interface
     * did before actions existed, and what the deterministic tests pass. The engine
     * treats a missing field exactly as it treats an empty one: the cards keep their
     * deterministic navigation.
     */
    proposals?: readonly ProposedAction[];
  }>;
}

/** Re-exported shape, so a caller can build memory without importing the model module. */
export interface ConversationTurn {
  question: string;
  answer: string;
  keys: readonly string[];
}

/**
 * What a card's action does, from where the reader is standing.
 *
 * Attached to each answer rather than resolved at render time, because the decision
 * depends on the reader's current route and the engine does not know it. The widget
 * passes the route in; the engine returns the plan.
 */
export interface CardPlan {
  key: string;
  href: string;
  label: string;
  action: ActionPlan;
}

/**
 * What a resolved action should actually *do*, given the page the reader is on.
 *
 * The result is a list of things to offer, not an instruction to perform. Everything
 * here stays advisory: nothing in this module clicks, scrolls or routes on its own,
 * because an agent that navigates the page behind the reader's back is doing something
 * no allowlist was asked to authorise.
 */
export type ActionPlan =
  | { kind: 'none'; reason: string }
  | { kind: 'anchor'; href: string; label: string; note: string }
  | { kind: 'offer'; hrefs: readonly { href: string; label: string }[]; note: string };

export interface AgentAnswer {
  question: string;
  intent: Intent;
  routing: IntentRoute;
  normalised: NormalisedQuestion;
  /** The reply text. Every sentence in it is composed here, not generated. */
  text: string;
  /** Records the answer stands on. Never contains anything not in the payload. */
  cards: EntityRef[];
  navigation: NavigationTarget[];
  /** Present for job-match and skill-check. */
  match?: MatchResult;
  /** The skills this answer is about, by name. */
  subject?: string;
  /** True when nothing could be verified. Distinct from a negative answer. */
  empty: boolean;
  /** Warnings worth surfacing: ambiguous terms, unverifiable requirements. */
  caveats: string[];
  /**
   * Model-proposed actions, resolved against the navigation registry.
   *
   * Absent or empty whenever no model ran, which is the case for every deterministic
   * test and for a reader who never loaded one. Cards then use their own navigation.
   *
   * Every entry has been through `resolveAction`, so `href` is a real route or `null`
   * for a non-navigating kind — never a string the model wrote.
   */
  actions?: readonly CheckedAction[];
}

export interface Engine {
  knowledge: PortfolioKnowledge;
  aliases: AliasTable;
  lexical: LexicalIndex;
  navigation: NavigationRegistry;
  /**
   * The last `answer()` result's text, and the keys it stood on.
   *
   * Kept on the engine rather than in the widget so that memory cannot be assembled
   * from unvalidated drafts: it is the composed text, recorded by the same code path
   * that displayed it.
   */
  readonly history: ConversationTurn[];
  /**
   * Forget every remembered turn.
   */
  clearHistory(): void;
  /**
   * Decide what each card's action does from the reader's current route.
   */
  plan(answer: AgentAnswer, here: string): CardPlan[];
  answer(
    question: string,
    options?: {
      embedder?: Embedder | null;
      conversation?: ConversationLayer | null;
      onToken?: (token: string) => void;
    },
  ): Promise<AgentAnswer>;
}

export interface BuildEngineOptions extends BuildKnowledgeOptions {
  portfolio: Portfolio;
  graph?: PortfolioGraph;
  embedder?: Embedder | null;
}

export interface EngineFromKnowledgeOptions {
  /**
   * The registry, which is a pure function of `knowledge.navigation`. Passed in
   * rather than derived from a portfolio because the browser has the derived
   * payload and not the content file.
   */
  navigation: NavigationRegistry;
  embedder?: Embedder | null;
}
