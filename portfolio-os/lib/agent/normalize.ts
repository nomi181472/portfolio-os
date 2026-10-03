/**
 * lib/agent/normalize.ts
 *
 * Free text in, structured terms out. This is the step where a question stops
 * being a string and becomes a set of claims the evidence layer can check.
 *
 * The hard part is not tokenising. It is that a question mentions things at three
 * different levels of specificity, and treating them alike is how a job matcher
 * ends up reporting 40% against a posting that asks for Kubernetes:
 *
 *   "Do you have experience with Kubernetes or EKS, and have you used Kafka?"
 *     -> kubernetes-eks     (exact concept, both aliases of one record)
 *     -> apache-kafka       (exact concept)
 *
 *   "Have you done any backend work with container orchestration?"
 *     -> container orchestration: a FAMILY, not a concept
 *
 *   "Are you comfortable with real-time systems?"
 *     -> nothing. Not a skill, not a family, not an alias.
 *
 * The third case is the important one. It must produce no term at all rather
 * than a guess, so the matcher can say "not verifiable from the portfolio"
 * instead of confidently surfacing Kafka and calling it a match. Guessing here
 * is how an evidence-bound agent becomes an unconstrained one.
 *
 * Pure, no I/O, no model. `aliases.ts` owns the vocabulary; this file only
 * applies it.
 */

import { normaliseTerm } from './text';
import { resolveTerm, type AliasTable, type TermResolution } from './aliases';
import type { EntityKind } from '@/types/portfolio';

export type RequirementLevel = 'required' | 'preferred' | 'unknown';

export type TermMatchKind = 'exact' | 'family';

export interface NormalisedTerm {
  /** The token as it appeared in the question, trimmed. */
  raw: string;
  /** `normaliseTerm` applied. */
  term: string;
  /** Records this term names. Empty for a family-only or unresolved term. */
  canonicalIds: string[];
  /** `exact` = the record names it. `family` = only a family contains it. */
  matchKind: TermMatchKind | null;
  /** Family name, when the term matched a family rather than a record. */
  family: string | null;
  /** Sibling concepts in that family. Empty unless `matchKind === 'family'`. */
  familyMembers: string[];
  /** True when the term could mean more than one concept. */
  ambiguous: boolean;
  level: RequirementLevel;
  /** Why this term is in the result, for the rationale the user can see. */
  basis: 'alias' | 'name' | 'family' | 'unresolved';
}

export interface NormalisedQuestion {
  /** The original string, untouched. */
  raw: string;
  /** `normaliseTerm(raw)`. */
  normalised: string;
  terms: NormalisedTerm[];
  /** Terms that named at least one record, deduplicated. */
  resolvedIds: string[];
  /** Terms that named nothing. Not an error — a reason to be careful. */
  unresolvedTerms: string[];
  /** Terms whose meaning is genuinely plural. Reported, never silently picked. */
  ambiguousTerms: string[];
}

/**
 * Words that carry no retrieval signal in a question about a person's work.
 *
 * Not a stopword list from linguistics: these are the words that made up career
 * questions, removed because they match skill records by accident. "lead" and
 * "head" are here because a question about leading a team would otherwise match
 * the Leadership skill record on the verb alone.
 */
const STOP_TERMS: ReadonlySet<string> = new Set([
  'a', 'about', 'above', 'after', 'again', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'done', 'during',
  'each', 'ever', 'every', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'know', 'like', 'me', 'more', 'most', 'much', 'my',
  'no', 'nor', 'not', 'now',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'own',
  'really', 'role', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'us', 'use', 'used', 'using',
  'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will',
  'with', 'would',
  'you', 'your', 'yours',
  'years', 'year', 'month', 'months', 'week', 'weeks', 'day', 'days',
  'work', 'worked', 'working', 'works', 'experience', 'experienced', 'expertise', 'knowledge',
  'familiar', 'comfortable', 'good', 'strong', 'solid', 'deep', 'extensive', 'expert', 'level',
  'anything', 'something', 'someone', 'thing', 'things', 'lot', 'lots',
  'tell', 'me', 'about', 'please', 'hi', 'hello', 'hey', 'thanks', 'thank',
  'have', 'has', 'had',
  // Every word that appears in a requirement marker. These are how a level is
  // expressed, never something the reader asked about: without this, "AWS is
  // required, Azure preferred" reports "required" and "preferred" as technologies
  // the portfolio does not have.
  'required', 'require', 'requires', 'must', 'essential', 'mandatory', 'minimum',
  'prefer', 'preferred', 'nice', 'bonus', 'ideally', 'ideal', 'exposure',
  'familiarity', 'optional', 'desirable', 'advantageous', 'proficient',
  'looking', 'need', 'needs', 'want', 'wants', 'looking for', 'least',
  // Verbs that survive the other filters and are not technologies.
  'built', 'build', 'builds', 'did', 'doing', 'done', 'got', 'get', 'made', 'make',
  'seen', 'see', 'saw', 'want', 'wanted', 'need', 'needs',
]);

/**
 * Phrases that mark the rest of the clause as a requirement.
 *
 * These are matched against the raw text *before* tokenising, because "must
 * have" and "have" are the same tokens and only position distinguishes them.
 */
const REQUIRED_MARKERS = [
  'must have', 'must-have', 'requires', 'required', 'require', 'essential', 'mandatory',
  'at least', 'minimum', 'strong', 'expert', 'deep', 'proficient', 'solid',
  'looking for', 'we need', 'you need', 'need you to', 'should have', 'should-have',
];

const PREFERRED_MARKERS = [
  'nice to have', 'nice-to-have', 'preferred', 'prefer', 'bonus', 'plus', 'ideally',
  'a plus', 'familiarity', 'exposure', 'some experience', 'a little', 'optional',
  'desirable', 'advantageous', 'good to have', 'great to have',
];

/** Negations. A negated term is dropped, not inverted. */
const NEGATION_MARKERS = ['no ', 'not ', 'without ', 'never ', 'none of', "haven't", "hasn't", "don't", 'lacks', 'lack of', 'absent'];

/**
 * Splits a question into candidate terms.
 *
 * Three constraints, each of which was a bug before it was a comment:
 *
 * 1. **Multi-word terms survive.** "computer vision" must reach the resolver as
 *    one token. Splitting it gives "computer" and "vision", and "vision" alone
 *    matches nothing while being a real thing the portfolio has.
 *
 * 2. **Technology names are not split at their punctuation.** `C++`, `.NET`,
 *    `C#` and `Node.js` are one term each. The earlier version inserted a space
 *    before every `.`/`+`/`#` to protect them from the split — which protected
 *    nothing and destroyed all of them, turning `C++` into `C+ +` and `.NET`
 *    into ` .NET`. Nothing needs protecting: `normaliseTerm` already keeps these
 *    characters, and words are only ever split on whitespace.
 *
 * 3. **Windows never cross a clause boundary.** Otherwise "Do you have experience
 *    with Kubernetes or EKS, and have you used Kafka" produces windows like
 *    "EKS and have you used", which are not phrases anyone wrote. Clauses are cut
 *    first, then windows are taken inside each.
 */
export function tokenize(text: string): string[] {
  const terms: string[] = [];

  // A `.` only ends a clause when whitespace follows it. Splitting on every dot
  // turns `Node.js` into the two unresolved terms "Node" and "js", and `js`
  // resolves to nothing while "Node" resolves to the wrong record.
  for (const clause of text.split(/(?:[,;:!?()\[\]]+|\.(?=\s|$))+/)) {
    const words = clause.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    // Longest window first so the resolver sees "event driven architecture"
    // before the fragments inside it, and the caller can drop the fragments.
    for (let start = 0; start < words.length; start += 1) {
      for (let span = 3; span >= 1; span -= 1) {
        const slice = words.slice(start, start + span);
        if (slice.length === 0) continue;
        // Trailing stopwords mean the window is not a noun phrase: "experience
        // with", "nice to have", "have you used" are all fragments of a
        // sentence rather than terms.
        const normalisedWords = slice.map((word) => normaliseTerm(word));
        const window = slice.join(' ').trim();
        if (window.length < 2) continue;

        // Boundaries only. A window that starts or ends on a stopword is a
        // fragment of the sentence — "experience with message", "with message
        // brokers" — and emitting those turned one question into six
        // requirements for the same thing.
        //
        // Interior stopwords are allowed, because some of them are part of a
        // technology's name: "deep learning frameworks" is a family, and
        // rejecting any window containing "deep" would lose it. Rejecting on
        // interior stopwords alone also could not be right, for the same reason.
        const firstWord = normalisedWords[0] ?? '';
        const lastWord = normalisedWords[normalisedWords.length - 1] ?? '';
        if (STOP_TERMS.has(firstWord) || STOP_TERMS.has(lastWord)) continue;
        if (normalisedWords.some((word) => word === '')) continue;

        terms.push(window);
      }
    }
  }

  return terms;
}

/**
 * True when a candidate is worth reporting as unresolved.
 *
 * A window containing a stopword is a fragment of the question, not a thing the
 * reader asked about. Reporting those turns "I could not verify" into a wall of
 * nonsense like `["Do you have experience", "you have experience with"]`, which
 * is worse than saying nothing, because it looks like the agent tried thirty
 * things and failed at all of them.
 */
function isReportable(candidate: string): boolean {
  const words = normaliseTerm(candidate).split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  return words.every((word) => !STOP_TERMS.has(word));
}

/**
 * Which requirement level applies to a term.
/**
 * A clause is the unit that requirement markers are scoped to.
 *
 * "AWS is required, Azure preferred" has to give two different answers, and the
 * only signal is which clause each term sits in. Markers are therefore read from
 * inside the clause, never across the boundary — otherwise "required" in the
 * first clause leaks into the preference in the second and every term in the
 * sentence comes back required.
 */
function clauseAt(text: string, index: number): { start: number; end: number } {
  const boundaries = /(?:[,;:!?()]|\.(?=\s|$))/g;
  let start = 0;
  let end = text.length;
  boundaries.lastIndex = 0;
  for (let match = boundaries.exec(text); match !== null; match = boundaries.exec(text)) {
    if (match.index < index) start = match.index + 1;
    if (match.index > index && end === text.length) end = match.index;
  }
  // A connective starts a new clause too: "Kubernetes required and Kafka nice to
  // have" is two requirements, not one.
  const connective = /(?:\band\b|\bbut\b|\bor\b|\balso\b|\bplus\b|\bhowever\b)/gi;
  connective.lastIndex = 0;
  for (let match = connective.exec(text); match !== null; match = connective.exec(text)) {
    if (match.index < index && match.index > start) start = match.index + match[0].length;
    if (match.index > index && match.index < end) end = match.index;
  }
  return { start, end };
}

const ALL_MARKERS = { required: REQUIRED_MARKERS, preferred: PREFERRED_MARKERS } as const;

/**
 * Which requirement level applies to a term.
 *
 * Scoped to the term's clause, and decided by the *nearest* marker on either
 * side of it within that clause — so a postfix marker works ("AWS is required")
 * and a prefix one works ("required: Kubernetes"), and neither leaks across a
 * clause boundary.
 */
function levelFor(text: string, termIndex: number): RequirementLevel {
  const { start, end } = clauseAt(text, termIndex);
  const before = text.slice(start, termIndex).toLowerCase();
  const after = text.slice(termIndex, end).toLowerCase();

  if (NEGATION_MARKERS.some((marker) => before.includes(marker) || after.includes(marker))) {
    return 'unknown';
  }

  const distanceTo = (markers: readonly string[]): number | null => {
    let best: number | null = null;
    for (const marker of markers) {
      const fromEnd = before.lastIndexOf(marker);
      if (fromEnd !== -1) {
        const distance = termIndex - (start + fromEnd);
        if (best === null || distance < best) best = distance;
      }
      const toStart = after.indexOf(marker);
      if (toStart !== -1 && (best === null || toStart < best)) best = toStart;
    }
    return best;
  };

  const requiredAt = distanceTo(ALL_MARKERS.required);
  const preferredAt = distanceTo(ALL_MARKERS.preferred);

  if (requiredAt === null && preferredAt === null) return 'unknown';
  // Equal distance is a tie, which in practice means both markers are in the same
  // phrase ("strongly preferred"). Required wins the tie because a job posting
  // that says both is describing a hard requirement.
  if (requiredAt !== null && (preferredAt === null || requiredAt <= preferredAt)) return 'required';
  return 'preferred';
}

/** True when the term sits under a negation inside its own clause. */
function isNegated(text: string, termIndex: number): boolean {
  const { start } = clauseAt(text, termIndex);
  const before = text.slice(start, termIndex).toLowerCase();
  return NEGATION_MARKERS.some((marker) => before.includes(marker));
}

/**
 * Turns a free-text question into terms with evidence-bearing resolutions.
 *
 * The window-based tokenizer produces many overlapping candidates, so this does
 * the deduplication that makes the result usable: the longest window that
 * resolves wins, and the windows it subsumes are dropped. Without that, "event
 * driven architecture" would also be reported as "event" and "driven", which is
 * how a family-level answer turns into three unrelated exact matches.
 */
export function normaliseQuestion(raw: string, table: AliasTable): NormalisedQuestion {
  const text = raw.trim();
  const normalised = normaliseTerm(text);
  const candidates = tokenize(text);

  const seen = new Set<string>();
  const terms: NormalisedTerm[] = [];
  const resolvedIds: string[] = [];
  const unresolvedTerms: string[] = [];

  // Longest candidates first, so a phrase is considered before the words in it.
  const ordered = [...candidates].sort((a, b) => b.length - a.length);

  for (const candidate of ordered) {
    const term = normaliseTerm(candidate);
    if (term.length < 2) continue;
    if (seen.has(term)) continue;
    if (STOP_TERMS.has(term)) continue;

    // Where the term actually starts in the raw text, so level and negation are
    // read from the sentence rather than guessed from the token.
    const index = text.toLowerCase().indexOf(candidate.toLowerCase());
    if (index === -1) continue;

    if (isNegated(text, index)) {
      // A negated requirement is not a requirement. It is also not a claim of
      // absence, so it is dropped rather than recorded as a negative result.
      seen.add(term);
      continue;
    }

    let resolution: TermResolution = resolveTerm(table, candidate);
    let label = term;

    // Drop a leading qualifier, but only if what remains still names something.
    // If the remainder resolves to nothing, the qualifier was the concept and the
    // original phrase stands — better a clumsier label than a wrong one.
    const words = term.split(' ').filter(Boolean);
    while (words.length > 1) {
      const first = words[0] ?? '';
      const last = words[words.length - 1] ?? '';
      const remainder = QUALIFIER_PREFIXES.has(first)
        ? words.slice(1)
        : QUALIFIER_SUFFIXES.has(last)
          ? words.slice(0, -1)
          : null;
      if (!remainder) break;

      const joined = remainder.join(' ');
      const trimmed = resolveTerm(table, joined);
      if (trimmed.canonicalIds.length === 0 && !trimmed.family) break;

      resolution = trimmed;
      label = joined;
      words.splice(0, words.length, ...remainder);
    }

    const level = levelFor(text, index);
    seen.add(term);

    if (resolution.canonicalIds.length > 0) {
      const ambiguous = resolution.ambiguous;
      for (const id of resolution.canonicalIds) {
        if (!resolvedIds.includes(id)) resolvedIds.push(id);
      }
      terms.push({
        raw: candidate,
        term: label,
        canonicalIds: [...resolution.canonicalIds],
        matchKind: 'exact',
        family: resolution.family,
        familyMembers: [],
        ambiguous,
        level,
        basis: ambiguous ? 'name' : 'alias',
      });
      continue;
    }

    if (resolution.family) {
      terms.push({
        raw: candidate,
        term,
        canonicalIds: [],
        matchKind: 'family',
        family: resolution.family,
        familyMembers: [...resolution.familyMembers],
        ambiguous: false,
        level,
        basis: 'family',
      });
      continue;
    }

    // Not resolvable. Kept, because "I could not verify this" is an answer the
    // matcher owes the user rather than something to hide — but only when the
    // candidate is a real noun phrase rather than a fragment of the question.
    if (isReportable(candidate)) unresolvedTerms.push(candidate);
  }

  // Compound suppression.
  //
  // 1. A resolved phrase wins over the words inside it, so "event driven
  //    architecture" does not also report "driven", "architecture" and "event".
  // 2. An *unresolved* compound wins over its parts too, and this is the one
  //    that matters. "Are you comfortable with real-time systems" has no record
  //    for the compound; if the halves are allowed through it answers with FFmpeg
  //    and Distributed Systems — two confident, specific, wrong records for a
  //    vague question. The reader asked about one compound idea, and the honest
  //    answer is that the portfolio does not name it.
  //
  const clean = (phrase: string): boolean => {
    const words = phrase.split(' ').filter(Boolean);
    if (words.length < 2) return false;
    if (words.some((word) => STOP_TERMS.has(word))) return false;
    const first = words[0] ?? '';
    if (VERB_STARTS.has(first)) return false;
    // A gerund that is not in the list above. "learning" is a technology-ish
    // word in an education context; "onboarding" is not a concept anyone asks
    // about. Checking the shape catches the ones the list will miss.
    if (first.length > 5 && first.endsWith('ing') && !words.slice(1).some((w) => w.length > 5)) return false;
    return true;
  };

  // Family terms suppress their fragments too. "message brokers" is a concept,
  // and without this "message" and "brokers" survive beside it as requirements
  // of their own — three answers to one question, all naming the same family.
  const resolvedPhrases = terms
    .filter((t) => t.matchKind === 'exact' || t.matchKind === 'family')
    .map((t) => t.term)
    .filter(clean);
  const compoundPhrases = [...resolvedPhrases, ...unresolvedTerms.map(normaliseTerm).filter(clean)].sort(
    (a, b) => b.length - a.length,
  );

  /** True when every word of `term` also appears in a longer clean phrase. */
  const subsumed = (term: string): boolean =>
    compoundPhrases.some((phrase) => {
      if (phrase === term) return false;
      const phraseWords = phrase.split(' ');
      if (phraseWords.length <= term.split(' ').length) return false;
      return term.split(' ').every((word) => phraseWords.includes(word));
    });

  /**
   * Two candidates can name the same thing — "orchestration" and "container
   * orchestration" both mean Kubernetes. Reporting both makes the reader think
   * they asked two questions. Keeps the one with the fewest stopwords, so
   * "Kubernetes" beats "experience with Kubernetes", and the longest among those,
   * so the most specific phrasing of the same concept wins.
   */
  const dedupeExact = (list: NormalisedTerm[]): NormalisedTerm[] => {
    const best = new Map<string, NormalisedTerm>();
    for (const term of list) {
      if (term.matchKind !== 'exact') continue;
      const signature = [...term.canonicalIds].sort().join('|');
      const current = best.get(signature);
      if (!current) {
        best.set(signature, term);
        continue;
      }
      const stopwords = (value: string): number =>
        value.split(' ').filter((word) => STOP_TERMS.has(word)).length;
      const challenger = stopwords(term.term);
      const incumbent = stopwords(current.term);
      if (challenger < incumbent || (challenger === incumbent && term.term.length > current.term.length)) {
        best.set(signature, term);
      }
    }
    return list.filter((term) => term.matchKind !== 'exact' || best.get([...term.canonicalIds].sort().join('|')) === term);
  };

  // Fragments are removed whether the compound that claimed them resolved to a
  // record or only to a family. Restricting this to `exact` let "message" and
  // "brokers" sit beside "message brokers", so one question produced three
  // requirements that all named the same family.
  const kept = dedupeExact(
    terms.filter((t) => !(t.matchKind !== null && subsumed(t.term))),
  );

  // Ambiguity is reported from the terms that survived, not from every term
  // considered. Otherwise a question about "event driven architecture" reports
  // "event" and "architecture" as ambiguous after both were suppressed as
  // fragments — ambiguity the reader can do nothing with.
  const ambiguousTerms = kept.filter((t) => t.ambiguous).map((t) => t.raw);

  return {
    raw: text,
    normalised,
    terms: kept.sort((a, b) => b.term.length - a.term.length),
    resolvedIds,
    unresolvedTerms: [...new Set(unresolvedTerms)].filter((term) => !subsumed(normaliseTerm(term))),
    ambiguousTerms: [...new Set(ambiguousTerms)],
  };
}

/** Convenience: the records a question names, in question order. */
export function termsToIds(question: NormalisedQuestion): string[] {
  return question.resolvedIds;
}

/** The kinds a question touched, for deciding which collection to search. */
export function kindsFor(terms: NormalisedTerm[]): EntityKind[] {
  const kinds = new Set<EntityKind>();
  for (const term of terms) {
    for (const member of [...term.canonicalIds, ...term.familyMembers]) {
      const kind = member.split(':')[0];
      if (kind) kinds.add(kind as EntityKind);
    }
  }
  return [...kinds];
}

  // Only *clean* phrases suppress. Two ways a window fails to be a concept:
//
//  - it contains a stopword, so it is a fragment of the sentence
//    ("experience with Kubernetes" must not erase "Kubernetes"); and
//  - it begins with a verb, so it is a phrase describing work rather than a
//    thing ("building distributed systems" must not erase "Distributed
//    Systems", or a posting's requirement bullets each score as an unrelated
//    unverifiable technology and the real concept is scored twice).
const VERB_STARTS: ReadonlySet<string> = new Set([
  'build', 'building', 'design', 'designing', 'operate', 'operating', 'work', 'working',
  'ship', 'shipping', 'use', 'using', 'write', 'writing', 'create', 'creating',
  'develop', 'developing', 'manage', 'managing', 'lead', 'leading', 'run', 'running',
  'drive', 'driving', 'own', 'owning', 'deliver', 'delivering', 'maintain', 'maintaining',
  'optimise', 'optimizing', 'optimize', 'ensure', 'ensuring', 'support', 'supporting',
  'collaborate', 'implement', 'implementing', 'deploy', 'deploying', 'monitor', 'monitoring',
  'analyse', 'analyze', 'research', 'mentor', 'mentoring', 'train', 'review', 'reviewing',
  'expose', 'exposing', 'integrate', 'integrating', 'configure', 'configuring',
]);

/**
 * Words that qualify a requirement without naming a different one.
 *
 * "5+ years of production Kubernetes" is a requirement for Kubernetes. The word
 * "production" describes the engagement, not the technology, and leaving it on
 * produces a requirement labelled "production kubernetes" that a reader cannot
 * match against anything in their own job description.
 *
 * Deliberately short and deliberately excludes "real". "real-time systems" is a
 * concept the portfolio does not document, and stripping "real" would turn an
 * honest "not documented" into a confident answer about "time systems" — which is
 * the TimescaleDB-shaped mistake this whole module exists to prevent.
 */
const QUALIFIER_PREFIXES: ReadonlySet<string> = new Set([
  'production', 'strong', 'solid', 'hands-on', 'hands', 'expert', 'expertise',
  'senior', 'junior', 'advanced', 'modern', 'professional', 'proficient',
  'extensive', 'in-depth', 'deep', 'proven', 'scalable', 'secure', 'reliable',
  'enterprise', 'excellent', 'working', 'practical', 'relevant', 'good',
]);

/**
 * The same idea at the other end: "Python coding skills" is a requirement for
 * Python. None of these name a technology, so none can be the thing the reader
 * meant — but only once what remains has been shown to resolve, because "systems",
 * "services" and "design" do name concepts and stripping them would answer a
 * different question.
 */
const QUALIFIER_SUFFIXES: ReadonlySet<string> = new Set([
  'skills', 'skill', 'coding', 'code', 'experience', 'experiences', 'knowledge',
  'development', 'technologies', 'technology', 'tools', 'programming', 'tooling',
]);

/**
 * True when `needle` appears in `haystack` as a whole sequence of words.
 *
 * Used to drop a shorter, overlapping reading of something already kept, so
 * "real time systems" is not reported twice as itself and as "systems".
 */
function containsPhrase(haystack: string, needle: string): boolean {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escape(needle.toLowerCase())}(?:[^a-z0-9]|$)`, 'i').test(haystack.toLowerCase());
}

/* ---------------------------------------------------------------- postings */

/**
 * Requirements read out of a pasted job description, line by line.
 *
 * Doing this by normalising the whole posting at once is wrong in a way that
 * quietly corrupts the score. Each bullet is a sentence, and normalising a
 * sentence produces overlapping windows — "Experience with microservices
 * architecture" yields `microservices architecture` *and* `Microservices` — so
 * one requirement in the posting becomes two scored requirements. The
 * denominator grows, the same concept is counted twice, and the reader is shown
 * a bullet twice.
 *
 * So each line is normalised on its own, and each line contributes at most one
 * requirement per distinct concept it names.
 *
 * Lines that resolve to nothing still count, at zero. "Familiarity with Rust" is
 * a real requirement the portfolio does not document, and dropping it would be the
 * single easiest way to make this tool flatter a candidate. A one-word line
 * counts only if it looks like a proper noun or a technology name, because
 * "Design and ship" is not a requirement and `ship` is not a technology.
 */
export function normalisePosting(
  requirements: string,
  preferred: string,
  table: AliasTable,
): NormalisedTerm[] {
  const seenConcepts = new Map<string, NormalisedTerm>();
  const order: string[] = [];

  const read = (text: string, level: RequirementLevel): void => {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line
        // Bullet characters, list markers and leading emphasis.
        .replace(/^\s*(?:[-*•·—–]|\d+[.)])\s*/, '')
        .replace(/^[*_`]+|[*_`]+$/g, '')
        .trim();
      if (trimmed.length < 2) continue;

      const question = normaliseQuestion(trimmed, table);
      const resolved = question.terms.filter((term) => term.matchKind === 'exact' || term.matchKind === 'family');

      if (resolved.length > 0) {
        for (const term of resolved) {
          // A single word that is a verb names work, not a technology. "Design
          // and ship event-driven services" must contribute Kubernetes and AWS,
          // not a requirement called "design". A *phrase* that begins with a verb
          // is left alone, because that is a concept: "building distributed
          // systems" resolves to Distributed Systems and is exactly the
          // requirement the bullet was asking about.
          if (term.raw.split(' ').length === 1 && VERB_STARTS.has(term.raw)) continue;

          // One term per concept, not one per resolved id. "AWS" legitimately
          // reaches five skills, and emitting a requirement per id would list it
          // five times, inflating both the denominator and the caveat.
          const ids = term.canonicalIds.length > 0 ? term.canonicalIds : term.familyMembers;
          const key = ids.length === 1 ? (ids[0] as string) : `multi:${term.raw.toLowerCase()}`;

          const existing = seenConcepts.get(key);
          // A required mention subsumes a preferred one. The posting asked for it
          // outright, so scoring it at the preferred weight would understate the
          // gap if it is missing.
          if (!existing) {
            seenConcepts.set(key, { ...term, level });
            order.push(key);
          } else if (existing.level !== 'required' && level === 'required') {
            seenConcepts.set(key, { ...existing, level });
          }
        }
        continue;
      }

      // Nothing in the line resolved. Every concept the line names still counts,
      // at zero. Keeping only the longest one silently dropped the other half of
      // "Rust or Elixir" — the same flattering failure as dropping the line, and
      // the reason an undocumented requirement has to be reported by name.
      const considered = [
        ...question.unresolvedTerms,
        ...question.terms.filter((term) => term.raw.length >= 4).map((term) => term.raw),
      ];

      // Longest first, so the most specific reading of an overlap is the one that
      // survives: "real time systems" is a requirement, and reporting "systems"
      // beside it would be noise.
      const kept: string[] = [];
      for (const candidate of considered.sort((a, b) => b.length - a.length)) {
        const token = candidate.trim();
        // The tokenizer leaves debris that names nothing: "a plus" leaves "plus",
        // "5+ years of Rust" leaves "5+". Neither is a requirement, and calling
        // one a gap in the portfolio would be a different kind of lie.
        if (!/[a-z]{3}/i.test(token)) continue;
        const looksLikeATechnology = /[+#.]/.test(token) || /^[A-Z0-9]/.test(token) || token.includes(' ');
        if (!looksLikeATechnology) continue;
        // Word-sequence containment, not substring: "Go" is inside "MongoDB",
        // and dropping Go because some other line mentioned a database that
        // happens to contain those two letters would be its own small wrongness.
        if (kept.some((other) => containsPhrase(other, token))) continue;
        kept.push(token);
      }

      for (const token of kept) {
        const key = `unresolved:${token.toLowerCase()}`;
        if (seenConcepts.has(key)) continue;
        seenConcepts.set(key, {
          raw: token,
          term: normaliseTerm(token),
          canonicalIds: [],
          matchKind: null,
          family: null,
          familyMembers: [],
          ambiguous: false,
          level,
          basis: 'unresolved',
        });
        order.push(key);
      }
    }
  };

  // Required is read first so that a preferred mention cannot overwrite it.
  read(requirements, 'required');
  read(preferred, 'preferred');

  return order
    .map((key) => seenConcepts.get(key))
    .filter((term): term is NormalisedTerm => term !== undefined);
}
