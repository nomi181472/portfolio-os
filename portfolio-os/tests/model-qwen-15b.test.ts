/**
 * tests/model-qwen-15b.test.ts
 *
 * Dedicated Unit Test for the High-Quality Qwen2.5 1.5B Instruct model layer (`role: 'fluent'`).
 * Tests:
 * 1. Exact system prompt formatting matching production.
 * 2. Allowing user to pass any question to test.
 * 3. Structured actions proposal parsing (navigate / compare) and engine integration.
 * 4. Can be run with custom questions via CLI:
 *    npx tsx tests/model-qwen-15b.test.ts --question "Your custom question here"
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

const MODEL = modelForRole('fluent');

test('Qwen 1.5B configuration matches production registry', () => {
  assert.equal(MODEL.id, 'onnx-community/Qwen2.5-1.5B-Instruct');
  assert.equal(MODEL.role, 'fluent');
  assert.equal(MODEL.autoDownload, false);
  assert.ok(MODEL.devices.includes('wasm'));
});

test('Qwen 1.5B prompt formats with candidate records and contact info', async () => {
  const q = 'Tell me about scalable distributed systems and microservices';
  const retrieved = await retrieve(q, knowledge, lexical, { limit: 5 });
  const candidates = retrieved.map((r) => ({ key: r.key, name: r.record.name }));

  const instruction = buildInstruction(candidates);
  const messages = renderMessages(instruction, q, []);

  assert.equal(messages.length, 2);
  assert.match(messages[0]?.content ?? '', /Distributed Systems, Cloud Architecture, and Software Engineering/);
  assert.match(messages[0]?.content ?? '', /https:\/\/www\.linkedin\.com\/in\/noman-a-70604a175/);

  for (const c of candidates) {
    assert.ok(messages[0]?.content.includes(c.key));
  }
});

test('Qwen 1.5B complex response with navigation actions', async () => {
  const q = 'Tell me about Kubernetes and Python';
  const retrieved = await retrieve(q, knowledge, lexical, { limit: 5 });
  const candidates = retrieved.map((r) => ({ key: r.key, name: r.record.name }));

  const naviroxKey = candidates.find((c) => c.key.includes('navirox'))?.key || candidates[0]?.key || 'projects:proj-navirox';
  const modelProse = 'Noman Ali has worked extensively with Kubernetes container orchestration and Python backend services. Check the NAVIROX project for deep systems details or connect at nomansoomro51@gmail.com.';
  const simulatedOutput = JSON.stringify({
    text: modelProse,
    keys: [naviroxKey],
    actions: [
      {
        kind: 'navigate',
        targetId: naviroxKey,
        label: 'Open NAVIROX Case Study',
      },
    ],
  });

  const parsedJson = parseSelection(simulatedOutput);
  assert.ok(parsedJson.ok);
  assert.equal(parsedJson.text, modelProse);
  assert.equal(parsedJson.actions.length, 1);
  assert.equal(parsedJson.actions[0]?.kind, 'navigate');

  const conv = await createConversation({
    role: 'fluent',
    load: async () => ({
      pipeline: async () => simulatedOutput,
      backend: 'wasm',
    }),
  });

  const answer = await engine.answer(q, { conversation: conv });
  assert.equal(answer.text, modelProse);
  assert.ok(answer.cards.length > 0);
});

// Interactive / Manual CLI Execution
if (process.argv[1]?.includes('model-qwen-15b.test.ts') && process.argv.includes('--question')) {
  const qIndex = process.argv.indexOf('--question');
  const userQ = process.argv[qIndex + 1] || 'What is NAVIROX and your experience with autonomous systems?';

  (async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 [Qwen2.5 1.5B - Manual Test Runner]`);
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

    const targetKey = candidates[0]?.key || 'projects:proj-navirox';
    const mockResponse = JSON.stringify({
      keys: candidates.slice(0, 3).map((c) => c.key),
      actions: [
        {
          kind: 'navigate',
          targetId: targetKey,
          label: `Open ${candidates[0]?.name || 'Record'}`,
        },
      ],
    });

    console.log(`\n--- Simulated Model Response ---`);
    console.log(mockResponse);

    const conv = await createConversation({
      role: 'fluent',
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
