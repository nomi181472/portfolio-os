/**
 * lib/agent/engine.ts
 *
 * The zero-LLM answer path, end to end.
 *
 * `answer()` takes a question and returns a complete, evidence-bound reply with
 * cards and navigation. No model, no network, no weights. It runs identically on
 * a server, in a worker, and in a browser tab that has never downloaded anything,
 * which is what makes the whole product testable and what makes it safe to
 * improve the model layer later without changing a single answer it produces.
 *
 * The division of labour with a model, when one is present, is deliberate and
 * narrow: the model may rewrite the phrasing. It may not add a fact, a number, a
 * skill or a link. Every entity id in the result comes from `knowledge.byKey`,
 * and the composer is handed the set of ids the engine decided are relevant —
 * a model asked to mention anything outside it has no way to.
 */

import { buildAliasTable, type AliasTable } from './aliases';
import {
  normalisePosting,
  normaliseQuestion,
  type NormalisedQuestion,
  type NormalisedTerm,
} from './normalize';
import { looksLikeJobDescription, routeIntent, splitPosting, type Intent, type IntentRoute } from './intent';
import { detectPremise, type Premise } from './premise';
import { relevanceForSubject, subjectFromUnresolved } from './relevance';
import { buildLexicalIndex, retrieve, type Embedder, type LexicalIndex, type ScoredRecord } from './retrieve';
import {
  buildNavigationRegistry,
  checkActions,
  navigationRegistryFromTargets,
  resolveAction,
  type CheckedAction,
  type NavigationRegistry,
  type ProposedAction,
  type ResolvedAction,
} from './navigation';
import {
  scoreMatch,
  scoreReadings,
  type MatchResult,
  type RequirementScore,
  type TermReading,
} from './scoring';
import { buildKnowledge, type BuildKnowledgeOptions } from './knowledge';
import type { EntityRef, NavigationTarget, PortfolioKnowledge } from './types';
import type { Portfolio } from '@/types/portfolio';
import { buildGraph, type PortfolioGraph } from '@/lib/graph';

/**
 * The optional reordering layer.
 *
 * Declared structurally here rather than imported, so `engine.ts` stays free of the
 * model modules and the whole engine remains importable with no runtime. Its authority
 * is one method, and what it returns is a set of keys that is *already* restricted to
 * what retrieval returned — so the strongest thing it can do is change which verified
 * records are shown first. It cannot add a record, a fact, a score or a URL.
 */
export interface ConversationLayer {
  select(
    question: string,
    retrieved: readonly { key: string; name: string }[],
    history: readonly ConversationTurn[],
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

export interface Engine {
  knowledge: PortfolioKnowledge;
  aliases: AliasTable;
  lexical: LexicalIndex;
  navigation: ReturnType<typeof buildNavigationRegistry>;
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
   *
   * Separate from disposal because closing the panel is not the same as unloading the
   * models: a reader who closes and reopens the widget should not have to re-ask what
   * they already asked, but they must be able to end the session and start clean.
   * Without this the only way to clear memory was a page reload, so "clearable" memory
   * was true only in the sense that nothing could be cleared.
   */
  clearHistory(): void;
  /**
   * Decide what each card's action does from the reader's current route.
   *
   * Takes `here` rather than reading it, so the engine stays DOM-free and the same
   * function is testable from Node. Returns a plan, never performs one: there is no
   * `router.push` or `scrollIntoView` anywhere in `lib/agent/`.
   */
  plan(answer: AgentAnswer, here: string): CardPlan[];
  answer(
    question: string,
    options?: {
      embedder?: Embedder | null;
      conversation?: ConversationLayer | null;
    },
  ): Promise<AgentAnswer>;
}

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

export interface BuildEngineOptions extends BuildKnowledgeOptions {
  portfolio: Portfolio;
  graph?: PortfolioGraph;
  embedder?: Embedder | null;
}

export function buildEngine(options: BuildEngineOptions): Engine {
  const graph = options.graph ?? buildGraph(options.portfolio);
  const knowledge = buildKnowledge(options.portfolio, graph, { now: options.now });
  return buildEngineFromKnowledge(knowledge, {
    navigation: navigationRegistryFromTargets(knowledge.navigation),
    embedder: options.embedder ?? null,
  });
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

/**
 * The entry point the client uses.
 *
 * `buildEngine` needs a `Portfolio`, which only exists on the server: the browser
 * receives the derived knowledge payload. Without this split there were two
 * options, both wrong — ship the whole content file to every visitor so the
 * client could rebuild what it already had, or run a second copy of the engine on
 * the server and make the browser a viewer of it. The first doubles the payload
 * for a derivation already performed; the second contradicts `PLAN.md` §5, which
 * ends the data flow at the UI.
 */
export function buildEngineFromKnowledge(
  knowledge: PortfolioKnowledge,
  options: EngineFromKnowledgeOptions,
): Engine {
  const aliases = buildAliasTable(knowledge);
  const lexical = buildLexicalIndex(knowledge.records);
  const navigation = options.navigation;

  /**
   * Plan what each card's action does, given where the reader is.
   *
   * Separate from `answer()` rather than folded into it, because the answer is
   * computed once and the reader may move afterwards: the same answer yields a plain
   * link while the reader is on another page, and an in-page anchor once they arrive.
   * Recomputing is cheap — it is a `resolveAction` and a string compare per card — and
   * caching it in the answer would freeze the wrong plan the moment a card was clicked.
   */
  const hasEntity = (key: string): boolean => knowledge.byKey.has(key);
  const hrefForKey = (key: string): string | undefined => knowledge.byKey.get(key)?.href;

  const plan = (answer: AgentAnswer, here: string): CardPlan[] => {
    // A model's action for a card is used *in preference to* the default navigate, and
    // only for the card it names. A proposal about a record that is not a card on this
    // answer has nothing to attach to, so it is ignored rather than given a card of its
    // own — otherwise a model could pad the panel with records retrieval ranked out.
    const proposed = new Map((answer.actions ?? []).map((action) => [action.targetId, action]));

    /*
     * The record the reader is standing on, if this answer is about it.
     *
     * Derived from `here` rather than taken from a card: `planAction` compares it
     * against the action's target to decide whether a `compare` is "the other record,
     * offered" or "this record, in place". Passing the card's own href would make
     * `from` always equal `target` and the compare branch unreachable — a card that
     * cannot distinguish the two cases cannot answer either correctly.
     */
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

  /**
   * Conversation memory, bounded on entry.
   *
   * Held here rather than in the widget for one reason: what gets remembered must be
   * the composed text, recorded by the same path that displayed it. A widget that
   * remembered "the model's last suggestion" would be feeding unvalidated output back
   * as context, so one bad generation could compound across a conversation.
   *
   * Only non-empty answers are kept, and at most `MAX_HISTORY` of them. Both bounds
   * matter, but memory is the binding one: each retained turn re-enters the prompt
   * carrying its whole retrieved evidence block, and past a handful of turns the
   * prompt is mostly old context.
   */
  const history: ConversationTurn[] = [];

  /**
   * Record one answer in memory. Called from the tail of `answer()` only, once the
   * composed text exists.
   *
   * A turn is kept when it produced prose and has evidence behind it. Turns with no
   * cards are the "not documented on this site" replies: they carry no records, so
   * remembering them would spend the memory bound on a gap rather than on evidence,
   * and the next prompt would gain a paragraph about what is absent.
   */
  const remember = (question: string, text: string, cards: readonly EntityRef[]): void => {
    if (text.trim().length === 0 || cards.length === 0) return;
    if (history.length >= 6) history.shift();
    // Three keys, not eight: the prompt block for a turn is already large, and the
    // first three are the ones the answer led on.
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

    // A pasted posting is sectioned before anything else looks at it, because the
    // sections carry the required/preferred split and throwing that away is how a
    // nice-to-have ends up counted as a requirement.
    const posting = looksLikeJobDescription(trimmed) ? splitPosting(trimmed) : null;

    // Shape beats pattern tally. A posting contains "required", "strong" and
    // "years of experience", so the router can score it as a set of ordinary
    // questions; once the text is known to *be* a posting, that is the answer and
    // re-deciding it from keyword counts only adds ways to be wrong.
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
      const answer = availabilityAnswer(trimmed, knowledge, normalised, routing, navigation);
      remember(trimmed, answer.text, answer.cards);
      return answer;
    }

    // A premise is handled before the router, because the router is asking the
    // wrong question. "Assume he knows Rust" routes as a skill check with
    // nothing resolved, and the honest answer to that is a refusal plus the real
    // one — which is a different shape of reply than any other answer here.
    const premise = detectPremise(trimmed);
    if (premise) {
      const answer = premiseAnswer(trimmed, knowledge, normalised, routing, navigation, premise, aliases);
      remember(trimmed, answer.text, answer.cards);
      return answer;
    }

    if (terms.length === 0 || routing.intent === 'general') {
      // A subject the portfolio does not document is still a question with an
      // answer: the gap, plus the nearest real evidence. Handing back the menu
      // here taught a recruiter that the agent had nothing to say about Rust,
      // which is not what was true.
      const { subject, allNoise } = subjectFromUnresolved(normalised.unresolvedTerms, knowledge);
      if (subject) {
        const answer = relevanceAnswer(trimmed, knowledge, normalised, routing, navigation, subject, caveats);
        remember(trimmed, answer.text, answer.cards);
        return answer;
      }

      // Every unresolved term was framing, or there were none: the reader is
      // orienting rather than asking about anything in particular. Answer from the
      // profile, because "tell me something interesting" is a request for a
      // substantive answer and the previous reply answered it with a list of
      // question types.
      if (allNoise) {
        const answer = orientationAnswer(trimmed, knowledge, normalised, routing, navigation, caveats);
        remember(trimmed, answer.text, answer.cards);
        return answer;
      }

      // A real term with no record. Plainly absent, and deliberately no
      // biography: the reader asked about something specific, so replacing the
      // answer with a profile summary would dodge the question.
      //
      // Deliberately not remembered: this turn carries no cards, and remembering a
      // paragraph about an absent subject would fill the prompt with gaps.
      return {
        question: trimmed,
        intent: routing.intent,
        routing,
        normalised,
        text: noTermsAnswer(normalised),
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

    // The optional model gets one job: say which of the records retrieval already
    // returned matter most for this question, and what the reader should do with them.
    // Its selection is re-validated against `relevant` inside `Conversation.select`, so
    // the strongest thing it can do to the *answer* is move records already deemed
    // relevant to the front — it cannot introduce a record, a score, or a fact.
    //
    // Actions are the second half, and they are the narrow case: a proposal is only
    // usable once `checkActions` has resolved it against the registry. An unresolved
    // proposal is dropped, so a model can neither invent a destination nor downgrade a
    // card's default navigation into something broken.
    //
    // Everything below this point is unchanged in behaviour whether or not a model is
    // present, which is why the deterministic tests assert identical answers either
    // way rather than a variant path.
    const conversation = answerOptions.conversation ?? null;
    let modelActions: readonly CheckedAction[] | undefined;
    let modelText: string | undefined;
    if (conversation) {
      const selection = await conversation.select(
        trimmed,
        relevant.map((hit) => ({ key: hit.key, name: hit.record.name })),
        history,
      );

      if (selection.text && selection.text.trim().length > 0) {
        modelText = selection.text.trim();
      }

      if (selection.proposals && selection.proposals.length > 0) {
        // Scoped to the retrieved set before resolving, for the same reason the key
        // selection is. `checkActions` alone would happily resolve a proposal naming
        // any real record in the portfolio, which is a way for the model to attach an
        // action to a record retrieval decided was not relevant. Filtering first means
        // the proposal obeys the same boundary as the selection.
        const retrieved = new Set(relevant.map((hit) => hit.key));
        const inScope = selection.proposals.filter((proposal) => retrieved.has(proposal.targetId.trim()));

        const checked = checkActions(inScope, navigation, hasEntity, hrefForKey);
        // Only kept if at least one survived, so `answer.actions` stays absent rather
        // than present-and-empty when the model proposed nothing usable. The widget
        // checks the field, not its length, and an empty array would be a second way
        // to say the same thing.
        if (checked.length > 0) modelActions = checked;
      }

      if (selection.dropped && selection.dropped.length > 0) {
        caveats.push(
          `The model suggested ${selection.dropped.length === 1 ? 'a record' : `${selection.dropped.length} records`} that retrieval had not returned; ${selection.dropped.length === 1 ? 'it was' : 'they were'} left out.`,
        );
      }

      if (selection.keys.length > 0) {
        // A stable partition, so the model's ordering wins and the deterministic
        // ranking is preserved within each group. A plain `sort` by membership would
        // scramble the rest, and the rest is where the tie-breaks live.
        const chosen = new Set(selection.keys);
        relevant = [
          ...relevant.filter((hit) => chosen.has(hit.key)),
          ...relevant.filter((hit) => !chosen.has(hit.key)),
        ];
      }
    }

    const match = scoreMatch({ terms, knowledge });
    if (match.unverifiable.length > 0) {
      caveats.push(
        `Not documented on this site, so not scored: ${match.unverifiable.join(', ')}. That is a statement about the portfolio, not about Noman.`,
      );
    }
    if (match.documentedOnlyScore > match.score) {
      caveats.push(
        `Of what the portfolio does document, the fit is ${match.documentedOnlyScore}%. The headline ${match.score}% also counts the undocumented requirements.`,
      );
    }

    // Ambiguous terms are held out of the arithmetic by the scorer, so they must
    // also be held out of the prose. Narrating one as "documented" while the
    // score excludes it is how a reader concludes it counted for something.
    const scoredTerms = match.requirements.filter((t) => !t.ambiguous);

    // A question whose *only* terms are ambiguous lands here with nothing countable,
    // and the composer would answer "there is nothing to score" — while the cards
    // underneath it are real, linked evidence the scorer computed moments earlier.
    // That contradiction is what eleven common recruiter questions were producing.
    //
    // It gets its own answer path rather than a scoring change. One word with four
    // readings has no defensible denominator, so there is no percentage to give; the
    // honest answer enumerates the readings and states each one's true evidence.
    if (scoredTerms.length === 0) {
      const readingsAnswer = readingsAnswerFor(normalised.terms, knowledge);
      if (readingsAnswer) {
        // Cards come from the readings, not from `relevant`. Retrieval ranks records
        // by text similarity and would lead with whatever matched the word; the
        // readings are the records the term actually names, which is the narrower and
        // more truthful set.
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
          // No `match`. There is no score to show, and handing back a `MatchResult`
          // with a zero would invite the UI to render a 0% bar for a question that was
          // never scored.
          subject: readingsAnswer.subject,
          empty: readingsAnswer.empty,
          caveats,
        };
      }
    }

    const cards = cardsFor(scoredTerms, relevant);
    // Named `nav` because `navigation` is the registry closed over by `buildEngine`.
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
    // Same array instance, emptied in place. Assigning a fresh array instead would
    // leave the `history` a caller already captured holding the old turns, which is
    // how a "cleared" history quietly stays populated.
    clearHistory: () => {
      history.length = 0;
    },
    plan,
    answer,
  };
}

/* ------------------------------------------------------------ composition */

/**
 * "1 role" / "2 roles". The count belongs in the phrase.
 *
 * Previously this returned only the word, so every call site dropped the number
 * and the availability answer read "4.9 years across roles between ..." — which
 * states a span and then never says how many roles it spans.
 */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Just the verb, for a subject the sentence has already named.
 *
 * Separate from `plural` because these sites do not want a number: "Docker and Go
 * could mean more than one thing here, so they are left out of the score" already
 * named its subject, and inserting one would read "so 2 they are".
 */
function agreement(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * How a requirement should be named in prose.
 *
 * A posting bullet resolves to a concept long before it reads like one — "Operate
 * PostgreSQL databases" and "Experience with microservices architecture" are both
 * the requirement `SQL PostgreSQL` and `Microservices`. Echoing the bullet back
 * to the reader names a requirement they never asked about.
 */
function nameOf(term: { raw: string; best?: { name: string } | null }): string {
  return term.best?.name ?? term.raw;
}

/** `A`, `A and B`, `A, B and C`. Naive joins read as a bug when they collide. */
function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The reply when the reader hands over a fact and asks the agent to repeat it.
 *
 * Three shapes, and the difference between them is what gets refused:
 *
 * - An instruction to lie gets the shortest possible answer and the real number.
 * - An offered assumption gets a refusal and then a genuine answer about the
 *   thing that was assumed, because "I can't assume that" alone leaves the reader
 *   with nothing they did not already have.
 * - A target that does not exist gets told so by name, and the real records are
 *   offered instead. This is the case where a bare refusal is worst: the reader
 *   asked for a link, and answering with nothing teaches them the tool is broken
 *   rather than that the project is not here.
 *
 * Nothing in this function asserts a fact about the portfolio. Every sentence is
 * either a refusal, or read off `knowledge` by the same helpers as every other
 * answer in this file.
 */
function premiseAnswer(
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
    // Quote the number back rather than paraphrasing it. Echoing the claim is
    // what makes the refusal legible, and it guarantees this reply never has to
    // invent a figure of its own to contrast against.
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

    // The real answer to the real question underneath. Resolving the subject
    // through the same alias table as any other question is what keeps this from
    // becoming a second, weaker answer path.
    const subject = premise.subject ?? premise.claim;
    if (subject) {
      // Resolved through the same alias table as any other question, so this is
      // not a second and weaker answer path. Resolving the id to a record is also
      // stricter than ranking records by relevance: a term either names something
      // real here or it names nothing.
      const asked = normaliseQuestion(subject, aliases);
      const resolved = asked.terms.filter((term) => term.matchKind === 'exact' || term.matchKind === 'family');
      const records = resolved
        .map((term) => term.canonicalIds[0])
        .filter((id): id is string => id !== undefined)
        .map((id) => knowledge.byKey.get(id))
        .filter((record): record is NonNullable<typeof record> => record !== undefined);

      lines.push(
        records.length === 0
          ? `On ${subject} itself: the portfolio does not document it. That is a statement about this site, not a claim that Noman cannot do it.`
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

    // Offer what is real rather than stopping at the refusal. The reader asked to
    // see a thing; the closest honest answer is the things that exist.
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

function availabilityAnswer(
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
    // `closed` is the safe direction. The portfolio does not say Noman is
    // unavailable, and this answer is not allowed to say it either.
    lines.push('The portfolio does not state an availability status, so there is nothing here to report on that.');
  }
  if (span.months > 0) {
    lines.push(
      `What is documented: ${span.years} years across ${plural(span.roles.length, 'role', 'roles')} between ${span.first} and ${span.last}.`,
    );
  }
  // Deliberately no "could not place these" line here. Availability is answered
  // from a fixed statement, so the terms in the question were never the subject
  // — listing them reported "open" as an undocumented technology.

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
    // The roles are the evidence for the span, so they are the natural thing to
    // offer next. Leaving this empty made every availability answer a dead end.
    navigation: navigationFor(cards, navigation, knowledge),
    empty: statement === null && span.months === 0,
    caveats: statement === null ? ['Availability is `closed` in the content file, which is not the same as unavailable.'] : [],
  };
}

/**
 * The reply to a question about something the portfolio does not document.
 *
 * Two sentences, in this order, and the order is the point. The gap comes first
 * because it is the fact being asked about and anything else reads as a dodge.
 * The relevance comes second because it is what makes the answer usable.
 *
 * The wording is deliberately unable to be read as a partial yes. "Adjacent" and
 * "not the same as" are both load-bearing: a recruiter skimming this needs to be
 * unable to leave thinking Rust was used. Every named record gets a card and a
 * link, so a claim in the prose can be checked in one click rather than trusted.
 */
/** Evidence kinds that show work done, as opposed to study or certification. */
const BACKING_KINDS: ReadonlySet<string> = new Set(['projects', 'products', 'experience']);

function relevanceAnswer(
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
    // Adjacency is drawn only from records the content file backs. Inventing a
    // "related" list here would be the exact failure this module exists to
    // prevent, so the honest answer is a short one.
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

  // Carried in `caveats` as well as the prose. The prose is what a reader reads;
  // this is what a reader sees when they scroll back to it, and the two drifting
  // apart is how an answer stops being checkable.
  caveats.push(
    `Adjacency only. Nothing below is evidence of ${subject} experience, and nothing below is scored.`,
  );

  // The record first, then the work that backs it. Only projects, products and
  // roles are offered as backing: a certificate and a degree say what was studied,
  // not what was built, and putting an education card under a relevance answer
  // invited the reader to treat coursework as the evidence for the adjacent field.
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
    // Nothing here verifies the subject, so the answer is empty *for the subject*.
    // The records are relevance, not a match, and there is no `match` to mislead.
    empty: true,
    caveats,
  };
}

/**
 * The reply when a reader is orienting and named nothing.
 *
 * "Who is this?" has no subject and no technology, and the previous answer told
 * them what kinds of question to ask instead of telling them anything. Composed
 * from the profile and the roles behind the career span, so it is the portfolio
 * answering rather than the agent advertising itself.
 */
function orientationAnswer(
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

function noTermsAnswer(normalised: NormalisedQuestion): string {
  if (normalised.unresolvedTerms.length === 0) {
    return 'I could not tell what to look up. Name a technology, a project, or paste a job description.';
  }
  return `Nothing on this site covers ${normalised.unresolvedTerms.join(', ')}. I would rather say that than guess which record you meant.`;
}

function cardsFor(terms: readonly RequirementScore[], relevant: readonly ScoredRecord[]): EntityRef[] {
  const seen = new Set<string>();
  const cards: EntityRef[] = [];

  for (const requirement of terms) {
    for (const receipt of requirement.classification.receipts) {
      if (seen.has(receipt.key)) continue;
      seen.add(receipt.key);
      cards.push(receipt);
    }
  }

  // Backfill from retrieval so an exploratory question still has somewhere to
  // go, but never ahead of a receipt the answer actually leans on.
  for (const hit of relevant) {
    if (cards.length >= 8) break;
    if (seen.has(hit.key)) continue;
    seen.add(hit.key);
    cards.push({ key: hit.key, kind: hit.record.kind, id: hit.record.id, name: hit.record.name, href: hit.record.href });
  }

  return cards.slice(0, 8);
}

/**
 * Turn the cards an answer leans on into destinations the reader can click.
 *
 * `registry.byId` holds pages and category hubs only, so looking entity keys up
 * in it returned nothing and every card was a dead end. Entity destinations are
 * resolved through `resolveAction` instead, which is the same validated path the
 * chat UI will take and which knows the difference between "this record has no
 * page" and "this key is not a record at all".
 */
function navigationFor(
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
  // No cap here. An earlier version truncated to four while cards ran to eight,
  // which silently orphaned half of them: the reader saw a card with nothing to
  // click and no explanation. Cards are already bounded upstream, so bounding
  // navigation again only drops destinations that exist.
  return out;
}

/* ------------------------------------------------------ action execution */

/**
 * What a resolved action should actually *do*, given the page the reader is on.
 *
 * The distinction matters because "navigate" and "compare" mean different things on
 * different pages, and a runner that ignored it would be wrong in one direction or the
 * other:
 *
 * - On the entity's own page there is nothing to do — the reader is already there.
 *   Scrolling to the entity section is correct, and saying so beats a no-op.
 * - On another entity's page, "compare" offers the other entity so the reader can put
 *   the two side by side. It does not navigate on its own, because losing the page they
 *   were reading to compare it with something is not what "compare" means.
 * - "navigate" from anywhere else is a plain link, and that is already covered.
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

/**
 * Decide what to do with a card's action, without doing it.
 *
 * Pure, so the decision is testable without a browser and cannot reach the DOM.
 * `here` is the route the reader is on, compared after stripping the query and hash so
 * `/products/verseye#results` is recognised as being on `/products/verseye`.
 */
export function planAction(
  action: ResolvedAction,
  context: { here: string; entityHref?: string | null },
): ActionPlan {
  if (!action.ok || action.href === null) {
    return { kind: 'none', reason: action.ok ? 'no destination' : action.reason.code };
  }

  const here = normaliseHref(context.here);
  const target = normaliseHref(action.href);

  // Already on the destination. Navigating would reload the page the reader is reading
  // and land them back where they started, so the useful thing is the section, not the
  // route.
  if (here === target) {
    return {
      kind: 'anchor',
      href: `${action.href}#record`,
      label: action.label,
      note: 'You are already on this page — this points at the record itself.',
    };
  }

  // On a *different* record's page, and the action asked to compare. Offer the other
  // record rather than navigating, so the reader keeps what they were reading.
  if (action.kind === 'compare' && context.entityHref) {
    const from = normaliseHref(context.entityHref);
    if (from !== target) {
      return {
        kind: 'offer',
        hrefs: [{ href: from, label: 'Back to this record' }],
        note: 'Opening the other record will replace this page.',
      };
    }
  }

  return { kind: 'anchor', href: action.href, label: action.label, note: '' };
}

/** Route comparison ignores query and hash, so `/x?y=1` and `/x` are the same place. */
function normaliseHref(href: string): string {
  return href.split('#')[0]?.split('?')[0]?.replace(/\/$/, '') ?? href;
}

/* ------------------------------------------------------- ambiguous readings */

/**
 * The reply for a question whose terms are all ambiguous.
 *
 * Eleven common recruiter questions reach this path — "Do you know AWS?", "Docker?",
 * "React?" — and every one of them previously answered "there is nothing to score"
 * over four to eight rendered evidence cards. The cards were real and the score was
 * never computed; the composer simply had no branch for "evidence, but no
 * denominator".
 *
 * So this is deliberately a *different shape* from `composeAnswer`, not a variation
 * of it. Three commitments:
 *
 * - **No percentage.** One term with four readings has no defensible denominator.
 *   Inventing one would mean picking a reading silently, which is the flattering
 *   error this project exists to avoid.
 * - **Every reading is stated with its own evidence**, ordered by strength before
 *   count, so "Docker" leads with Docker Compose rather than with Microservices.
 * - **The hold-out stays intact.** Nothing here re-enters the arithmetic, so
 *   postings are unaffected — `ambiguousTerms` is only consulted when there is
 *   nothing else to report at all.
 */
export function composeReadingsAnswer(
  sections: readonly { term: NormalisedTerm; readings: readonly TermReading[] }[],
  knowledge: PortfolioKnowledge,
): string {
  const parts: string[] = [];

  // Opens with the ambiguity rather than burying it, because the reader's question
  // assumed one meaning and the whole answer is about that assumption being wrong.
  //
  // Named for one term, joined for several: "AWS and Docker could mean more than one
  // thing each" is the honest phrasing, and joining the raw terms without a conjunction
  // would read as a single term spelled oddly.
  parts.push(
    sections.length === 1
      ? `${sections[0]!.term.raw} could mean more than one thing here, so ${agreement(sections[0]!.readings.length, 'it is', 'they are')} reported separately and nothing is scored.`
      : `${sections.map((section) => section.term.raw).join(' and ')} could each mean more than one thing here, so ${agreement(sections.length, 'it is', 'they are')} reported separately and nothing is scored.`,
  );

  // Keyed by record, so a record that is a reading of two terms is stated once. The
  // sentence it produces is the same either way — same record, same evidence — and
  // printing it twice read as two separate findings, which is how one record became
  // apparent corroboration for itself.
  const documented = new Map<string, TermReading>();
  for (const section of sections) {
    // Leading with the absence, when there is one. "JavaScript" resolving only to
    // records that do not name it is the answer; the adjacent records are context for
    // it, not evidence of it.
    // Names the term it came from, because a bare "no record identifies this directly"
    // in a multi-term answer would be a sentence about nothing in particular.
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

  // The career span is a property of the portfolio, not of any one reading, so it is
  // appended once at the end rather than repeated per term.
  for (const reading of documented.values()) {
    const name = reading.record.name;
    const { state, receipts: receiptRefs } = reading.classification;
    const count = receiptRefs.length;
    // With no receipts the count adds nothing and reads badly ("with  records behind
    // it"), so the corroborating clause is dropped entirely and the uncorroborated
    // branch below carries the sentence.
    const behind = count === 0 ? '' : `, with ${plural(count, 'record', 'records')} behind ${count === 1 ? 'it' : 'them'}`;

    if (state === 'strong') {
      parts.push(`${name}: documented${behind}.`);
    } else if (state === 'partial') {
      parts.push(`${name}: related rather than the same thing${behind}.`);
    } else {
      // The honest state for the Kafka case: a record exists, it names nothing the
      // portfolio can point at. Saying "documented" here would be a stronger claim
      // than the data supports.
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
 *
 * Returning null rather than an empty answer matters: the caller falls through to the
 * normal scored path, so this function must not claim a question it cannot answer.
 */
function readingsAnswerFor(
  terms: readonly NormalisedTerm[],
  knowledge: PortfolioKnowledge,
): { text: string; cards: EntityRef[]; subject: string | undefined; empty: boolean } | null {
  const ambiguous = terms.filter(
    (term) => term.ambiguous || term.canonicalIds.length > 1 || term.familyMembers.length > 0,
  );
  // Anything countable alongside the ambiguity is the normal path's business.
  if (ambiguous.length === 0 || ambiguous.length !== terms.length) return null;

  // Every ambiguous term is answered, not just the first.
  //
  // "Do you know AWS and Docker?" is two readings, not one: both terms are ambiguous
  // and both name families of records. Reporting only the first answered half the
  // question and, worse, did it silently — the reply read as though Docker were the
  // only thing asked about, which is the kind of omission that looks like a finding.
  //
  // A term with no readings at all is dropped, because `composeReadingsAnswer` says
  // "nothing here identifies X" and one of those per unresolvable term is noise. It is
  // dropped only when *every* term is dropped, below, since an answer with no readings
  // is not an answer.
  const sections: { term: NormalisedTerm; readings: readonly TermReading[] }[] = [];
  for (const term of ambiguous) {
    const readings = scoreReadings(term, knowledge);
    if (readings.length === 0) continue;
    sections.push({ term, readings });
  }
  if (sections.length === 0) return null;

  // One combined card list rather than one per term. The same record can be a reading
  // of two terms — Kubernetes is a plausible reading of both "Docker" and "AWS" — and
  // rendering it twice would look like two separate pieces of evidence.
  const cards = readingCards(sections.flatMap((section) => section.readings));

  return {
    text: composeReadingsAnswer(sections, knowledge),
    cards,
    // The first documented reading across all terms, so the subject line names
    // something real rather than whichever term happened to sort first.
    subject: readingSubject(sections.flatMap((section) => section.readings)),
    empty: sections.every((section) =>
      section.readings.every((reading) => reading.classification.state === 'unverified'),
    ),
  };
}

/**
 * Writes the reply.
 *
 * Every sentence is assembled from a state, a name and a count. There is no free
 * text here and no interpolation of anything the reader typed, so the output
 * cannot contain a claim that is not in the payload. This is the reason the
 * product works before the model does.
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
    parts.push(
      `${missing.map((t) => t.raw).join(', ')} ${agreement(missing.length, 'is', 'are')} not documented on this site. That is a gap in the portfolio, not a finding about Noman.`,
    );
  }

  // Split the required gap, because "not met" was doing two different jobs: a
  // requirement that is undocumented and a requirement that is documented but
  // uncorroborated are very different answers, and merging them hides which
  // one the reader is looking at.
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
