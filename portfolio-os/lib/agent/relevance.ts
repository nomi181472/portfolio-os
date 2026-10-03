/**
 * lib/agent/relevance.ts
 *
 * What to say when the reader asks about something Noman does not document.
 *
 * The rule this module exists to enforce: an honest "no" is still a failure if the
 * reader leaves with nothing to act on. A recruiter who asks "does he know Rust?"
 * and receives "Rust is not on this site" has learned one true thing and lost the
 * conversation. They did not ask whether Rust is documented; they asked whether
 * Noman is worth a call. So the answer has two halves, and the order matters:
 * the gap first, because that is the fact being asked about, and then the nearest
 * real, linked evidence — which is the part that lets a recruiter act.
 *
 * "Relevance" is a precise word here and it is load-bearing. Nothing in this file
 * claims the reader's subject is present. Every returned item is a real record
 * with a real href and a real evidence trail, and the answer says in words that it
 * is adjacent rather than the same thing. A portfolio that let an unanswered
 * question drift into an implied "yes" would be worse than one that stayed quiet,
 * because the recruiter would not know to check.
 *
 * Three signals, in descending order of how much they should be trusted:
 *
 *  1. **Co-occurrence.** Two skills that appear in the same project are used on
 *     the same work. This is the strongest signal available and it is read
 *     entirely out of the graph — no hand-authored mapping, nothing to drift out
 *     of date with the content.
 *  2. **Tags.** Authored conceptual labels ("Systems Programming", "Distributed
 *     Systems") that connect a concept to its field. Broad by nature, so they
 *     rank below co-occurrence and are reported with the tag that connected them
 *     so the reader can judge the link themselves.
 *  3. **Depth.** A tiebreak only. Self-assessed, so it never promotes a record on
 *     its own; it only orders records already admitted by 1 or 2.
 *
 * Deliberately absent: any claim that two technologies are interchangeable. That
 * is what `FAMILIES` in `aliases.ts` is for, and it is capped at `partial`
 * precisely because holding RabbitMQ does not satisfy a requirement for
 * messaging. Relevance is weaker still — it never enters a score at all.
 */

import type { KnowledgeRecord, PortfolioKnowledge } from './types';

/** One thing worth showing a reader who asked about something absent. */
export interface RelevantRecord {
  record: KnowledgeRecord;
  /** How this record was found. Named so the answer can be specific about it. */
  via: 'co-occurrence' | 'tag';
  /**
   * What connected them, in words a reader can check.
   *
   * For co-occurrence this is the project the two were seen in together. For a
   * tag it is the tag itself. Empty only when the subject named a skill that has
   * no evidence at all, in which case there is nothing true to say about how the
   * two are connected.
   */
  bridge: string;
  /** True when the record is the reader's subject after all. */
  isSubject: boolean;
}

/** How many records to return. Enough to be useful, few enough to stay a list. */
const LIMIT = 4;

/** Evidence kinds strong enough to co-occur through. */
const EVIDENCE_KINDS: ReadonlySet<string> = new Set(['projects', 'products', 'experience']);

/**
 * Depth, as an ordering weight. Used only to sort records already admitted by a
 * real signal, never to admit one on its own — self-assessment is not evidence.
 */
const DEPTH_WEIGHT: Readonly<Record<string, number>> = {
  deep: 3,
  expert: 3,
  specialist: 2,
  proficient: 1,
  working: 0.5,
  familiar: 0.25,
};

/**
 * Absent technologies mapped to the fields the portfolio does document.
 *
 * Needed because a tag search can only find concepts the content already names.
 * "Rust" appears nowhere in the portfolio, so nothing matches it lexically and the
 * honest answer was "nothing related here" — true, and useless to a recruiter who
 * was really asking whether the conversation is worth continuing.
 *
 * Each entry is a statement about a *field*, never about experience: Rust is a
 * systems language, so the systems records are relevant to read. It does not say
 * Rust was used, and the composed answer says so explicitly. Tags are preferred
 * over skill slugs because a tag is authored as a category label, which is
 * exactly the kind of claim this is.
 *
 * Kept deliberately small and conservative. Every tag named here was checked to
 * exist in `content/portfolio.json` — a typo would silently return nothing.
 */
const CONCEPT_FIELDS: Readonly<Record<string, readonly string[]>> = {
  rust: ['Systems Programming', 'Programming Language'],
  zig: ['Systems Programming', 'Programming Language'],
  c: ['Systems Programming', 'Programming Language'],
  'c++': ['Systems Programming', 'Programming Language'],
  cpp: ['Systems Programming', 'Programming Language'],
  elixir: ['Programming Language', 'Distributed Systems'],
  erlang: ['Programming Language', 'Distributed Systems'],
  haskell: ['Programming Language', 'Functional Programming'],
  clojure: ['Programming Language'],
  scala: ['Programming Language'],
  kotlin: ['Programming Language', 'Mobile'],
  swift: ['Programming Language', 'Mobile'],
  java: ['Programming Language', 'Microservices'],
  'java/spring': ['Programming Language', 'Web Framework'],
  spring: ['Programming Language', 'Web Framework'],
  php: ['Programming Language', 'Web Framework'],
  laravel: ['Programming Language', 'Web Framework'],
  ruby: ['Programming Language', 'Web Framework'],
  rails: ['Programming Language', 'Web Framework'],
  solidity: ['Programming Language', 'Distributed Systems'],
  web3: ['Programming Language', 'Distributed Systems'],
  wordpress: ['Web Framework'],
  oracle: ['Relational Database'],
  sqlserver: ['Relational Database'],
  cassandra: ['NoSQL Database'],
  snowflake: ['Serverless'],
  clickhouse: ['NoSQL Database'],
  rabbitmq: ['Message Broker'],
  activemq: ['Message Broker'],
  ansible: ['DevOps'],
  terraform: ['DevOps'],
  pulumi: ['DevOps'],
  helm: ['Container Orchestration'],
  openshift: ['Container Orchestration'],
  jest: ['Testing Framework'],
  mocha: ['Testing Framework'],
  vitest: ['Testing Framework'],
  cypress: ['End-to-End Testing'],
  selenium: ['End-to-End Testing'],
  webpack: ['Module Federation'],
  vite: ['Frontend Framework'],
  vue: ['Frontend Framework'],
  angular: ['Frontend Framework'],
  svelte: ['Frontend Framework'],
  redux: ['State Management'],
  grpc: ['gRPC APIs'],
  openapi: ['OpenAPI'],
  mysql: ['Relational Database'],
  mariadb: ['Relational Database'],
  sqlite: ['Relational Database'],
  elasticsearch: ['Semantic Search'],
  lucene: ['Semantic Search'],
  pinecone: ['Vector Database'],
  weaviate: ['Vector Database'],
  chroma: ['Vector Database'],
  langchain: ['Machine Learning Framework'],
  pytorch: ['Deep Learning Framework'],
  tensorflow: ['Deep Learning Framework'],
  cuda: ['GPU Acceleration'],
  rocm: ['GPU Acceleration'],
  opencv: ['Deep Learning'],
  'scikit-learn': ['Machine Learning'],
  airflow: ['Workflow Orchestration'],
  spark: ['Stream Processing'],
  flink: ['Stream Processing'],
  dbt: ['CI Automation'],
  hazelcast: ['Distributed Caching'],
  memcached: ['Distributed Caching'],
  'github actions': ['CI Automation'],
  jenkins: ['CI Automation'],
  circleci: ['CI Automation'],
  gitlab: ['CI Automation'],
  ios: ['Mobile'],
  android: ['Mobile'],
  'react native': ['Mobile'],
};

/**
 * Words that follow a technology in an unresolved phrase.
 *
 * "Show me Rust projects" leaves `Rust projects` unresolved — the phrase is
 * reportable, but `projects` is a head noun the reader used to frame the request
 * and not a second thing to go looking for. Dropped before a subject is chosen.
 */
const HEAD_NOUNS = new Set([
  'project', 'projects', 'skill', 'skills', 'experience', 'experiences', 'work',
  'works', 'job', 'jobs', 'role', 'roles', 'stack', 'tool', 'tools', 'tooling',
  'resume', 'cv', 'background', 'history', 'usage', 'use',
]);

/** Verbs and question words that lead an unresolved phrase without being it. */
const LEAD_WORDS = new Set([
  'compare', 'show', 'tell', 'list', 'find', 'explain', 'describe', 'give',
  'mention', 'talk', 'discuss', 'summarise', 'summarize', 'any', 'much', 'many',
  'more', 'most', 'best', 'good', 'strong', 'deep', 'extensive', 'ask',
]);

/**
 * The site itself, which is never the subject of a technology question.
 *
 * "How do I use this site?" is a question about the interface, and answering it
 * with the portfolio's absence of a record for "site" would be technically true
 * and useless. Same class as the owner's own name.
 */
const META_SUBJECTS = new Set([
  'site', 'website', 'web', 'page', 'pages', 'app', 'application', 'ui',
  'interface', 'thing', 'things', 'stuff', 'something', 'anything', 'content',
  'portfolio', 'this', 'that', 'it', 'me', 'him', 'her', 'them', 'us', 'here',
  'name', 'person', 'team', 'company', 'employer', 'client', 'clients',
]);

/**
 * Chooses the one thing an unresolved question is actually about.
 *
 * The router sends a question here when it could not place it, and the unresolved
 * terms at that point are a mix of genuine subjects and pure grammar — "Noman",
 * "interesting", "ask", "site" are all noise. Reading them as subjects produced
 * answers about the portfolio not documenting the word "Noman", which is true and
 * useless, so this gate is what makes relevance safe to offer.
 *
 * A token is a subject when it is a known absent technology, when it carries
 * technology punctuation (`C++`, `.NET`, `Web3`), or when the reader capitalised it
 * as a proper noun. Capitalisation is doing real work here: it is how a reader
 * marks "this is a name" without the portfolio knowing the name, and refusing to
 * trust it would leave "Tell me about Rust" unanswered.
 *
 * The returned subject keeps the reader's own capitalisation. Lowercasing "Rust"
 * into "rust" in a sentence about Rust reads as a typo and undercuts the whole
 * reply.
 *
 * `allNoise` distinguishes the two ways nothing survives. Pure framing ("Noman",
 * "interesting", "ask", "site") means the reader is orienting and should be told
 * about the portfolio. A real term that simply is not documented ("real-time
 * systems") means the reader asked about something specific and is owed a plain
 * statement that it is absent — never a biography in place of an answer.
 */
export function subjectFromUnresolved(
  unresolved: readonly string[],
  knowledge: PortfolioKnowledge,
): { subject: string | null; allNoise: boolean } {
  const ownerTokens = new Set(tokens(knowledge.profile.name ?? ''));
  const skillTokens = new Set<string>();
  for (const record of knowledge.byKind.get('skills') ?? []) {
    for (const tag of record.tags) for (const token of tokens(tag)) skillTokens.add(token);
  }

  let sawRealTerm = false;

  for (const phrase of unresolved) {
    let words = phrase.split(/\s+/).filter(Boolean);
    // Framing words may sit on either end: "Compare Rust" and "Rust projects".
    while (words.length > 0 && LEAD_WORDS.has(words[0]!.toLowerCase())) words = words.slice(1);
    while (words.length > 0 && HEAD_NOUNS.has(words[words.length - 1]!.toLowerCase())) words = words.slice(0, -1);
    if (words.length === 0) continue;

    for (const word of words) {
      const lower = word.toLowerCase();
      if (META_SUBJECTS.has(lower)) continue;
      if (ownerTokens.has(lower)) continue;
      if (FRAMING.has(lower)) continue;
      if (NOISE.has(lower)) continue;
      if (HEAD_NOUNS.has(lower) || LEAD_WORDS.has(lower)) continue;

      // Past this point the word means something specific, so the question is
      // about something real whether or not a record exists for it.
      sawRealTerm = true;

      // A known absent technology is a subject whether or not it is capitalised.
      if (CONCEPT_FIELDS[lower]) return { subject: word, allNoise: false };
      // `.NET`, `C++`, `gRPC`, `Web3`, `Node.js`: punctuation is an authored
      // signal of "this is a proper name of a technology".
      if (/[+#.]/.test(word) || /\d/.test(word)) return { subject: word, allNoise: false };
      // Capitalised and not the owner's name. A reader capitalising a word is the
      // only evidence available for an unknown technology.
      if (/^[A-Z]/.test(word) && lower.length > 1) return { subject: word, allNoise: false };
      // Present as a portfolio tag, and named on its own. Restricted to
      // single-word phrases because "real-time systems" contains a tag word
      // (`systems`) while naming something the portfolio does not document, and
      // splitting that phrase to reach the tag would claim knowledge of systems
      // design from the word "systems" appearing in a tag.
      if (words.length === 1 && skillTokens.has(lower)) return { subject: word, allNoise: false };
    }
  }

  return { subject: null, allNoise: !sawRealTerm };
}

/**
 * Words a reader uses to characterise rather than to ask about.
 *
 * Distinct from `NOISE`, which drops retrieval-irrelevant words from a *term*.
 * These are adjectives and intensifiers that arrive unresolved because they name
 * nothing: "Tell me something interesting" leaves `interesting`, and treating it
 * as a subject produced an answer about the portfolio not documenting the word.
 */
const FRAMING = new Set([
  'interesting', 'impressive', 'great', 'cool', 'nice', 'awesome', 'special',
  'unique', 'amazing', 'remarkable', 'favourite', 'favorite', 'best', 'standout',
  'stand-out', 'strongest', 'top', 'main', 'primary', 'coolest', 'wild', 'crazy',
]);

/** Tokens that carry no topical meaning, dropped before comparing text. */
const NOISE = new Set([
  'work', 'works', 'worked', 'working', 'experience', 'experiences', 'experienced',
  'expertise', 'familiar', 'familiarity', 'comfortable', 'skill', 'skills', 'use',
  'used', 'using', 'know', 'knows', 'known', 'like', 'good', 'solid', 'strong',
  'deep', 'extensive', 'expert', 'level', 'years', 'year', 'months', 'month',
  'with', 'about', 'much', 'many', 'any', 'some', 'tell', 'show', 'does', 'do',
  'have', 'has', 'had', 'noman', 'there', 'anything', 'something',
]);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9+.#]+/)
      .filter((token) => token.length > 1 && !NOISE.has(token)),
  );
}

function depthWeight(record: KnowledgeRecord): number {
  return DEPTH_WEIGHT[String(record.depth)] ?? 0;
}

/** Evidence records shared with `record`, most substantial first. */
function bridgesFor(record: KnowledgeRecord, limit = 2): string[] {
  return record.evidence
    .filter((edge) => EVIDENCE_KINDS.has(edge.kind))
    .map((edge) => edge.name)
    .slice(0, limit);
}

/**
 * Skills that share a project, product or role with `subject`.
 *
 * This is the load-bearing signal and it is pure graph traversal: every link here
 * is one the content file actually declares. Nothing is inferred, so the answer
 * cannot drift away from what the portfolio says.
 */
function byCoOccurrence(subject: KnowledgeRecord, knowledge: PortfolioKnowledge): RelevantRecord[] {
  const subjectBridges = new Map<string, string>();
  for (const edge of subject.evidence) {
    if (!EVIDENCE_KINDS.has(edge.kind)) continue;
    // The longest name wins so the rationale reads as the real title rather than
    // a truncated one when two records share a bridge key.
    const existing = subjectBridges.get(edge.key);
    if (!existing || edge.name.length > existing.length) subjectBridges.set(edge.key, edge.name);
  }
  if (subjectBridges.size === 0) return [];

  const found: RelevantRecord[] = [];
  for (const candidate of knowledge.byKind.get('skills') ?? []) {
    if (candidate.key === subject.key) continue;
    for (const edge of candidate.evidence) {
      if (!EVIDENCE_KINDS.has(edge.kind)) continue;
      const bridge = subjectBridges.get(edge.key);
      if (!bridge) continue;
      found.push({
        record: candidate,
        via: 'co-occurrence',
        bridge,
        isSubject: false,
      });
      break;
    }
  }
  return found;
}

/**
 * Skills sharing an authored conceptual tag with the subject.
 *
 * Broader than co-occurrence and reported as such. A tag like "Systems Programming"
 * genuinely connects C++ to Rust as a field, but the connection is conceptual, so
 * the answer must say so rather than implying they were used together.
 */
function byTag(subject: KnowledgeRecord, knowledge: PortfolioKnowledge): RelevantRecord[] {
  const subjectTags = new Set(subject.tags.map((tag) => tag.toLowerCase()));
  if (subjectTags.size === 0) return [];

  const found: RelevantRecord[] = [];
  for (const candidate of knowledge.byKind.get('skills') ?? []) {
    if (candidate.key === subject.key) continue;
    const shared = candidate.tags
      .map((tag) => tag.toLowerCase())
      .find((tag) => subjectTags.has(tag));
    if (!shared) continue;
    found.push({ record: candidate, via: 'tag', bridge: shared, isSubject: false });
  }
  return found;
}

/**
 * Scores a relevance candidate for ranking.
 *
 * Co-occurrence outranks tags by a wide margin, and evidence count breaks ties
 * inside each group. Depth only orders within an equal score, which is the most it
 * can honestly do.
 */
function rank(item: RelevantRecord, score: { via: 'co-occurrence' | 'tag'; evidence: number }): number {
  const base = score.via === 'co-occurrence' ? 1000 : 0;
  return base + score.evidence * 10 + depthWeight(item.record);
}

/**
 * Finds the real, evidenced records closest to `subject`.
 *
 * Returns an empty array when nothing is adjacent, which is a legitimate outcome
 * and the caller must handle: "there is nothing related here either" is honest,
 * and padding it with the portfolio's most impressive unrelated records would be
 * the exact flattery this whole project exists to avoid.
 */
export function relevantTo(subject: KnowledgeRecord, knowledge: PortfolioKnowledge): RelevantRecord[] {
  const coOccurred = byCoOccurrence(subject, knowledge);
  const tagged = byTag(subject, knowledge);

  const scored = [
    ...coOccurred.map((item) => ({ item, score: { via: 'co-occurrence' as const, evidence: item.record.evidence.length } })),
    ...tagged.map((item) => ({ item, score: { via: 'tag' as const, evidence: item.record.evidence.length } })),
  ];

  const byKey = new Map<string, { item: RelevantRecord; score: number }>();
  for (const entry of scored) {
    const existing = byKey.get(entry.item.record.key);
    // A record reachable both ways keeps the stronger signal.
    if (existing && existing.score >= rank(entry.item, entry.score)) continue;
    byKey.set(entry.item.record.key, { item: entry.item, score: rank(entry.item, entry.score) });
  }

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score || a.item.record.name.localeCompare(b.item.record.name))
    .slice(0, LIMIT)
    .map((entry) => entry.item);
}

/**
 * Relates an unresolved subject to what the portfolio does document.
 *
 * Takes the subject as free text because it is usually absent from the content
 * entirely — "Rust" is not a record, so there is nothing to traverse from. In that
 * case the closest documented field is found by shared tags and text, and the
 * result is weaker by construction, which is why `method` is returned alongside
 * the records rather than left implicit.
 */
export function relevanceForSubject(
  subject: string,
  knowledge: PortfolioKnowledge,
): { method: 'field'; records: RelevantRecord[] } {
  const wanted = tokens(subject);
  if (wanted.size === 0) return { method: 'field', records: [] };

  // Authored field tags for this subject, when it is a known absent technology.
  const fields = new Set<string>();
  for (const key of wanted) {
    for (const field of CONCEPT_FIELDS[key] ?? []) fields.add(field.toLowerCase());
  }

  const skills = knowledge.byKind.get('skills') ?? [];
  const scored: { record: KnowledgeRecord; shared: number }[] = [];

  for (const record of skills) {
    let shared = 0;
    // An authored field tag is the strongest available connection and outranks
    // incidental lexical overlap, so it is worth more than one stray token match.
    for (const tag of record.tags) {
      if (fields.has(tag.toLowerCase())) shared += 3;
    }
    // Shared tags are the next best honest connection: both are tagged into the
    // same field, so "Rust systems programming" reaches C++ on "Systems
    // Programming" without anything asserting Rust was used.
    for (const tag of record.tags) {
      const tagTokens = tokens(tag);
      for (const wantedToken of wanted) {
        if (tagTokens.has(wantedToken)) {
          shared += 1;
          break;
        }
      }
    }
    // Plus lexical overlap on the record's own text, which is how a subject like
    // "vector database" reaches a tag it does not literally contain.
    const recordTokens = tokens(record.text);
    for (const wantedToken of wanted) {
      if (recordTokens.has(wantedToken)) shared += 1;
    }
    if (shared > 0) scored.push({ record, shared });
  }

  scored.sort(
    (a, b) =>
      b.shared - a.shared ||
      b.record.evidence.length - a.record.evidence.length ||
      depthWeight(b.record) - depthWeight(a.record) ||
      a.record.name.localeCompare(b.record.name),
  );

  const bridgeFor = (record: KnowledgeRecord): string => {
    const authored = record.tags.find((tag) => fields.has(tag.toLowerCase()));
    if (authored) return authored;
    const lexical = record.tags.find((tag) => {
      const tagTokens = tokens(tag);
      return [...wanted].some((wantedToken) => tagTokens.has(wantedToken));
    });
    return lexical ?? record.tags[0] ?? '';
  };

  return {
    method: 'field',
    records: scored.slice(0, LIMIT).map(({ record }) => ({
      record,
      via: 'tag' as const,
      bridge: bridgeFor(record),
      isSubject: false,
    })),
  };
}
