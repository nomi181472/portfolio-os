/**
 * lib/agent/types.ts
 *
 * The vocabulary shared by every module in lib/agent.
 *
 * One rule shapes all of it: nothing in these types is ever produced by a
 * language model. They are the *output* side of the deterministic pipeline —
 * retrieval and scoring write them, and the model is only allowed to read them
 * and phrase them. That is the whole reason the types exist separately from the
 * prompt strings: if a claim has to be typed to be stated, a model that skipped
 * the engine cannot state it.
 *
 * Data shapes only. What the agent *answered* is `AgentAnswer` in `engine.ts`,
 * where it is actually constructed — an earlier copy lived here and was never
 * used, which is how a second `MatchResult` and a second `Intent` came to exist
 * in this file and drift from the live ones.
 *
 * Pure and DOM-free. Imported by tests, by the server route, and by the browser
 * bundle, so it must not reach for `window`, `fetch`, or a model runtime.
 */

import type { EntityKind } from '@/types/portfolio';
// Type-only, so the cycle through `scoring.ts` never exists at runtime.
import type { MatchResult } from './scoring';

/* ------------------------------------------------------- match vocabulary */

/**
 * Four states, not the three the original brief described.
 *
 * `documented-uncorroborated` exists because the data forces it. `sk-kafka`
 * (Apache Kafka, depth: deep) and `sk-tensorflow` (depth: working) are both real
 * skill records with *zero* edges to any experience, product, or project. A
 * three-state model must call one of them "unverified" — which is false, the
 * record is right there — or "strong" — which is unsupported, nothing says it
 * was used. This state is the honest third answer, and it is the reason Test 4
 * ("Does Noman have Kafka experience?") can be answered truthfully at all.
 */
export const MATCH_STATES = ['strong', 'partial', 'documented-uncorroborated', 'unverified'] as const;

export type MatchState = (typeof MATCH_STATES)[number];

/**
 * Re-exported, not defined here.
 *
 * `MatchResult`, `RequirementScore` and `ScoreGrade` live in `scoring.ts`, which
 * is where they are produced. A second, differently-shaped `MatchResult` used to sit
 * in this file and nothing imported it — so the natural move of reaching for the
 * contract module and getting the wrong shape was available to anyone who tried.
 *
 * `export type` is erased at compile time, so this costs nothing at runtime and
 * introduces no import cycle through `scoring.ts`, which imports from here.
 */
export type { MatchResult, RequirementScore, ScoreGrade } from './scoring';

export const REQUIREMENT_CATEGORIES = ['technical', 'experience', 'education', 'domain', 'responsibility'] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const IMPORTANCES = ['required', 'preferred', 'unknown'] as const;
export type Importance = (typeof IMPORTANCES)[number];

/* ------------------------------------------------------------- knowledge */

export interface KnowledgeLink {
  label: string;
  url: string;
  type: string;
}

/** A pointer back to something that exists on the site. */
export interface EntityRef {
  key: string;
  kind: EntityKind;
  id: string;
  name: string;
  href: string;
}

/**
 * One retrieved record.
 *
 * `text` is the single field the embedder and the lexical scorer both read, so a
 * document that ranks well lexically and poorly semantically is a signal about
 * `text`, not about the pipeline. It is assembled once, here, from the fields
 * already in portfolio.json — no new prose is written.
 */
export interface KnowledgeRecord {
  /** `${kind}:${id}`. Never a bare slug: two collections share a slug today. */
  key: string;
  kind: EntityKind;
  id: string;
  slug: string;
  name: string;
  href: string;
  summary: string;
  /** Everything retrieval reads. Lowercased at build time. */
  text: string;
  /** Kept separately so cards and evidence lists can show the authored terms. */
  technologies: string[];
  tags: string[];
  aliases?: string[];
  organisation?: string;
  status?: string;
  /** Self-assessed depth. A claim by the owner, never treated as a receipt. */
  depth?: string;
  period?: { start?: string; end?: string; ongoing: boolean };
  featured: boolean;
  /** Non-skill entities that reference this one. Drives corroboration. */
  evidence: EntityRef[];
  links: KnowledgeLink[];
}

export interface ExperienceSpan {
  /** Months of unioned employment, gaps excluded. */
  months: number;
  years: number;
  /** ISO dates, for rendering. */
  first: string;
  last: string;
  /** Undocumented gaps, in months, so the number is explainable. */
  gapMonths: number;
  /** `key` is canonical — `experience:<id>` — as everywhere else in this module. */
  roles: { key: string; name: string; organisation: string; href: string; start?: string; end?: string; ongoing: boolean }[];
}

export interface AvailabilityKnowledge {
  status: 'open-to-work' | 'looking-for-opportunities' | 'closed';
  note?: string;
  updatedAt?: string;
  /**
   * The one sentence the agent is permitted to say about availability, fixed
   * per status. Written here, read verbatim, never generated. `null` means the
   * agent has nothing to say and must not volunteer a guess.
   */
  statement: string | null;
}

export interface PortfolioKnowledge {
  profile: {
    name: string;
    discipline?: string;
    positioning?: string;
    location?: string;
    email?: string;
    focus?: string;
    domains: string[];
    industries: string[];
    specialisation?: string;
    philosophy?: string;
    /** The owner-asserted figure. Present, but never quoted as fact by the agent. */
    statedYearsActive?: number;
    links: KnowledgeLink[];
  };
  availability: AvailabilityKnowledge;
  taxonomy?: {
    families?: Record<string, string[]>;
    aliases?: Record<string, string[]>;
  };
  /** Always empty. The owner has not documented services; see PLAN.md §9. */
  services: never[];
  records: KnowledgeRecord[];
  byKey: Map<string, KnowledgeRecord>;
  byKind: Map<EntityKind, KnowledgeRecord[]>;
  experienceSpan: ExperienceSpan;
  navigation: NavigationTarget[];
  generatedAt: string;
}

/* ------------------------------------------------------------ navigation */

export interface NavigationTarget {
  id: string;
  label: string;
  href: string;
  kind: 'page' | 'category' | 'entity';
  entityKind?: EntityKind;
}

/* ----------------------------------------------------------- requirements */

export interface JobRequirement {
  id: string;
  /** The line the requirement came from, trimmed. Shown to the user verbatim. */
  originalText: string;
  /** The canonical id this normalised to, when it matched one. */
  canonicalId?: string;
  /** The label to display — the canonical skill's name, else the query text. */
  label: string;
  category: RequirementCategory;
  importance: Importance;
  /** Terms that produced the canonical match, for the "why" panel. */
  matchedTerms: string[];
}

/* ---------------------------------------------------------------- actions */

export type AgentAction =
  | { type: 'navigate'; target: string }
  | { type: 'open_project'; projectId: string }
  | { type: 'open_product'; productId: string }
  | { type: 'open_experience'; experienceId: string }
  | { type: 'open_skill'; skillId: string }
  | { type: 'show_match_result' }
  | { type: 'clear_conversation' };

/* ---------------------------------------------------------- conversation */

export interface VerifiedContextItem {
  label: string;
  detail: string;
  href?: string;
}

/* ------------------------------------------------------------------- wire */

/**
 * A record as it crosses the network.
 *
 * `byKey` and `byKind` are dropped rather than flattened into objects: both are
 * pure functions of `records`, which the client can rebuild in one pass. Shipping
 * them would send every record's identity twice, and a JSON object keyed by
 * `kind:id` is also a shape that has to be defended against prototype keys.
 */
export type KnowledgeRecordWire = Omit<KnowledgeRecord, 'text'> & { text?: string };

/**
 * The JSON-safe form of `PortfolioKnowledge`.
 *
 * This exists as a separate type rather than `JSON.parse(JSON.stringify(x))` so
 * that forgetting to strip a `Map` is a compile error at the route boundary
 * instead of a `{}` reaching the browser at runtime.
 */
export interface KnowledgePayload {
  profile: PortfolioKnowledge['profile'];
  availability: AvailabilityKnowledge;
  services: never[];
  records: KnowledgeRecordWire[];
  experienceSpan: ExperienceSpan;
  navigation: NavigationTarget[];
  /**
   * Deliberately absent: `generatedAt`.
   *
   * It is a wall-clock reading taken when the adapter ran, so putting it in the
   * body makes every response differ from the one before it. That silently
   * disables `If-None-Match`, defeats shared caching, and turns the ETag into
   * decoration. Freshness is the validators' job — `ETag` and `Date` already
   * express it, and the server keeps `generatedAt` on `PortfolioKnowledge` for
   * logs. A `Date` header is stable within a response and a `Last-Modified`
   * would change only when the content does.
   */
  /** `false` when the caller asked for the metadata-only payload. */
  corpusIncluded: boolean;
  /** Byte length of the omitted corpus, so a client can show an honest cost. */
  corpusBytes?: number;
}
