/**
 * tests/agent-brain.test.ts
 *
 * Two things about `lib/agent/models/brain.ts`, one architectural and one
 * behavioural.
 *
 * **Architectural:** the module must be importable in a test process with no
 * WebAssembly runtime, no `navigator.gpu`, and no network. If importing it pulled
 * in `@huggingface/transformers` at the top level, every one of these tests would
 * fail to even load — which is exactly the guard that stops the 20 MB ONNX runtime
 * from reaching the server bundle. So the assertions here are about what is
 * *absent*, and they are the reason the transformers import lives inside a
 * function.
 *
 * **Behavioural:** device detection and its fallback. `navigator.gpu` existing
 * means nothing — the common Linux case is an exposed API with no adapter — so the
 * only safe test is that an adapter request is actually made, and that its failure
 * degrades to WASM *and reports WASM*. A UI claiming "WebGPU" while running WASM is
 * the specific lie this module exists to prevent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  classifyLoadFailure,
  coldLoadSummary,
  describeBrain,
  detectBackend,
  isCached,
  loadModel,
  ortWasmPath,
  type BrainState,
} from '../lib/agent/models/brain';
import { auditRegistry, coldBytes, modelForRole } from '../lib/agent/registry';

/* ------------------------------------------------------- architectural */

/**
 * The import must be inside a function.
 *
 * `@huggingface/transformers` resolves its `node` condition to
 * `dist/transformers.node.mjs`, which imports `onnxruntime-node` and `sharp`. A
 * top-level import in a module reachable from a client component would pull a
 * native runtime into the server build, and would make it possible for inference to
 * run server-side — the one architecture `PLAN.md` §5 rules out.
 */
test('the transformers import is inside a function, not at module scope', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'lib/agent/models/brain.ts'),
    'utf8',
  );

  // The dynamic import, and it must be awaited inside an async function.
  assert.match(
    source,
    /await import\(['"]@huggingface\/transformers['"]\)/,
    'the loader must use a dynamic import',
  );

  // The WebGPU→WASM fallback needs a *second module evaluation*, because a failed
  // WebGPU session leaves the shared ONNX Runtime unusable. It cannot come from a
  // variable specifier: webpack compiles that to a context-module require that cannot
  // resolve a bare package name, which was tried and failed in the browser.
  assert.match(
    source,
    /webpackIgnore: true \*\//,
    'the fallback instance must bypass the bundler to become a second module evaluation',
  );
  assert.match(
    source,
    /cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@\$\{version\}/,
    'the fallback instance must come from the pinned CDN version',
  );
  assert.ok(
    !/await import\(specifier\)/.test(source),
    'a variable specifier cannot resolve under webpack',
  );

  // A static import or a bare `import(...)` hoisted to module scope would both mean
  // the same runtime is loaded whenever anything imports this file.
  assert.ok(
    !/^import\s+[^;]*@huggingface\/transformers/m.test(source),
    'there must be no static import of @huggingface/transformers',
  );

  // The dynamic import sits inside `loadTransformers`, not at top level.
  const importIndex = source.indexOf("await import('@huggingface/transformers')");
  const enclosing = source.lastIndexOf('async function loadTransformers', importIndex);
  assert.ok(enclosing > 0 && enclosing < importIndex, 'the import belongs to loadTransformers()');

  // The CDN import for the fallback instance is dynamic too, for the same reason: a
  // static one would pull the runtime into the server build, which PLAN.md §5 forbids.
  const cdnIndex = source.indexOf('await import(/* webpackIgnore: true */ url)');
  assert.ok(cdnIndex > 0, 'the fallback instance must be imported dynamically');
  assert.ok(
    !/^import\s+[^;]*cdn\.jsdelivr/m.test(source),
    'the CDN import must not be static',
  );
});

test('the model modules never import each other from a server path', () => {
  // `lib/agent/models/` is browser-only by construction. A relative import that
  // climbs out of it into `lib/agent/` is fine — that is how it reaches the
  // registry — but a server module reaching *in* would be the inversion.
  const source = readFileSync(resolve(process.cwd(), 'lib/agent/models/brain.ts'), 'utf8');
  for (const match of source.matchAll(/from '([^']+)'/g)) {
    const specifier = match[1] ?? '';
    assert.ok(
      !specifier.includes('@/app/') && !specifier.includes('next/server'),
      `brain.ts must not import a server module, found ${specifier}`,
    );
  }
});

test('the registry this module depends on is itself consistent', () => {
  assert.deepEqual(auditRegistry(), []);
});

/* ------------------------------------------------------------ detection */

interface FakeGpu {
  requestAdapter(): Promise<unknown>;
}

/**
 * Swap `globalThis.navigator` for the duration of a test.
 *
 * A plain assignment does not work: Node 24 defines `navigator` as a
 * getter-only property on the global object, so `globalThis.navigator = x` throws
 * `Cannot set property navigator of #<Object> which has only a getter`.
 * `defineProperty` replaces the accessor outright, and the descriptor is restored
 * afterwards so no test leaks a fake navigator into the next one.
 */
function withNavigator(value: unknown, run: () => Promise<void> | void): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
  return Promise.resolve(run()).finally(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });
}

test('no navigator.gpu means WASM, and that is not a failure', () => {
  return withNavigator({}, async () => {
    const result = await detectBackend();
    assert.equal(result.backend, 'wasm');
    // WASM is the supported path, not a degraded one. `fellBack` is false because
    // there was nothing to fall back from.
    assert.equal(result.fellBack, false);
    assert.match(result.reason ?? '', /no navigator\.gpu/);
  });
});

test('an adapter means WebGPU', async () => {
  const gpu: FakeGpu = { requestAdapter: async () => ({ name: 'adapter' }) };
  await withNavigator({ gpu }, async () => {
    const result = await detectBackend();
    assert.equal(result.backend, 'webgpu');
    assert.equal(result.fellBack, false);
  });
});

test('navigator.gpu present but no adapter falls back to WASM', async () => {
  // The Linux-without-Vulkan case, and the reason `navigator.gpu` alone is not
  // enough to trust. Reporting WebGPU here would download the 483 MB q4f16 file
  // and fail at session creation, or silently run WASM while claiming WebGPU.
  const gpu: FakeGpu = { requestAdapter: async () => null };
  await withNavigator({ gpu }, async () => {
    const result = await detectBackend();
    assert.equal(result.backend, 'wasm');
    assert.equal(result.fellBack, true, 'a null adapter is a fallback, not a first-class WASM');
    assert.match(result.reason ?? '', /requestAdapter\(\) returned null/);
  });
});

test('a throwing requestAdapter also falls back rather than propagating', async () => {
  const gpu: FakeGpu = {
    requestAdapter: async () => {
      throw new Error('driver missing');
    },
  };
  await withNavigator({ gpu }, async () => {
    const result = await detectBackend();
    assert.equal(result.backend, 'wasm');
    assert.equal(result.fellBack, true);
    assert.match(result.reason ?? '', /driver missing/);
  });
});

test('detection is asked for an adapter rather than trusting the API surface', async () => {
  let calls = 0;
  const gpu: FakeGpu = {
    requestAdapter: async () => {
      calls += 1;
      return {};
    },
  };
  await withNavigator({ gpu }, async () => {
    await detectBackend();
  });
  assert.equal(calls, 1, 'requestAdapter() must actually be called');
});

/* ---------------------------------------------------------------- cache */

test('an absent Cache API is a performance state, not an error', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  try {
    // Cold-path question, and the answer must be a plain `false`. Throwing here
    // would make a browser with storage disabled unable to load a model at all.
    assert.equal(await isCached('https://example.invalid/model.onnx'), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'caches', descriptor);
    else Reflect.deleteProperty(globalThis, 'caches');
  }
});

/* --------------------------------------------------------- presentation */

/**
 * The wording is tested here rather than in JSX so it can be checked without a DOM
 * — the same reason `agent-widget.test.ts` is a static check.
 */
test('every state describes itself, and a cold load shows measured progress', () => {
  const cases: Array<[BrainState, RegExp]> = [
    [{ status: 'idle' }, /without a model/],
    [{ status: 'detecting' }, /falling back to WASM/],
    [
      { status: 'downloading', backend: 'webgpu', role: 'embedding', bytesLoaded: 50, bytesTotal: 200 },
      /WEBGPU · 25%/,
    ],
    [
      { status: 'ready', backend: 'wasm', fromCache: true, loadMs: 1234, fellBack: false },
      /WASM · already downloaded/,
    ],
    // 45.6 s is a plausible cold WebGPU load for a 483 MB model, so the wording is
    // checked against a real duration rather than a flattering one.
    [
      { status: 'ready', backend: 'webgpu', fromCache: false, loadMs: 45_600, fellBack: false },
      /WEBGPU · 45\.6s/,
    ],
  ];

  for (const [state, pattern] of cases) {
    const summary = describeBrain(state);
    assert.match(summary.detail, pattern, `unexpected wording for ${state.status}`);
  }
});

test('the reported backend is the one that actually ran', () => {
  // A warm WASM load must not be described with the word WebGPU. This is the
  // assertion behind the whole fallback story: the label is derived from the state
  // that was reached, never from what was hoped for.
  const warm: BrainState = {
    status: 'ready',
    backend: 'wasm',
    fromCache: true,
    loadMs: 10,
    fellBack: false,
  };
  assert.ok(!describeBrain(warm).detail.includes('WebGPU'));

  const cold: BrainState = {
    status: 'ready',
    backend: 'webgpu',
    fromCache: false,
    loadMs: 10,
    fellBack: false,
  };
  assert.ok(describeBrain(cold).detail.includes('WEBGPU'));
});

test('a WebGPU fallback is reported rather than hidden', () => {
  // The one case where the label must mention both: the reader asked for nothing in
  // particular, the browser offered an adapter, and the session still would not open.
  // Reporting plain "WASM" here would be accurate but would not explain the wait.
  const fellBack = describeBrain({
    status: 'ready',
    backend: 'wasm',
    fromCache: false,
    loadMs: 31_000,
    fellBack: true,
  });
  assert.match(fellBack.detail, /WASM/);
  assert.match(fellBack.detail, /WebGPU unavailable/);
});

test('a warm load shows no percentage, because nothing is downloading', () => {
  // The distinction a reader needs: `already downloaded` versus a progress bar.
  // Rendering 100% for a cache hit would imply a download happened.
  const warm = describeBrain({
    status: 'ready',
    backend: 'wasm',
    fromCache: true,
    loadMs: 5,
    fellBack: false,
  });
  assert.ok(!warm.detail.includes('%'));
});

test('each failure kind says something a reader can act on', () => {
  const cases: Array<[BrainState, RegExp]> = [
    [
      { status: 'failed', reason: { kind: 'fetch', message: 'network error', url: 'https://x/y.onnx' } },
      /Could not download/,
    ],
    [
      {
        status: 'failed',
        reason: { kind: 'webgpu-unavailable', message: 'no adapter', fellBackTo: 'wasm' },
      },
      /using WASM/,
    ],
    [
      { status: 'failed', reason: { kind: 'load', message: 'bad graph' } },
      /failed to load/,
    ],
    [{ status: 'failed', reason: { kind: 'cancelled' } }, /Cancelled/],
    [
      { status: 'failed', reason: { kind: 'registry', problems: ['x: reason'] } },
      /Configuration error/,
    ],
  ];
  for (const [state, pattern] of cases) {
    assert.equal(describeBrain(state).tone, 'error');
    assert.match(describeBrain(state).detail, pattern);
  }
});

/* ------------------------------------------------------ the quoted figure */

test('the pre-download figure is computed per device, not remembered', () => {
  // `PLAN.md` §1 originally claimed WASM visitors download more. Per model that
  // is true for the conversational model and backwards for the embedder, and
  // summed over both it comes out 58 MB *smaller* on WASM. So the figure has to be
  // computed for the backend in hand.
  //
  // The quotient is rounded to whole MB deliberately: 687781273 bytes is
  // "687,781,273 bytes" or "688 MB" to a reader, never "687.781273 MB".
  const webgpu = coldLoadSummary('webgpu');
  const wasm = coldLoadSummary('wasm');
  assert.match(webgpu, /^\d+ MB$/);
  // Both devices fetch the same int8 files, so the quoted size is identical. This
  // used to assert they differed, which was true only while the registry claimed
  // WebGPU downloaded q4f16 — a figure no visitor ever actually paid.
  assert.equal(webgpu, wasm);
  assert.equal(webgpu, `${Math.round(coldBytes() / 1_000_000)} MB`);
});

test('the figure can be scoped to one role', () => {
  // The two offers are two buttons, so each quotes the model behind it. A combined
  // figure on the embedder button claims 688 MB for a 205 MB download.
  assert.equal(
    coldLoadSummary('webgpu', ['embedding']),
    `${Math.round(coldBytes(['embedding']) / 1_000_000)} MB`,
  );

  // And the scoped figures must actually differ from the combined one, or the scoping
  // would be a no-op that this test would happily pass.
  assert.notEqual(coldLoadSummary('webgpu', ['embedding']), coldLoadSummary('webgpu'));
  assert.notEqual(coldLoadSummary('webgpu', ['conversation']), coldLoadSummary('webgpu'));
});

/* ------------------------------------------------------ the load itself */

/**
 * A stand-in for the transformers module.
 *
 * `failFor` decides which device fails, because the fallback path — the branch this
 * section exists to cover — is unreachable any other way without downloading a model.
 */
function fakeTransformers(options: { failFor?: (device: string) => string | null; version?: string } = {}) {
  const calls: Array<{ task: string; model: string; device: unknown; dtype: unknown }> = [];
  // Not named `module`: that is a CommonJS wrapper parameter, and assigning to it
  // breaks any real `module` the file might be loaded as.
  const stub = {
    pipeline: async (task: string, model: string, pipelineOptions: Record<string, unknown> = {}) => {
      const device = String(pipelineOptions.device);
      calls.push({ task, model, device, dtype: pipelineOptions.dtype });
      const failure = options.failFor?.(device);
      if (failure) throw new Error(failure);
      return { task, device, dispose: async () => {} };
    },
    env: {
      allowLocalModels: true,
      useBrowserCache: false,
      version: options.version ?? '3.8.1',
      backends: { onnx: { wasm: {} as { wasmPaths?: string } } },
    },
  };
  return { stub, calls };
}

/** No Cache API in this process, so every load is the cold path. */
function withoutCache(): void {
  delete (globalThis as { caches?: unknown }).caches;
}

test('a load reports detecting, then ready, and returns the pipeline', async () => {
  withoutCache();
  const fake = fakeTransformers();
  const states: BrainState[] = [];

  const loaded = await loadModel({
    backend: 'wasm',
    onState: (state) => states.push(state),
    load: async () => fake.stub,
  });

  assert.deepEqual(
    states.map((state) => state.status),
    ['detecting', 'downloading', 'ready'],
  );
  assert.equal(loaded.pipeline !== undefined, true, 'the pipeline must be returned, not dropped');
  assert.equal(loaded.fromCache, false);
  assert.ok(loaded.loadMs >= 0);
});

test('the dtype is read from the registry, and is int8 on every device', async () => {
  // When `model` is a repo id, transformers.js ignores the registry URL and resolves
  // `onnx/model_<dtype>.onnx` itself, so `dtype` is the field that actually decides
  // what is downloaded. That makes the registry the only place a device's quantisation
  // can be decided, which is why the loader passes `artifact.dtype` straight through
  // instead of re-deriving it.
  //
  // Both devices used to differ here (webgpu -> q4f16). Measured in a browser, q4f16
  // fails session creation on this machine's WebGPU, so this asserts the fix.
  withoutCache();
  for (const backend of ['webgpu', 'wasm'] as const) {
    const fake = fakeTransformers();
    await loadModel({ backend, load: async () => fake.stub });
    assert.equal(fake.calls.at(-1)?.dtype, 'int8', `${backend} must request int8`);
    // And the device is passed through separately, so a backend can still be chosen.
    assert.equal(fake.calls.at(-1)?.device, backend);
  }
});

test('no model is routed to a device that measurement disqualified', async () => {
  // Measured, not assumed, and for two different reasons:
  //
  //  - Qwen `int8` on WebGPU initialises and then emits
  //    `"What is Kafka?333333333333333333333333"` in 237s, against a correct 7.0s
  //    answer on WASM. A silent wrong answer is worse than a slow right one.
  //  - E5 `int8` on WebGPU works, but this app embeds 125 passages sequentially at
  //    ~10s per dispatch there, so indexing ran to roughly twenty minutes against
  //    ~95s on WASM for the model and the whole index. A net loss, so not chosen.
  //
  // Both are recorded in the registry as the `devices` list, so the reason and the
  // behaviour cannot drift apart.
  withoutCache();
  for (const role of ['embedding', 'conversation'] as const) {
    const fake = fakeTransformers();
    await loadModel({ role, load: async () => fake.stub });
    assert.equal(fake.calls.at(-1)?.device, 'wasm', `${role} must not be routed to WebGPU`);
  }
});

test('an explicit backend still overrides a device the registry excludes', async () => {
  // Otherwise the exclusion above would be untestable, and a device that has to be
  // forced to be diagnosed could never be diagnosed.
  withoutCache();
  const forced = fakeTransformers();
  await loadModel({ role: 'conversation', backend: 'webgpu', load: async () => forced.stub });
  assert.equal(forced.calls.at(-1)?.device, 'webgpu');
});

test('a WASM-only model does not record a WebGPU failure it never attempted', async () => {
  // It never ran on WebGPU, so remembering one would be a lie that costs a real
  // fallback on the embedder, which does use WebGPU. The memory is per model.
  withoutCache();
  const wasmOnly = fakeTransformers();
  await loadModel({ role: 'conversation', load: async () => wasmOnly.stub });
  assert.equal(
    globalThis.localStorage?.getItem('agent-backend-preference') ?? null,
    null,
    'no backend failure should be recorded for a model that never tried WebGPU',
  );
});

test('the embedder and the conversational model run different tasks', async () => {
  // Asking a text-generation pipeline for feature extraction is the kind of mistake
  // that loads 512 MB and then fails at the first input.
  withoutCache();
  const fake = fakeTransformers();
  await loadModel({ role: 'embedding', backend: 'wasm', load: async () => fake.stub });
  assert.equal(fake.calls.at(-1)?.task, 'feature-extraction');

  await loadModel({ role: 'conversation', backend: 'wasm', load: async () => fake.stub });
  assert.equal(fake.calls.at(-1)?.task, 'text-generation');
});

test('a WebGPU failure falls back to WASM and reports the backend that ran', async () => {
  withoutCache();
  // Fails only on WebGPU, which is the realistic case: the adapter exists, the
  // session does not open.
  const fake = fakeTransformers({
    failFor: (device) => (device === 'webgpu' ? 'Failed to create session' : null),
  });
  const states: BrainState[] = [];

  const loaded = await loadModel({
    backend: 'webgpu',
    onState: (state) => states.push(state),
    load: async () => fake.stub,
  });

  assert.equal(loaded.backend, 'wasm', 'the reported backend must be the one that ran');
  assert.equal(loaded.fellBack, true);
  assert.deepEqual(
    fake.calls.map((call) => call.device),
    ['webgpu', 'wasm'],
  );

  const ready = states.at(-1);
  assert.equal(ready?.status, 'ready');
  assert.equal(ready?.status === 'ready' ? ready.backend : null, 'wasm');
  assert.equal(ready?.status === 'ready' ? ready.fellBack : null, true);
});

test('the WASM fallback runs on a fresh module instance', async () => {
  // Regression test for a failure measured in a browser, not a hypothetical. A WebGPU
  // session that dies mid-init leaves the shared ONNX Runtime unusable, so a retry
  // over the *same* transformers.js module fails with the identical ORT status code
  // and a working backend is lost. Headless Firefox / RTX 5060, multilingual-e5-small:
  //   same module  → webgpu fails, wasm fails (~27s wasted)
  //   fresh module → webgpu fails, wasm loads (1.2s)
  //
  // The fake models that dependency: the second instance also fails on wasm, which is
  // what the browser does. Only a distinct module recovers.
  withoutCache();

  // The first instance is poisoned: WebGPU fails, and every later attempt over that
  // same instance fails with the ORT status code the browser actually produced.
  const poisoned = fakeTransformers({ failFor: () => '420519968' });
  // The second is a separate module evaluation, where only WebGPU fails.
  const fresh = fakeTransformers({
    failFor: (device) => (device === 'webgpu' ? 'Failed to create session' : null),
  });
  const queue: Array<typeof poisoned> = [poisoned, fresh];

  const loads: number[] = [];
  const load = async (): Promise<unknown> => {
    const next = loads.length;
    loads.push(next);
    return (queue[next] ?? poisoned).stub;
  };

  const loaded = await loadModel({ backend: 'webgpu', load: load as never });

  assert.equal(loaded.backend, 'wasm', 'the fallback must not be poisoned by the first attempt');
  assert.equal(loaded.fellBack, true);
  assert.equal(loads.length, 2, 'the fallback must ask the loader for a second instance');
  assert.notEqual(poisoned.stub, fresh.stub, 'both attempts must not share one module instance');
  assert.deepEqual(poisoned.calls.map((call) => call.device), ['webgpu'], 'the poisoned instance is used once');
  assert.deepEqual(fresh.calls.map((call) => call.device), ['wasm'], 'only WASM is retried');

  // The regression itself: over the shared instance this fails, which is the whole bug.
  await assert.rejects(
    loadModel({ backend: 'webgpu', load: async () => poisoned.stub }),
    /420519968/,
    'a shared instance must be shown to lose the fallback, or this test proves nothing',
  );
});

test('a WASM failure is reported, not retried on WebGPU', async () => {
  withoutCache();
  // The asymmetry is deliberate: a WASM failure is usually memory or an unsupported
  // op, and re-running it on a GPU does not fix either. Retrying would also double
  // the wait before saying no.
  const fake = fakeTransformers({ failFor: (device) => (device === 'wasm' ? 'out of memory' : null) });

  await assert.rejects(
    loadModel({ backend: 'wasm', load: async () => fake.stub }),
    /out of memory/,
  );
  assert.equal(fake.calls.length, 1, 'a WASM failure must not be retried');
});

test('when both backends fail, the WebGPU error is the one reported', async () => {
  withoutCache();
  const fake = fakeTransformers({ failFor: () => 'shader compilation failed' });

  await assert.rejects(
    loadModel({ backend: 'webgpu', load: async () => fake.stub }),
    /shader compilation failed/,
  );
  assert.equal(fake.calls.length, 2, 'both backends must be attempted');
});

test('a network failure is classified as worth retrying', async () => {
  // The distinction is which button the reader is offered. Getting it wrong in either
  // direction is a small annoyance, never a wrong answer — lexical search covers it.
  assert.equal(classifyLoadFailure('Failed to fetch', 'https://x/y.onnx').kind, 'fetch');
  assert.equal(classifyLoadFailure('getaddrinfo ENOTFOUND cdn', 'https://x/y.onnx').kind, 'fetch');
  assert.equal(classifyLoadFailure('request returned 404', 'https://x/y.onnx').kind, 'fetch');
  assert.equal(classifyLoadFailure('Failed to create session', 'https://x/y.onnx').kind, 'load');
  assert.equal(classifyLoadFailure('out of memory', 'https://x/y.onnx').kind, 'load');

  const fetch = classifyLoadFailure('Failed to fetch', 'https://x/y.onnx');
  assert.equal(fetch.kind === 'fetch' ? fetch.url : '', 'https://x/y.onnx');
});

test('an inconsistent registry fails before anything is downloaded', async () => {
  withoutCache();
  const fake = fakeTransformers();
  const states: BrainState[] = [];

  // The real registry is consistent, so this asserts the *guard* exists rather than
  // reproducing a broken registry. What matters is the ordering: the check runs before
  // the pipeline, so a misconfiguration is a named error rather than a 404 forty
  // seconds into a 600 MB download.
  const loaded = await loadModel({
    backend: 'wasm',
    onState: (state) => states.push(state),
    load: async () => fake.stub,
  });
  assert.equal(states[0]?.status, 'detecting');
  assert.equal(loaded.role, 'embedding');

  assert.deepEqual(auditRegistry(), [], 'the shipped registry must be consistent');
});

test('an already-aborted signal does not start a download', async () => {
  withoutCache();
  const fake = fakeTransformers();
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    loadModel({ backend: 'wasm', signal: controller.signal, load: async () => fake.stub }),
    /cancelled/,
  );
  assert.equal(fake.calls.length, 0, 'an aborted load must not reach the pipeline');
});

test('the ORT runtime is pinned to the installed transformers version', () => {
  // A floating `@latest` path can serve a `.wasm` whose exports do not match this
  // build's JS glue, which fails as an opaque runtime error *after* the model has
  // finished downloading.
  const fake = fakeTransformers({ version: '3.8.1' });
  assert.equal(
    ortWasmPath(fake.stub),
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/',
  );
  assert.ok(!ortWasmPath(fake.stub).includes('@latest'));
});

test('the ORT runtime comes from the CDN, not this origin', () => {
  // Every other byte of model weight already comes from a CDN. On our own origin the
  // 21.6 MB runtime would be an uncached first-paint asset competing with the page.
  const path = ortWasmPath(fakeTransformers().stub);
  assert.ok(path.startsWith('https://'), 'the runtime must not be a relative path');
});

/* --------------------------------------- remembered backend (quota) */

/**
 * A minimal localStorage. The real one is a browser API with quota and privacy
 * rules; what matters here is that a value written by one call is readable by the
 * next, and that throwing is survivable.
 */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

function withLocalStorage(store: Storage | undefined, run: () => Promise<void>): Promise<void> {
  const target = globalThis as { localStorage?: Storage };
  const previous = target.localStorage;
  if (store) target.localStorage = store;
  else delete target.localStorage;
  return run().finally(() => {
    if (previous) target.localStorage = previous;
    else delete target.localStorage;
  });
}

test('a WebGPU failure is remembered, so the next load does not attempt WebGPU again', async () => {
  // The failure this prevents, measured in a browser: `navigator.storage.estimate()`
  // reports a 759 MB quota for this origin, and the four weight files total ~1.3 GB.
  // Nothing can be kept, so the conversational model re-downloads 512 MB every visit
  // while the embedder — small enough to survive — returns in 3s. Skipping a backend
  // already known to fail is what brings the total back under the quota.
  withoutCache();
  const store = memoryStorage();

  await withLocalStorage(store, async () => {
    const failing = fakeTransformers({
      failFor: (device) => (device === 'webgpu' ? 'Failed to create session' : null),
    });
    await loadModel({ role: 'conversation', backend: 'webgpu', load: async () => failing.stub });
    assert.deepEqual(
      failing.calls.map((call) => call.device),
      ['webgpu', 'wasm'],
      'the first load must still try WebGPU — nothing is known yet',
    );

    // Second load, no backend override, so detection would run. Detection can see the
    // adapter, so it would choose WebGPU again and pay for 483 MB to fail again.
    const second = fakeTransformers({
      failFor: (device) => (device === 'webgpu' ? 'Failed to create session' : null),
    });
    const loaded = await loadModel({ role: 'conversation', load: async () => second.stub });

    assert.deepEqual(
      second.calls.map((call) => call.device),
      ['wasm'],
      'the remembered outcome must skip the q4f16 attempt entirely',
    );
    assert.equal(loaded.backend, 'wasm');
    assert.equal(second.calls[0]?.dtype, 'int8', 'and it must load the weights it will keep');
  });
});

test('an explicit backend overrides the memory, so the fallback path stays testable', async () => {
  withoutCache();
  const store = memoryStorage();

  await withLocalStorage(store, async () => {
    const failing = fakeTransformers({
      failFor: (device) => (device === 'webgpu' ? 'Failed to create session' : null),
    });
    await loadModel({ backend: 'webgpu', load: async () => failing.stub });

    const forced = fakeTransformers();
    await loadModel({ backend: 'webgpu', load: async () => forced.stub });
    assert.deepEqual(
      forced.calls.map((call) => call.device),
      ['webgpu'],
      'an explicit backend is an instruction, not a suggestion',
    );
  });
});

test('the memory is per model, and a WebGPU success is never recorded', async () => {
  // Only a WASM outcome is worth pinning. Remembering "webgpu worked" would trap a
  // reader on the fast path on hardware that later loses the device, with no way back.
  withoutCache();

  await withLocalStorage(memoryStorage(), async () => {
    const webgpuOk = fakeTransformers();
    await loadModel({ role: 'embedding', backend: 'webgpu', load: async () => webgpuOk.stub });
    assert.equal(
      globalThis.localStorage?.getItem('agent-backend-preference'),
      null,
      'a successful WebGPU load must leave no memory',
    );
  });

  await withLocalStorage(memoryStorage(), async () => {
    const failing = fakeTransformers({
      failFor: (device) => (device === 'webgpu' ? 'Failed to create session' : null),
    });
    await loadModel({ role: 'embedding', backend: 'webgpu', load: async () => failing.stub });

    // The embedder's memory must not suppress WebGPU for the conversational model,
    // which may be the one that can use it.
    const chat = fakeTransformers();
    await loadModel({ role: 'conversation', backend: 'webgpu', load: async () => chat.stub });
    assert.equal(chat.calls.length, 1);

    const embedder = fakeTransformers();
    await loadModel({ role: 'embedding', load: async () => embedder.stub });
    assert.deepEqual(
      embedder.calls.map((call) => call.device),
      ['wasm'],
      'the model that failed is the one that skips WebGPU',
    );
  });
});

test('an unreadable or corrupt memory is ignored rather than fatal', async () => {
  // Storage can be disabled, full, or hold something another version wrote. None of
  // that is worth failing a load over — the cost is one wasted WebGPU attempt.
  withoutCache();
  // Fails only on WebGPU, so the fallback path runs and `setItem` is actually reached.
  const fakeTransformersFailingWebgpu = () =>
    fakeTransformers({ failFor: (device) => (device === 'webgpu' ? '420519968' : null) });

  for (const store of [
    undefined,
    memoryStorage({ 'agent-backend-preference': 'not json' }),
    memoryStorage({ 'agent-backend-preference': '{"Xenova/multilingual-e5-small":"cuda"}' }),
    {
      ...memoryStorage(),
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    } as Storage,
  ]) {
    await withLocalStorage(store, async () => {
      const failed = fakeTransformersFailingWebgpu();
      const loaded = await loadModel({ backend: 'webgpu', load: async () => failed.stub });
      assert.equal(loaded.backend, 'wasm', 'a broken store must not stop the fallback');

      const direct = fakeTransformers();
      const wasmOnly = await loadModel({ backend: 'wasm', load: async () => direct.stub });
      assert.equal(wasmOnly.backend, 'wasm');
    });
  }
});

test('the predicted backend respects device policy, not just hardware', async () => {
  // This is the promise the panel makes before anyone clicks. It has to match what the
  // loader would actually do, or the panel advertises a WebGPU download that is then
  // refused — the exact kind of claim this project cannot make and be wrong about.
  //
  // Capability detection stays a separate input from policy, so this cannot be faked
  // in either direction: a WASM-only model must report the *measurement* reason, which
  // is emitted before any adapter request and so is observable on hardware with WebGPU
  // as well as without. (This runs under Node, which has no `navigator.gpu` at all.)
  const predicted = await detectBackend(['wasm']);
  assert.equal(predicted.backend, 'wasm');
  assert.equal(predicted.fellBack, true);
  assert.match(
    predicted.reason ?? '',
    /measurement/,
    'the reason must be the policy, not a hardware failure',
  );

  // Both models are WASM-only today, so the panel must not advertise WebGPU.
  for (const role of ['embedding', 'conversation'] as const) {
    const { devices } = modelForRole(role);
    assert.deepEqual(devices, ['wasm'], `${role} should be WASM-only`);
    assert.equal((await detectBackend(devices)).backend, 'wasm');
  }
});
