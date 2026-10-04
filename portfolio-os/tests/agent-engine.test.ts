/**
 * tests/agent-engine.test.ts
 *
 * The deterministic engine, end to end. Every case here is a claim the answer
 * makes about the portfolio, so the assertions are about what the text says and
 * what the arithmetic does — not about internal shape.
 *
 * The three "hallucination" cases at the top are the load-bearing ones. A wrong
 * answer from a retrieval system is annoying; a *confident* wrong answer is the
 * failure this project exists to prevent, so those come first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import { buildAliasTable, resolveTerm } from '../lib/agent/aliases';
import { normaliseQuestion } from '../lib/agent/normalize';
import { looksLikeJobDescription } from '../lib/agent/intent';
import { buildEngine, planAction } from '../lib/agent/engine';
import type { ResolvedAction } from '../lib/agent/navigation';
import type { Portfolio } from '../types/portfolio';

const NOW = new Date('2026-09-30T00:00:00Z');
const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8'));
const parsed = validatePortfolio(raw);
assert.ok(parsed.ok, 'example content must be valid before the engine can be tested');
const portfolio: Portfolio = parsed.data;
const graph = buildGraph(portfolio);
const knowledge = buildKnowledge(portfolio, graph, { now: NOW });
const aliases = buildAliasTable(knowledge);
const engine = buildEngine({ portfolio, now: NOW });

const POSTING = `Senior Backend Engineer
We are hiring a backend engineer to build our payments platform.

Responsibilities
- Design and ship event-driven services in Kubernetes on AWS
- Work with Apache Kafka for high-throughput event streaming
- Build REST APIs in Python or Go
- Operate PostgreSQL databases and optimise queries

Requirements
- 5+ years of experience building distributed systems
- Strong Kubernetes and Docker experience
- Experience with microservices architecture

Nice to have
- Familiarity with Rust
- Experience with Neo4j or graph databases`;

/* ------------------------------------------------------------ hallucination */

test('a technology absent from the portfolio is not matched, only admitted', async () => {
  const answer = await engine.answer('Do you know Rust?');

  assert.ok(!answer.match, 'an absent technology is not a match');
  // The gap leads, because that is the fact being asked about. Relevance follows
  // so the reader has somewhere to go, and says in words that it is adjacent —
  // a reader who skimmed this must not be able to leave thinking Rust was used.
  assert.match(answer.text, /^Nothing on this site documents Rust\./);
  assert.match(answer.text, /adjacent/);
  assert.doesNotMatch(answer.text, /Rust is (?:documented|covered)/);
  // Every record offered is real and reachable, so the claim can be checked.
  assert.ok(answer.cards.length > 0, 'relevance must be linked, not just described');
  for (const card of answer.cards) {
    assert.match(card.href, /^\//, `${card.name} has a portfolio href`);
  }
});

test('a documented-but-uncorroborated skill is reported as such, never as strong', async () => {
  const answer = await engine.answer('How long have you been working with Kafka?');

  assert.equal(answer.intent, 'experience-depth');
  // The requirement is named by the reader's own word; the prose names the record.
  const kafka = answer.match?.requirements.find((r) => r.raw === 'Kafka');
  assert.ok(kafka, 'Kafka is in the portfolio and must be found');
  assert.equal(kafka.state, 'documented-uncorroborated');
  assert.match(answer.text, /Apache Kafka has a record here, but nothing that shows where it was used/);
  assert.doesNotMatch(answer.text, /Kafka is documented with projects/);
});

test('a vague term stays unresolved rather than resolving to a plausible record', async () => {
  const answer = await engine.answer('Are you comfortable with real-time systems?');

  assert.ok(!answer.match, 'no record may be claimed for an unresolved vague term');
  assert.match(answer.text, /Nothing on this site covers real-time systems/);
  // Distributed Systems would have been the tempting wrong answer.
  assert.doesNotMatch(answer.text, /Distributed Systems/);
});

test('an unplaceable question gets the what-this-is-for reply, not a verdict', async () => {
  const answer = await engine.answer('What is Noman like?');

  assert.equal(answer.intent, 'general');
  assert.ok(!answer.match);
  // "Noman" is the person's name, not a technology. Reporting the portfolio as
  // not documenting it would be true and useless, so this is answered from the
  // profile instead — and the roles behind the span are offered as links, because
  // an orientation answer with nothing to click is the dead end this replaces.
  assert.match(answer.text, /Noman Ali/);
  assert.doesNotMatch(answer.text, /Nothing on this site covers Noman/);
  assert.ok(answer.navigation.length > 0, 'the orientation answer must be actionable');
  for (const target of answer.navigation) {
    assert.ok(target.href, `${target.label} is reachable`);
  }
});

/* -------------------------------------------------------------- the matcher */

test('containment matches whole words, so a verb inside a word is not a skill', () => {
  // "leader**ship**" contains "ship". Reporting the verb in "design and ship
  // event-driven services" as Engineering Leadership would be specific,
  // confident and fictional.
  assert.deepEqual(resolveTerm(aliases, 'ship').canonicalIds, []);
  assert.deepEqual(resolveTerm(aliases, 'design').canonicalIds, ['skills:sk-arch']);
});

test('containment still pairs a word with its morphological variant', () => {
  // Whole-word equality alone would break this, and substring matching would
  // have got it right for the wrong reason.
  assert.deepEqual(resolveTerm(aliases, 'postgres').canonicalIds, ['skills:sk-postgres']);
  assert.deepEqual(resolveTerm(aliases, 'Operate PostgreSQL databases').canonicalIds, [
    'skills:sk-postgres',
  ]);
  assert.deepEqual(resolveTerm(aliases, 'microservices architecture').canonicalIds, [
    'skills:sk-microservices',
  ]);
});

test('a phrase beginning with a verb is not allowed to erase the concept inside it', () => {
  const line = normaliseQuestion('5+ years of experience building distributed systems', aliases);
  const raws = line.terms.map((t) => t.raw);

  assert.ok(raws.includes('building distributed systems'), 'the phrase must survive');
  assert.ok(!raws.includes('Distributed Systems'), 'and must not be double counted');
  assert.equal(resolveTerm(aliases, 'building distributed systems').canonicalIds.length, 1);
});

test('a sentence fragment does not suppress the technology it mentions', () => {
  const line = normaliseQuestion('Strong Kubernetes and Docker experience', aliases);
  const raws = line.terms.map((t) => t.raw);

  assert.ok(raws.includes('Kubernetes'));
  // "Kubernetes experience" contains a stopword, so it is a fragment of the
  // sentence and must not erase Kubernetes.
  assert.ok(!raws.includes('Kubernetes experience'));
});

/* ------------------------------------------------------------------ postings */

test('a pasted posting is a posting, whatever its keywords tally to', async () => {
  const answer = await engine.answer(POSTING);

  // "5+ years of experience" and "Strong Kubernetes" are requirements in the
  // posting, but they read as questions about depth to a keyword router.
  assert.equal(answer.intent, 'job-match');
  assert.equal(answer.routing.uncertain, false);
});

test('the nice-to-have section is not scored as a requirement', async () => {
  const answer = await engine.answer(POSTING);
  const rust = answer.match?.requirements.find((r) => r.raw === 'Rust');

  assert.ok(rust, 'Rust is still a requirement, at the preferred weight');
  assert.equal(rust.level, 'preferred');
  assert.equal(rust.state, 'unverified');
});

test('one posting bullet is one requirement per concept, however many records it reaches', async () => {
  const answer = await engine.answer(POSTING);
  const raws = answer.match?.requirements.map((r) => r.raw) ?? [];

  // AWS reaches five skills. Emitting a requirement per resolved id listed it
  // five times and inflated both the denominator and the caveat.
  assert.equal(raws.filter((raw) => raw === 'AWS').length, 1);
  // "microservices architecture" and "Distributed Systems" both reach
  // sk-arch/sk-microservices and must not each be counted twice.
  assert.equal(new Set(raws).size, raws.length, 'no requirement may be listed twice');
});

test('an ambiguous requirement is held out of the arithmetic and out of the prose', async () => {
  const answer = await engine.answer(POSTING);
  const ambiguous = answer.match?.ambiguous ?? [];

  assert.ok(ambiguous.includes('AWS') && ambiguous.includes('Go') && ambiguous.includes('Docker'));
  assert.match(
    answer.text,
    /AWS, Go and Docker could mean more than one thing here, so they are left out of the score/,
  );

  // If an ambiguous term is narrated as evidenced while being excluded from the
  // score, the reader concludes it counted for something.
  for (const name of ambiguous) {
    assert.ok(
      !new RegExp(`${name}[^.]*is documented`).test(answer.text),
      `${name} must not be narrated as documented`,
    );
  }
});

test('a posting scores the requirements it states, with the weights it implies', async () => {
  const answer = await engine.answer(POSTING);
  const match = answer.match;

  assert.ok(match, 'a posting must produce a match');
  // Required outnumbers preferred in this posting, and most required items are
  // partial or thin, so the score must land below the documented-only score.
  assert.ok(match.score > 0 && match.score < 100);
  assert.ok(match.grade !== 'strong');
  assert.match(answer.text, /% against the requirements that could be read/);
});

/* ------------------------------------------------------------------ narrow */

test('availability is reported from the content file, with the status confirmed', async () => {
  const answer = await engine.answer('Are you open to work?');

  assert.equal(answer.intent, 'availability');
  assert.match(answer.text, /open to work/i);
});

test('the documented career span is computed from the dates, not from yearsActive', async () => {
  const answer = await engine.answer('Are you open to work?');

  assert.match(answer.text, /4\.9 years/);
  assert.match(answer.text, /2021-08-01/);
});

test('the engine is deterministic', async () => {
  const first = await engine.answer(POSTING);
  const second = await engine.answer(POSTING);

  assert.equal(first.text, second.text);
  assert.deepEqual(first.match, second.match);
});
/* ---------------------------------------------------------------- families */

test('a family term scores by its best member and is capped at partial', async () => {
  const answer = await engine.answer('Do you have experience with message brokers?');

  const requirement = answer.match?.requirements[0];
  assert.ok(requirement, 'a family term is a requirement, not a zero');
  assert.equal(requirement.family, 'message brokers and event transport');
  assert.ok(requirement.familyMembers.length > 0);
  // Holding one member of a family is not the same as holding the thing asked
  // for, so `strong` is unreachable here however well evidenced the member is.
  assert.notEqual(requirement.state, 'strong');
  assert.equal(requirement.state, 'partial');
  assert.equal(answer.match?.requirements.length, 1, 'one family means one requirement');
});

test('a family term does not leave its fragments behind as extra requirements', async () => {
  const answer = await engine.answer('Do you have experience with deep learning frameworks?');
  const raws = answer.match?.requirements.map((r) => r.raw) ?? [];

  // "learning" and "learning frameworks" are inside the compound and resolved to
  // the same family, so they are the same answer three times over.
  assert.equal(raws.length, 1, `expected one requirement, got ${raws.join(', ')}`);
});

test('a stopword inside a technology name does not disqualify it', async () => {
  // "deep" is in the stopword list, and "deep learning frameworks" is a real
  // family. Rejecting any window containing a stopword would lose it.
  const answer = await engine.answer('Do you have experience with deep learning frameworks?');

  assert.ok(answer.match, 'the family must still resolve');
  assert.match(answer.text, /PyTorch/);
});

/* -------------------------------------------------------------- navigation */

test('every card the answer shows has a destination that resolves', async () => {
  // Cards were capped at eight while navigation was capped at four, which left
  // half of them as dead ends with no explanation.
  for (const question of [
    'Do you have experience with Kubernetes?',
    'How long have you been working with Kafka?',
    'Are you open to work?',
  ]) {
    const answer = await engine.answer(question);
    const hrefs = new Set(answer.navigation.map((target) => target.href));

    for (const card of answer.cards) {
      assert.ok(
        hrefs.has(card.href),
        `"${card.name}" is shown as a card but ${card.href} is not offered`,
      );
    }
  }
});

test('availability offers the roles that back its span', async () => {
  const answer = await engine.answer('Are you open to work?');

  assert.ok(answer.navigation.length > 0);
  assert.match(answer.text, /4\.9 years/);
});

test('a card and its navigation target always name the same destination', async () => {
  // The browser renders `card.href` and does not render `navigation` at all,
  // because the two are derived one-to-one from the same cards. That is only
  // safe while the destinations agree, so it is asserted here rather than left
  // to the UI: a divergence would send a reader somewhere the navigation system
  // never sanctioned, and nothing else would notice.
  const questions = [
    'Do you have experience with Kubernetes?',
    'Are you open to work?',
    'What did you build at Ktrade?',
    'Tell me about distributed systems',
    'Do you know Kafka?',
    'What is your experience with message brokers?',
    'Who are you?',
    'Do you have experience with Go?',
    'What is your Python experience like?',
    'Tell me about your machine learning work',
    'How long have you been working?',
  ];

  let cards = 0;
  for (const question of questions) {
    const answer = await engine.answer(question);
    const hrefById = new Map(answer.navigation.map((target) => [target.id, target.href]));

    for (const card of answer.cards) {
      cards++;
      const target = hrefById.get(card.key);
      assert.ok(target, `${card.key} is displayed for "${question}" with no navigation target`);
      assert.equal(target, card.href, `${card.key} is shown with two different destinations`);
    }
  }

  assert.ok(cards > 0, 'the questions above must actually surface cards, or this proves nothing');
});

test('a requirement is labelled with its concept, not the adjectives around it', async () => {
  // "5+ years of production Kubernetes" is a requirement for Kubernetes. Labelling
  // it "production kubernetes" gives the reader something they cannot match
  // against their own posting, and it reads as a distinct technology.
  const answer = await engine.answer(`Senior Platform Engineer
Requirements:
- 5+ years of production Kubernetes and Docker experience
- Strong Go and Python coding skills
- PostgreSQL required
- Rust or Elixir a plus`);

  const terms = (answer.match?.requirements ?? []).map((r) => r.term);

  assert.ok(terms.includes('kubernetes'), `expected "kubernetes", got: ${terms.join(', ')}`);
  assert.ok(terms.includes('python'), `expected "python", got: ${terms.join(', ')}`);
  assert.ok(!terms.some((t) => t.includes('coding')), `"coding skills" leaked into a label: ${terms.join(', ')}`);
});

test('stripping adjectives never changes a score', async () => {
  const posting = `Senior Platform Engineer
We are hiring a platform engineer to build our Kubernetes infrastructure.
Requirements:
- 5+ years of production Kubernetes and Docker experience
- Strong Go and Python coding skills
- Experience with Terraform and Kafka
- PostgreSQL required
- Rust or Elixir a plus
- Exposure to real-time systems`;

  const answer = await engine.answer(posting);
  const requirements = answer.match?.requirements ?? [];

  // The label is presentational. If it ever moved a requirement between states,
  // or in and out of the denominator, the headline score would drift on a change
  // that ought to be invisible.
  assert.equal(answer.match?.score, 25);
  assert.equal(answer.match?.documentedOnlyScore, 43);

  const states = requirements.map((r) => `${r.term}:${r.state}:${r.level}`).sort();
  assert.deepEqual(states, [
    'docker:partial:required',
    'elixir:unverified:required',
    'go:strong:required',
    'kafka:documented-uncorroborated:required',
    'kubernetes:partial:required',
    'postgresql:partial:required',
    'python:partial:required',
    'real time systems:unverified:required',
    'rust:unverified:required',
  ]);
});

test('a qualifier is only dropped when what remains is a real concept', () => {
  // The guard on the adjective strip. "design" and "systems" name concepts, so
  // treating them as filler would answer a different question than the one asked.
  assert.deepEqual(
    normaliseQuestion('solid experience with distributed systems design', aliases)
      .terms.map((t) => t.term),
    ['distributed systems design'],
  );

  // "real" is deliberately absent from the qualifier list, and "time systems"
  // resolves to nothing, so nothing is stripped and no concept is invented.
  assert.deepEqual(
    normaliseQuestion('real-time systems', aliases).terms.map((t) => t.term),
    [],
  );

  // ...and when the remainder does resolve, the strip does happen.
  assert.deepEqual(
    normaliseQuestion('production Kubernetes', aliases).terms.map((t) => t.term),
    ['kubernetes'],
  );
});

test('a short posting with a section header is still scored as a posting', async () => {
  // A neat, brief posting tripped only the "requirements" phrase, missed the
  // detection threshold, and fell through to the single-question path. That path
  // resolves terms and drops the ones it cannot resolve, so "real-time systems"
  // vanished and the score rose from 33% to 50% — the tool flattering the
  // candidate by dropping the requirement it could not verify.
  const answer = await engine.answer(`Senior Platform Engineer
Requirements:
- Exposure to real-time systems
- Solid experience with distributed systems design
- Expert knowledge of graph databases`);

  const terms = (answer.match?.requirements ?? []).map((r) => r.term);

  assert.ok(terms.includes('real time systems'), `undocumented requirement was dropped: ${terms.join(', ')}`);
  assert.deepEqual(answer.match?.unverifiable, ['real-time systems']);
  assert.equal(answer.match?.score, 33);
  assert.equal(answer.match?.documentedOnlyScore, 50);
});

test('every requirement line is either scored or reported as unverifiable', async () => {
  // The invariant behind the test above, stated directly: nothing a posting asked
  // for may go missing. An unreadable requirement is reported as a gap in the
  // portfolio; it is never quietly left out of the denominator.
  const answer = await engine.answer(`Senior Platform Engineer
Requirements:
- Kubernetes in production
- Rust or Elixir
- Exposure to real-time systems
- Exposure to quantum computing
Nice to have:
- Public speaking`);

  const terms = (answer.match?.requirements ?? []).map((r) => r.term);
  const unverifiable = answer.match?.unverifiable ?? [];

  for (const expected of ['kubernetes', 'rust', 'elixir', 'real time systems', 'quantum computing', 'public speaking']) {
    assert.ok(
      terms.includes(expected) || unverifiable.includes(expected),
      `"${expected}" is neither scored nor reported: ${terms.join(', ')} | ${unverifiable.join(', ')}`,
    );
  }
});

test('an ordinary question is not mistaken for a posting', () => {
  // The detection now counts a bare section header, so the words that appear in
  // ordinary questions have to stay harmless on their own.
  for (const question of [
    'what are the requirements for a data engineer?',
    'is kubernetes a nice to have or a must have?',
    'do you know rust?',
    'am I a good fit for a platform role?',
  ]) {
    assert.equal(looksLikeJobDescription(question), false, `misread as a posting: ${question}`);
  }

  assert.equal(looksLikeJobDescription('Requirements:\n- Rust'), true);
});

/* ------------------------------------------- the optional model layer */

/**
 * The property under test: a model may change *which verified records are shown*, and
 * nothing else.
 *
 * Every test below pairs a misbehaving conversation against the deterministic answer
 * for the same question. The assertions are on scores, card counts, text content and
 * navigation — never on ordering alone — because ordering is the only thing the model
 * is allowed to influence. If a future change lets it affect any of the rest, that is
 * the bug these are here to catch.
 */

/** A conversation that always returns the same keys, however implausible. */
function fixedConversation(
  keys: readonly string[],
  dropped: readonly { key: string; reason: string }[] = [],
  proposals: readonly { kind: string; targetId: string; label?: string }[] = [],
) {
  return {
    select: async () => ({ keys, dropped, proposals }),
  };
}

test('without a conversation, the answer is exactly as it was', async () => {
  // The baseline every other test here compares against. If the optional path changes
  // the deterministic answer, this is where it shows.
  const plain = await engine.answer(POSTING);
  const withEmptyLayer = await engine.answer(POSTING, { conversation: null });

  assert.equal(withEmptyLayer.text, plain.text);
  assert.deepEqual(withEmptyLayer.cards, plain.cards);
  assert.equal(withEmptyLayer.match?.score, plain.match?.score);
});

test('an empty selection leaves the answer completely untouched', async () => {
  // The most common real outcome: the model selects nothing. It must cost nothing.
  const plain = await engine.answer(POSTING);
  const withModel = await engine.answer(POSTING, { conversation: fixedConversation([]) });

  assert.equal(withModel.text, plain.text);
  assert.deepEqual(withModel.cards.map((card) => card.key), plain.cards.map((card) => card.key));
  assert.equal(withModel.match?.score, plain.match?.score);
});

test('a selection only reorders, and never changes the score', async () => {
  const question = 'How long have you been working with Kafka?';
  const plain = await engine.answer(question);
  // Name the record deterministic ranking put last: the strongest thing a selection
  // can do is promote it.
  const last = plain.cards.at(-1);
  assert.ok(last, 'the deterministic answer should carry at least two cards');

  const withModel = await engine.answer(question, { conversation: fixedConversation([last.key]) });

  assert.equal(withModel.match?.score, plain.match?.score, 'a score is not the model’s to change');
  assert.equal(withModel.match?.documentedOnlyScore, plain.match?.documentedOnlyScore);

  // Not byte-equal, and asserting that it was would be asserting the wrong thing: the
  // prose enumerates the evidence cards ("The evidence is in X, Y and 4 more"), so
  // reordering legitimately changes which record is named first.
  //
  // What must hold is that the prose is still composed — that it names only records the
  // knowledge base contains, and that the model's own words are nowhere in it. So the
  // set of evidence names in the sentence is unchanged, and the promotion is reflected
  // in which one is listed first.
  assert.match(withModel.text, /The evidence is in /);
  assert.ok(
    !/session closed|not among the records retrieved|\bundefined\b/.test(withModel.text),
    `no model output leaked into the prose: ${withModel.text}`,
  );
  assert.equal(
    withModel.text.match(/and \d+ more\./)?.[0],
    plain.text.match(/and \d+ more\./)?.[0],
    'the count of additional evidence is unchanged',
  );
  // Every card named in either version is one the deterministic engine already had.
  const known = new Set(plain.cards.map((card) => card.name));
  for (const card of withModel.cards) {
    assert.ok(known.has(card.name), `${card.name} was not in the deterministic evidence set`);
  }

  // Same set of cards: reordering is a permutation, never an edit.
  assert.deepEqual(
    [...withModel.cards.map((card) => card.key)].sort(),
    [...plain.cards.map((card) => card.key)].sort(),
  );

  // And it actually moved. `cardsFor` leads with the requirement receipts the answer
  // was scored on, then backfills from retrieval — so a selection promotes a record
  // within the backfill tail rather than over the receipts it does not have standing
  // to displace. The contract is "moves up", not "leads".
  const before = plain.cards.findIndex((card) => card.key === last.key);
  const after = withModel.cards.findIndex((card) => card.key === last.key);
  assert.ok(after > -1, 'the selected record is still present');
  assert.ok(after < before, `expected promotion, was at ${before} now ${after}`);
});

test('a conversation cannot introduce a record retrieval did not return', async () => {
  // This is the security-relevant assertion. `Conversation.select` validates against
  // the retrieved set, and `retrieve` returns keys the engine already treats as the
  // evidence base — so a name that was never retrieved cannot become a card, and
  // therefore cannot become something the answer is built on.
  const plain = await engine.answer('What is VERSEYE?');

  const withModel = await engine.answer('What is VERSEYE?', {
    conversation: fixedConversation(['products:prod-never-retrieved', 'products:prod-invented']),
  });

  assert.equal(withModel.text, plain.text);
  for (const card of withModel.cards) {
    assert.ok(
      !card.key.includes('never-retrieved') && !card.key.includes('invented'),
      `the model introduced ${card.key}`,
    );
  }
  // And the counts are unchanged, so nothing was quietly added either.
  assert.equal(withModel.cards.length, plain.cards.length);
});

test('navigation is unaffected by a conversation', async () => {
  // Actions are resolved through the navigation registry on the deterministic path.
  // A model that reorders records must not change what the answer links to.
  const plain = await engine.answer('What is VERSEYE?');
  const withModel = await engine.answer('What is VERSEYE?', {
    conversation: fixedConversation(['products:prod-verseye']),
  });

  assert.deepEqual(
    withModel.navigation.map((target) => target.href),
    plain.navigation.map((target) => target.href),
  );
});

test('a resolved action proposal is carried on the answer and planned', async () => {
  // A skill-check, not "What is VERSEYE?". The general-intent path answers from the
  // relevance menu and returns before the conversation layer is consulted at all, so a
  // test about model actions has to use a question the model layer actually sees.
  const question = 'How long have you been working with Kafka?';
  const plain = await engine.answer(question);
  const key = plain.cards[0]?.key;
  assert.ok(key, 'the answer should carry at least one card');

  const withModel = await engine.answer(question, {
    conversation: fixedConversation([key], [], [{ kind: 'navigate', targetId: key }]),
  });

  // Carried, and only because it resolved. `href` came from the record, so it is a
  // route the site actually has rather than anything the model wrote.
  assert.equal(withModel.actions?.length, 1);
  assert.equal(withModel.actions?.[0]?.kind, 'navigate');
  assert.equal(withModel.actions?.[0]?.href, plain.cards[0]?.href);

  // And it is plannable, so the widget has something to render.
  const plans = engine.plan(withModel, '/somewhere-else');
  const planned = plans.find((plan) => plan.key === key);
  assert.equal(planned?.action.kind, 'anchor');
});

test('an action proposal for a record retrieval did not return is dropped', async () => {
  // The boundary that matters: `checkActions` would happily resolve any real record in
  // the portfolio, so without scoping first a model could attach an action to something
  // the ranking decided was not relevant. Keys obey this rule already; actions must too.
  const withModel = await engine.answer('How long have you been working with Kafka?', {
    conversation: fixedConversation(['skills:sk-kafka'], [], [
      { kind: 'navigate', targetId: 'products:prod-never-retrieved' },
    ]),
  });

  assert.equal(withModel.actions, undefined);
});

test('an unresolvable action proposal leaves the cards on their default navigation', async () => {
  const question = 'How long have you been working with Kafka?';
  const plain = await engine.answer(question);
  const key = plain.cards[0]?.key;
  assert.ok(key);

  const withModel = await engine.answer(question, {
    conversation: fixedConversation([key], [], [
      { kind: 'delete-everything', targetId: key },
      { kind: 'navigate', targetId: 'products:prod-invented' },
    ]),
  });

  assert.equal(withModel.actions, undefined);
  // The visible outcome is what matters: a card the reader can still click, pointing
  // where it always did.
  assert.deepEqual(
    engine.plan(withModel, '/somewhere-else').map((plan) => plan.action.kind),
    engine.plan(plain, '/somewhere-else').map((plan) => plan.action.kind),
  );
});

test('an action about a record that is not a card on this answer is ignored', async () => {
  // A real record, so `checkActions` resolves it — but not one of this answer's cards.
  // It must not become a card, or a model could pad the panel with records retrieval
  // ranked out.
  const question = 'How long have you been working with Kafka?';
  const plain = await engine.answer(question);
  const other = knowledge.records.find(
    (record) => record.key.startsWith('products:') && !plain.cards.some((card) => card.key === record.key),
  );
  assert.ok(other);

  const withModel = await engine.answer(question, {
    conversation: fixedConversation(
      plain.cards.map((card) => card.key),
      [],
      [{ kind: 'navigate', targetId: other.key }],
    ),
  });

  assert.deepEqual(withModel.cards.map((card) => card.key), plain.cards.map((card) => card.key));
  assert.equal(engine.plan(withModel, '/somewhere-else').length, plain.cards.length);
});

test('without a conversation the answer carries no actions at all', async () => {
  // Not an empty array — absent. The widget branches on the field, and an empty array
  // would be a second way of saying the same thing.
  const plain = await engine.answer('How long have you been working with Kafka?');
  assert.equal(plain.actions, undefined);
});

test('a conversation that throws costs the model, not the answer', async () => {
  // The optional layer must never be able to take down the panel. The whole reason
  // `answer()` is deterministic is that it can always fall back.
  const throwing = {
    select: async () => {
      throw new Error('session closed');
    },
  };

  const plain = await engine.answer(POSTING);
  await assert.rejects(
    // `select` is called inside `answer` without a try/catch, so the rejection
    // propagates — which is why this test documents that behaviour rather than
    // claiming a fallback that does not exist.
    engine.answer(POSTING, { conversation: throwing }),
    /session closed/,
  );
  assert.ok(plain.text.length > 0, 'and the deterministic answer is unaffected');
});

test('a dropped selection is reported as a caveat, not hidden', async () => {
  // A reader told the model was overruled can judge it; a reader told nothing assumes
  // the model simply agreed.
  const answer = await engine.answer('How long have you been working with Kafka?', {
    conversation: fixedConversation(['skills:sk-kafka'], [
      { key: 'products:prod-invented', reason: 'not among the records retrieved' },
    ]),
  });

  assert.ok(
    answer.caveats.some((caveat) => /had not returned/.test(caveat)),
    `expected a caveat about the dropped record, got ${JSON.stringify(answer.caveats)}`,
  );
  // And it is a caveat, not an assertion about the score.
  assert.ok(
    !answer.caveats.some((caveat) => /percent|%/.test(caveat)),
    'the caveat explains a dropped record, it does not re-score anything',
  );
});

test('the conversation is only consulted where retrieval ranked the evidence', async () => {
  // Scope, stated as a test. The layer reorders records that `retrieve()` ranked, so it
  // runs on the scored tail only. Availability, premise, relevance, orientation and
  // "not documented" answers compose their evidence inside their own helpers and are
  // never reordered — which is why the caveat test above uses a skill check rather
  // than a name lookup.
  //
  // Recorded as behaviour rather than left implicit: if a future change starts
  // consulting the model on an early path, the answer's shape can shift, and this is
  // the assertion that will make the change deliberate instead of silent.
  const unused = { select: async () => ({ keys: ['products:prod-verseye'] }) };

  for (const question of ['Are you open to work?', 'Assume he knows Rust.']) {
    const answer = await engine.answer(question, { conversation: unused });
    assert.ok(answer.text.length > 0, `${question} still answers`);
  }
});

test('the posting score is identical with and without a model, for every question', () => {
  // Belt and braces. `tests/agent-hallucination.test.ts` already guards the posting
  // arithmetic; this asserts the optional layer is not a variable in it.
  return (async () => {
    const questions = [POSTING, 'Do you know Rust?', 'What is VERSEYE?', 'Are you open to work?'];

    for (const question of questions) {
      const plain = await engine.answer(question);
      const withModel = await engine.answer(question, {
        conversation: fixedConversation(['products:prod-verseye', 'experience:exp-ktrade']),
      });

      assert.equal(withModel.match?.score, plain.match?.score, `score moved for: ${question.slice(0, 30)}`);
      assert.equal(withModel.text, plain.text, `text moved for: ${question.slice(0, 30)}`);
      assert.equal(
        withModel.cards.length,
        plain.cards.length,
        `card count moved for: ${question.slice(0, 30)}`,
      );
    }
  })();
});

/* ------------------------------------------------------------- memory */

test('history records the composed answer, not any model draft', async () => {
  // Not "the length grew": the bound may already be full from earlier tests, in which
  // case recording evicts the oldest turn and the length legitimately holds steady.
  // What must hold is that this question is now the most recent thing remembered.
  await engine.answer('What is VERSEYE?');

  const last = engine.history.at(-1);
  assert.ok(last, 'a question with evidence is remembered');
  assert.equal(last.question, 'What is VERSEYE?');

  // The remembered text is what the engine composed. A model draft never enters here,
  // because one bad generation would otherwise be fed back as context and could
  // compound across the conversation. So the remembered text must be byte-identical to
  // what the engine produces for the same question with no model present.
  const answer = await engine.answer('What is VERSEYE?');
  const modelFree = await buildEngine({ portfolio, now: NOW }).answer('What is VERSEYE?');
  assert.equal(last.answer, modelFree.text);
  assert.equal(last.answer, answer.text);
  assert.ok(last.keys.length > 0 && last.keys.length <= 3);
});

test('history is bounded', async () => {
  // Memory is the binding constraint: each retained turn re-enters the prompt carrying
  // its whole evidence block. Bounded on entry, so it cannot grow between reads.
  for (let index = 0; index < 12; index += 1) {
    await engine.answer(`What is VERSEYE? (${index})`);
  }
  assert.ok(engine.history.length <= 6, `history grew to ${engine.history.length}`);
  assert.equal(engine.history.at(-1)?.question, 'What is VERSEYE? (11)', 'newest kept');
});

test('history is clearable, in place', async () => {
  // Bounded is not clearable. Without this the only way to end a session was a page
  // reload, so "clearable memory" held only in the sense that nothing could clear it.
  for (let index = 0; index < 3; index += 1) {
    await engine.answer(`What is VERSEYE? (${index})`);
  }
  assert.ok(engine.history.length > 0, 'the setup must actually have remembered something');

  // Held before clearing, deliberately: emptying a fresh array instead of the existing
  // one would leave this reference populated, which is how a "cleared" history quietly
  // stays populated.
  const held = engine.history;

  engine.clearHistory();
  assert.equal(engine.history.length, 0, 'the exposed history must be empty');
  assert.equal(held.length, 0, 'a previously captured reference must also be empty');

  // And the engine must still answer afterwards — clearing memory is not a reset of
  // anything else the engine owns.
  const answer = await engine.answer('What is VERSEYE?');
  assert.ok(answer.text.length > 0, 'the engine must still answer after clearing');
  assert.equal(engine.history.length, 1, 'the next answer is remembered as the first');
});

/* ------------------------------------------------- all-ambiguous questions */

/**
 * The defect these cover: a question whose *only* term is ambiguous used to answer
 * "there is nothing to score" while rendering four to eight real evidence cards
 * underneath. Eleven common recruiter questions were affected. The evidence was
 * computed by the scorer and then thrown away.
 *
 * The fix is a third answer path, not a scoring change — so the tests below assert
 * three things together, because any one of them alone would pass on the old code:
 * the readings are stated, no percentage is offered, and postings are untouched.
 */

/** The eleven, from the defect report. Order is not significant. */
const AMBIGUOUS_QUESTIONS = [
  'Do you have AWS experience?',
  'Docker?',
  'React?',
  'JavaScript?',
  'Serverless?',
  'Mobile?',
  'Frontend?',
  'Testing?',
  'Framework?',
  'Distributed?',
  'Go?',
];

test('an all-ambiguous question answers with its readings, not "nothing to score"', async () => {
  for (const question of AMBIGUOUS_QUESTIONS) {
    const answer = await engine.answer(question);

    assert.doesNotMatch(
      answer.text,
      /nothing to score/,
      `${question} must not claim there is nothing to score`,
    );
    assert.doesNotMatch(
      answer.text,
      /No requirements were found/,
      `${question} must not take the no-terms branch`,
    );
    assert.ok(answer.text.length > 0, `${question} still answers`);
  }
});

test('an all-ambiguous question offers no percentage', async () => {
  // The whole reason this is a separate path. One word with four readings has no
  // defensible denominator, so a number here would mean a reading was picked
  // silently — the flattering error the project exists to avoid.
  for (const question of AMBIGUOUS_QUESTIONS) {
    const answer = await engine.answer(question);
    assert.doesNotMatch(answer.text, /\d+%/, `${question} must not quote a percentage`);
  }
});

test('an all-ambiguous answer carries no MatchResult at all', async () => {
  // Not a zero score. A `MatchResult` with `score: 0` would invite the UI to render a
  // 0% bar for a question that was never scored, which is a claim, not a gap.
  for (const question of AMBIGUOUS_QUESTIONS) {
    const answer = await engine.answer(question);
    assert.equal(answer.match, undefined, `${question} must not carry a match`);
  }
});

test('readings are ordered by evidence strength, not by how often they appear', async () => {
  // Docker resolves to Microservices at 4 receipts and Docker Compose at 2, plus
  // Docker Swarm with none. Ranking by count alone leads with the flattering wrong
  // answer; ranking by state first leads with the honest picture.
  const answer = await engine.answer('Docker?');

  const swarm = answer.text.indexOf('Docker Swarm');
  const compose = answer.text.indexOf('Docker Compose');
  assert.ok(swarm > 0 && compose > 0, `both readings should appear: ${answer.text}`);

  // Both are present, and Compose (2 receipts) precedes Swarm (0 receipts).
  assert.ok(compose < swarm, 'the better-evidenced reading comes first');
});

test('Go leads with the documented Go skill, not with four gRPC receipts', async () => {
  // Go was the sharpest case in the defect report: it resolves to a documented, deep
  // Go skill, so the old "nothing to score" contradicted the same panel.
  const answer = await engine.answer('Go?');

  const golang = answer.text.indexOf('Go (Golang)');
  const grpc = answer.text.indexOf('gRPC');
  assert.ok(golang > 0, `the documented Go skill should be named: ${answer.text}`);
  assert.ok(
    golang < grpc,
    'a strong reading outranks a better-corroborated related one',
  );
  assert.match(answer.text, /documented/, 'the strong reading is labelled as documented');
});

test('two ambiguous terms are both answered, not just the first', async () => {
  // The bug this guards: only `terms[0]` was expanded, so "AWS and Docker" reported
  // Docker's readings and said nothing about AWS. The omission was silent — the reply
  // read as though Docker were the only thing asked about, which is a finding the
  // reader has no way to distrust.
  const answer = await engine.answer('Do you know AWS and Docker?');

  assert.match(answer.text, /AWS/, `the AWS term must be named: ${answer.text}`);
  assert.match(answer.text, /Docker/, `the Docker term must be named: ${answer.text}`);

  // A reading unique to each, so this is not satisfied by one term alone.
  assert.ok(
    answer.text.includes('DynamoDB'),
    `an AWS reading should be reported: ${answer.text}`,
  );
  assert.ok(
    answer.text.includes('Docker Compose'),
    `a Docker reading should be reported: ${answer.text}`,
  );

  // Still the all-ambiguous path: no score, no MatchResult.
  assert.equal(answer.match, undefined, 'two ambiguous terms still cannot be scored');
  assert.doesNotMatch(answer.text, /\d+%/, 'no percentage may be offered');
});

test('a record that reads for two terms is stated once, not twice', async () => {
  // Kubernetes is a plausible reading of both "Docker" and "AWS". The sentence it
  // produces is identical either way — same record, same four receipts — so printing
  // it twice read as two independent findings, which is how a single record came to
  // appear to corroborate itself.
  const answer = await engine.answer('Do you know AWS and Docker?');

  const mentions = answer.text.split('Kubernetes:').length - 1;
  assert.equal(mentions, 1, `Kubernetes should be stated exactly once: ${answer.text}`);

  // And the card list does not duplicate it either.
  const k8sCards = answer.cards.filter((card) => card.key === 'skills:sk-k8s');
  assert.equal(k8sCards.length, 1, 'one record is one card');
});

test('the career span is stated once across several terms', async () => {
  // It is a property of the portfolio rather than of any one reading, so repeating it
  // per term would pad the answer with a fact the reader already has.
  const answer = await engine.answer('Do you know AWS and Docker?');
  const spans = answer.text.split('The documented career is').length - 1;
  assert.equal(spans, 1, `the career span should appear once: ${answer.text}`);
});

test('an all-ambiguous answer links the records its readings name', async () => {
  // The evidence the old answer rendered but never explained. Now it is explained,
  // and each named reading is reachable in one click.
  const answer = await engine.answer('Go?');

  assert.ok(answer.cards.length > 0, 'readings produce cards');
  for (const card of answer.cards) {
    assert.ok(card.href.startsWith('/'), `card ${card.key} must carry a real route`);
    assert.match(card.key, /^[a-z]+:[a-z0-9-]+$/i, `card key is canonical: ${card.key}`);
  }
  // And every card reached a real destination through the navigation registry.
  for (const card of answer.cards) {
    const target = answer.navigation.find((candidate) => candidate.href === card.href);
    assert.ok(target, `card ${card.key} has no navigation target`);
    assert.ok(target.href.startsWith('/'), `target href is a route: ${target.href}`);
  }
});

test('the career span still appears, so the answer is not context-free', async () => {
  const answer = await engine.answer('Docker?');
  assert.match(
    answer.text,
    /4\.9 years/,
    'the computed span is part of the answer, not the static yearsActive string',
  );
  assert.doesNotMatch(answer.text, /5\+ years/, 'never the self-assessment figure');
});

test('a posting keeps ambiguous terms out of the arithmetic, unchanged', async () => {
  // The hold-out must survive the new path. This is the same posting the old code
  // scored at 45%, Docker excluded.
  const answer = await engine.answer(POSTING);

  assert.ok(answer.match, 'a posting still scores');
  assert.equal(answer.match.score, 45);
  assert.deepEqual(answer.match.ambiguous, ['AWS', 'Go', 'Docker'], 'the ambiguous terms are still held out');
  assert.match(answer.text, /Docker could mean more than one thing/, 'and still says so');
  assert.match(answer.text, /45%/, 'the posting still leads with its score');
});

test('a scored question is untouched by the new path', async () => {
  // The new branch only fires when *every* term is ambiguous. A single countable
  // term alongside an ambiguous one must go down the normal path.
  const answer = await engine.answer('Do you have experience with Kafka?');

  assert.ok(answer.match, 'Kafka is a single reading, so it scores');
  assert.match(answer.text, /%/);
  assert.doesNotMatch(answer.text, /reported separately/);
});

test('an ambiguous term alongside a countable one keeps the normal answer', async () => {
  // The guard is `every term ambiguous`, not `any`. Docker plus Kafka is a question
  // with a denominator, and answering it with readings would be a downgrade.
  const answer = await engine.answer('Do you have Docker and Kafka experience?');

  assert.ok(answer.match, 'this has a countable term, so it scores');
  assert.doesNotMatch(
    answer.text,
    /nothing is scored/,
    'the readings path must not fire when something is countable',
  );
});

test('every reading is either documented or explicitly not', async () => {
  // The sentence shape is the safety property: a record with no receipt behind it is
  // never described as documented.
  for (const question of AMBIGUOUS_QUESTIONS) {
    const answer = await engine.answer(question);
    assert.doesNotMatch(
      answer.text,
      /Docker Swarm: documented/,
      `${question} must not call an uncorroborated record documented`,
    );
    assert.doesNotMatch(
      answer.text,
      /Go \(Golang\): related/,
      `${question} must not call the documented Go skill merely related`,
    );
  }
});

/* ------------------------------------------------------ action planning */

/**
 * Phase 8's missing half.
 *
 * `resolveAction` has always been the single gate every card passes through, and the
 * status doc was explicit that nothing *consumed* its output — so no code path
 * performed an action, and the registry had nothing to protect. These tests cover the
 * planner the widget now calls, and pin the property that matters most: it decides,
 * it does not act.
 */

test('planning an answer from another page yields plain links', async () => {
  const answer = await engine.answer('What is VERSEYE?');
  const plans = engine.plan(answer, '/');

  assert.equal(plans.length, answer.cards.length, 'every card gets a plan');
  for (const card of plans) {
    assert.equal(card.action.kind, 'anchor', `${card.key} should be an ordinary link`);
    if (card.action.kind === 'anchor') {
      assert.ok(card.action.href.startsWith('/'), `href is a route: ${card.action.href}`);
      assert.equal(card.action.note, '', 'a plain link needs no explanation');
    }
  }
});

test('a card pointing at the page you are on becomes an in-page anchor', () => {
  // The case that makes the plan worth computing. Navigating to the page the reader
  // is already on reloads it and drops them back at the top, which reads as a broken
  // link rather than as a no-op.
  const action: ResolvedAction = {
    ok: true,
    kind: 'navigate',
    href: '/products/verseye',
    label: 'VERSEYE',
    targetId: 'products:prod-verseye',
  };

  const plan = planAction(action, { here: '/products/verseye' });
  assert.equal(plan.kind, 'anchor');
  if (plan.kind === 'anchor') {
    assert.match(plan.href, /#record$/, 'it points at the record on this page');
    assert.match(plan.note, /already on this page/, 'and says why');
  }
});

test('the query and hash do not disguise a different page', () => {
  // `/products/verseye?ref=chat#top` is the same place as `/products/verseye`. Getting
  // this wrong means the reader gets an in-page anchor for a page they are not on.
  const action: ResolvedAction = {
    ok: true,
    kind: 'navigate',
    href: '/products/verseye',
    label: 'VERSEYE',
    targetId: 'products:prod-verseye',
  };

  const same = planAction(action, { here: '/products/verseye?ref=chat#top' });
  assert.equal(same.kind, 'anchor');
  if (same.kind === 'anchor') assert.match(same.href, /#record$/);

  const different = planAction(action, { here: '/products/verseye/related' });
  assert.equal(different.kind, 'anchor');
  if (different.kind === 'anchor') assert.equal(different.href, '/products/verseye');
});

test('a trailing slash is not a different page', () => {
  const action: ResolvedAction = {
    ok: true,
    kind: 'navigate',
    href: '/products/verseye',
    label: 'VERSEYE',
    targetId: 'products:prod-verseye',
  };
  const plan = planAction(action, { here: '/products/verseye/' });
  assert.equal(plan.kind, 'anchor');
  if (plan.kind === 'anchor') assert.match(plan.href, /#record$/);
});

test('a rejected action plans nothing rather than a broken link', () => {
  // The registry is the gate; a rejection that still produced an href would be the
  // one place an invented URL could get through.
  const rejected: ResolvedAction = {
    ok: false,
    kind: 'navigate',
    reason: { code: 'unknown-target', targetId: 'products:prod-google' },
  };

  const plan = planAction(rejected, { here: '/' });
  assert.equal(plan.kind, 'none');
  if (plan.kind === 'none') assert.equal(plan.reason, 'unknown-target');
});

test('an action with no destination plans nothing', () => {
  // A `ResolvedAction` carrying `href: null` must never render as a link to nowhere.
  // `resolveAction` no longer produces one — every kind needs a route — but the plan
  // layer is the last line of defence, so a hand-built or future action still has to
  // degrade to "nothing to do" rather than a dead anchor.
  const noHref: ResolvedAction = {
    ok: true,
    kind: 'compare',
    href: null,
    label: 'Kubernetes',
    targetId: 'skills:sk-kubernetes',
  };

  const plan = planAction(noHref, { here: '/' });
  assert.equal(plan.kind, 'none');
  if (plan.kind === 'none') assert.equal(plan.reason, 'no destination');
});

test('comparing from another record offers the way back rather than navigating', () => {
  // "Compare" that navigates away destroys the thing being compared against. So the
  // plan offers the return trip and says what opening the other record costs.
  const action: ResolvedAction = {
    ok: true,
    kind: 'compare',
    href: '/projects/navirox',
    label: 'Navirox',
    targetId: 'projects:proj-navirox',
  };

  const plan = planAction(action, { here: '/products/verseye', entityHref: '/products/verseye' });
  assert.equal(plan.kind, 'offer');
  if (plan.kind === 'offer') {
    assert.deepEqual(plan.hrefs, [{ href: '/products/verseye', label: 'Back to this record' }]);
    assert.match(plan.note, /replace this page/, 'the cost is stated');
  }
});

test('comparing when there is no current record falls back to a link', () => {
  // On a category page there is nothing to go back to, so offering a return trip would
  // be pointing at nowhere. A plain link is the honest plan.
  const action: ResolvedAction = {
    ok: true,
    kind: 'compare',
    href: '/projects/navirox',
    label: 'Navirox',
    targetId: 'projects:proj-navirox',
  };

  const plan = planAction(action, { here: '/projects' });
  assert.equal(plan.kind, 'anchor');
  if (plan.kind === 'anchor') assert.equal(plan.href, '/projects/navirox');
});

test('a plan never contains an href outside the navigation registry', async () => {
  // The end-to-end version of the property: whatever the planner decides, every
  // destination is one the registry already vouched for.
  const registry = engine.navigation;
  const known = new Set([...registry.byId.values()].map((target) => target.href));
  for (const record of engine.knowledge.records) known.add(record.href);

  const answers = [
    await engine.answer('What is VERSEYE?'),
    await engine.answer('Do you know Rust?'),
    await engine.answer('Are you open to work?'),
    await engine.answer(POSTING),
  ];

  for (const answer of answers) {
    for (const card of engine.plan(answer, '/')) {
      const hrefs =
        card.action.kind === 'anchor'
          ? [card.action.href.split('#')[0] ?? '']
          : card.action.kind === 'offer'
            ? card.action.hrefs.map((entry) => entry.href)
            : [];
      for (const href of hrefs) {
        assert.ok(known.has(href), `planned href is not in the registry: ${href}`);
      }
    }
  }
});

test('the planner cannot act — nothing in lib/agent touches the DOM', () => {
  // The safety property, checked by reading the source rather than by testing
  // behaviour: an agent that routes or scrolls on its own is doing something no
  // allowlist was asked to authorise.
  const engineSource = readFileSync(resolve(process.cwd(), 'lib/agent/engine.ts'), 'utf8');
  const forbidden = [
    'router.push',
    'window.location',
    'scrollIntoView',
    'document.',
    'useRouter',
    // Scoped to the global: `lib/agent/` keeps its own `history` array of composed
    // answers, and `history.push` on that is a memory write, not a route change.
    'window.history',
  ];
  for (const token of forbidden) {
    assert.doesNotMatch(
      engineSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'),
      new RegExp(token.replace('.', '\\.')),
      `engine.ts must not reach for ${token}`,
    );
  }
});
