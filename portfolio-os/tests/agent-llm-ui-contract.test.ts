/**
 * Contract tests for "LLM mode is 100% model-written": the widget and engine must not add canned assistant text or unrelated evidence chips
 * when a local LLM is selected. (Static checks: the widget needs a browser to render, so these guard the source-level contract.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const widget = readFileSync(resolve(process.cwd(), 'components/agent/AgentWidget.tsx'), 'utf8');
const engine = readFileSync(resolve(process.cwd(), 'lib/agent/engine/conversationalEngine.ts'), 'utf8');

test('the canned "I am alive!" banner and random greeting are gone from the widget', () => {
  assert.doesNotMatch(widget, /I am alive/);
  assert.doesNotMatch(widget, /pickRandomGreeting/);
  assert.doesNotMatch(widget, /greetingMessage/);
});

test('when a local LLM is ready, the model writes its own welcome (hidden visitor bubble, once per model)', () => {
  assert.match(widget, /const LLM_CHOICES/);
  assert.match(widget, /void ask\('Hi', \{ welcome: true \}\)/);
  assert.match(widget, /welcomedForRef/);
  assert.match(widget, /turn\.welcome \? null/);
});

test('LLM answers show a plain typing indicator instead of a canned status sentence', () => {
  assert.match(widget, /LLM_CHOICES\.has\(selectedModelChoice\)\s*\?\s*'…'/);
  assert.doesNotMatch(widget, /Analyzing context & synthesizing answer/);
});

test('the engine no longer falls back to "top 3 retrieved records" as evidence chips in LLM mode', () => {
  assert.doesNotMatch(engine, /relevant\.slice\(0, 3\)\.map\(\(r\) => r\.key\)/);
  assert.match(engine, /const cards: EntityRef\[\] = \[\];/);
});
