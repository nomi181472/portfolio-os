/**
 * tests/agent-brain-registry.test.ts
 *
 * Unit tests for model registry definitions, audit integrity, and backend detection.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  auditRegistry,
  coldBytes,
  formatMb,
  modelForRole,
  MODELS,
  EMBEDDING_MODEL,
  CONVERSATION_MODEL,
  SMOLLM_MODEL,
} from '../lib/agent/registry';
import { detectBackend } from '../lib/agent/models/brain';

test('production models match verified registry configurations', () => {
  // Embedding model: all-MiniLM-L6-v2
  assert.equal(EMBEDDING_MODEL.id, 'Xenova/all-MiniLM-L6-v2');
  assert.equal(EMBEDDING_MODEL.role, 'embedding');
  assert.equal(EMBEDDING_MODEL.artifact.dtype, 'int8');
  assert.ok(EMBEDDING_MODEL.artifact.bytes > 20_000_000);

  // Conversational model: Qwen2.5-0.5B-Instruct
  assert.equal(CONVERSATION_MODEL.id, 'onnx-community/Qwen2.5-0.5B-Instruct');
  assert.equal(CONVERSATION_MODEL.role, 'conversation');
  assert.equal(CONVERSATION_MODEL.artifact.dtype, 'int8');
  assert.ok(CONVERSATION_MODEL.artifact.bytes > 400_000_000);

  // Conversational model: SmolLM2-360M-Instruct
  assert.equal(SMOLLM_MODEL.id, 'onnx-community/SmolLM2-360M-Instruct-ONNX');
  assert.equal(SMOLLM_MODEL.role, 'smollm');
  assert.equal(SMOLLM_MODEL.artifact.dtype, 'int8');
  assert.ok(SMOLLM_MODEL.artifact.bytes > 300_000_000);
});

test('auditRegistry validates production models with zero problems', () => {
  const problems = auditRegistry(MODELS);
  assert.equal(problems.length, 0);
});

test('coldBytes accurately sums downloaded weights by role', () => {
  const embeddingBytes = coldBytes(['embedding']);
  assert.equal(embeddingBytes, EMBEDDING_MODEL.artifact.bytes);

  const totalBytes = coldBytes(['embedding', 'conversation']);
  assert.equal(totalBytes, EMBEDDING_MODEL.artifact.bytes + CONVERSATION_MODEL.artifact.bytes);
});

test('formatMb displays human-readable megabytes', () => {
  assert.equal(formatMb(118_054_593), '118 MB');
  assert.equal(formatMb(512_096_557), '512 MB');
});

test('detectBackend falls back to wasm when WebGPU policy or device is disabled', async () => {
  const result = await detectBackend(['wasm']);
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fellBack, true);
});
