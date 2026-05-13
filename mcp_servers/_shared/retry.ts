/**
 * Retry-with-backoff helper for upstream API calls.
 *
 * - 3 attempts by default (configurable)
 * - exponential backoff with full jitter (200ms, 400ms, 800ms, ...)
 * - honors Retry-After when present on the thrown error
 * - only retries transient errors (network / 5xx / 429 / explicit isTransient flag)
 *
 * The function the caller passes MUST throw on failure. To indicate a 429 with
 * a server-provided wait, throw a `RetryableHttpError` carrying `retryAfterMs`.
 */

import type { Logger } from "pino";

export class RetryableHttpError extends Error {
  status: number;
  retryAfterMs?: number;
  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "RetryableHttpError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  logger?: Logger;
  operationName?: string;
}

const DEFAULTS = { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 10_000 };

function isTransient(err: unknown): boolean {
  if (err instanceof RetryableHttpError) return true;
  if (err instanceof TypeError && /fetch failed|network|ECONN/i.test(err.message)) return true;
  // Slack SDK errors expose a `code` like 'slack_webapi_platform_error'; many
  // are non-transient. We default to NOT retrying SDK platform errors except
  // for explicit rate_limited.
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: string; data?: { error?: string } };
    if (e.code === "slack_webapi_rate_limited_error") return true;
    if (e.data?.error === "ratelimited") return true;
  }
  return false;
}

function backoffMs(attempt: number, base: number, max: number): number {
  const exp = Math.min(max, base * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const cfg = { ...DEFAULTS, ...options };
  const op = options.operationName ?? "upstream call";
  let lastErr: unknown;
  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const transient = isTransient(err);
      const final = attempt === cfg.maxAttempts - 1;
      options.logger?.warn(
        {
          op,
          attempt: attempt + 1,
          maxAttempts: cfg.maxAttempts,
          transient,
          final,
          error: err instanceof Error ? err.message : String(err),
        },
        transient ? "transient failure" : "non-transient failure",
      );
      if (!transient || final) throw err;
      let waitMs: number;
      if (err instanceof RetryableHttpError && err.retryAfterMs !== undefined) {
        waitMs = err.retryAfterMs;
      } else {
        waitMs = backoffMs(attempt, cfg.baseDelayMs, cfg.maxDelayMs);
      }
      await sleep(waitMs);
    }
  }
  throw lastErr;
}
