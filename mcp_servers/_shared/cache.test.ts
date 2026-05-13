import { describe, it, expect, vi } from "vitest";
import { LRUCache } from "./cache.js";

describe("LRUCache", () => {
  it("returns undefined on miss", () => {
    const c = new LRUCache<string, string>({ capacity: 2, ttlMs: 1000 });
    expect(c.get("missing")).toBeUndefined();
  });

  it("returns set value on hit", () => {
    const c = new LRUCache<string, number>({ capacity: 2, ttlMs: 1000 });
    c.set("k", 42);
    expect(c.get("k")).toBe(42);
  });

  it("evicts least-recently-used when over capacity", () => {
    const c = new LRUCache<string, number>({ capacity: 2, ttlMs: 1000 });
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3); // evicts "a"
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
  });

  it("promotes on access (LRU semantics)", () => {
    const c = new LRUCache<string, number>({ capacity: 2, ttlMs: 1000 });
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // promote "a", making "b" the LRU
    c.set("c", 3); // evicts "b"
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("c")).toBe(3);
  });

  it("treats TTL-expired entries as misses", () => {
    vi.useFakeTimers();
    const c = new LRUCache<string, string>({ capacity: 2, ttlMs: 1000 });
    c.set("k", "v");
    vi.advanceTimersByTime(1500);
    expect(c.get("k")).toBeUndefined();
    vi.useRealTimers();
  });

  it("memo invokes loader once per key per TTL window", async () => {
    const c = new LRUCache<string, number>({ capacity: 2, ttlMs: 1000 });
    let calls = 0;
    const loader = async () => {
      calls++;
      return 100;
    };
    expect(await c.memo("k", loader)).toBe(100);
    expect(await c.memo("k", loader)).toBe(100);
    expect(calls).toBe(1);
  });

  it("rejects invalid capacity", () => {
    expect(() => new LRUCache({ capacity: 0, ttlMs: 1000 })).toThrow(/capacity/);
  });

  it("rejects negative ttl", () => {
    expect(() => new LRUCache({ capacity: 2, ttlMs: -1 })).toThrow(/ttlMs/);
  });
});
