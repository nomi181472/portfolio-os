/**
 * lib/agent/models/brain.ts
 *
 * Loading a model in a browser, as an explicit state machine.
 *
 * This file is the boundary between "the site works" and "the site might download
 * 600 MB". Everything else in `lib/agent/` is pure, synchronous and testable with
 * no dependencies. This is the first thing that reaches the network, the Cache API
 * and WebGPU, so it earns its own module and its own vocabulary.
 *
 * Three rules, all of which exist because the alternative fails silently:
 *
 *  1. **The import is inside a function.** `@huggingface/transformers` resolves its
 *     `node` export condition to `dist/transformers.node.mjs`, which pulls in
 *     `onnxruntime-node` and `sharp`. A top-level import would drag a native ONNX
 *     runtime and an image library into the server build and, worse, make it
 *     possible for the model to run server-side — the one architecture
 *     `PLAN.md` §5 forbids. The test suite asserts no server module reaches it.
 *
 *  2. **The backend is detected, never assumed.** `navigator.gpu` existing means
 *     nothing: a machine can expose the API and still fail to return an adapter,
 *     which is common on Linux without a Vulkan driver. So `requestAdapter()` is
 *     called and its result decides. A WebGPU failure *falls back to WASM
 *     automatically* — and the reported backend changes with it, because a UI that
 *     said "WebGPU" while running WASM is the specific lie this module is written
 *     to prevent.
 *
 *  3. **Progress is measured.** Bytes from the loader's own `progress_callback`,
 *     never a timer, never a fake percentage. A cold load shows progress; a warm
 *     load from the Cache API shows none, and that difference is how a reader can
 *     tell the two apart.
 *
 * The registry is consulted before any fetch, and `auditRegistry()` runs first, so a
 * misconfigured URL fails here with a named problem rather than as a 404 that
 * surfaces 40 seconds into a 600 MB download.
 */

/* eslint-disable no-restricted-imports */
import {
  auditRegistry,
  coldBytes,
  formatMb,
  modelForRole,
  type ModelBackend,
  type ModelRole,
} from '../registry';

/**
 * States, in the order a healthy load visits them.
 *
 * `ready` carries `fromCache`, which is what makes a warm load distinguishable from
 * a cold one in the UI. Collapsing it into `ready` without that flag would render
 * both as "done" and hide the entire benefit of the cache.
 */
export type BrainState =
  | { status: 'idle' }
  /** Checking for WebGPU. Fast, but real: it awaits `requestAdapter()`. */
  | { status: 'detecting' }
  | {
      status: 'downloading';
      backend: ModelBackend;
      role: ModelRole;
      bytesLoaded: number;
      bytesTotal: number;
    }
  | {
      status: 'ready';
      backend: ModelBackend;
      fromCache: boolean;
      /** Wall-clock ms. Measured, never estimated. */
      loadMs: number;
      /**
       * True when WebGPU was wanted and WASM answered.
       *
       * On the state as well as the return value, because the UI has to be able to
       * say so: a panel that reported "WebGPU" while running on WASM is precisely the
       * lie this module exists to prevent.
       */
      fellBack: boolean;
    }
  | { status: 'failed'; reason: BrainFailure };

/**
 * Failures a reader can be told something useful about.
 *
 * Distinguishing them matters because the actions differ. `fetch` is worth a retry
 * button. `webgpu-unavailable` needs no retry at all — it already fell back and the
 * answer is loading over WASM. `registry` cannot be fixed by the reader and is a
 * bug, so it says so.
 */
export type BrainFailure =
  | { kind: 'registry'; problems: string[] }
  | { kind: 'fetch'; message: string; url: string }
  | { kind: 'webgpu-unavailable'; message: string; fellBackTo: ModelBackend }
  | { kind: 'unsupported'; message: string }
  | { kind: 'load'; message: string }
  | { kind: 'cancelled' };

/* -------------------------------------------------------------- detection */

/**
 * What device this browser will actually run on.
 *
 * `navigator.gpu` is checked *and then* an adapter is requested. Both halves are
 * necessary and the second is the one that gets forgotten: the API is present on
 * hardware that cannot provide an adapter, and skipping the request means downloading
 * weights for a device that will never run them.
 */
/**
 * Report which backend a model would actually be loaded on.
 *
 * `devices` is the model's measured device policy. It is a separate input from
 * capability detection on purpose: capability answers "does this machine have WebGPU?",
 * while the registry answers "should we use it?", and only the second one is allowed
 * to change what the loader does. Without threading the policy through here the UI
 * happily promises a WebGPU download that the loader then refuses to make — which is
 * the kind of claim this project cannot afford to make and be wrong about.
 */
export async function detectBackend(
  devices: readonly ModelBackend[] = ['webgpu', 'wasm'],
): Promise<{
  backend: ModelBackend;
  /** True when WebGPU was left out for capability *or* policy reasons. */
  fellBack: boolean;
  reason?: string;
}> {
  // `Navigator.gpu` is not in the DOM lib this project typechecks against, and it
  // is read through a cast rather than an ambient declaration so that the rest of
  // the codebase keeps compiling against a DOM without WebGPU types.
  // Policy first, and deliberately before any hardware probing. A model that
  // measurement disqualified from WebGPU must report that reason whether or not the
  // machine has the device, or the same `devices` list would mean two different things
  // depending on where it happened to run.
  if (!devices.includes('webgpu')) {
    return {
      backend: 'wasm',
      fellBack: true,
      reason: 'WebGPU is disabled for this model by measurement; see the registry',
    };
  }

  const nav = globalThis.navigator as (Navigator & { gpu?: unknown }) | undefined;
  const gpu = nav?.gpu as { requestAdapter(): Promise<unknown> } | undefined;

  if (!gpu) {
    return { backend: 'wasm', fellBack: false, reason: 'no navigator.gpu' };
  }

  try {
    const adapter = await gpu.requestAdapter();
    if (adapter) return { backend: 'webgpu', fellBack: false };
    return {
      backend: 'wasm',
      fellBack: true,
      reason: 'navigator.gpu is present but requestAdapter() returned null',
    };
  } catch (error) {
    return {
      backend: 'wasm',
      fellBack: true,
      reason: `requestAdapter() threw: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/* ----------------------------------------------------------------- cache */

/**
 * Whether the transformers cache already holds this model.
 *
 * A `caches.match()` that finds nothing is not an error — it is the cold case, and
 * it is the common case. What must not happen is treating a hit as a load, or a miss
 * as a failure.
 */
export async function isCached(url: string): Promise<boolean> {
  const cacheStorage = (globalThis as { caches?: CacheStorage }).caches;
  if (!cacheStorage) return false;
  try {
    const cache = await cacheStorage.open('transformers-cache');
    const hit = await cache.match(url);
    return hit !== undefined;
  } catch {
    // A blocked or absent Cache API is a performance state, not a correctness
    // one. The load works either way; it just re-downloads.
    return false;
  }
}

/**
 * Delete model weights from Cache Storage (`transformers-cache`).
 *
 * Removes the given model URL from the browser's Cache Storage.
 * Also matches related cached files (e.g. tokenizer configs, weights)
 * associated with the same HuggingFace model repo path if available.
 */
export async function deleteCachedModel(url: string): Promise<boolean> {
  const cacheStorage = (globalThis as { caches?: CacheStorage }).caches;
  if (!cacheStorage) return false;
  try {
    const cache = await cacheStorage.open('transformers-cache');
    const keys = await cache.keys();
    let deletedAny = false;
    const directHit = await cache.match(url);
    if (directHit) {
      await cache.delete(url);
      deletedAny = true;
    }
    const repoMatch = url.match(/huggingface\.co\/([^/]+\/[^/]+)/i);
    const repoPath = repoMatch ? repoMatch[1] : null;

    for (const request of keys) {
      if (request.url === url || (repoPath && request.url.includes(repoPath))) {
        await cache.delete(request);
        deletedAny = true;
      }
    }
    return deletedAny;
  } catch {
    return false;
  }
}

/* -------------------------------------------------- remembered backend */

/**
 * `localStorage` key for the backend that actually worked last time.
 *
 * ## Why this exists
 *
 * `detectBackend()` can prove an adapter exists. It cannot prove that a session will
 * initialise on the device it hands back — shader compilation, a lost device, a driver
 * that advertises features it does not honour. When that happens the first load pays
 * for a WebGPU attempt and then falls back to WASM.
 *
 * **This used to be much more expensive than it is now, and that is worth recording.**
 * The registry originally sent WebGPU to `q4f16`, so a failed attempt had already
 * fetched the weights it was going to discard:
 *
 * | Model | q4f16 fetched and discarded | file actually used |
 * | --- | --- | --- |
 * | `Xenova/multilingual-e5-small` | 205 MB | 118 MB int8 |
 * | `onnx-community/Qwen2.5-0.5B-Instruct` | 483 MB | 512 MB int8 |
 *
 * That also made caching impossible, which was the worse half. Measured in the browser,
 * `navigator.storage.estimate()` reports a **759 MB quota** for this origin while the
 * four weight files total ~1.3 GB, so the browser evicted the larger model's weights and
 * it re-downloaded 512 MB on every visit while the smaller model — which does fit —
 * returned from cache in 3s. Same code path, opposite outcome, decided by size.
 *
 * The registry no longer selects `q4f16` for anything (it fails session creation on this
 * machine's WebGPU, and `int8` runs on both devices), so the wasted download is gone at
 * the source rather than being skipped on the second visit. What remains is the
 * fallback itself, and this memory makes the second visit skip it.
 *
 * It is a *performance* memory, not a capability one. A wrong entry costs one failed
 * attempt, and a cleared one costs the waste above, so it is deliberately cheap to erase
 * and never gates a load.
 */
const BACKEND_KEY = 'agent-backend-preference';

interface BackendPreference {
  /** Model id → the backend that worked. Absent means "no memory of this model". */
  [modelId: string]: 'wasm' | 'webgpu';
}

function readPreference(modelId: string): 'wasm' | 'webgpu' | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(BACKEND_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as BackendPreference;
    const value = parsed[modelId];
    return value === 'wasm' || value === 'webgpu' ? value : undefined;
  } catch {
    // Unavailable, blocked, or corrupt. All the same outcome: no memory.
    return undefined;
  }
}

function writePreference(modelId: string, backend: 'wasm' | 'webgpu'): void {
  try {
    const store = globalThis.localStorage;
    if (!store) return;
    let current: BackendPreference = {};
    try {
      current = JSON.parse(store.getItem(BACKEND_KEY) ?? '{}') as BackendPreference;
    } catch {
      current = {};
    }
    // Only a WASM success is worth remembering. Recording "webgpu worked" would pin a
    // reader to a fast path on hardware that later loses the device, and the asymmetry
    // is cheap: a false WASM entry costs one retry, a false WebGPU entry costs a
    // failure with no way back.
    if (backend !== 'wasm') return;
    store.setItem(BACKEND_KEY, JSON.stringify({ ...current, [modelId]: backend }));
  } catch {
    // A full or disabled storage quota. Not worth failing a load over.
  }
}

/* ------------------------------------------------------------------ load */

export interface LoadOptions {
  /** Which model. Defaults to the embedder, which is the smaller and comes first. */
  role?: ModelRole;
  /** Override detection. Used by tests; never by the UI. */
  backend?: ModelBackend;
  /** Omit when loading without a UI, as `embeddings.ts` does. */
  onState?: (state: BrainState) => void;
  signal?: AbortSignal;
  /**
   * Injectable module loader.
   *
   * Present so the WebGPU→WASM fallback can be tested at all. That fallback is the
   * one branch in this file that costs a real model download to exercise, and
   * "we could not test it" is how a fallback silently stops working after a refactor.
   */
  load?: () => Promise<TransformersModule>;
}

/** The minimum shape of a loaded pipeline, kept opaque to callers. */
export interface LoadedModel {
  readonly role: ModelRole;
  readonly backend: ModelBackend;
  /** True when the weights came from the Cache API, so no download was shown. */
  readonly fromCache: boolean;
  /** Wall-clock ms. Measured, never estimated. */
  readonly loadMs: number;
  /** True when a WebGPU attempt failed and WASM answered instead. */
  readonly fellBack: boolean;
  /**
   * The pipeline itself, opaque.
   *
   * Typed `unknown` deliberately: `brain.ts` must stay importable under `node:test`
   * without a 20 MB WASM runtime, so it never names the library's types. Callers cast
   * to the narrow interface they need — `FeatureExtractionPipeline` in
   * `embeddings.ts`, a text-generation pipeline in `conversation.ts`.
   */
  readonly pipeline: unknown;
}

/**
 * Which task each model runs.
 *
 * `fluent` is the same Qwen2.5-0.5B weights as `conversation`, asked for
 * single-shot completion rather than chat templating — a cheaper task over the same
 * download, which is why the two roles share one model file and one byte count. There
 * is no default, so an unmapped role is a type error rather than a wrong guess.
 */
const TASK_FOR_ROLE: Record<ModelRole, 'feature-extraction' | 'text-generation'> = {
  embedding: 'feature-extraction',
  conversation: 'text-generation',
  fluent: 'text-generation',
};

/**
 * Transformers.js loader, typed structurally.
 *
 * Structural rather than imported, so this module — and every module that calls it —
 * stays importable under `node:test` without pulling the runtime into the test
 * process. The cast is the seam; nothing else in the project touches the library's
 * types.
 */
interface TransformersModule {
  pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<unknown>;
  env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
    version: string;
    backends?: { onnx?: { wasm?: { wasmPaths?: string | { wasm?: string } } } };
  };
}

/**
 * Where the ONNX Runtime WebAssembly binary is fetched from.
 *
 * Left as the library's own jsDelivr default, pinned to the installed version rather
 * than a floating `@latest`. Two reasons, both about a 21.6 MB download:
 *
 *  - **CDN, not our origin.** Every other byte of model weight already comes from a
 *    CDN (see `registry.ts`), so the runtime binary coming from one is consistent. On
 *    our origin it would be a 21.6 MB uncached first-paint asset, competing with the
 *    page itself for bandwidth.
 *  - **Pinned to `env.version`.** An unpinned CDN path can serve a `.wasm` whose
 *    exported symbols do not match the JS glue in this exact build, and that fails as
 *    an opaque runtime error long after the model has downloaded.
 *
 * Set explicitly rather than left implicit, so that a future library default change
 * is a deliberate decision rather than a silent 21.6 MB shift.
 */
export function ortWasmPath(transformers: TransformersModule): string {
  return `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${transformers.env.version}/dist/`;
}

/** Apply the environment every instance needs, including a freshly imported one. */
function configure(mod: TransformersModule): TransformersModule {
  // Without this the runtime probes the app's own origin for weights and takes a 404
  // before falling back to the hub, which is both slower and a confusing thing to see
  // in a console.
  mod.env.allowLocalModels = false;
  mod.env.useBrowserCache = true;
  const wasm = mod.env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.wasmPaths = ortWasmPath(mod);
    // Disable multi-threading workers (`numThreads = 1`) for WASM. Multi-threading allocates
    // multiple SharedArrayBuffers that exceed 2GB/4GB WebAssembly memory limits on 1.5B models,
    // causing ONNX WASM `Aborted() ort-wasm-simd-threaded.jsep.wasm` crashes.
    (wasm as { numThreads?: number }).numThreads = 1;
  }
  // Also configure global ONNX Runtime environment directly if available in window/globalThis
  const globalOrt = (globalThis as { ort?: { env?: { wasm?: { numThreads?: number } } } }).ort;
  if (globalOrt?.env?.wasm) {
    globalOrt.env.wasm.numThreads = 1;
  }
  return mod;
}

/** The one permitted import site. Inside a function, so no server module reaches it. */
async function loadTransformers(): Promise<TransformersModule> {
  return configure((await import('@huggingface/transformers')) as unknown as TransformersModule);
}

/**
 * A *second* transformers.js instance, for the WebGPU→WASM fallback.
 *
 * This exists because of a measured failure, not a precaution. transformers.js creates
 * one ONNX Runtime per module evaluation, and a WebGPU session that dies during
 * initialisation leaves that shared runtime unusable — so a retry over the *same* module
 * fails with the identical ORT status code and a working backend is lost. Measured in
 * headless Firefox 156 on an RTX 5060, `Xenova/multilingual-e5-small`:
 *
 *   webgpu then wasm, same module   → webgpu fails, wasm fails  (status 420519968)
 *   webgpu then wasm, second module → webgpu fails, wasm loads  (1.2s)
 *   wasm only, fresh page           → wasm loads                 (3.0s)
 *   webgpu, wasm, reset `onnx.wasm` → wasm still fails            (not recoverable in place)
 *
 * The instance comes from the CDN rather than a second bundled copy. A variable
 * specifier cannot be used: webpack compiles it to a context-module require that cannot
 * resolve a bare package name, and the build warns "Critical dependency: the request of
 * a dependency is an expression" — which was tried and measured failing in the browser.
 * `webpackIgnore` leaves the import for the browser, whose module cache is keyed by URL,
 * so this is genuinely a second evaluation of the same pinned version. The weights are
 * unaffected and still come from Cache Storage, so the retry does not re-download them.
 */
async function loadSeparateTransformers(version: string): Promise<TransformersModule> {
  const url = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${version}`;
  return configure((await import(/* webpackIgnore: true */ url)) as unknown as TransformersModule);
}

/** One attempt at one backend. Progress and cache state are reported, nothing else. */
async function attempt(
  transformers: TransformersModule,
  role: ModelRole,
  backend: ModelBackend,
  fromCache: boolean,
  onState: ((state: BrainState) => void) | undefined,
): Promise<LoadedModel> {
  const model = modelForRole(role);
  const artifact = model.artifact;

  if (!fromCache) {
    onState?.({
      status: 'downloading',
      backend,
      role,
      bytesLoaded: 0,
      bytesTotal: artifact.bytes,
    });
  }

  let bytesLoaded = 0;
  let bytesTotal = artifact.bytes;

  const pipeline = await transformers.pipeline(TASK_FOR_ROLE[role], model.id, {
    // `dtype` is what actually selects the weights file. When `model` is a repo id
    // transformers.js resolves `onnx/model_<dtype>.onnx` itself and never consults the
    // registry URL, so this is the field that decides what gets downloaded — which is
    // why it reads from the registry rather than being re-chosen here.
    dtype: artifact.dtype,
    device: backend,
    session_options: {
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      executionMode: 'sequential',
    },
    progress_callback: (event: unknown) => {
      const progress = event as {
        status?: string;
        loaded?: number;
        total?: number;
        file?: string;
      };
      // Only the weight file has a meaningful share of the total; tokenizer and
      // config files would otherwise swing the percentage by tens of points.
      if (progress?.status !== 'progress' || typeof progress.loaded !== 'number') return;
      if (progress.file !== undefined && !/onnx.*\.onnx$/i.test(progress.file)) return;

      bytesLoaded = progress.loaded;
      if (typeof progress.total === 'number' && progress.total > 0) bytesTotal = progress.total;
      onState?.({ status: 'downloading', backend, role, bytesLoaded, bytesTotal });
    },
  });

  return {
    role,
    backend,
    fromCache,
    loadMs: 0,
    fellBack: false,
    pipeline,
  };
}

/**
 * Load one model, reporting every state transition.
 *
 * A WebGPU failure falls back to WASM automatically, and the *reported* backend
 * changes with it. This is the rule the file header states, and it is the reason
 * detection alone is not enough: detection proves an adapter can be obtained, not
 * that a session will initialise on the device it was handed. Session creation is
 * where WebGPU actually fails — shader compilation, a device lost mid-load — and none
 * of that is visible before the attempt.
 */
export async function loadModel(options: LoadOptions): Promise<LoadedModel> {
  const { role = 'embedding', onState, signal } = options;
  const started = Date.now();
  const emit = (state: BrainState): void => onState?.(state);

  // A misconfigured registry fails here, by name, rather than as a 404 forty seconds
  // into a 600 MB download.
  const problems = auditRegistry();
  if (problems.length > 0) {
    const failure: BrainFailure = {
      kind: 'registry',
      problems: problems.map((problem) => `${problem.model}: ${problem.reason}`),
    };
    emit({ status: 'failed', reason: failure });
    throw new Error('model registry is inconsistent');
  }

  if (signal?.aborted) {
    emit({ status: 'failed', reason: { kind: 'cancelled' } });
    throw new Error('load cancelled');
  }

  emit({ status: 'detecting' });

  let backend = options.backend;
  let fellBack = false;

  // A remembered WASM outcome outranks detection. Detection can only see that an
  // adapter exists; the memory records that a session on it failed anyway. Whether the
  // registry selects a different file per device no longer matters — it selects int8
  // for both — so what this saves is the failed attempt, not a wasted download.
  const model = modelForRole(role);
  const remembered = options.backend ? undefined : readPreference(model.id);

  // An explicit `backend` is honoured whatever the registry says: it is the escape
  // hatch that keeps the fallback path testable, and the place to force a device when
  // diagnosing one. Everything else is filtered through `devices`, because a model
  // measured to misbehave on a device must not reach it by accident.
  if (options.backend) {
    backend = options.backend;
  } else if (!model.devices.includes('webgpu')) {
    backend = 'wasm';
    // Not a "fallback": no better device was available in the first place.
    fellBack = false;
  } else if (remembered === 'wasm') {
    backend = 'wasm';
    fellBack = true;
  } else {
    const detected = await detectBackend();
    backend = detected.backend;
    fellBack = detected.fellBack;
  }

  const transformers = await (options.load ?? loadTransformers)();
  let loaded: LoadedModel;

  try {
    loaded = await attempt(
      transformers,
      role,
      backend,
      await isCached(modelForRole(role).artifact.url),
      emit,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // If initial backend was not WebGPU, no GPU fallback chain applies.
    if (backend !== 'webgpu') {
      const failure = classifyLoadFailure(message, modelForRole(role).artifact.url);
      emit({ status: 'failed', reason: failure });
      throw error instanceof Error ? error : new Error(message);
    }

    // Fallback chain: WebGPU failed -> try WebGL (if genuinely supported) -> WASM.
    let fallbackSuccess = false;

    // Probe genuine WebGL support in installed Transformers.js / ONNX Runtime environment
    const onnxBackends = transformers.env.backends?.onnx as Record<string, unknown> | undefined;
    const isWebGlSupported = Boolean(onnxBackends && 'webgl' in onnxBackends && typeof (globalThis as { WebGLRenderingContext?: unknown }).WebGLRenderingContext !== 'undefined');

    if (isWebGlSupported) {
      try {
        // Attempt WebGL only if supported by the runtime & model
        const webglModule = options.load
          ? await options.load()
          : await loadSeparateTransformers(transformers.env.version);
        const warm = await isCached(modelForRole(role).artifact.url);
        loaded = await attempt(webglModule, role, 'webgl' as ModelBackend, warm, emit);
        fellBack = true;
        fallbackSuccess = true;
      } catch {
        // WebGL unavailable or failed for this model/device; proceed to WASM fallback
      }
    }

    if (!fallbackSuccess) {
      try {
        // Final fallback: WASM with a fresh module instance
        const retryModule = options.load
          ? await options.load()
          : await loadSeparateTransformers(transformers.env.version);
        const warm = await isCached(modelForRole(role).artifact.url);
        loaded = await attempt(retryModule, role, 'wasm', warm, emit);
        fellBack = true;
        // A WebGPU session demonstrably did not work for this model on this machine.
        // Remember it so the next visit does not attempt it again.
        writePreference(modelForRole(role).id, 'wasm');
      } catch {
        // WebGPU, WebGL, and WASM all failed or are unavailable.
        // Mark model as unsupported and emit clear failure state.
        const failure: BrainFailure = {
          kind: 'unsupported',
          message: 'Model is not supported on your device or browser. Please try a supported browser or device.',
        };
        emit({ status: 'failed', reason: failure });
        throw error instanceof Error ? error : new Error(message);
      }
    } else {
      // TypeScript safety: loaded is assigned in try block when fallbackSuccess is true
    }
  }

  // TypeScript assertion: loaded is guaranteed to be assigned if no exception was thrown
  if (!loaded!) {
    throw new Error('Model failed to initialize on any supported backend');
  }

  if (signal?.aborted) {
    // Checked after, not during: the transformers.js pipeline API has no abort
    // parameter, so an in-flight download cannot be interrupted. This check is what
    // stops the result being *used* after the reader walked away, and `dispose()`
    // releases the session. Claiming mid-flight cancellation would be a lie.
    emit({ status: 'failed', reason: { kind: 'cancelled' } });
    throw new Error('load cancelled');
  }

  const result: LoadedModel = { ...loaded, loadMs: Date.now() - started, fellBack };
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Agent Model] Initialized ${role} model with backend: ${result.backend}`);
  }
  emit({
    status: 'ready',
    backend: result.backend,
    fromCache: result.fromCache,
    loadMs: result.loadMs,
    fellBack: result.fellBack,
  });
  return result;
}

/**
 * Whether a load failure looks like a network problem.
 *
 * Separated so the distinction is testable: a `fetch` failure is worth a retry button,
 * and everything else is not. Matching on substrings of a runtime message is a guess,
 * but a wrong guess only affects which button is offered — never whether an answer
 * comes back, because lexical search covers the failure either way.
 */
export function classifyLoadFailure(
  message: string,
  url: string,
): BrainFailure {
  return /fetch|network|ENOTFOUND|ETIMEDOUT|ECONNRESET|Failed to load|404|403/i.test(message)
    ? { kind: 'fetch', message, url }
    : { kind: 'load', message };
}

/* ----------------------------------------------------------- presentation */

export interface BrainSummary {
  readonly label: string;
  /** Never a claim about capability — only what was measured. */
  readonly detail: string;
  readonly tone: 'idle' | 'active' | 'ready' | 'error';
}

/**
 * One line describing the current state.
 *
 * A function of the state rather than JSX in the component, so the wording is
 * testable without a DOM. The rule it enforces: never imply a backend other than
 * the one selected, and never show a progress percentage during a warm load,
 * because there is nothing being downloaded.
 */
export function describeBrain(state: BrainState): BrainSummary {
  switch (state.status) {
    case 'idle':
      return { label: 'Optional', detail: 'Answers work now, without a model.', tone: 'idle' };
    case 'detecting':
      return { label: 'Checking', detail: 'Looking for WebGPU, falling back to WASM.', tone: 'active' };
    case 'downloading': {
      const pct = state.bytesTotal > 0 ? Math.round((state.bytesLoaded / state.bytesTotal) * 100) : 0;
      return {
        label: 'Downloading',
        detail: `${state.backend.toUpperCase()} · ${pct}%`,
        tone: 'active',
      };
    }
    case 'ready': {
      // The backend is always the one that ran, never the one that was hoped for.
      const device = state.fellBack ? `${state.backend.toUpperCase()} (WebGPU unavailable)` : state.backend.toUpperCase();
      return {
        label: 'Ready',
        detail: state.fromCache
          ? `${device} · already downloaded`
          : `${device} · ${Math.round(state.loadMs / 100) / 10}s`,
        tone: 'ready',
      };
    }
    case 'failed':
      return {
        label: 'Unavailable',
        detail: failureText(state.reason),
        tone: 'error',
      };
  }
}

function failureText(failure: BrainFailure): string {
  switch (failure.kind) {
    case 'registry':
      return `Configuration error: ${failure.problems[0] ?? 'see console'}`;
    case 'fetch':
      return `Could not download the model. ${failure.message}`;
    case 'webgpu-unavailable':
      return `WebGPU unavailable, using ${failure.fellBackTo.toUpperCase()}.`;
    case 'unsupported':
      return failure.message;
    case 'load':
      return `The model failed to load. ${failure.message}`;
    case 'cancelled':
      return 'Cancelled.';
  }
}

/**
 * The figure to show before anyone commits to a download.
 *
 * Computed from the registry, per device, so it cannot drift from the URL that will
 * actually be fetched. See `PLAN.md` §1: the two backends are not ordered the same
 * way for every model, and the totals are close enough that a remembered figure
 * would be wrong.
 *
 * `roles` is not optional decoration. The two models are offered by two separate
 * buttons, so the figure has to describe the model behind *that* button: quoting the
 * combined total on the embedder button asks for 205 MB and says 688 MB, which is a
 * number no reader can check against their network and is the kind of over-quote that
 * makes an optional download feel mandatory. It defaults to both roles because the
 * combined total is the right answer to "what does the whole thing cost", which is a
 * different question.
 */
export function coldLoadSummary(
  backend: ModelBackend,
  roles: readonly ModelRole[] = ['embedding', 'conversation'],
): string {
  return formatMb(coldBytes(roles));
}
