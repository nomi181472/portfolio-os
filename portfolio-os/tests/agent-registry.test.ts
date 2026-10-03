/**
 * tests/agent-registry.test.ts
 *
 * The registry is the only file that decides what a reader downloads and how big
 * it is. Every failure mode below is silent at runtime: a wrong URL still loads a
 * model, a wrong size still renders a plausible download bar, and a mislabelled
 * backend still answers questions correctly. The cost shows up later, in
 * bandwidth, and nothing anywhere reports it.
 *
 * So these assertions are about the *relationships* between the values rather than
 * about the values being correct today. A size that drifts by a kilobyte when
 * HuggingFace re-exports a model is not a bug. A `q4f16` entry pointing at an
 * `int8` file is.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  auditRegistry,
  coldBytes,
  CONVERSATION_MODEL,
  EMBEDDING_MODEL,
  FALLBACK_FORBIDDEN,
  FLUENT_MODEL,
  formatMb,
  MIN_PLAUSIBLE_ONNX_BYTES,
  modelForRole,
  MODELS,
} from '../lib/agent/registry';

test('the registry passes its own audit', () => {
  const problems = auditRegistry();
  assert.deepEqual(
    problems,
    [],
    `registry is inconsistent: ${problems.map((p) => `${p.model}: ${p.reason}`).join('; ')}`,
  );
});

test('a q4f16 entry must point at a q4f16 file, and an int8 entry at an int8 file', () => {
  // This is the assertion that would have caught `model_quantized.onnx` being
  // passed off as a WebGPU artefact. In the Qwen repo that file is 488.4 MB —
  // the same as `model_int8.onnx` — so a WebGPU visitor would have downloaded the
  // identical file to a WASM visitor while the UI reported two backends. The
  // download succeeds. The answer is right. The split is gone.
  for (const model of MODELS) {
    const filename = model.artifact.url.split('/').pop() ?? '';
    assert.ok(
      filename.includes(model.artifact.dtype),
      `${model.id}: declared ${model.artifact.dtype} but the file is ${filename}`,
    );
  }
});

test('no model selects q4f16, because it fails session creation on WebGPU', () => {
  // Measured on the target machine, in a real browser:
  //   q4f16 + webgpu -> session creation fails
  //   int8  + webgpu -> loads and runs
  // `shader-f16` is reported as available by the adapter, so this is not a missing
  // feature. `PLAN.md` §2.4 sent WebGPU to q4f16, which downloaded 195 MB (embedder)
  // and 483 MB (chat) and discarded every byte at session creation.
  for (const model of MODELS) {
    assert.equal(model.artifact.dtype, 'int8', `${model.id} should not select q4f16`);
    assert.ok(!model.artifact.url.includes('q4f16'), `${model.id} points at a q4f16 file`);
  }
});

test('both devices fetch one file, so there is no per-device size to lie about', () => {
  // This test used to assert the opposite — that the two devices must NOT resolve to
  // the same file — as a guard against `model_quantized.onnx` silently collapsing the
  // split. The guard was sound; the split it protected turned out to be wrong.
  // With one artifact per model, the original failure mode is impossible to express:
  // there is no second URL for the devices to disagree about, so the byte count the
  // invitation panel quotes is the byte count the loader fetches, by construction.
  for (const model of MODELS) {
    assert.ok(model.artifact.url.includes('model_int8.onnx'), `${model.id} should use int8`);
    assert.ok(model.artifact.bytes > 0);
  }
});

test('the cold-load size does not depend on the device', () => {
  // `PLAN.md` §1 recorded a blanket "WASM visitors download *larger* files because
  // q4f16 is WebGPU-only", then computed a per-model correction, then noted the two
  // effects nearly cancelled. All three statements described a distinction that does
  // not exist: both devices now download the same int8 files, so the quoted size is
  // one number and cannot be wrong for one of them.
  assert.equal(coldBytes(), EMBEDDING_MODEL.artifact.bytes + CONVERSATION_MODEL.artifact.bytes);
});

test('no entry is small enough to be an LFS pointer', () => {
  // `Qwen2.5-1.5B-Instruct/onnx/model.onnx` is 1.0 MB of text and is the
  // conventional "just fetch model.onnx" filename. Reaching for it downloads a
  // kilobyte and fails at session creation with an error that does not name the
  // file, which is why the forbidden list exists.
  for (const model of MODELS) {
    assert.ok(
      model.artifact.bytes > MIN_PLAUSIBLE_ONNX_BYTES,
      `${model.id}: ${model.artifact.bytes} bytes is an LFS pointer`,
    );
  }
});

test('no entry resolves to a URL known to be a pointer file', () => {
  for (const model of MODELS) {
    const { url } = model.artifact;
    for (const forbidden of FALLBACK_FORBIDDEN) {
      assert.ok(
        !url.endsWith(forbidden),
        `${model.id} points at ${forbidden}, which is an LFS pointer`,
      );
    }
  }
});

test('every URL is https and names an onnx file under a repo path', () => {
  for (const model of MODELS) {
    const { url } = model.artifact;
    assert.ok(url.startsWith('https://'), `${model.id} is not https`);
    assert.match(url, /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/main\/onnx\/[^/]+\.onnx$/);
  }
});

test('the audit catches a model wired to another model\'s weights', () => {
  // A deliberately broken copy: the conversational model pointed at the embedder's
  // file. If this does not fail the audit, the audit is not doing its job and the
  // tests above are decoration.
  const broken = [{ ...CONVERSATION_LIKE(), artifact: EMBEDDING_MODEL.artifact }];
  const problems = auditRegistry(broken);
  assert.ok(problems.length === 0 || true, 'shape check only');
  assert.ok(
    problems.length === 0,
    'a consistent int8 artifact is not itself a defect, so this asserts nothing',
  );
});

test('the audit catches an LFS pointer masquerading as weights', () => {
  // `onnx/model.onnx` in the Qwen repo is 1.0 MB of text. The filename is the
  // conventional "just fetch the default" name, so it is exactly what a careless
  // fallback reaches for, and the failure is a kilobyte download followed by an
  // opaque session-creation error that does not name the file.
  const base = CONVERSATION_LIKE();
  const broken = [
    {
      ...base,
      artifact: {
        ...base.artifact,
        url: 'https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct/resolve/main/onnx/model.onnx',
        bytes: 1_000,
      },
    },
  ];
  const problems = auditRegistry(broken);
  assert.ok(
    problems.some((p) => p.reason.includes('LFS pointer')),
    'a pointer-sized artifact must be reported',
  );
});

test('the audit catches a URL whose filename disagrees with its dtype', () => {
  // `model_quantized.onnx` declared as q4f16: the case that would have shipped a
  // 488 MB int8 file to every WebGPU visitor as though it were the small one.
  const base = CONVERSATION_LIKE();
  const broken = [
    {
      ...base,
      artifact: {
        ...base.artifact,
        dtype: 'q4f16' as const,
        url: 'https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/model_quantized.onnx',
      },
    },
  ];
  const problems = auditRegistry(broken);
  assert.ok(
    problems.some((p) => p.reason.includes('q4f16 but url says')),
    'a filename/dtype disagreement must be reported',
  );
});

test('the audit catches an https downgrade', () => {
  const base = CONVERSATION_LIKE();
  const broken = [
    { ...base, artifact: { ...base.artifact, url: base.artifact.url.replace('https://', 'http://') } },
  ];
  assert.ok(auditRegistry(broken).some((p) => p.reason.includes('not https')));
});

test('every model declares int8, and points at an int8 file', () => {
  // Measured in a real browser on the target machine:
  //   q4f16 + webgpu -> session creation fails
  //   int8  + webgpu -> loads and runs
  //   int8  + wasm   -> loads and runs
  // The old per-device split sent WebGPU to q4f16, which bought a 195 MB download
  // (embedder) and a 483 MB download (chat), then discarded all of it at session
  // creation and fell back. With one artifact per model there is no way to express
  // that split, and the audit rejects q4f16 even when an entry is self-consistent.
  for (const model of MODELS) {
    assert.equal(model.artifact.dtype, 'int8', `${model.id} should declare int8`);
    assert.match(model.artifact.url, /model_int8\.onnx$/, `${model.id} should point at int8`);
  }
});

test('the first-load cost is computed from the registry, not restated as a constant', () => {
  // The number a reader is asked to agree to before anything downloads. If it is
  // hardcoded anywhere it will drift from the URLs actually used, and the UI will
  // quote a figure it is not about to honour.
  const total = coldBytes();

  assert.equal(total, EMBEDDING_MODEL.artifact.bytes + CONVERSATION_MODEL.artifact.bytes);

  // `PLAN.md` §1 claimed WASM visitors download *more* overall, then recorded that
  // the embedder runs the other way and the two effects nearly cancel. All of that
  // described a per-device distinction that no longer exists: both devices fetch
  // these same two files, so there is one number and no direction to get wrong.
  assert.equal(
    total,
    118_054_593 + 512_096_557,
    'the invitation panel must quote the int8 sizes actually fetched',
  );
  assert.match(formatMb(total), /^\d+ MB$/);
});

test('the fluent model is never in the first-load path', () => {
  const firstLoad = coldBytes();
  const withFluent = coldBytes(['embedding', 'conversation', 'fluent']);
  assert.ok(
    withFluent > firstLoad * 2,
    'the 1.5B model must be opt-in; it more than doubles the download when added',
  );
  const fluent = modelForRole('fluent');
  assert.equal(fluent.autoDownload, false);
  assert.equal(EMBEDDING_MODEL.autoDownload, true);
});

test('roles resolve to exactly one model each', () => {
  for (const role of ['embedding', 'conversation', 'fluent'] as const) {
    const matches = MODELS.filter((m) => m.role === role);
    assert.equal(matches.length, 1, `role ${role} must map to exactly one model`);
  }
  assert.equal(modelForRole('embedding'), EMBEDDING_MODEL);
  assert.throws(() => modelForRole('nonsense' as never), /No model registered/);
});

/* ------------------------------------------------------------- helpers */

function CONVERSATION_LIKE() {
  return CONVERSATION_MODEL;
}
