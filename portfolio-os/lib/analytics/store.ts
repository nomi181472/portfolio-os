/**
 * lib/analytics/store.ts
 *
 * Optional durability for the singleton (§12, §14). Default is MemoryOnly — the
 * manager never touches disk. When ANALYTICS_SNAPSHOT_DIR is set (self-hosted
 * `next start` with a persistent disk), a bounded aggregate snapshot is written
 * atomically on an interval so plain process restarts do not wipe "since
 * deployment" history. The snapshot holds only aggregates (day buckets), never
 * events or visitor ids. All failures are swallowed: analytics never breaks the
 * portfolio (§47).
 */
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

export interface SerializedDay {
  key: string;
  scalars: Record<string, number>;
  sectionViews: [string, number][];
  sectionDurationMs: [string, number][];
  clicksByNamespace: [string, number][];
  clicksByTarget: [string, number][];
  scroll: number[];
  exitSections: [string, number][];
  countries: [string, number][];
  devices: [string, number][];
  browsers: [string, number][];
  oss: [string, number][];
  referrers: [string, number][];
  referrerHosts: [string, number][];
  utm: [string, number][];
  perf: Record<string, [number, number]>;
  sketch: number[];
}

export interface SerializedSnapshot {
  schema: 1;
  writtenAt: number;
  deployments: {
    id: string;
    firstSeenAt: number;
    days: SerializedDay[];
  }[];
}

export interface AnalyticsStore {
  readonly kind: string;
  write(snapshot: SerializedSnapshot): Promise<void>;
  read(): Promise<SerializedSnapshot | null>;
}

export class MemoryStore implements AnalyticsStore {
  readonly kind = 'memory';
  async write(): Promise<void> {
    // No-op by design. The singleton is the store.
  }
  async read(): Promise<SerializedSnapshot | null> {
    return null;
  }
}

export class NullStore implements AnalyticsStore {
  readonly kind = 'null';
  async write(): Promise<void> {}
  async read(): Promise<SerializedSnapshot | null> {
    return null;
  }
}

/** Atomic best-effort JSON snapshot store (temp file + rename). */
export class FileSnapshotStore implements AnalyticsStore {
  readonly kind = 'file';
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private get path(): string {
    return join(this.dir, 'analytics-snapshot.json');
  }

  async write(snapshot: SerializedSnapshot): Promise<void> {
    try {
      await fs.mkdir(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(snapshot), 'utf8');
      await fs.rename(tmp, this.path);
    } catch {
      // Disk unavailable / read-only / quota: drop the snapshot quietly.
    }
  }

  async read(): Promise<SerializedSnapshot | null> {
    try {
      const raw = await fs.readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw) as SerializedSnapshot;
      if (parsed?.schema !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

export function resolveStore(): AnalyticsStore {
  const dir = process.env.ANALYTICS_SNAPSHOT_DIR?.trim();
  if (!dir) return new MemoryStore();
  return new FileSnapshotStore(dir);
}