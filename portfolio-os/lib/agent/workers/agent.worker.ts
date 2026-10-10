/**
 * lib/agent/workers/agent.worker.ts
 *
 * Dedicated Web Worker for running ONNX Runtime / Transformers.js execution
 * 100% off the main browser thread.
 *
 * This worker:
 * 1. Runs ONNX WASM in background threads without blocking UI or freezing the browser.
 * 2. Emits progressive streaming tokens ({ type: 'TOKEN', token }) back to the main thread.
 * 3. Supports multi-threading (WASM SIMD with hardwareConcurrency) safely in Web Worker context.
 */

export type WorkerRequest =
  | { type: 'LOAD_MODEL'; id: string; role: 'conversation' | 'fluent' | 'smollm' | 'embedding' }
  | {
      type: 'GENERATE';
      id: string;
      question: string;
      instruction: string;
      history?: any[];
      maxNewTokens?: number;
    }
  | { type: 'DISPOSE'; id: string };

export type WorkerResponse =
  | { type: 'PROGRESS'; id: string; status: string; loaded?: number; total?: number; file?: string }
  | { type: 'LOADED'; id: string; backend: 'webgpu' | 'wasm'; loadMs: number }
  | { type: 'TOKEN'; id: string; token: string }
  | { type: 'GENERATE_DONE'; id: string; raw: string; text?: string; keys: string[]; actions: any[] }
  | { type: 'ERROR'; id: string; error: string };

let generatorPipeline: any = null;
let currentRole: string | null = null;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (!req) return;

  if (req.type === 'LOAD_MODEL') {
    const started = Date.now();
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Multi-threading configuration inside background Web Worker
      const threads =
        typeof navigator !== 'undefined' && navigator.hardwareConcurrency
          ? Math.min(4, Math.max(1, navigator.hardwareConcurrency))
          : 1;

      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${env.version}/dist/`;
        (env.backends.onnx.wasm as any).numThreads = threads;
      }

      const modelId =
        req.role === 'fluent'
          ? 'onnx-community/Qwen2.5-1.5B-Instruct'
          : req.role === 'smollm'
            ? 'onnx-community/SmolLM2-360M-Instruct-ONNX'
            : req.role === 'embedding'
              ? 'Xenova/all-MiniLM-L6-v2'
              : 'onnx-community/Qwen2.5-0.5B-Instruct';

      const task = req.role === 'embedding' ? 'feature-extraction' : 'text-generation';
      const dtype = 'int8';

      generatorPipeline = await pipeline(task, modelId, {
        dtype,
        device: 'wasm',
        progress_callback: (prog: any) => {
          self.postMessage({
            type: 'PROGRESS',
            id: req.id,
            status: prog.status,
            loaded: prog.loaded,
            total: prog.total,
            file: prog.file,
          } as WorkerResponse);
        },
      });

      currentRole = req.role;
      self.postMessage({
        type: 'LOADED',
        id: req.id,
        backend: 'wasm',
        loadMs: Date.now() - started,
      } as WorkerResponse);
    } catch (err: any) {
      self.postMessage({
        type: 'ERROR',
        id: req.id,
        error: err?.message || String(err),
      } as WorkerResponse);
    }
    return;
  }

  if (req.type === 'GENERATE') {
    if (!generatorPipeline) {
      self.postMessage({
        type: 'ERROR',
        id: req.id,
        error: 'Model pipeline is not loaded in worker.',
      } as WorkerResponse);
      return;
    }

    try {
      const messages = [
        { role: 'system', content: req.instruction },
        ...(req.history || []).flatMap((h: any) => [
          { role: 'user', content: h.question },
          { role: 'assistant', content: h.answer },
        ]),
        { role: 'user', content: req.question },
      ];

      const { TextStreamer } = await import('@huggingface/transformers');
      const streamer = generatorPipeline.tokenizer
        ? new TextStreamer(generatorPipeline.tokenizer, {
            skip_prompt: true,
            callback_function: (token: string) => {
              self.postMessage({
                type: 'TOKEN',
                id: req.id,
                token,
              } as WorkerResponse);
            },
          })
        : undefined;

      const output = await generatorPipeline(messages, {
        do_sample: true,
        temperature: 0.7,
        top_p: 0.9,
        max_new_tokens: req.maxNewTokens || 512,
        repetition_penalty: 1.1,
        ...(streamer ? { streamer } : {}),
      });

      let raw = '';
      if (typeof output === 'string') {
        raw = output;
      } else if (Array.isArray(output) && output[0]) {
        const first = output[0];
        if (typeof first.generated_text === 'string') {
          raw = first.generated_text;
        } else if (Array.isArray(first.generated_text)) {
          const lastMsg = first.generated_text[first.generated_text.length - 1];
          raw = typeof lastMsg?.content === 'string' ? lastMsg.content : JSON.stringify(first.generated_text);
        } else {
          raw = JSON.stringify(first);
        }
      } else {
        raw = String(output);
      }

      self.postMessage({
        type: 'GENERATE_DONE',
        id: req.id,
        raw,
        text: raw,
        keys: [],
        actions: [],
      } as WorkerResponse);
    } catch (err: any) {
      self.postMessage({
        type: 'ERROR',
        id: req.id,
        error: err?.message || String(err),
      } as WorkerResponse);
    }
    return;
  }

  if (req.type === 'DISPOSE') {
    try {
      if (generatorPipeline?.dispose) {
        await generatorPipeline.dispose();
      }
    } catch {}
    generatorPipeline = null;
    currentRole = null;
  }
};
