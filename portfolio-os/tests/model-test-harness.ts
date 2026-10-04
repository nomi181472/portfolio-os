/**
 * tests/model-test-harness.ts
 *
 * Dedicated test harness to test individual models (Qwen2.5 0.5B, Qwen2.5 1.5B, E5 Embedder)
 * and the Portfolio OS Engine locally with custom prompts and questions.
 *
 * Can be run directly via:
 *   npx tsx tests/model-test-harness.ts
 * or with custom arguments:
 *   npx tsx tests/model-test-harness.ts --question "Do you have experience with Kubernetes?" --model "0.5B"
 */

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
  type Conversation,
} from '../lib/agent/models/conversation';
import { retrieve, buildLexicalIndex } from '../lib/agent/retrieve';
import { normaliseQuestion } from '../lib/agent/normalize';
import { routeIntent } from '../lib/agent/intent';
import { MODELS, modelForRole, type ModelRole } from '../lib/agent/registry';
import type { Portfolio } from '../types/portfolio';

// Load actual verified portfolio knowledge
const NOW = new Date('2026-10-04T00:00:00Z');
const rawPortfolio = JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8'));
const parsed = validatePortfolio(rawPortfolio);
if (!parsed.ok) {
  throw new Error('Failed to validate portfolio: ' + JSON.stringify(parsed.issues));
}
const portfolio: Portfolio = parsed.data;
const graph = buildGraph(portfolio);
const knowledge = buildKnowledge(portfolio, graph, { now: NOW });
const aliases = buildAliasTable(knowledge);
const lexical = buildLexicalIndex(knowledge.records);
const engine = buildEngine({ portfolio, now: NOW });

/**
 * Executes a simulated turn with exact production prompt and pipeline mocking or live connection
 */
export async function testModelPrompt({
  modelRole = 'conversation',
  question,
  mockOutput,
  liveTransformersPipeline,
}: {
  modelRole?: ModelRole;
  question: string;
  mockOutput?: string;
  liveTransformersPipeline?: (messages: any, options?: any) => Promise<string>;
}) {
  console.log('\n======================================================');
  console.log(`🤖 TESTING MODEL ROLE: [${modelRole}]`);
  console.log(`   Model ID: ${modelForRole(modelRole).id}`);
  console.log(`❓ USER QUESTION: "${question}"`);
  console.log('======================================================');

  // Step 1: Normalization & Intent Routing
  const normalised = normaliseQuestion(question, aliases);
  const routing = routeIntent(normalised);
  console.log(`\n1. INTENT ANALYSIS:`);
  console.log(`   Intent: ${routing.intent} (confidence: ${(routing.confidence * 100).toFixed(0)}%)`);
  console.log(`   Detected Terms: [${normalised.terms.map((t) => t.term).join(', ') || 'none'}]`);

  // Step 2: Retrieve Relevant Records
  const retrieved = await retrieve(question, knowledge, lexical, { limit: 6 });
  const inScopeRecords = retrieved.map((hit) => ({ key: hit.key, name: hit.record.name }));
  console.log(`\n2. RETRIEVED CANDIDATE RECORDS (${inScopeRecords.length}):`);
  inScopeRecords.forEach((r, idx) => console.log(`   [${idx}] ${r.key} — ${r.name}`));

  // Step 3: Exact Production System Prompt Construction
  const instruction = buildInstruction(inScopeRecords);
  const messages = renderMessages(instruction, question, []);

  console.log(`\n3. EXACT PRODUCTION PROMPT DELIVERED TO MODEL:`);
  console.log(`------------------------------------------------------`);
  console.log(`[SYSTEM PROMPT]:\n${messages[0]?.content}`);
  console.log(`------------------------------------------------------`);
  console.log(`[USER INPUT]:\n${messages[1]?.content}`);
  console.log(`------------------------------------------------------`);

  // Step 4: Model Execution (Mock or Live)
  let rawModelResponse = mockOutput;
  if (!rawModelResponse && liveTransformersPipeline) {
    try {
      console.log(`\n4. RUNNING INFERENCE THROUGH MODEL PIPELINE...`);
      rawModelResponse = await liveTransformersPipeline(messages, {
        do_sample: false,
        max_new_tokens: 64,
        repetition_penalty: 1.05,
      });
    } catch (err: any) {
      console.error(`   Pipeline Error: ${err.message}`);
    }
  }

  if (rawModelResponse) {
    console.log(`\n4. RAW MODEL OUTPUT:\n${rawModelResponse}`);

    // Step 5: JSON & Allowlist Validation
    const parsed = parseSelection(rawModelResponse);
    console.log(`\n5. OUTPUT VALIDATION:`);
    console.log(`   JSON Parse OK: ${parsed.ok}`);
    if (parsed.ok) {
      const validated = validateSelection(parsed.keys, inScopeRecords);
      console.log(`   Keys Selected By Model:`, parsed.keys);
      console.log(`   Keys Surviving Allowlist:`, validated.keys);
      if (validated.dropped.length > 0) {
        console.log(`   ⚠️ Dropped Non-Allowlisted Keys:`, validated.dropped);
      }
    }
  }

  // Step 6: Full Engine Response Synthesis
  const simulatedConversationLayer: Conversation | null = rawModelResponse
    ? await createConversation({
        role: modelRole === 'fluent' ? 'fluent' : 'conversation',
        load: async () => ({
          pipeline: async () => rawModelResponse!,
          backend: 'wasm',
        }),
      })
    : null;

  const engineAnswer = await engine.answer(question, {
    conversation: simulatedConversationLayer,
  });

  console.log(`\n6. SYNTHESIZED PORTFOLIO ANSWER TEXT:`);
  console.log(`   "${engineAnswer.text}"`);
  console.log(`   Cards: [${engineAnswer.cards.map((c) => c.name).join(', ')}]`);
  if (engineAnswer.caveats?.length) {
    console.log(`   Caveats: ${engineAnswer.caveats.join(' | ')}`);
  }
  console.log('======================================================\n');

  return { routing, retrieved, instruction, messages, rawModelResponse, engineAnswer };
}

// If executed directly from command line
if (process.argv[1]?.endsWith('model-test-harness.ts')) {
  const args = process.argv.slice(2);
  const qIndex = args.indexOf('--question');
  const userQ: string = (qIndex !== -1 && args[qIndex + 1]) ? (args[qIndex + 1] as string) : 'Do you have experience with Kubernetes and distributed systems?';

  (async () => {
    // Demonstration 1: Qwen2.5-0.5B with realistic JSON response
    await testModelPrompt({
      modelRole: 'conversation',
      question: userQ,
      mockOutput: '```json\n{"keys":["skills:sk-kubernetes","skills:sk-distributed-systems"],"actions":[]}\n```',
    });

    // Demonstration 2: Qwen2.5-1.5B with realistic JSON response + navigation action
    await testModelPrompt({
      modelRole: 'fluent',
      question: userQ,
      mockOutput: '{"keys":["skills:sk-kubernetes","skills:sk-distributed-systems","projects:proj-navirox"],"actions":[{"kind":"navigate","targetId":"skills:sk-kubernetes","label":"View Kubernetes"}]}',
    });
  })();
}
