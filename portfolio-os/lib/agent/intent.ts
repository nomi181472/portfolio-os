/**
 * lib/agent/intent.ts
 *
 * Which of the seven questions is being asked.
 *
 * Routed by rule, not by model, and that is the whole point: the same input must
 * produce the same intent on every device, with no weights downloaded, and the
 * routing decision must be explainable. "Why did it answer that?" has to have an
 * answer that is a sentence about pattern matches, not a logit.
 *
 * Order matters. A question that matches two patterns is assigned the more
 * specific one, and the order below is the specificity order — a job description
 * is recognised as a job description before it is noticed to be a pile of
 * technologies.
 *
 * The router returns a confidence and the patterns that fired, so the caller can
 * see the reasoning and so a low-confidence route can be answered with a
 * clarifying question instead of a wrong confident answer.
 */

import type { NormalisedQuestion } from './normalize';

export type Intent =
  | 'job-match'
  | 'skill-check'
  | 'experience-depth'
  | 'project-explore'
  | 'availability'
  | 'compare'
  | 'general';

export interface IntentRoute {
  intent: Intent;
  /** 0–1. Rule-derived, so it is a count of matched signals over their weights. */
  confidence: number;
  /** The patterns that fired, in match order. Shown to the user when it matters. */
  signals: string[];
  /** True when nothing scored above the floor. */
  uncertain: boolean;
}

interface Rule {
  intent: Intent;
  /** How much this pattern is worth. Higher means more specific. */
  weight: number;
  test: (question: NormalisedQuestion, text: string) => boolean;
  signal: string;
}

/**
 * A posting, not a question.
 *
 * Detected by shape rather than by keyword: a job description has a role title,
 * a company, and a responsibilities list. That is why this is checked first — a
 * pasted posting contains "required" and "nice to have" and would otherwise
 * scatter across three skill checks and produce three confident partial answers
 * instead of one match report.
 */
const JOB_DESCRIPTION_SHAPE: RegExp[] = [
  /\b(?:job description|role description|job posting|job ad|position description)\b/i,
  /\b(?:we are|we're) (?:looking|hiring|searching)\b/i,
  /\b(?:responsibilities|what you(?:'ll| will) do|what you(?:'ll| will) own|about the role|about the job)\b/i,
  /\b(?:requirements|what we(?:'re| are) looking for|what we need from you|qualifications|skills (?:and|&) experience)\b/i,
  /\b(?:apply|application|how to apply|interested in)\b/i,
  /\b(?:nice to have|preferred qualifications|bonus points)\b/i,
];

const RULES: Rule[] = [
  {
    intent: 'job-match',
    weight: 3,
    signal: 'reads as a job description',
    test: (_q, text) => JOB_DESCRIPTION_SHAPE.some((pattern) => pattern.test(text)),
  },
  {
    intent: 'job-match',
    weight: 2,
    signal: 'asks about fit for a role',
    test: (_q, text) =>
      /\b(?:am i a (?:good |strong )?fit|would i (?:be )?(?:a )?(?:good |strong )?fit|do i (?:match|qualify)|is this a good match)\b/i.test(
        text,
      ) ||
      /\b(?:match|fit) (?:for|against|with) (?:this|the|my) (?:job|role|posting|description)\b/i.test(text),
  },
  {
    intent: 'availability',
    weight: 3,
    signal: 'asks about availability',
    test: (_q, text) =>
      /\b(?:are you (?:currently )?(?:open|looking|available)|open to work|looking for (?:work|opportunit|new role)|are you hiring|available for (?:work|new))\b/i.test(
        text,
      ),
  },
  {
    intent: 'availability',
    weight: 1,
    signal: 'mentions hiring or availability at all',
    test: (_q, text) => /\b(?:hiring|availability|open to (?:work|opportunities)|notice period)\b/i.test(text),
  },
  {
    intent: 'compare',
    weight: 3,
    signal: 'asks to compare two things',
    test: (question, text) =>
      /\b(?:versus|vs\.?|compared to|compare|difference between|better than|or)\b/i.test(text) &&
      (question.resolvedIds.length >= 2 || question.terms.length >= 2),
  },
  {
    intent: 'experience-depth',
    weight: 3,
    signal: 'asks how deep or how long',
    // Interrogative framing only. An earlier version also matched a bare
    // "years of experience", which appears in nearly every job posting — so a
    // pasted description outscored job-match 4 to 3 and was routed as a question
    // about depth rather than as a posting.
    test: (_q, text) =>
      /\b(?:how (?:long|many years|deep|much experience|experienced are you)|how long have you|depth of|expert (?:level )?in)\b/i.test(
        text,
      ),
  },
  {
    intent: 'project-explore',
    weight: 3,
    signal: 'asks about a project or a built thing',
    test: (_q, text) =>
      /\b(?:what have you built|show me|tell me about|walk me through|describe|projects? (?:have|has) you|what did you (?:build|create|make))\b/i.test(
        text,
      ) && /\b(?:project|built|build|created|worked on)\b/i.test(text),
  },
  {
    intent: 'skill-check',
    weight: 2,
    signal: 'names a documented concept',
    test: (question) => question.resolvedIds.length > 0,
  },
  {
    intent: 'skill-check',
    weight: 1,
    signal: 'asks whether a skill is present',
    test: (_q, text) =>
      /\b(?:do you (?:have|know|use)|have you (?:used|worked)|are you (?:familiar|experienced)|can you|does he|is he)\b/i.test(
        text,
      ),
  },
];

/**
 * Below this, the router says so.
 *
 * The alternative is to always pick the best rule and answer confidently, which
 * is how "what is Noman like" ends up answered with a list of technologies. An
 * uncertain route is an invitation to ask what the reader meant, and that is a
 * better answer than a confident misread.
 */
const CONFIDENCE_FLOOR = 0.34;

export function routeIntent(question: NormalisedQuestion): IntentRoute {
  const text = question.raw;
  const tally = new Map<Intent, { score: number; signals: string[] }>();

  for (const rule of RULES) {
    if (!rule.test(question, text)) continue;
    const entry = tally.get(rule.intent) ?? { score: 0, signals: [] };
    entry.score += rule.weight;
    entry.signals.push(rule.signal);
    tally.set(rule.intent, entry);
  }

  if (tally.size === 0) {
    return { intent: 'general', confidence: 0, signals: [], uncertain: true };
  }

  // Highest score wins. Ties break toward the earlier rule, which is the more
  // specific one, because RULES is ordered by specificity.
  let best: IntentRoute = { intent: 'general', confidence: 0, signals: [], uncertain: true };
  let bestScore = 0;
  let total = 0;

  for (const [intent, entry] of tally) {
    total += entry.score;
    if (entry.score > bestScore) {
      bestScore = entry.score;
      best = {
        intent,
        confidence: 0,
        signals: entry.signals,
        uncertain: false,
      };
    }
  }

  // Confidence is this intent's share of all the evidence that fired, not a raw
  // weight sum. A question that trips one rule scores 1; one that reads equally
  // as three things scores 0.33 and is reported as uncertain, which is the
  // honest reading of a tie.
  const confidence = total === 0 ? 0 : bestScore / total;

  return { ...best, confidence, uncertain: confidence < CONFIDENCE_FLOOR };
}

/**
 * A line that is nothing but a section header.
 *
 * Anchored to the whole line on purpose. "Requirements" appears in ordinary
 * questions — "what are the requirements for a data engineer?" — and that line is
 * not a posting, so the header has to be the entire line, with nothing after it.
 */
const POSTING_SECTION_HEADER =
  /^(?:key )?(?:responsibilities|what you(?:'ll| will) do|what you(?:'ll| will) own|about the (?:role|job)|requirements?|qualifications|what we need from you|must haves?|essential requirements|nice to haves?|preferred qualifications|bonus points?|good to haves?)\s*:?\s*$/i;

/** True when the input is a posting rather than a question. */
export function looksLikeJobDescription(text: string): boolean {
  const hits = JOB_DESCRIPTION_SHAPE.filter((pattern) => pattern.test(text)).length;
  // Two independent signals. A single phrase like "apply" appears in plenty of
  // ordinary questions and on its own is not a posting.
  //
  // A bare section header is a third, structural one — and counting it separately
  // matters more than it looks. Without it, a short and neatly formatted posting
  // ("Senior Platform Engineer" + a "Requirements:" list) trips only the
  // requirements phrase, misses the threshold, and gets answered by the
  // single-question path. That path resolves terms and drops the ones it cannot
  // resolve, so an undocumented requirement disappears and the score quietly goes
  // up. The failure is invisible and it flatters the candidate, which is the one
  // direction this tool must never fail in.
  const hasSectionHeader = text.split(/\r?\n/).some((line) => POSTING_SECTION_HEADER.test(line.trim()));
  return hits >= 2 || hasSectionHeader;
}

/**
 * Splits a pasted posting into the parts the matcher needs.
 *
 * Best-effort and deliberately partial: a posting that cannot be sectioned falls
 * back to treating the whole thing as requirement text, which produces a noisier
 * but still evidence-bound answer. Failing loudly on a formatting difference
 * would be worse than a slightly worse answer.
 */
export function splitPosting(text: string): { requirements: string; preferred: string; role: string | null } {
  const lines = text.split(/\r?\n/);
  let current: 'role' | 'requirements' | 'preferred' = 'role';
  const role: string[] = [];
  const requirements: string[] = [];
  const preferred: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    if (/^(?:key )?responsibilities|what you(?:'ll| will) do|about the role\b/i.test(trimmed)) {
      current = 'requirements';
      continue;
    }
    if (/^(?:requirements?|qualifications|must haves?|essential)\b/i.test(trimmed)) {
      current = 'requirements';
      continue;
    }
    if (/^(?:nice to haves?|preferred|bonus|desirable|good to have)\b/i.test(trimmed)) {
      current = 'preferred';
      continue;
    }

    if (current === 'role') role.push(trimmed);
    else if (current === 'requirements') requirements.push(trimmed);
    else preferred.push(trimmed);
  }

  return {
    requirements: requirements.join('\n'),
    preferred: preferred.join('\n'),
    role: role[0] ?? null,
  };
}

/** Exported so the router test can assert the specificity ordering. */
export const ROUTER_RULES = RULES.map((rule) => ({
  intent: rule.intent,
  weight: rule.weight,
  signal: rule.signal,
}));
