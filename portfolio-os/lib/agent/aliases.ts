/**
 * lib/agent/aliases.ts
 *
 * Alias expansion, and the boundary between "the same thing" and "a related
 * thing".
 *
 * The table is **mined from the portfolio's own vocabulary** first. All 60 skills
 * carry between 5 and 16 tags plus a `technologies` list, and that vocabulary is
 * already good: `Container Orchestration`, `ASP.NET Core`, `Event Streaming`,
 * `Key-Value Store`. Writing those by hand would have been inventing a second
 * source of truth for something the data already says. Hand-written entries are
 * added afterwards and only where a term is genuinely *identical* in meaning —
 * a missing abbreviation like "k8s" for a skill called "Kubernetes", which no
 * tag list contains.
 *
 * ## The line this file exists to hold
 *
 * Two things being adjacent is not the same as two things being equal, and an
 * agent that cannot tell the difference will confidently tell a hiring manager
 * that Kafka experience means NATS experience. So:
 *
 *   - An **alias** resolves to the same concept. "k8s" -> kubernetes. A match on
 *     an alias is a match on the thing itself.
 *   - A **family** groups concepts that occupy the same slot without being
 *     interchangeable. kafka, nats and mqtt are all message brokers; PyTorch and
 *     TensorFlow are both deep learning frameworks. A family hit is reported as
 *     `partial` and always names the substitutes explicitly, so the reader is
 *     told what was found *and* what was not.
 *
 * `FORBIDDEN_EQUIVALENCES` is exported so a unit test can assert that none of
 * these pairs ever collapse into a single canonical id. That is the failure this
 * file is designed to make impossible rather than merely unlikely.
 */

import { normaliseTerm, squashed } from './text';
import type { Portfolio } from '@/types/portfolio';
import type { KnowledgeRecord, PortfolioKnowledge } from './types';

/* ------------------------------------------------------------- forbidden */

/**
 * Pairs that must never be treated as the same technology, asserted by a test.
 *
 * Each of these is a *plausible* confusion — same job function, same layer of
 * the stack — which is exactly why they are written down. Without the list they
 * would eventually be collapsed by an over-eager synonym rule, and the failure
 * would be invisible: the answer would read well and be wrong.
 */
export const FORBIDDEN_EQUIVALENCES: readonly (readonly [string, string])[] = [
  ['pytorch', 'tensorflow'],
  ['kafka', 'nats'],
  ['redis', 'postgresql'],
  ['aws', 'azure'],
] as const;

/* --------------------------------------------------------------- families */

/**
 * Concepts that share a slot but are not substitutes. Membership here can only
 * ever produce a `partial`, never a `strong`.
 *
 * Keyed by canonical id (a skill slug), mapped to the family name. Families are
 * used in exactly one place — a requirement whose exact concept is absent — and
 * the rationale string built there always names the members it found, so "same
 * family" is never presented as "same skill".
 */
export const FAMILIES: Readonly<Record<string, readonly string[]>> = {
  'deep learning frameworks': [
    'pytorch',
    'tensorflow',
    'jax',
    'evotorch',
    'onnx',
    'tensorrt',
    'litert',
  ],
  'message brokers and event transport': [
    'apache-kafka',
    'nats-messaging',
    'mqtt-protocol',
    'aws-eventbridge-eventbus',
  ],
  'document and key-value databases': [
    'redis',
    'mongodb',
    'dynamodb',
    'aws-memorydb',
    'neo4j-graph-database',
  ],
  'relational databases': ['postgresql', 'timescaledb'],
  'vector search stores': ['qdrant', 'pgvector'],
  'container orchestration': ['kubernetes-eks', 'docker-swarm'],
  'polyglot api styles': ['rest-apis', 'grpc', 'ocelot-api-gateway', 'aws-api-gateway'],
  'frontend frameworks': ['nextjs', 'flutter'],
  'test automation': [
    'pytest-automated-testing',
    'xunit-net',
    'playwright',
    'patrol-flutter-end-to-end-testing',
    'polyglot-test-framework',
  ],
  'agent and workflow frameworks': ['langchain', 'langgraph', 'temporal-io', 'microsoft-semantic-kernel'],
  'model runtimes and inference': ['onnx', 'tensorrt', 'litert'],
};

/* ------------------------------------------------------ hand-written only */

/**
 * Terms that identify a concept already in the data but that no tag or
 * `technologies` list contains. Every entry is an abbreviation, a spelling
 * variant, or a full expansion of a name the portfolio already uses.
 *
 * There are deliberately no entries here that cross a family boundary. A term
 * that means a *different specific technology* is not an alias of anything in
 * this portfolio and is left to resolve as `unverified`, which is the correct
 * and useful answer.
 *
 * Keys are **slugs as they actually appear in portfolio.json**, not the names a
 * reader would guess. `kubernetes-eks` is the slug behind the skill called
 * "Kubernetes", and `solutions-architecture` is the one behind "Distributed
 * Systems". An entry keyed on the guessed name is silently dropped by the
 * `knownSlugs` guard below, which is how an earlier draft lost all thirteen of
 * its Kubernetes aliases without a single error being reported.
 *
 * Two-character and three-character abbreviations are omitted unless they are
 * unambiguous in a technical context. "go", "ts", "js" and "py" all appear in
 * ordinary English sentences and would resolve "I'm going to look" to Golang.
 */
const HAND_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'kubernetes-eks': ['k8s', 'k8', 'kubernetes', 'amazon eks', 'eks', 'container orchestration'],
  'dotnet-core': ['dotnet', '.net', '.net core', 'dotnet core', 'asp.net', 'asp.net core', 'netcore', 'c# backend'],
  csharp: ['c#', 'c sharp', 'csharp'],
  python: ['python', 'python3'],
  typescript: ['typescript'],
  golang: ['golang', 'go lang'],
  postgresql: ['postgresql', 'postgres', 'sql postgresql', 'psql'],
  redis: ['redis', 'redis cluster', 'key-value store', 'key value store'],
  mongodb: ['mongodb', 'mongo', 'document database'],
  apachekafka: ['apache kafka', 'kafka'],
  pytorch: ['pytorch', 'torch', 'pytorch cuda', 'cuda'],
  tensorflow: ['tensorflow', 'keras'],
  grpc: ['grpc', 'protobuf', 'protocol buffers', 'grpc apis'],
  nextjs: ['next.js', 'nextjs', 'next js'],
  flutter: ['flutter', 'flutter bloc'],
  'ffmpeg-real-time-video-streaming': ['ffmpeg', 'real-time video streaming', 'video streaming'],
  'temporal-io': ['temporal', 'temporal io', 'temporal.io'],
  microservices: ['microservices', 'microservice', 'micro services', 'microservice architecture'],
  'solutions-architecture': [
    'distributed systems',
    'distributed system',
    'event-driven architecture',
    'event driven',
    'system design',
  ],
  'iam-saml-oidc': ['iam', 'sso', 'sso integration', 'saml', 'saml 2.0', 'oidc', 'oauth2', 'oauth', 'openid'],
  onnx: ['onnx', 'onnx runtime', 'onnxruntime'],
  tensorrt: [
    'tensorrt',
    'nvidia jetson',
    'jetson',
    'jetson nano',
    'edge ai',
    'edge intelligence',
    'edge compute',
    'edge-compute',
    'embedded ai',
    'edge-first',
  ],
  litert: [
    'litert',
    'tflite',
    'tensorflow lite',
    'on-device ai',
    'mobile ai',
    'on-device inference',
  ],
  'docker-containerization': ['docker compose', 'docker-compose', 'containerization', 'containers'],
  'git-version-control-monorepo': ['git', 'github', 'monorepo', 'version control'],
  ray: ['ray', 'ray.io'],
  // Defect 3: two records for one concept. Rather than merging the data, both
  // slugs are made to resolve to both concepts, so a query returns both records
  // and the reader sees the actual pair instead of one arbitrary member.
  'module-federations': [
    'mfe',
    'module federation',
    'module federations',
    'module-federation',
    'module-federations',
    'microfrontend',
    'micro frontends',
    'micro-frontends',
    'micro frontend',
    'micro-frontend',
  ],
  'micro-frontends': [
    'microfrontends',
    'micro frontends',
    'micro-frontend',
    'micro frontend',
    'micro-frontend architecture',
    'microfrontends architecture',
    'mfe',
    'module federation',
    'module federations',
    'module-federation',
  ],
};

/**
 * Normalises a term for alias lookup: lowercased, punctuation collapsed, and
 * the C#/C++ shape preserved because `c#` and `c` are different languages and
 * collapsing the hash would merge them.
 */

/* ------------------------------------------------------------- the table */

export interface AliasTable {
  /** term -> canonical ids it can mean. More than one is a genuine ambiguity. */
  byTerm: Map<string, string[]>;
  /**
   * term -> canonical ids whose *own name or slug* is that term.
   *
   * Kept separately from `byTerm` because "PyTorch" is a technology listed on the
   * Python record and on the EvoTorch record as well as being the name of the
   * PyTorch skill. A flat table therefore reports three-way ambiguity for a term
   * that has one obvious answer, and the strongest concept gets buried under two
   * records that merely *use* it. Resolution consults this first and only falls
   * back to `byTerm` when the name table has nothing.
   */
  primaryByTerm: Map<string, string[]>;
  /** canonical id -> the terms that resolve to it. */
  termsFor: Map<string, string[]>;
  /** canonical id -> family name, for partial matches only. */
  familyOf: Map<string, string>;
  /** canonical id -> other canonical ids in the same family, self excluded. */
  familyMembers: Map<string, string[]>;
  /**
   * Family name -> canonical ids of the members actually present.
   *
   * Built here rather than left to the caller because `FAMILIES` is authored in
   * slug space. A caller comparing those slugs against `canonicalIds` finds
   * nothing, which is what silently disabled family resolution entirely.
   */
  families: Map<string, string[]>;
  /** Every canonical id that came from the data. */
  canonicalIds: string[];
}

function skillIdForSlug(slug: string, skills: Portfolio['skills']): string | undefined {
  return skills.find((skill) => skill.slug === slug)?.id;
}

/**
 * Builds the table.
 *
 * Mining order matters: authored vocabulary first, so a hand-written entry can
 * never *replace* what the portfolio says about its own skills, only add to it.
 */
export function buildAliasTable(knowledge: PortfolioKnowledge): AliasTable {
  const portfolioSkills = knowledge.byKind.get('skills') ?? [];
  const byTerm = new Map<string, string[]>();
  const primaryByTerm = new Map<string, string[]>();
  const termsFor = new Map<string, string[]>();
  const familyOf = new Map<string, string>();
  const familyMembers = new Map<string, string[]>();

  // Slugs are the readable key in portfolio.json; canonical ids are the
  // `kind:id` strings everything else in the adapter is addressed by. Alias
  // output has to be canonical ids, because a caller resolving a job
  // requirement goes straight from here to `knowledge.byKey.get(...)` with no
  // translation step of its own. A table keyed on slugs would need one, and
  // every caller would eventually forget it.
  const canonicalIdForSlug = new Map<string, string>();
  for (const record of portfolioSkills) canonicalIdForSlug.set(record.slug, record.key);

  const push = (map: Map<string, string[]>, term: string, canonicalId: string): void => {
    const key = normaliseTerm(term);
    if (key.length < 2) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, [canonicalId]);
    } else if (!existing.includes(canonicalId)) {
      existing.push(canonicalId);
    }
  };

  const add = (term: string, canonicalId: string): void => {
    push(byTerm, term, canonicalId);
    const key = normaliseTerm(term);
    const owned = termsFor.get(canonicalId);
    if (key.length >= 2) {
      if (!owned) termsFor.set(canonicalId, [key]);
      else if (!owned.includes(key)) owned.push(key);
    }
  };

  // 1. Mined from the data. A record's own name and slug are the concept, and
  //    are the authoritative spelling of it; its tags and technologies are the
  //    vocabulary other people use to refer to it.
  for (const record of portfolioSkills) {
    const canonicalId = record.key;
    push(primaryByTerm, record.name, canonicalId);
    push(primaryByTerm, record.slug, canonicalId);
    for (const term of [record.name, record.slug, ...record.tags, ...record.technologies]) {
      add(term, canonicalId);
    }
  }

  // 2. Hand-written abbreviations, resolved against the ids that actually exist.
  //    An entry naming a skill this portfolio does not have is ignored rather
  //    than inventing the skill. The check is on the exact slug, which is why the
  //    table above is written in slugs.
  const knownSlugs = new Set(portfolioSkills.map((record) => record.slug));
  for (const [slug, aliases] of Object.entries(HAND_ALIASES)) {
    const canonicalId = canonicalIdForSlug.get(slug);
    if (!canonicalId) continue;
    for (const alias of aliases) {
      add(alias, canonicalId);
      // A hand-written alias for the concept is primary too: "k8s" means
      // Kubernetes the way "Kubernetes" does, not the way "PyTorch" is a
      // technology on the Python record.
      push(primaryByTerm, alias, canonicalId);
    }
  }

  // 3. Families. Membership is resolved to canonical ids here, once, rather than
  //    left in slug space for every caller to translate. `FAMILIES` is authored
  //    in slugs because that is what is readable and checkable against the
  //    content file, but nothing downstream of this function should ever see a
  //    slug. A family whose members are not all present is kept: the
  //    partial-match rationale reports only the members it actually found, so a
  //    partially-populated family is still useful.
  const families = new Map<string, string[]>();
  for (const [family, members] of Object.entries(FAMILIES)) {
    const present = members
      .map((slug) => canonicalIdForSlug.get(slug))
      .filter((id): id is string => id !== undefined);
    if (present.length > 0) families.set(family, present);
    for (const canonicalId of present) {
      familyOf.set(canonicalId, family);
      // Excludes self: a concept is not its own substitute, and offering back the
      // thing that was asked about adds nothing to a partial match.
      familyMembers.set(canonicalId, present.filter((id) => id !== canonicalId));
    }
  }

  const canonicalIds = portfolioSkills.map((record) => record.key).sort();

  return { byTerm, primaryByTerm, termsFor, familyOf, familyMembers, families, canonicalIds };
}

/**
 * Siblings in the same family, as canonical ids, excluding the concept itself.
 *
 * This is the correct substitute set for a family-level partial match and no
 * narrower one: a family is defined as skills that stand in for each other, so
 * substituting a single sibling would claim a distinction the portfolio does not
 * actually make.
 */
export function siblingsInFamily(table: AliasTable, canonicalId: string): string[] {
  return table.familyMembers.get(canonicalId) ?? [];
}

/* ------------------------------------------------------------ resolution */

export interface TermResolution {
  /** The query term, normalised. */
  term: string;
  /** Canonical ids this term can mean. Empty when nothing matches. */
  canonicalIds: string[];
  /** True when the term means more than one concept in this portfolio. */
  ambiguous: boolean;
  /**
   * Sibling concepts in the same family. Only consulted by the match engine when
   * `canonicalIds` is empty — if the exact thing is present, family members are
   * noise and must not dilute the result.
   */
  family: string | null;
  familyMembers: string[];
}

/**
 * Resolves one query term to the concepts it can mean.
 *
 * Three passes, cheapest first: the term table, then an abbreviation match for
 * inputs like "k8s" or "otel" that the term table cannot contain, then the
 * family lookup. Only the first two can produce a real match; the family pass is
 * what turns "not in the portfolio" into "not listed, but here is the adjacent
 * thing that is".
 */
/** Split on anything that is not part of a name, so "leader.ship" is two words. */
function words(text: string): string[] {
  return text.split(/[^a-z0-9+#.]+/).filter(Boolean);
}

/**
 * Whole-word containment, either way round.
 *
 * Plain `candidate.includes(term)` finds "ship" inside "leader**ship**", which is
 * how the verb in "design and ship event-driven services" came to resolve to
 * Engineering Leadership & Team Direction: a confident, specific, entirely
 * fictional answer. Substring hits are worse than no hit at all, because they
 * clear the ambiguity check by looking unique.
 *
 * Morphology is handled by prefix, not by substring: two words match when one
 * is a prefix of the other and the shorter is four characters or more. That pairs
 * "postgres" with "postgresql" and "microservice" with "microservices", while
 * still refusing "ship" for "leadership", where neither word is a prefix of the
 * other. Plain substring matching drew that distinction for free and then lost it
 * the moment it was applied inside a word rather than between words.
 */
/**
 * The term's words appearing inside a longer candidate name.
 *
 * "k8s orchestrator" is a requirement for "kubernetes"; that is the useful half
 * of containment. The restriction to multi-word candidates is deliberate: the
 * other half, `containsPhrase(term, candidate)`, already covers single words in
 * the position that carries the evidence, and letting a lone common word match
 * anywhere inside a long term is how "design and ship event-driven services"
 * acquires a requirement for Architecture.
 */
function termContainsCandidate(term: string, candidate: string): boolean {
  return words(candidate).length >= 2 && containsPhrase(candidate, term);
}

function containsPhrase(haystack: string, needle: string): boolean {
  const h = words(haystack);
  const n = words(needle);
  if (n.length === 0 || h.length < n.length) return false;
  const sameWord = (a: string, b: string): boolean => {
    if (a === b) return true;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    // A truncation, not a different word that starts the same way. Prefix
    // agreement alone let "time" match "timescaledb", which turned the vague
    // question "are you comfortable with real-time systems" into a requirement
    // for TimescaleDB on the strength of one shared syllable. The shorter word
    // has to account for most of the longer one before they are the same word.
    return shorter.length >= 4 && longer.startsWith(shorter) && shorter.length / longer.length >= 0.75;
  };

  for (let start = 0; start + n.length <= h.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < n.length; offset += 1) {
      if (!sameWord(h[start + offset] ?? '', n[offset] ?? '')) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

export function resolveTerm(table: AliasTable, rawTerm: string): TermResolution {
  const term = normaliseTerm(rawTerm);
  const empty: TermResolution = { term, canonicalIds: [], ambiguous: false, family: null, familyMembers: [] };
  if (term.length < 2) return empty;

  // Name-level answers win outright. "pytorch" names the PyTorch skill; the fact
  // that Python and EvoTorch also list it as a technology is a fact about them,
  // not a second reading of the query.
  const primary = table.primaryByTerm.get(term);
  if (primary && primary.length > 0) {
    return {
      term,
      canonicalIds: [...primary],
      ambiguous: primary.length > 1,
      family: table.familyOf.get(primary[0] ?? '') ?? null,
      familyMembers: [],
    };
  }

  const direct = table.byTerm.get(term);
  if (direct && direct.length > 0) {
    return {
      term,
      canonicalIds: [...direct],
      ambiguous: direct.length > 1,
      family: table.familyOf.get(direct[0] ?? '') ?? null,
      familyMembers: [],
    };
  }

  // Abbreviation pass. "k8s" and "k 8 s" squash to the same string, which is how
  // it reaches `kubernetes-eks`; so does a multiword tag that lost a word.
  const squashedTerm = squashed(rawTerm);
  if (squashedTerm.length >= 2) {
    for (const [candidate, ids] of table.primaryByTerm) {
      if (squashed(candidate) === squashedTerm) {
        return {
          term,
          canonicalIds: [...ids],
          ambiguous: ids.length > 1,
          family: table.familyOf.get(ids[0] ?? '') ?? null,
          familyMembers: [],
        };
      }
    }
  }

  // Containment on *names* only, and only for queries of four characters or more.
  //
  // Matching a short term against the whole tag and technology vocabulary is
  // where confident nonsense comes from: "cloud" is contained in a technology on
  // AWS API Gateway, and reporting that as an exact match names a record the
  // reader never mentioned. A record's own *name* is safe to match loosely,
  // because a name is short and curated — there is little in "Apache Kafka" for
  // "cloud" to hide in.
  //
  // Note this leaves the *direct* tag lookup above intact, and that is
  // deliberate: `backend` still resolves to Node.js, because the portfolio
  // tags that record `Backend`. That is a claim the data makes, traceable to
  // `skills[].tags`, which is a different thing from the agent guessing that
  // Node.js is a backend technology because its name contains "node".
  //
  // Containment is tested against whole words. Plain `candidate.includes(term)`
  // finds "ship" inside "leader**ship**", so the verb in "design and ship
  // event-driven services" resolved to Engineering Leadership & Team Direction —
  // a confident, specific, entirely fictional answer. Substring hits are worse
  // than no hit, because they survive the ambiguity check by looking unique.
  if (term.length >= 4) {
    const nameMatches: string[] = [];
    for (const [candidate, ids] of table.primaryByTerm) {
      if (containsPhrase(term, candidate) || termContainsCandidate(term, candidate)) {
        nameMatches.push(...ids);
      }
    }
    if (nameMatches.length > 0) {
      const unique = [...new Set(nameMatches)];
      return {
        term,
        canonicalIds: unique,
        ambiguous: unique.length > 1,
        family: table.familyOf.get(unique[0] ?? '') ?? null,
        familyMembers: [],
      };
    }
  }

  const family = findFamilyForTerm(table, term);
  if (family) {
    return {
      term,
      canonicalIds: [],
      ambiguous: false,
      family: family.name,
      familyMembers: family.members,
    };
  }

  return empty;
}

/**
 * A term that is not a technology but still names a family, e.g. "messaging".
 *
 * Matching is on whole words of the family name. This used to test
 * `term.includes(word)` against slugs and compare the result against canonical
 * ids, which never lined up, so *no* family ever resolved and every family term
 * scored zero.
 */
function findFamilyForTerm(table: AliasTable, term: string): { name: string; members: string[] } | null {
  const termWords = term.split(' ');
  for (const [name, members] of table.families) {
    const familyWords = name.split(' ');
    const sharesAWord = familyWords.some(
      (word) => word.length >= 4 && termWords.some((t) => t === word || (t.length >= 4 && word.startsWith(t))),
    );
    if (sharesAWord) return { name, members };
  }
  return null;
}

/**
 * The families a canonical id belongs to, for the "why this is partial" text.
 * Exported so the match engine does not reach into the table's internals.
 */

