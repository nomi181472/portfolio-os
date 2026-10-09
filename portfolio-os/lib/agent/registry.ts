/**
 * lib/agent/registry.ts
 *
 * What to download, from where, in what shape.
 *
 * Pure data and pure functions. No imports, no DOM, no runtime. That is not
 * stylistic: the whole point of this file is that the expensive decisions — which
 * quantisation, which host, which device — can be checked by `node:test` in
 * milliseconds instead of by downloading 461 MB and watching it fail. The three
 * tests over this file assert the invariants that a wrong value would break
 * silently, and every one of those failures has no error message at runtime.
 *
 * The central trap, and the reason this file exists as data rather than as string
 * concatenation at the call site:
 *
 * **A HuggingFace filename does not tell you the quantisation.**
 * `model_quantized.onnx` appears in all three repositories and is a *different
 * file* in each. In `onnx-community/Qwen2.5-0.5B-Instruct` it is 488.4 MB —
 * byte-for-byte the size of `model_int8.onnx`, because `quantized` is an alias for
 * int8 there. Building the WebGPU path from it would have made every visitor
 * download the same 488 MB file while the UI reported two different backends, and
 * `PLAN.md` §2.4's entire per-device split would have quietly stopped existing.
 * Nothing throws. The download succeeds, the model loads, the answer is correct.
 * It is simply 30 MB heavier than intended on WebGPU and identical on WASM, which
 * is exactly the kind of regression nobody notices until bandwidth costs money.
 *
 * So every URL below names its quantisation in the filename, and the test suite
 * pins the measured sizes that were read from each repository's own file listing on
 * 2026-10-01. A typo in a URL fails the tests rather than the browser.
 *
 * **Every model here is `int8`, for every device.** `PLAN.md` §2.4 used to split
 * them — `q4f16` on WebGPU, `int8` on WASM — reasoning that fp16 compute was the
 * WebGPU-native choice. Measured in a browser on this machine, that is backwards:
 * `q4f16` fails session creation on WebGPU while `int8` loads and runs on both.
 * So the split bought a large download that was discarded at session creation, and
 * a byte count the invitation panel quoted that no visitor ever paid. The type now
 * carries one `artifact` per model and the audit rejects `q4f16` outright, so the
 * split cannot be reintroduced by a well-meaning edit.
 */

/** Which compute backend the weights will run on. Reported, never assumed. */
export type ModelBackend = 'webgpu' | 'wasm';

export type ModelRole = 'embedding' | 'conversation' | 'fluent' | 'smollm';

export interface ModelArtifact {
  /**
   * Absolute URL to one ONNX file.
   *
   * Absolute rather than a repo id plus a path so that a `localModelPath` /
   * `remoteHost` override in `env` cannot silently redirect it somewhere else.
   * The whole verification story in this file depends on the URL being exactly
   * what was checked.
   */
  readonly url: string;
  /** Bytes, as reported by the HuggingFace API. Enforced by test. */
  readonly bytes: number;
  /**
   * What ONNX Runtime calls the tensor type. Recorded separately from the
   * filename because that is where the two drift apart.
   */
  readonly dtype: 'q4f16' | 'int8';
}

export interface ModelDefinition {
  readonly id: string;
  readonly role: ModelRole;
  /** Shown in the UI. Never a claim about capability. */
  readonly label: string;
  /**
   * The one file this model downloads, whichever device runs it.
   *
   * Was two slots — `{ webgpu, wasm }` — because `PLAN.md` §2.4 assigned `q4f16` to
   * WebGPU and `int8` to WASM. That split was measured and is wrong on the target
   * machine: `q4f16` fails session creation on WebGPU there, while `int8` loads and
   * runs on both devices. One artifact is therefore not a simplification, it is the
   * accurate description — and it removes the class of bug where the byte count a
   * device is quoted disagrees with the file it is actually handed.
   */
  readonly artifact: ModelArtifact;

  /**
   * Devices this model is allowed to run on, best first.
   *
   * A list rather than a boolean because "is WebGPU OK?" is per model, and the
   * measured answers are not uniform.
   *
   * **Both models are WASM-only, for two different measured reasons.**
   *
   * *Conversational model — WebGPU is wrong.* Qwen `int8` loads on WebGPU (167s) and
   * then generates degenerate output: `"What is Kafka?333333333333333333333333"`,
   * taking **237s for 24 tokens** against a correct 7.0s answer on WASM. So on this
   * stack WebGPU is simultaneously ~34x slower and produces nonsense.
   *
   * That failure is *silent*, which is what disqualifies it. A session that refuses to
   * create raises an error the UI can report. A session that initialises and emits
   * `333333` renders as a plausible answer containing nothing true, on a page whose
   * entire premise is that answers are evidence-bound. Shipping that would be a
   * correctness regression dressed as a performance feature.
   *
   * *Embedder — WebGPU works, and is still a net loss here.* E5 `int8` loads on WebGPU
   * in 49.1s and produces correct embeddings, so the device is not broken. But this
   * app's inference shape is 125 small sequential embedding calls, and WebGPU's
   * per-dispatch overhead dominates at that size: measured **~10s per passage**, so
   * indexing alone ran to roughly twenty minutes, against ~95s on WASM for the model
   * *and* the whole index. WebGPU wins the load and loses the workload by more than an
   * order of magnitude.
   *
   * So the device is left available and simply not chosen. Adding `'webgpu'` back to a
   * list is the entire change if a future runtime fixes the int8 path or the corpus is
   * ever batched into one dispatch — and an explicit `backend` still overrides this, so
   * the device can always be forced for diagnosis.
   */
  readonly devices: readonly ModelBackend[];
  /**
   * Whether a cold visitor is offered this model at all. The fluent model is 1165
   * MB and is opt-in; it is never in the first-load path.
   */
  readonly autoDownload: boolean;
}

/**
 * The all-MiniLM-L6-v2 embedder. 384 dimensions, mean-pooled and L2-normalised at use time.
 *
 * Highly efficient quantized (~23 MB) lightweight embedding model running locally via ONNX Runtime.
 */
export const EMBEDDING_MODEL: ModelDefinition = {
  id: 'Xenova/all-MiniLM-L6-v2',
  role: 'embedding',
  label: 'Semantic search (all-MiniLM-L6-v2)',
  autoDownload: true,
  artifact: {
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_int8.onnx',
    bytes: 22_972_370,
    dtype: 'int8',
  },
  devices: ['wasm'],
};

/**
 * The conversational model. Small on purpose: 0.5B is the point at which a
 * browser can hold a whole turn's context without the answer taking longer than
 * the reader's patience.
 *
 * Note `model_quantized.onnx` is deliberately absent despite being 488.4 MB and
 * looking like the obvious choice — see the file header.
 */
export const CONVERSATION_MODEL: ModelDefinition = {
  id: 'onnx-community/Qwen2.5-0.5B-Instruct',
  role: 'conversation',
  label: 'Conversation (Qwen2.5 0.5B)',
  autoDownload: true,
  artifact: {
    url: 'https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/model_int8.onnx',
    bytes: 512_096_557,
    dtype: 'int8',
  },
  devices: ['wasm'],
};

/**
 * SmolLM2 360M Instruct — ultra-compact model (360M params) for fast client-side inference.
 */
export const SMOLLM_MODEL: ModelDefinition = {
  id: 'onnx-community/SmolLM2-360M-Instruct-ONNX',
  role: 'smollm',
  label: 'SmolLM2 360M Instruct (Ultra-light)',
  autoDownload: false,
  artifact: {
    url: 'https://huggingface.co/onnx-community/SmolLM2-360M-Instruct-ONNX/resolve/main/onnx/model_int8.onnx',
    bytes: 363_115_149,
    dtype: 'int8',
  },
  devices: ['wasm'],
};

/**
 * The optional 1.5B, for a reader who wants a better answer and is willing to wait
 * for it. Never auto-downloaded: 1165 MB is not a thing to push on someone who
 * asked a question.
 *
 * **There is no fp32 export of this repo.** `onnx/model.onnx` is a 1.0 MB LFS
 * pointer — 1,000 bytes of text, not weights. A WebGPU path that "fell back" to
 * `model.onnx` would download a kilobyte and fail at session creation with an
 * error that does not name the file. `FALLBACK_FORBIDDEN` below exists to make
 * that specific mistake impossible to express.
 */
export const FLUENT_MODEL: ModelDefinition = {
  id: 'onnx-community/Qwen2.5-1.5B-Instruct',
  role: 'fluent',
  label: 'Conversation, higher quality (Qwen2.5 1.5B)',
  autoDownload: false,
  artifact: {
    url: 'https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct/resolve/main/onnx/model_int8.onnx',
    bytes: 1_578_954_293,
    dtype: 'int8',
  },
  // Never downloaded without asking, so it is never measured on a second device.
  // WASM-only by default rather than by claim: opting in should require evidence.
  devices: ['wasm'],
};

export const MODELS: readonly ModelDefinition[] = [
  EMBEDDING_MODEL,
  CONVERSATION_MODEL,
  SMOLLM_MODEL,
  FLUENT_MODEL,
];

export function modelForRole(role: ModelRole): ModelDefinition {
  const found = MODELS.find((model) => model.role === role);
  if (!found) {
    // Unreachable through the `ModelRole` union. Exists so that a typo in a caller
    // fails here with a named role instead of deep inside an import.
    throw new Error(`No model registered for role "${role}"`);
  }
  return found;
}

/**
 * Bytes a cold visitor downloads, by role.
 *
 * Reported to the UI before anything is fetched. It is the number a reader needs
 * to decide, and computing it from the registry rather than a constant means the
 * figure cannot drift away from the URLs actually used.
 */
export function coldBytes(roles: readonly ModelRole[] = ['embedding', 'conversation']): number {
  return roles.reduce((sum, role) => sum + modelForRole(role).artifact.bytes, 0);
}

/** Human-readable MB, for the invitation panel. Decimal, not binary. */
export function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/* ------------------------------------------------------------------ dtypes */

/* --------------------------------------------------------- guard rails */

/**
 * Paths that look like a model file but are not one.
 *
 * `onnx/model.onnx` in `Qwen2.5-1.5B-Instruct` is a 1.0 MB LFS pointer. It is the
 * conventional "just fetch the default" filename, so it is exactly what a
 * careless fallback reaches for, and the failure is a kilobyte download followed by
 * an opaque session-creation error.
 */
export const FALLBACK_FORBIDDEN = [
  'onnx-community/Qwen2.5-1.5B-Instruct/resolve/main/onnx/model.onnx',
  'onnx-community/Qwen2.5-1.5B-Instruct/resolve/main/onnx/model_fp16.onnx',
] as const;

/** Below this, a `.onnx` URL is an LFS pointer rather than weights (~20 MB min). */
export const MIN_PLAUSIBLE_ONNX_BYTES = 20_000_000;

export interface RegistryProblem {
  readonly model: string;
  readonly reason: string;
}

/**
 * Every way a registry entry could be wrong without any of it throwing.
 *
 * Called by the tests and by `brain.ts` before a fetch, because a check that only
 * runs in CI is a check that does not run. Returns problems rather than throwing:
 * a corrupt entry should surface in the UI as a named, explainable failure, not a
 * stack trace.
 */
export function auditRegistry(models: readonly ModelDefinition[] = MODELS): RegistryProblem[] {
  const problems: RegistryProblem[] = [];

  for (const model of models) {
    const { artifact } = model;
    const tail = artifact.url.split('/').pop() ?? '';

    if (!artifact.url.startsWith('https://')) {
      problems.push({ model: model.id, reason: 'url is not https' });
    }
    if (artifact.dtype === 'int8' && !tail.includes('int8')) {
      problems.push({ model: model.id, reason: `dtype says int8 but url says ${tail}` });
    }
    if (artifact.dtype === 'q4f16' && !tail.includes('q4f16')) {
      problems.push({ model: model.id, reason: `dtype says q4f16 but url says ${tail}` });
    }
    // q4f16 is rejected even when the entry is internally consistent, because it is
    // known-broken here rather than merely mislabelled: it fails session creation on
    // this machine's WebGPU, so selecting it costs a 195 MB download and produces no
    // model. Without this rule a well-meaning "restore the per-device split" edit
    // would pass every other check in this function.
    if (artifact.dtype === 'q4f16') {
      problems.push({
        model: model.id,
        reason: 'q4f16 fails session creation on WebGPU here; use int8 for every device',
      });
    }
    if (artifact.bytes < MIN_PLAUSIBLE_ONNX_BYTES) {
      problems.push({
        model: model.id,
        reason: `${artifact.bytes} bytes is an LFS pointer, not weights`,
      });
    }
    for (const forbidden of FALLBACK_FORBIDDEN) {
      if (artifact.url.endsWith(forbidden)) {
        problems.push({ model: model.id, reason: 'points at a known LFS pointer' });
      }
    }

    // A model with no usable device can never load, and one that names a device the
    // backend union does not contain is a typo that would silently never be taken.
    if (model.devices.length === 0) {
      problems.push({ model: model.id, reason: 'no usable device: every entry was excluded' });
    }
    for (const device of model.devices) {
      if (device !== 'webgpu' && device !== 'wasm') {
        problems.push({ model: model.id, reason: `unknown device "${device}"` });
      }
    }
  }

  return problems;
}
