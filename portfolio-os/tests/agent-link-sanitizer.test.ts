/**
 * Regression tests for the output link guard (lib/agent/sanitizeLinks.ts, used by the conversational engine).
 * Goal: visitors can navigate to REAL portfolio pages from the chatbot's markdown; the model can never send them to a page that does not exist.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePortfolio } from '../lib/validate';
import { buildGraph } from '../lib/graph';
import { buildKnowledge } from '../lib/agent/knowledge';
import { buildConversationalEngine } from '../lib/agent/engine';
import type { ConversationLayer } from '../lib/agent/engine';
import { buildLinkIndex, repairLinks } from '../lib/agent/sanitizeLinks';

const NOW = new Date('2026-10-04T00:00:00Z');
const parsed = validatePortfolio(JSON.parse(readFileSync(resolve(process.cwd(), 'content/portfolio.json'), 'utf8')));
assert.ok(parsed.ok, 'portfolio must validate');
const portfolio = parsed.data;
const knowledge = buildKnowledge(portfolio, buildGraph(portfolio), { now: NOW });
const withHref = knowledge.records.filter((r) => r.href && r.kind !== 'skills');
const A = withHref[0]!;
const B = withHref[withHref.length - 1]!;
const index = buildLinkIndex(knowledge.records, knowledge.navigation);

function layer(reply: (retrieved: readonly any[]) => string): ConversationLayer {
  return { select: async (_q, retrieved) => ({ keys: retrieved.slice(0, 3).map((r: any) => r.key), text: reply(retrieved) }) } as ConversationLayer;
}

test('unit: real routes are kept, with trailing slash / anchor / query tolerated', () => {
  for (const url of [A.href!, `${A.href}/`, `${A.href}#details`, `${A.href}?x=1`]) {
    assert.equal(repairLinks(`See [${A.name}](${url}).`, index), `See [${A.name}](${url}).`);
  }
});

test('unit: a real page that was NOT retrieved this turn is still kept', () => {
  assert.equal(repairLinks(`[${B.name}](${B.href})`, index), `[${B.name}](${B.href})`);
});

test('unit: a near-miss path is repaired from the label; an unknown label is reduced to text', () => {
  assert.equal(repairLinks(`[${A.name}](/wrong/${A.id ?? 'x'}-typo)`, index), `[${A.name}](${A.href})`);
  assert.equal(repairLinks('[Totally Invented Thing](/products/does-not-exist)', index), 'Totally Invented Thing');
});

test('unit: unknown external sites are removed, prompt-listed ones are kept', () => {
  assert.equal(repairLinks('[Bad](https://evil.example/x)', index), 'Bad');
  assert.equal(repairLinks('[Me](https://www.linkedin.com/in/x)', index, new Set(['https://www.linkedin.com/in/x'])), '[Me](https://www.linkedin.com/in/x)');
});

test('engine: valid links survive and invented ones are stripped', async () => {
  const engine = buildConversationalEngine({ portfolio, now: NOW });
  let valid = '';
  const answer = await engine.answer(`Tell me about ${A.name}`, {
    conversation: layer((retrieved) => {
      const r = retrieved.find((x: any) => x.href) ?? retrieved[0];
      valid = `[${r.name}](${r.href})`;
      return `Here it is: ${valid}. Also see [Invented](/products/does-not-exist) and [Bad](https://evil.example/x).`;
    }),
  });
  assert.ok(answer.text.includes(valid), `valid link ${valid} must be preserved, got: ${answer.text}`);
  assert.ok(!answer.text.includes('does-not-exist') && !answer.text.includes('evil.example'));
  assert.ok(answer.text.includes('Invented') && answer.text.includes('Bad'));
});

test('engine: a link from an earlier turn is still allowed in a follow-up whose retrieval no longer returns it', async () => {
  const engine = buildConversationalEngine({ portfolio, now: NOW });
  let firstLink = '';
  const first = await engine.answer(`Tell me about ${A.name}`, {
    conversation: layer((retrieved) => { const r = retrieved.find((x: any) => x.href)!; firstLink = `[${r.name}](${r.href})`; return `It is ${firstLink}.`; }),
  });
  assert.ok(first.text.includes(firstLink));
  const second = await engine.answer('Where can I read more about it?', { conversation: layer(() => `You can read more here: ${firstLink}.`) });
  assert.ok(second.text.includes(firstLink), `link from the earlier turn must be preserved, got: ${second.text}`);
});
