import { describe, it, expect, vi } from "vitest";
import { retry, RetryableHttpError } from "./retry.js";

describe("retry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn(async () => "ok");
    const result = await retry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on RetryableHttpError up to maxAttempts", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new RetryableHttpError(429, "rate-limited", 1);
      return "eventual-success";
    });
    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 });
    expect(result).toBe("eventual-success");
    expect(calls).toBe(3);
  });

  it("does not retry non-transient errors", async () => {
    const fn = vi.fn(async () => {
      throw new Error("permanent failure");
    });
    await expect(retry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow("permanent failure");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts on persistent transient failures", async () => {
    const fn = vi.fn(async () => {
      throw new RetryableHttpError(500, "internal");
    });
    await expect(retry(fn, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5 })).rejects.toBeInstanceOf(RetryableHttpError);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After hint from RetryableHttpError", async () => {
    let calls = 0;
    const start = Date.now();
    const fn = async () => {
      calls++;
      if (calls === 1) throw new RetryableHttpError(429, "rate-limited", 50);
      return "ok";
    };
    const result = await retry(fn, { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 });
    const elapsed = Date.now() - start;
    expect(result).toBe("ok");
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});
