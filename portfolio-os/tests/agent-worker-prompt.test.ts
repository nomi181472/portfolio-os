/**
 * Contract test: the Web Worker (primary generation path in the widget) must build its chat messages with renderMessages(),
 * so user turns are fenced in <question>…</question> exactly like the main-thread fallback and the fine-tuning data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderMessages } from '../lib/agent/models/conversation';

const worker = readFileSync(resolve(process.cwd(), 'lib/agent/workers/agent.worker.ts'), 'utf8');

test('worker builds messages through renderMessages (no hand-built, unfenced user turns)', () => {
  assert.match(worker, /\{ renderMessages \} = await import\('\.\.\/models\/conversation'\)/);
  assert.match(worker, /renderMessages\(req\.instruction, req\.question/);
  assert.doesNotMatch(worker, /content:\s*req\.question/);
  assert.doesNotMatch(worker, /content:\s*h\.question/);
});

test('renderMessages fences every user turn and leaves assistant turns untouched', () => {
  const m = renderMessages('SYS', 'now?', [{ question: 'first', answer: 'A1', keys: [] } as any]);
  assert.deepEqual(m.map((x) => x.role), ['system', 'user', 'assistant', 'user']);
  assert.equal(m[1]!.content, '<question>first</question>');
  assert.equal(m[2]!.content, 'A1');
  assert.equal(m[3]!.content, '<question>now?</question>');
});
