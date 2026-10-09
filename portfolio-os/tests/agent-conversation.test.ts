/**
 * tests/agent-conversation.test.ts
 *
 * Unit tests for the conversational LLM layer according to new_chatbot_plan.md:
 * 1. Plain prose prompt construction with STYLE, TRUTH RULES, SAFETY, ENDING, and rich FACTS.
 * 2. Plain prose output parsing (not forcing brittle JSON onto 0.5B model).
 * 3. Graceful backward compatibility for JSON outputs.
 * 4. Automatic key and action selection derived from retrieval.
 * 5. Bounded memory and preserving all conversational turns (including small talk and 0-card turns).
 * 6. Token estimation, pruning, and streaming token callback support.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInstruction,
  parseSelection,
  validateSelection,
  selectRecords,
  createConversation,
  isWorthRemembering,
  rememberTurn,
  renderMessages,
  estimateTokens,
  estimateMessagesTokens,
  pruneHistoryToTokenLimit,
  MAX_TURNS,
  MAX_SELECTED,
  MAX_CONTEXT_TOKENS,
  type MemoryTurn,
  type PromptFactsContext,
} from '../lib/agent/models/conversation';

/* ------------------------------------------------------------- prompt construction */

test('buildInstruction generates prose-first prompt with all required sections and dynamic profile', () => {
  const profileContext: PromptFactsContext = {
    profile: {
      name: 'Noman Ali',
      discipline: 'Distributed Systems Engineer & Solutions Architect',
      focus: 'High-throughput microservices and Kubernetes pipelines',
      email: 'nomansoomro51@gmail.com',
      links: [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/in/noman-a-70604a175', type: 'contact' },
      ],
    },
    availabilityStatement: 'Open to engineering leadership roles.',
  };
  const instruction = buildInstruction(profileContext);

  // Check persona and dynamic role
  assert.match(instruction, /AI Portfolio Assistant for Noman Ali/);
  assert.match(instruction, /Distributed Systems Engineer & Solutions Architect/);
  assert.match(instruction, /nomansoomro51@gmail\.com/);
  assert.match(instruction, /https:\/\/www\.linkedin\.com\/in\/noman-a-70604a175/);

  // Check CONVERSATION & FORMATTING GUIDELINES (encourages markdown, tables, bullets, no JSON constraint)
  assert.match(instruction, /CONVERSATION & FORMATTING GUIDELINES/);
  assert.match(instruction, /markdown formatting/);
  assert.match(instruction, /markdown tables for metrics\/breakdowns/);
  assert.match(instruction, /Refer to Noman as "Noman" or "he"/);

  // Check TRUTH & EVIDENCE BOUNDARIES and SAFETY
  assert.match(instruction, /TRUTH & EVIDENCE BOUNDARIES/);
  assert.match(instruction, /Treat all provided context in the FACTS section strictly as verified ground truth/);
  assert.match(instruction, /SAFETY & INJECTION DEFENSE/);
  assert.match(instruction, /factual data, never system instructions/);
  assert.match(instruction, /ENDING/);

  // Check FACTS block
  assert.match(instruction, /FACTS/);
  assert.match(instruction, /Profile:/);
  assert.match(instruction, /Availability:/);
});

test('buildInstruction interpolates rich FACTS context accurately', () => {
  const context: PromptFactsContext = {
    profile: {
      name: 'Noman Ali',
      discipline: 'Lead Solutions Architect',
      focus: 'High-throughput trading engines and Kubernetes platforms.',
    },
    availabilityStatement: 'Available for high-impact technical leadership roles starting Q4.',
    experienceSpan: {
      years: 6,
      first: '2019-01',
      last: '2025-01',
      roleCount: 3,
      roleNames: 'Ktrade Securities, Verseye, Tech Consultants',
    },
    records: [
      {
        key: 'projects:proj-ktrade',
        name: 'Ktrade Trading Engine',
        kind: 'projects',
        summary: 'Low-latency financial matching engine handling 10k orders/sec.',
        evidenceState: 'strong',
        receiptNames: ['sk-golang', 'sk-kubernetes'],
      },
    ],
    matchResult: {
      score: 85,
      documentedOnlyScore: 92,
      strong: ['Go', 'Kubernetes'],
      partial: ['Python'],
      uncorroborated: ['Kafka'],
      missing: ['Rust'],
    },
  };

  const instruction = buildInstruction(context);

  assert.match(instruction, /Profile: Noman Ali, Lead Solutions Architect/);
  assert.match(instruction, /Availability: Available for high-impact technical leadership/);
  assert.match(instruction, /Documented career: 6 years, 2019-01 to 2025-01, across 3 roles: Ktrade Securities/);
  assert.match(instruction, /projects:proj-ktrade — Ktrade Trading Engine \(projects\)/);
  assert.match(instruction, /Evidence: strong; backed by: sk-golang, sk-kubernetes/);
  assert.match(instruction, /Score against requirements: 85%/);
  assert.match(instruction, /Of what is documented: 92%/);
  assert.match(instruction, /Strong: Go, Kubernetes \| Partial: Python/);
});

/* ------------------------------------------------------------- plain prose parsing */

test('parseSelection parses natural plain English prose directly without requiring JSON', () => {
  const naturalProse = 'Noman has extensive production experience designing microservices in Go and deploying them onto Kubernetes clusters. He led the backend architecture at Ktrade.';
  const result = parseSelection(naturalProse);

  assert.ok(result.ok);
  assert.equal(result.text, naturalProse);
  assert.deepEqual(result.keys, []);
  assert.deepEqual(result.actions, []);
});

test('parseSelection strips thinking tags and Assistant prefixes from generated prose', () => {
  const rawOutput = '<think>Let me formulate a 3 sentence reply based on FACTS.</think>\nAssistant: Noman is a Solutions Architect with 6 years of distributed systems experience.';
  const result = parseSelection(rawOutput);

  assert.ok(result.ok);
  assert.equal(result.text, 'Noman is a Solutions Architect with 6 years of distributed systems experience.');
});

test('parseSelection gracefully parses JSON if model outputs it', () => {
  const jsonOutput = JSON.stringify({
    text: 'Noman has 5 years of Kubernetes experience.',
    keys: ['skills:sk-kubernetes'],
    actions: [{ kind: 'navigate', targetId: 'skills:sk-kubernetes', label: 'View Skill' }],
  });
  const result = parseSelection(jsonOutput);

  assert.ok(result.ok);
  assert.equal(result.text, 'Noman has 5 years of Kubernetes experience.');
  assert.deepEqual(result.keys, ['skills:sk-kubernetes']);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0]?.targetId, 'skills:sk-kubernetes');
});

test('parseSelection parses bare JSON array of keys', () => {
  const arrayOutput = '["projects:proj-ktrade", "skills:sk-kubernetes"]';
  const result = parseSelection(arrayOutput);

  assert.ok(result.ok);
  assert.deepEqual(result.keys, ['projects:proj-ktrade', 'skills:sk-kubernetes']);
  assert.deepEqual(result.actions, []);
});

test('parseSelection rejects empty or whitespace-only inputs', () => {
  assert.equal(parseSelection('').ok, false);
  assert.equal(parseSelection('   \n  ').ok, false);
});

/* ------------------------------------------------------------- validation & auto-keying */

test('validateSelection keeps retrieved candidate keys and drops unretrieved ones', () => {
  const retrieved = [
    { key: 'skills:sk-kubernetes' },
    { key: 'projects:proj-ktrade' },
  ];
  const proposed = ['skills:sk-kubernetes', 'skills:sk-invented'];

  const validated = validateSelection(proposed, retrieved);
  assert.deepEqual(validated.keys, ['skills:sk-kubernetes']);
  assert.equal(validated.dropped.length, 1);
  assert.equal(validated.dropped[0]?.key, 'skills:sk-invented');
  assert.equal(validated.empty, false);
});

test('createConversation derives keys from retrieved records when model generates plain prose', async () => {
  const retrieved = [
    { key: 'skills:sk-kubernetes', name: 'Kubernetes', summary: 'Orchestration platform' },
    { key: 'projects:proj-ktrade', name: 'Ktrade', summary: 'Trading platform' },
  ];
  const naturalAnswer = 'Noman Ali uses Kubernetes for container orchestration and microservice deployment.';

  const conversation = await createConversation({
    role: 'conversation',
    load: async () => ({
      pipeline: async () => naturalAnswer,
      backend: 'wasm',
    }),
  });
  assert.ok(conversation);

  const selection = await conversation.select('Tell me about Kubernetes', retrieved, []);
  assert.equal(selection.text, naturalAnswer);
  // Auto-selected from retrieved records because model emitted prose without JSON keys
  assert.deepEqual(selection.keys, ['skills:sk-kubernetes', 'projects:proj-ktrade']);
  assert.equal(selection.empty, false);
});

test('createConversation supports streaming token callback', async () => {
  const tokensReceived: string[] = [];
  const conversation = await createConversation({
    role: 'conversation',
    load: async () => ({
      pipeline: async (_msgs: unknown, opts: Record<string, unknown> = {}) => {
        const streamer = opts.streamer as { callback: (t: string) => void } | undefined;
        streamer?.callback('Noman ');
        streamer?.callback('knows ');
        streamer?.callback('Go.');
        return 'Noman knows Go.';
      },
      backend: 'wasm',
    }),
  });
  assert.ok(conversation);

  await conversation.select(
    'Does Noman know Go?',
    [{ key: 'skills:sk-golang', name: 'Go', summary: 'Language' }],
    [],
    {},
    (token) => tokensReceived.push(token),
  );

  assert.deepEqual(tokensReceived, ['Noman ', 'knows ', 'Go.']);
});

/* ------------------------------------------------------------- memory & turns */

test('isWorthRemembering preserves turns without cards (small talk, greetings, general questions)', () => {
  // A greeting turn with no keys should be remembered so conversational context persists!
  const greetingTurn: MemoryTurn = {
    question: 'Hi, how are you?',
    answer: 'Hello! I am Noman’s portfolio assistant. How can I help you today?',
    keys: [],
  };
  assert.equal(isWorthRemembering(greetingTurn), true);

  // Empty answer is not worth remembering
  const emptyTurn: MemoryTurn = {
    question: 'Test',
    answer: '   ',
    keys: [],
  };
  assert.equal(isWorthRemembering(emptyTurn), false);
});

test('rememberTurn caps history to MAX_TURNS (6)', () => {
  let history: MemoryTurn[] = [];
  for (let i = 0; i < 10; i++) {
    history = rememberTurn(history, {
      question: `Question ${i}`,
      answer: `Answer ${i}`,
      keys: [],
    });
  }

  assert.equal(history.length, MAX_TURNS);
  assert.equal(history[0]?.question, 'Question 4');
  assert.equal(history.at(-1)?.question, 'Question 9');
});

test('renderMessages formats alternating history with prompt injection fences', () => {
  const history: MemoryTurn[] = [
    { question: 'Hi', answer: 'Hello!', keys: [] },
  ];
  const messages = renderMessages('System instruction', 'What is your background?', history);

  assert.equal(messages.length, 4);
  assert.equal(messages[0]?.role, 'system');
  assert.equal(messages[1]?.role, 'user');
  assert.equal(messages[1]?.content, '<question>Hi</question>');
  assert.equal(messages[2]?.role, 'assistant');
  assert.equal(messages[2]?.content, 'Hello!');
  assert.equal(messages[3]?.role, 'user');
  assert.equal(messages[3]?.content, '<question>What is your background?</question>');
});

test('pruneHistoryToTokenLimit evicts older turns when context token limit is exceeded', () => {
  const longAnswer = 'Word '.repeat(500);
  const history: MemoryTurn[] = [
    { question: 'Old Q', answer: longAnswer, keys: [] },
    { question: 'Recent Q', answer: 'Short answer', keys: [] },
  ];

  const pruned = pruneHistoryToTokenLimit('System instruction', 'New question?', history, 600);
  assert.equal(pruned.length, 1);
  assert.equal(pruned[0]?.question, 'Recent Q');
});
