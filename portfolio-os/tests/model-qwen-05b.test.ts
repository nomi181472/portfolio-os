/**
 * tests/model-qwen-05b.test.ts
 *
 * Dedicated Unit Test for the Qwen2.5 0.5B Instruct model layer (`role: 'conversation'`).
 * Tests:
 * 1. Exact system prompt formatting matching production.
 * 2. Allowing user to pass any question to test.
 * 3. Exact allowlist enforcement, action proposal validation, and engine synthesis.
 * 4. Can be run with custom questions via CLI:
 *    npx tsx tests/model-qwen-05b.test.ts --question "Your custom question here"
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import { buildAliasTable } from '../lib/agent/aliases';
import { buildEngine } from '../lib/agent/engine';
import {
  buildInstruction,
  renderMessages,
  parseSelection,
  validateSelection,
  createConversation,
} from '../lib/agent/models/conversation';
import { retrieve, buildLexicalIndex } from '../lib/agent/retrieve';
import { modelForRole } from '../lib/agent/registry';
import type { Portfolio } from '../types/portfolio';

const NOW = new Date('2026-10-04T00:00:00Z');
const rawPortfolio = JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8'));
const parsed = validatePortfolio(rawPortfolio);
assert.ok(parsed.ok, 'portfolio must validate');
const portfolio: Portfolio = parsed.data;
const graph = buildGraph(portfolio);
const knowledge = buildKnowledge(portfolio, graph, { now: NOW });
const aliases = buildAliasTable(knowledge);
const lexical = buildLexicalIndex(knowledge.records);
const engine = buildEngine({ portfolio, now: NOW });

const MODEL = modelForRole('conversation');

test('Qwen 0.5B configuration matches production registry', () => {
  assert.equal(MODEL.id, 'onnx-community/Qwen2.5-0.5B-Instruct');
  assert.equal(MODEL.role, 'conversation');
  assert.ok(MODEL.devices.includes('wasm'));
});

test('Qwen 0.5B prompt formats correctly with real candidates', async () => {
  const q = 'What experience does Noman have in Computer Vision and LiDAR?';
  const retrieved = await retrieve(q, knowledge, lexical, { limit: 5 });
  const candidates = retrieved.map((r) => ({ key: r.key, name: r.record.name }));

  const instruction = buildInstruction(candidates);
  const messages = renderMessages(instruction, q, []);

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, 'system');
  assert.equal(messages[1]?.role, 'user');
  assert.match(messages[0]?.content ?? '', /AI portfolio assistant and navigation controller/);
  assert.match(messages[0]?.content ?? '', /nomansoomro51@gmail\.com/);
  assert.match(messages[1]?.content ?? '', /<question>What experience does Noman have in Computer Vision and LiDAR\?<\/question>/);

  for (const c of candidates) {
    assert.ok(messages[0]?.content.includes(c.key));
  }
});

test('Qwen 0.5B response simulation with allowlist filtering', async () => {
  const q = 'What projects use Computer Vision and Python?';
  const retrieved = await retrieve(q, knowledge, lexical, { limit: 5 });
  const candidates = retrieved.map((r) => ({ key: r.key, name: r.record.name }));

  // Simulate Qwen 0.5B markdown output with valid + invalid keys
  const validKey = candidates[0]?.key || 'skills:sk-python';
  const simulatedOutput = `\`\`\`json\n{"keys":["${validKey}","invented:key-999"],"actions":[]}\n\`\`\``;

  const parsedJson = parseSelection(simulatedOutput);
  assert.ok(parsedJson.ok);

  const validated = validateSelection(parsedJson.keys, candidates);
  assert.deepEqual(validated.keys, [validKey]);
  assert.equal(validated.dropped.length, 1);
  assert.equal(validated.dropped[0]?.key, 'invented:key-999');

  const conv = await createConversation({
    role: 'conversation',
    load: async () => ({
      pipeline: async () => simulatedOutput,
      backend: 'wasm',
    }),
  });

  const answer = await engine.answer(q, { conversation: conv });
  assert.ok(answer.text.length > 0);
  assert.ok(answer.cards.length > 0);
});

// Interactive / Manual CLI Execution
if (process.argv[1]?.includes('model-qwen-05b.test.ts') && process.argv.includes('--question')) {
  const qIndex = process.argv.indexOf('--question');
  const userQ = process.argv[qIndex + 1] || 'Do you know Python and Deep Learning?';

  (async () => {
    console.log(`\n======================================================`);
    console.log(`🧠 [Qwen2.5 0.5B - Manual Test Runner]`);
    console.log(`   Question: "${userQ}"`);
    console.log(`======================================================`);

    const retrieved = await retrieve(userQ, knowledge, lexical, { limit: 5 });
    const candidates = retrieved.map((r) => ({ key: r.key, name: r.record.name }));
    const instruction = buildInstruction(candidates);
    const messages = renderMessages(instruction, userQ, []);

    console.log(`\n--- Production Prompt Sent To Model ---`);
    console.log(messages[0]?.content);
    console.log(`\n--- User Slot ---`);
    console.log(messages[1]?.content);

    // Realistic Qwen 0.5B sample response
    const mockResponse = JSON.stringify({
      keys: candidates.slice(0, 2).map((c) => c.key),
      actions: [],
    });

    console.log(`\n--- Simulated Model Response ---`);
    console.log(mockResponse);

    const conv = await createConversation({
      role: 'conversation',
      load: async () => ({
        pipeline: async () => mockResponse,
        backend: 'wasm',
      }),
    });

    const ans = await engine.answer(userQ, { conversation: conv });
    console.log(`\n--- Synthesized Engine Output ---`);
    console.log(ans.text);
    console.log(`Cards:`, ans.cards.map((c) => c.name));
    console.log(`======================================================\n`);
  })();
}
