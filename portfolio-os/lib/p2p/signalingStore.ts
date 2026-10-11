/**
 * lib/p2p/signalingStore.ts
 *
 * Dual-Mode Signaling Store for WebRTC P2P direct communication.
 *
 * Provides transparent, interchangeable signaling storage:
 * 1. Mode A: Stateless Serverless Mode (Upstash Redis REST)
 *    - Cross-container shared state for Vercel / AWS Lambda.
 *    - Atomic Redis pipelines via native HTTPS fetch (zero npm package overhead).
 *    - Auto-expiring keys (60s signal TTL, 240s presence TTL).
 *
 * 2. Mode B: Persistent Server Mode (In-Memory Map)
 *    - Zero external dependency / zero SaaS cost.
 *    - Sliding 60s window for persistent single-process Node / Docker / VPS deployments.
 *    - Activated when Upstash credentials are omitted or P2P_SIGNALING_MODE='memory'.
 */

import type { SignalEnvelope } from './types';

export interface ISignalingStore {
  readonly backend: 'upstash' | 'memory';
  recordHostHeartbeat(channelId: string, timestamp?: number): Promise<void>;
  getHostLastSeen(channelId: string): Promise<number>;
  pushSignal(channelId: string, signal: SignalEnvelope): Promise<void>;
  pollSignals(
    channelId: string,
    role: string,
    clientId?: string,
    since?: number
  ): Promise<SignalEnvelope[]>;
}

const SIGNAL_TTL_MS = 60_000; // 60 seconds
const HEARTBEAT_TTL_SECONDS = 240; // 4 minutes

/**
 * Filter helper matching signal envelope to intended recipient and timestamp.
 */
export function matchesRecipient(
  sig: SignalEnvelope,
  role: string,
  clientId?: string,
  since = 0
): boolean {
  if (typeof sig.timestamp === 'number' && sig.timestamp < since) {
    return false;
  }
  return (
    sig.to === role ||
    (Boolean(clientId) && sig.to === clientId) ||
    (role === 'host' && (sig.to === 'host' || sig.to === 'all'))
  );
}

/**
 * In-Memory Signaling Store implementation for persistent single-process servers.
 */
export class InMemorySignalingStore implements ISignalingStore {
  readonly backend = 'memory' as const;
  private signalsByChannel = new Map<string, SignalEnvelope[]>();
  private hostHeartbeats = new Map<string, number>();

  private pruneExpired(channelId: string) {
    const now = Date.now();
    const list = this.signalsByChannel.get(channelId);
    if (!list) return;

    const fresh = list.filter((sig) => now - sig.timestamp < SIGNAL_TTL_MS);
    if (fresh.length === 0) {
      this.signalsByChannel.delete(channelId);
    } else {
      this.signalsByChannel.set(channelId, fresh);
    }
  }

  async recordHostHeartbeat(channelId: string, timestamp = Date.now()): Promise<void> {
    this.hostHeartbeats.set(channelId, timestamp);
  }

  async getHostLastSeen(channelId: string): Promise<number> {
    return this.hostHeartbeats.get(channelId) || 0;
  }

  async pushSignal(channelId: string, signal: SignalEnvelope): Promise<void> {
    this.pruneExpired(channelId);
    const list = this.signalsByChannel.get(channelId) || [];
    list.push(signal);
    this.signalsByChannel.set(channelId, list);
  }

  async pollSignals(
    channelId: string,
    role: string,
    clientId?: string,
    since = 0
  ): Promise<SignalEnvelope[]> {
    this.pruneExpired(channelId);
    const list = this.signalsByChannel.get(channelId) || [];
    return list.filter((sig) => matchesRecipient(sig, role, clientId, since));
  }

  /**
   * Diagnostic helper for testing.
   */
  clear() {
    this.signalsByChannel.clear();
    this.hostHeartbeats.clear();
  }
}

/**
 * Upstash Redis REST Signaling Store implementation for stateless serverless environments.
 */
export class UpstashRedisSignalingStore implements ISignalingStore {
  readonly backend = 'upstash' as const;
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
  }

  private async executePipeline<T = unknown>(commands: Array<Array<string | number>>): Promise<T[]> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Upstash pipeline error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as Array<{ result?: T; error?: string }>;
    return json.map((entry) => {
      if (entry.error) {
        throw new Error(`Upstash command error: ${entry.error}`);
      }
      return entry.result as T;
    });
  }

  async recordHostHeartbeat(channelId: string, timestamp = Date.now()): Promise<void> {
    const key = `p2p:host:${channelId}`;
    await this.executePipeline([['SET', key, String(timestamp), 'EX', HEARTBEAT_TTL_SECONDS]]);
  }

  async getHostLastSeen(channelId: string): Promise<number> {
    const key = `p2p:host:${channelId}`;
    try {
      const [result] = await this.executePipeline<string | number | null>([['GET', key]]);
      if (!result) return 0;
      const parsed = typeof result === 'number' ? result : Number(result);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch (err) {
      console.warn('[P2P/Upstash] Failed to retrieve host presence', err);
      return 0;
    }
  }

  async pushSignal(channelId: string, signal: SignalEnvelope): Promise<void> {
    const key = `p2p:signals:${channelId}`;
    const payload = JSON.stringify(signal);
    await this.executePipeline([
      ['RPUSH', key, payload],
      ['EXPIRE', key, Math.round(SIGNAL_TTL_MS / 1000)],
      ['LTRIM', key, -100, -1],
    ]);
  }

  async pollSignals(
    channelId: string,
    role: string,
    clientId?: string,
    since = 0
  ): Promise<SignalEnvelope[]> {
    const key = `p2p:signals:${channelId}`;
    try {
      const [rawList] = await this.executePipeline<unknown[]>([['LRANGE', key, 0, -1]]);
      if (!Array.isArray(rawList)) return [];

      const now = Date.now();
      const matched: SignalEnvelope[] = [];

      for (const item of rawList) {
        try {
          const sig: SignalEnvelope = typeof item === 'string' ? JSON.parse(item) : (item as SignalEnvelope);
          if (
            sig &&
            typeof sig.timestamp === 'number' &&
            now - sig.timestamp < SIGNAL_TTL_MS &&
            matchesRecipient(sig, role, clientId, since)
          ) {
            matched.push(sig);
          }
        } catch {
          // Ignore malformed signal
        }
      }

      return matched;
    } catch (err) {
      console.warn('[P2P/Upstash] Failed to poll signals', err);
      return [];
    }
  }
}

// Singleton instances
let globalInMemoryStore: InMemorySignalingStore | null = null;
let globalUpstashStore: UpstashRedisSignalingStore | null = null;

export interface SignalingStoreOptions {
  mode?: string;
  url?: string;
  token?: string;
}

/**
 * Factory creating or resolving the appropriate signaling store based on runtime configuration.
 */
export function getSignalingStore(options?: SignalingStoreOptions): ISignalingStore {
  const mode = (options?.mode ?? process.env.P2P_SIGNALING_MODE ?? 'auto').trim().toLowerCase();

  if (mode === 'memory') {
    if (!globalInMemoryStore) {
      globalInMemoryStore = new InMemorySignalingStore();
    }
    return globalInMemoryStore;
  }

  const url = (options?.url ?? process.env.UPSTASH_REDIS_REST_URL ?? '').trim();
  const token = (options?.token ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '').trim();

  if (url && token && mode !== 'memory') {
    if (!globalUpstashStore) {
      globalUpstashStore = new UpstashRedisSignalingStore(url, token);
    }
    return globalUpstashStore;
  }

  if (!globalInMemoryStore) {
    globalInMemoryStore = new InMemorySignalingStore();
  }
  return globalInMemoryStore;
}
