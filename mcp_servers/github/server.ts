/**
 * github MCP server
 *
 * Exposes pull-request operations needed by the pr-reviewer workflow.
 *
 *   - GITHUB_TOKEN unset → SYNTHETIC mode (reads JSON PR fixtures from
 *     ../../05_pr_reviewer/synthetic_prs/). Lets `npm install && npx tsx`
 *     work without any real GitHub access.
 *   - Token set + DRY_RUN=true → reads hit real GitHub, writes (review
 *     comments, ack) log to stderr only.
 *   - Token set + DRY_RUN unset → full read+write.
 *
 * Prod-grade pattern matches the slack/jira servers in this repo:
 *   - pino structured logging
 *   - retry-with-backoff on transient GitHub errors
 *   - LRU cache on PR list (rare-change read path)
 *   - McpError types
 *   - health_check tool
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeLogger } from "../_shared/logger.js";
import { LRUCache } from "../_shared/cache.js";
import { retry, RetryableHttpError } from "../_shared/retry.js";

const log = makeLogger("github");
const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SYNTH_DIR = join(REPO_ROOT, "05_pr_reviewer", "synthetic_prs");

const TOKEN = process.env.GITHUB_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "true";
const SYNTHETIC = !TOKEN;
const REPO = process.env.GITHUB_REPO ?? "carlos-rdz/enterprise-tooling";
const API_BASE = "https://api.github.com";
const FETCH_TIMEOUT_MS = Number(process.env.GITHUB_FETCH_TIMEOUT_MS ?? "30000");

// ---- Synthetic loader --------------------------------------------------------

interface SyntheticPR {
  number: number;
  title: string;
  author: string;
  base: string;
  head: string;
  state: string;
  labels: string[];
  description: string;
  planted_bug: {
    exists: boolean;
    kind: string | null;
    severity: string | null;
    summary: string;
  };
  files: Array<{ path: string; diff: string }>;
}

function loadSyntheticPRs(): Map<number, SyntheticPR> {
  const out = new Map<number, SyntheticPR>();
  try {
    for (const entry of readdirSync(SYNTH_DIR)) {
      if (!entry.endsWith(".json")) continue;
      const pr = JSON.parse(readFileSync(join(SYNTH_DIR, entry), "utf8")) as SyntheticPR;
      out.set(pr.number, pr);
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, "synthetic PR fixtures not loadable");
  }
  return out;
}

const syntheticPRs = SYNTHETIC ? loadSyntheticPRs() : new Map<number, SyntheticPR>();

// ---- GitHub live wrappers ----------------------------------------------------

const prListCache = new LRUCache<string, unknown[]>({ capacity: 4, ttlMs: 60_000 });

async function ghFetch<T>(path: string, init: RequestInit = {}, op = "github"): Promise<T> {
  return retry(
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          ...init,
          signal: ctrl.signal,
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
            "User-Agent": "enterprise-coordination-pr-reviewer",
            ...(init.headers ?? {}),
          },
        });
        if (res.ok) {
          if (res.status === 204) return undefined as T;
          return (await res.json()) as T;
        }
        if (res.status === 429 || res.status === 403) {
          const ra = res.headers.get("Retry-After");
          const retryAfterMs = ra ? Number(ra) * 1000 : 30_000;
          throw new RetryableHttpError(res.status, `gh ${path} rate-limited`, retryAfterMs);
        }
        if (res.status >= 500) {
          throw new RetryableHttpError(res.status, `gh ${path} ${res.status}`);
        }
        const body = await res.text();
        throw new Error(`gh ${path} ${res.status}: ${body.slice(0, 200)}`);
      } finally {
        clearTimeout(timer);
      }
    },
    { logger: log, operationName: op },
  );
}

function note(): string {
  if (SYNTHETIC) return "(SYNTHETIC — set GITHUB_TOKEN for real GitHub)";
  if (DRY_RUN) return "(DRY_RUN — review-comment writes logged, not posted)";
  return "(live — read + write enabled)";
}

const server = new McpServer({ name: "github", version: "0.1.0" });

server.tool(
  "health_check",
  "Verify the github MCP server is reachable. Returns mode, dry_run, and (in live mode) the authenticated user.",
  {},
  async () => {
    const base = { mode: SYNTHETIC ? "synthetic" : "live", dry_run: DRY_RUN, repo: REPO } as Record<string, unknown>;
    if (SYNTHETIC) {
      return { content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok", synthetic_prs: syntheticPRs.size }, null, 2) }] };
    }
    try {
      const me = await ghFetch<{ login: string; id: number }>("/user", {}, "user");
      return { content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok", as: me.login }, null, 2) }] };
    } catch (err) {
      throw new McpError(ErrorCode.InternalError, `github user fetch failed: ${(err as Error).message}`);
    }
  },
);

server.tool(
  "list_open_prs",
  "List open pull requests in the configured repo (GITHUB_REPO env var). Cached 60s. Returns number/title/author/labels.",
  {
    limit: z.number().int().positive().max(50).default(20),
  },
  async ({ limit }) => {
    if (SYNTHETIC) {
      const prs = [...syntheticPRs.values()]
        .filter((p) => p.state === "open")
        .slice(0, limit)
        .map((p) => ({
          number: p.number,
          title: p.title,
          author: p.author,
          labels: p.labels,
        }));
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", prs }, null, 2) }] };
    }
    const cached = prListCache.get(REPO);
    if (cached) {
      return { content: [{ type: "text", text: JSON.stringify({ mode: "live", prs: cached, cache: "hit" }, null, 2) }] };
    }
    type GhPR = { number: number; title: string; user: { login: string }; labels: Array<{ name: string }> };
    const data = await ghFetch<GhPR[]>(`/repos/${REPO}/pulls?state=open&per_page=${limit}`, {}, "pulls.list");
    const out = data.map((p) => ({
      number: p.number,
      title: p.title,
      author: p.user.login,
      labels: p.labels.map((l) => l.name),
    }));
    prListCache.set(REPO, out);
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", prs: out }, null, 2) }] };
  },
);

server.tool(
  "get_pr",
  "Fetch full metadata + description for one PR by number.",
  { number: z.number().int().positive() },
  async ({ number }) => {
    if (SYNTHETIC) {
      const pr = syntheticPRs.get(number);
      if (!pr) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `PR #${number} not found. Available: ${[...syntheticPRs.keys()].join(", ")}`,
        );
      }
      // Hide planted_bug from the agent — it's the answer key, not data the
      // reviewer should see.
      const { planted_bug: _planted_bug, ...visible } = pr;
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", pr: visible }, null, 2) }] };
    }
    type GhPR = {
      number: number;
      title: string;
      body: string;
      user: { login: string };
      head: { ref: string };
      base: { ref: string };
      labels: Array<{ name: string }>;
      state: string;
    };
    const pr = await ghFetch<GhPR>(`/repos/${REPO}/pulls/${number}`, {}, "pulls.get");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: "live",
              pr: {
                number: pr.number,
                title: pr.title,
                description: pr.body,
                author: pr.user.login,
                head: pr.head.ref,
                base: pr.base.ref,
                labels: pr.labels.map((l) => l.name),
                state: pr.state,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "get_pr_diff",
  "Fetch the unified diff for one PR. Returns file paths + per-file diff text.",
  { number: z.number().int().positive() },
  async ({ number }) => {
    if (SYNTHETIC) {
      const pr = syntheticPRs.get(number);
      if (!pr) {
        throw new McpError(ErrorCode.InvalidParams, `PR #${number} not found.`);
      }
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", files: pr.files }, null, 2) }] };
    }
    type GhFile = { filename: string; patch?: string };
    const files = await ghFetch<GhFile[]>(`/repos/${REPO}/pulls/${number}/files`, {}, "pulls.files");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { mode: "live", files: files.map((f) => ({ path: f.filename, diff: f.patch ?? "" })) },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "post_review_comment",
  "Post a review comment on a PR. Honors DRY_RUN=true (logs to stderr instead of posting). WRITE OPERATION.",
  {
    number: z.number().int().positive(),
    body: z.string().min(1),
    severity: z.enum(["info", "minor", "major", "critical"]).default("minor"),
  },
  async ({ number, body, severity }) => {
    if (SYNTHETIC || DRY_RUN) {
      log.info({ tool: "post_review_comment", number, severity, body_preview: body.slice(0, 200) }, "would-have-commented");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { mode: SYNTHETIC ? "synthetic" : "dry-run", posted: false, would_have_posted: { number, severity, body } },
              null,
              2,
            ),
          },
        ],
      };
    }
    const prefix = severity === "critical" ? "🔴 CRITICAL" : severity === "major" ? "🟠 MAJOR" : severity === "minor" ? "🟡 MINOR" : "ℹ️ INFO";
    const res = await ghFetch<{ id: number; html_url: string }>(
      `/repos/${REPO}/issues/${number}/comments`,
      { method: "POST", body: JSON.stringify({ body: `${prefix}\n\n${body}` }) },
      "issues.comment.create",
    );
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", id: res.id, url: res.html_url }, null, 2) }] };
  },
);

log.info({ mode: SYNTHETIC ? "synthetic" : "live", dry_run: DRY_RUN, repo: REPO }, `github MCP server starting ${note()}`);
await server.connect(new StdioServerTransport());
