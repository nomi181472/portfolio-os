/**
 * tests/agent-widget.test.ts
 *
 * Unit tests verifying UI model list synchronization, greetings, disable contracts, and focus handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getGreetingMessage } from '../components/agent/parts/greetings';

test('greetings contain accurate model descriptions and no JDK typos', () => {
  const defaultGreeting = getGreetingMessage();
  assert.ok(!defaultGreeting.includes('JDK'), 'must not contain JDK typo');

  const embeddingGreeting = getGreetingMessage('embedding');
  assert.match(embeddingGreeting, /384-dimensional|all-MiniLM-L6-v2/);
  assert.ok(!embeddingGreeting.includes('1024-dimensional'));

  const qwenGreeting = getGreetingMessage('conversation');
  assert.match(qwenGreeting, /Qwen2\.5 0\.5B/);
});

test('AgentWidget source verifies UI disable states and startModel boolean contract', () => {
  const widgetSource = readFileSync(
    resolve(process.cwd(), 'components/agent/AgentWidget.tsx'),
    'utf8',
  );

  // Verify suggestion chips are disabled when busy or downloading
  assert.match(
    widgetSource,
    /onClick=\{\(\) => void ask\(suggestion\)\}\s*disabled=\{busy \|\| isDownloading\}/,
    'suggestion chips must be disabled while busy or downloading',
  );

  // Verify Clear Context is disabled when busy or downloading
  assert.match(
    widgetSource,
    /className=\{styles\.contextResetBtn\}\s*disabled=\{busy \|\| isDownloading\}/,
    'clear context must be disabled while busy or downloading',
  );

  // Verify model picker trigger is disabled when busy or downloading
  assert.match(
    widgetSource,
    /disabled=\{isDownloading \|\| busy\}/,
    'model picker trigger must be disabled while busy or downloading',
  );

  // Verify startModel returns Promise<boolean> and startChat chains on boolean result
  assert.match(
    widgetSource,
    /const startModel = useCallback\(\(\): Promise<boolean>/,
    'startModel must return Promise<boolean>',
  );
  assert.match(
    widgetSource,
    /startModel\(\)\.then\(\(ok\) => \{\s*if \(ok/,
    'startChat must chain on startModel returning true',
  );

  // Verify textarea refocus after answer completes
  assert.match(
    widgetSource,
    /inputRef\.current\?\.focus\(\)/,
    'inputRef must be refocused',
  );

  // Verify AVAILABLE_MODELS synchronizes with all-MiniLM-L6-v2 and Qwen2.5 0.5B
  assert.match(widgetSource, /Xenova\/all-MiniLM-L6-v2/);
  assert.match(widgetSource, /onnx-community\/Qwen2\.5-0\.5B-Instruct/);
  assert.ok(!widgetSource.includes('Qwen3.5-0.8B'), 'stale Qwen 0.8B must not be present in model list');
});

test('AgentWidget maintains separate engines for local LLM vs direct/embeddings', () => {
  const widgetSource = readFileSync(
    resolve(process.cwd(), 'components/agent/AgentWidget.tsx'),
    'utf8',
  );

  // Must import both engine builders
  assert.match(widgetSource, /buildEngineFromKnowledge/);
  assert.match(widgetSource, /buildConversationalEngineFromKnowledge/);

  // Must hold separate engine refs
  assert.match(widgetSource, /standardEngineRef = useRef<Engine \| null>\(null\)/);
  assert.match(widgetSource, /conversationalEngineRef = useRef<Engine \| null>\(null\)/);

  // Must select activeEngine based on whether model is local LLM
  assert.match(widgetSource, /const isLocalLLM = selectedModelChoice === 'conversation' \|\| selectedModelChoice === 'fluent'/);
  assert.match(widgetSource, /activeEngine\.answer/);
});
