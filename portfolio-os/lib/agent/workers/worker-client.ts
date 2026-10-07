/**
 * lib/agent/workers/worker-client.ts
 *
 * Bridge client running on the main UI thread to communicate asynchronously
 * with the dedicated Web Worker.
 *
 * Provides:
 * - 100% async model loading with progress callbacks.
 * - Non-blocking token generation (the browser stays smooth, 60 FPS).
 * - Implements the `ConversationLayer` interface and `Conversation` methods.
 */

import type { ProposedAction } from '../navigation';
import type {
  Conversation,
  MemoryTurn,
  PromptFactsContext,
  PromptFactsRecord,
  ValidationResult,
} from '../models/conversation';
import {
  buildInstruction,
  validateSelection,
  MAX_SELECTED,
} from '../models/conversation';
import type { WorkerRequest, WorkerResponse } from './agent.worker';

export interface WorkerConversationOptions {
  role: 'conversation' | 'fluent';
  onState?: (state: {
    status: 'downloading' | 'ready' | 'failed';
    bytesLoaded?: number;
    bytesTotal?: number;
    backend?: 'webgpu' | 'wasm';
  }) => void;
}

export class AgentWorkerClient implements Conversation {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (val: any) => void;
      reject: (err: any) => void;
      onToken?: (token: string) => void;
    }
  >();
  private reqCounter = 0;
  private inferenceMs: number | null = null;
  private currentRole: 'conversation' | 'fluent';

  constructor(role: 'conversation' | 'fluent' = 'conversation') {
    this.currentRole = role;
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./agent.worker.ts', import.meta.url),
        { type: 'module' },
      );
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = (err) => {
        console.error('AgentWorker error:', err);
      };
    }
    return this.worker;
  }

  private handleMessage(e: MessageEvent<WorkerResponse>): void {
    const res = e.data;
    if (!res || !res.id) return;

    const pending = this.pendingRequests.get(res.id);
    if (!pending) return;

    if (res.type === 'TOKEN') {
      pending.onToken?.(res.token);
      return;
    }

    if (res.type === 'LOADED') {
      pending.resolve(res);
      this.pendingRequests.delete(res.id);
      return;
    }

    if (res.type === 'GENERATE_DONE') {
      pending.resolve(res);
      this.pendingRequests.delete(res.id);
      return;
    }

    if (res.type === 'ERROR') {
      pending.reject(new Error(res.error));
      this.pendingRequests.delete(res.id);
      return;
    }
  }

  public async init(
    onProgress?: (progress: { loaded?: number; total?: number; status: string }) => void,
  ): Promise<{ backend: 'webgpu' | 'wasm'; loadMs: number }> {
    const worker = this.getWorker();
    const id = `load_${++this.reqCounter}`;

    const originalOnMessage = worker.onmessage;
    const progressHandler = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg && msg.id === id && msg.type === 'PROGRESS') {
        onProgress?.({
          loaded: msg.loaded,
          total: msg.total,
          status: msg.status,
        });
      }
    };
    worker.addEventListener('message', progressHandler);

    try {
      const result = await new Promise<{ backend: 'webgpu' | 'wasm'; loadMs: number }>(
        (resolve, reject) => {
          this.pendingRequests.set(id, { resolve, reject });
          worker.postMessage({
            type: 'LOAD_MODEL',
            id,
            role: this.currentRole,
          } as WorkerRequest);
        },
      );
      return result;
    } finally {
      worker.removeEventListener('message', progressHandler);
    }
  }

  public async select(
    question: string,
    retrieved: readonly PromptFactsRecord[],
    history: readonly MemoryTurn[],
    facts?: Partial<PromptFactsContext>,
    onToken?: (token: string) => void,
  ): Promise<ValidationResult> {
    const worker = this.getWorker();
    const id = `gen_${++this.reqCounter}`;

    const promptContext: PromptFactsContext = {
      records: retrieved,
      ...(facts ?? {}),
    };
    const instruction = buildInstruction(promptContext);
    const started = Date.now();

    const result = await new Promise<{
      raw: string;
      text?: string;
      keys: string[];
      actions: any[];
    }>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, onToken });
      worker.postMessage({
        type: 'GENERATE',
        id,
        question,
        instruction,
        history: history as any,
        maxNewTokens: 256,
      } as WorkerRequest);
    });

    this.inferenceMs = Date.now() - started;

    // Validate proposed keys or take top records
    const proposedKeys =
      result.keys && result.keys.length > 0
        ? result.keys
        : retrieved.slice(0, MAX_SELECTED).map((r) => r.key);

    const validated = validateSelection(proposedKeys, retrieved);

    return {
      ...validated,
      proposals: result.actions || [],
      text: result.text || result.raw,
    };
  }

  public lastInferenceMs(): number | null {
    return this.inferenceMs;
  }

  public async dispose(): Promise<void> {
    if (this.worker) {
      try {
        const id = `dispose_${++this.reqCounter}`;
        this.worker.postMessage({ type: 'DISPOSE', id } as WorkerRequest);
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
  }
}

/**
 * Creates a Web Worker backed Conversation instance for browser runtime.
 * Falls back gracefully to standard in-memory creation if Worker is not supported.
 */
export async function createWorkerConversation(
  options: WorkerConversationOptions,
): Promise<Conversation | null> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }

  const client = new AgentWorkerClient(options.role);
  try {
    const loaded = await client.init((prog) => {
      if (options.onState && prog.status === 'progress') {
        options.onState({
          status: 'downloading',
          bytesLoaded: prog.loaded,
          bytesTotal: prog.total,
          backend: 'wasm',
        });
      }
    });

    if (options.onState) {
      options.onState({
        status: 'ready',
        backend: loaded.backend,
      });
    }
    return client;
  } catch (err) {
    await client.dispose();
    return null;
  }
}
