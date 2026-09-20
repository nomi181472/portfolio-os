/**
 * lib/analytics/lru.ts
 *
 * A tiny, strictly bounded LRU cache. This is the only place the system touches
 * per-visitor information in memory, and its size is fixed at construction time:
 * once full, the least-recently-seen key is evicted. It can never grow with
 * traffic (§5, §6, §51).
 */
export class Lru<K, V> {
  private map = new Map<K, V>();

  constructor(private readonly capacity: number) {
    if (capacity <= 0) throw new Error('LRU capacity must be positive');
  }

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Re-insert to refresh recency.
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): V {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
    return value;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  /** Iterate values, most-recent first. */
  values(): IterableIterator<V> {
    return this.map.values();
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  toArray(): V[] {
    return [...this.map.values()];
  }
}