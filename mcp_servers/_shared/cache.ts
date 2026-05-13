/**
 * Small LRU cache with TTL. Used by MCP servers to memoize read-heavy
 * upstream calls (Slack channel list, Jira project list, etc.) so repeated
 * agent queries don't spam the upstream API.
 *
 * Capacity-bounded: oldest entries evicted when capacity is exceeded.
 * Time-bounded: entries past their TTL are treated as misses.
 *
 * Not thread-safe — fine for our stdio MCP server, single-process by design.
 */

export interface LRUCacheOptions {
  capacity: number;
  ttlMs: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly ttlMs: number;
  private readonly map = new Map<K, Entry<V>>();

  constructor(opts: LRUCacheOptions) {
    if (opts.capacity < 1) throw new Error("capacity must be ≥ 1");
    if (opts.ttlMs < 0) throw new Error("ttlMs must be ≥ 0");
    this.capacity = opts.capacity;
    this.ttlMs = opts.ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Promote — move to end (most recently used).
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as K | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  /** Cached `loader` result; loader is invoked at most once per cache window. */
  async memo<T extends V>(key: K, loader: () => Promise<T>): Promise<T> {
    const hit = this.get(key) as T | undefined;
    if (hit !== undefined) return hit;
    const fresh = await loader();
    this.set(key, fresh);
    return fresh;
  }

  size(): number {
    return this.map.size;
  }
}
