/**
 * LLM mode must be 100% model-written: no deterministic match panel / score, no canned text on the normal path,
 * and long postings must gather evidence for each requirement.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePortfolio } from '../lib/validate';
import { buildConversationalEngine } from '../lib/agent/engine';
import type { ConversationLayer } from '../lib/agent/engine';
import { buildInstruction } from '../lib/agent/models/conversation';

const NOW = new Date('2026-10-04T00:00:00Z');
const parsed = validatePortfolio(JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8')));
assert.ok(parsed.ok);
const portfolio = parsed.data;

const POSTING = `Key Requirements 8+ years of engineering experience with 4+ years of hands-on computer vision experience. Principal or Lead-level ability to independently diagnose and solve complex AI/model-performance problems. Deep practical experience with YOLO and modern object detection architectures. Strong experience with object detection, multi-object tracking, pedestrian/vehicle counting and video analytics. Proven experience improving the accuracy of computer vision models deployed in real-world production environments. Experience handling challenges such as dense crowds, overlapping objects/occlusion, object re-identification, camera perspective and variable environmental conditions. Strong Python and modern AI/ML framework experience, ideally including PyTorch and OpenCV. Experience evaluating models using appropriate detection/tracking metrics and translating model improvements into measurable production accuracy. Ability to work effectively within an existing senior engineering team while providing principal-level technical leadership. Production experience and demonstrated technical capability are prioritized over certifications. Nice To Have compare noman skills with these requirements, give me answer in grid`;

function capture(reply = 'ok') {
  const seen: { retrieved: readonly any[]; facts: any }[] = [];
  const layer = { select: async (_q: string, retrieved: readonly any[], _h: unknown, facts: any) => { seen.push({ retrieved, facts }); return { keys: [], text: reply }; } } as unknown as ConversationLayer;
  return { seen, layer };
}

test('a pasted job posting is not scored deterministically: no match object, no matchResult in the prompt facts', async () => {
  const engine = buildConversationalEngine({ portfolio, now: NOW });
  const { seen, layer } = capture('Here is how he lines up.');
  const answer = await engine.answer(POSTING, { conversation: layer });
  assert.equal(answer.text, 'Here is how he lines up.');
  assert.equal((answer as any).match, undefined, 'no hard-coded match panel in LLM mode');
  assert.equal(seen[0]!.facts.matchResult, undefined, 'the model reads the posting itself');
  assert.equal(answer.intent, 'general');
});

test('a long posting gathers broad evidence (up to 10 records) instead of 8 dominated by a few words', async () => {
  const engine = buildConversationalEngine({ portfolio, now: NOW });
  const { seen, layer } = capture();
  await engine.answer(POSTING, { conversation: layer });
  const n = seen[0]!.retrieved.length;
  assert.ok(n > 8 && n <= 10, `expected 9-10 evidence records for a long brief, got ${n}`);
  assert.equal(new Set(seen[0]!.retrieved.map((r: any) => r.key)).size, n, 'records must be unique');
  const short = capture();
  await engine.answer('What did Noman build at Ktrade?', { conversation: short.layer });
  assert.ok(short.seen[0]!.retrieved.length <= 8, 'short questions keep the 8-record budget');
});

test('an empty model reply is retried once, then the second reply is used', async () => {
  const engine = buildConversationalEngine({ portfolio, now: NOW });
  let calls = 0;
  const layer = { select: async () => { calls += 1; return { keys: [], text: calls === 1 ? '   ' : 'Second try works.' }; } } as unknown as ConversationLayer;
  const answer = await engine.answer('Tell me about Noman', { conversation: layer });
  assert.equal(calls, 2);
  assert.equal(answer.text, 'Second try works.');
});

test('the instruction asks for a natural voice and a requirements grid (no forced-template wording)', () => {
  const ins = buildInstruction({ records: [], profile: { name: 'Noman Ali', discipline: 'Engineer', focus: 'Systems', email: 'a@b.dev', links: [] }, availabilityStatement: 'Open.' } as any);
  assert.match(ins, /thoughtful, friendly colleague/);
  assert.match(ins, /markdown table \(a grid\)/);
  assert.match(ins, /Requirement \| Fit: Strong, Partial, or Not documented \| Evidence/);
  assert.doesNotMatch(ins, /You MUST use markdown formatting/);
});
