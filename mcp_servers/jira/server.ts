/**
 * jira MCP server (prod-grade, Jira Cloud REST v3)
 *
 * Read + write tools against Jira Cloud using basic auth (email + API token).
 *
 * Operational modes:
 *   - JIRA_HOST/EMAIL/TOKEN not all set → SYNTHETIC mode (synthetic.ts fixtures).
 *   - All set + DRY_RUN=true → real reads, writes log to stderr only.
 *   - All set + DRY_RUN unset → full read+write.
 *
 * Prod hardening:
 *   - Structured logging via pino (stderr)
 *   - LRU cache on project list (rarely changes)
 *   - Retry-with-backoff on transient errors (5xx, 429, network)
 *   - Honors Retry-After header from Jira
 *   - Pagination on search endpoint (Jira returns `startAt` + `total`)
 *   - McpError types instead of {isError:true}
 *   - health_check tool for readiness probes
 *
 * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { makeLogger } from "../_shared/logger.js";
import { LRUCache } from "../_shared/cache.js";
import { retry, RetryableHttpError } from "../_shared/retry.js";
import { issues as synthIssues, projects as synthProjects, jqlMatch } from "./synthetic.js";

const log = makeLogger("jira");
const HOST = process.env.JIRA_HOST;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "true";
const SYNTHETIC = !(HOST && EMAIL && TOKEN);
const FETCH_TIMEOUT_MS = Number(process.env.JIRA_FETCH_TIMEOUT_MS ?? "30000");

const authHeader = SYNTHETIC ? "" : "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

const projectCache = new LRUCache<string, Array<{ key: string; name: string }>>({
  capacity: 1,
  ttlMs: 30 * 60 * 1000,
});

async function jiraFetch<T>(path: string, init: RequestInit = {}, operationName = "jira"): Promise<T> {
  return retry(
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`https://${HOST}${path}`, {
          ...init,
          signal: ctrl.signal,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: authHeader,
            ...(init.headers ?? {}),
          },
        });
        if (res.ok) return (await res.json()) as T;
        // 429 → wait per Retry-After if present.
        if (res.status === 429) {
          const ra = res.headers.get("Retry-After");
          const retryAfterMs = ra ? Number(ra) * 1000 : undefined;
          const body = await res.text();
          throw new RetryableHttpError(429, `jira ${path} 429: ${body.slice(0, 200)}`, retryAfterMs);
        }
        // 5xx → transient.
        if (res.status >= 500) {
          const body = await res.text();
          throw new RetryableHttpError(res.status, `jira ${path} ${res.status}: ${body.slice(0, 200)}`);
        }
        // 4xx (non-429) → not transient; surface to caller.
        const body = await res.text();
        throw new Error(`jira ${path} ${res.status}: ${body.slice(0, 300)}`);
      } finally {
        clearTimeout(timer);
      }
    },
    { logger: log, operationName },
  );
}

function note(): string {
  if (SYNTHETIC) return "(SYNTHETIC — set JIRA_HOST + EMAIL + API_TOKEN for real instance)";
  if (DRY_RUN) return "(DRY_RUN — writes logged, not sent)";
  return "(live — read + write enabled)";
}

const server = new McpServer({ name: "jira", version: "0.2.0" });

server.tool(
  "health_check",
  "Verify the jira MCP server is reachable and its upstream is healthy. Returns mode, dry_run, and (in live mode) the authenticated user. Safe to poll.",
  {},
  async () => {
    const base = { mode: SYNTHETIC ? "synthetic" : "live", dry_run: DRY_RUN } as Record<string, unknown>;
    if (SYNTHETIC) return { content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok" }, null, 2) }] };
    try {
      const me = await jiraFetch<{ accountId: string; displayName: string; emailAddress?: string }>(
        "/rest/api/3/myself",
        {},
        "myself",
      );
      return {
        content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok", as: { id: me.accountId, name: me.displayName, email: me.emailAddress } }, null, 2) }],
      };
    } catch (err) {
      log.error({ err: (err as Error).message }, "health_check failed");
      throw new McpError(ErrorCode.InternalError, `jira myself failed: ${(err as Error).message}`);
    }
  },
);

server.tool(
  "jira_list_projects",
  "List all Jira projects the bot account can see. Cached 30 min.",
  {},
  async () => {
    if (SYNTHETIC) {
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", projects: synthProjects }, null, 2) }] };
    }
    const cached = projectCache.get("all");
    if (cached) {
      return { content: [{ type: "text", text: JSON.stringify({ mode: "live", projects: cached, cache: "hit" }, null, 2) }] };
    }
    const res = await jiraFetch<{ values: Array<{ key: string; name: string }> }>(
      "/rest/api/3/project/search?maxResults=100",
      {},
      "project.search",
    );
    const projects = res.values.map((p) => ({ key: p.key, name: p.name }));
    projectCache.set("all", projects);
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", projects }, null, 2) }] };
  },
);

server.tool(
  "jira_search_issues",
  "Search issues with JQL. Returns key, status, summary, assignee, type. Supports pagination via start_at.",
  {
    jql: z.string().min(1).describe("JQL query, e.g. 'project = PLAN AND status != Done ORDER BY updated DESC'"),
    max: z.number().int().positive().max(100).default(20),
    start_at: z.number().int().nonnegative().default(0).describe("Pagination offset. Use response.next_start_at to advance."),
  },
  async ({ jql, max, start_at }) => {
    if (SYNTHETIC) {
      const matched = synthIssues.filter((i) => jqlMatch(jql, i));
      const slice = matched.slice(start_at, start_at + max);
      const issues = slice.map((i) => ({
        key: i.key,
        status: i.status,
        summary: i.summary,
        assignee: i.assignee,
        type: i.type,
      }));
      const next = start_at + slice.length;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                mode: "synthetic",
                jql,
                total: matched.length,
                start_at,
                returned: slice.length,
                next_start_at: next < matched.length ? next : null,
                issues,
              },
              null,
              2,
            ),
          },
        ],
      };
    }
    const params = new URLSearchParams({
      jql,
      maxResults: String(max),
      startAt: String(start_at),
      fields: "summary,status,assignee,issuetype",
    });
    type J = {
      total: number;
      startAt: number;
      maxResults: number;
      issues: Array<{
        key: string;
        fields: {
          summary: string;
          status: { name: string };
          assignee: { displayName: string } | null;
          issuetype: { name: string };
        };
      }>;
    };
    const res = await jiraFetch<J>(`/rest/api/3/search?${params}`, {}, "issue.search");
    const out = res.issues.map((i) => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status.name,
      assignee: i.fields.assignee?.displayName ?? null,
      type: i.fields.issuetype.name,
    }));
    const next = res.startAt + res.issues.length;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: "live",
              jql,
              total: res.total,
              start_at: res.startAt,
              returned: res.issues.length,
              next_start_at: next < res.total ? next : null,
              issues: out,
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
  "jira_get_issue",
  "Fetch one issue by key, including description and comments.",
  { key: z.string().regex(/^[A-Z][A-Z0-9_]+-\d+$/, "expected key like 'PLAN-1893'") },
  async ({ key }) => {
    if (SYNTHETIC) {
      const i = synthIssues.find((x) => x.key === key);
      if (!i) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `issue '${key}' not found. Available keys: ${synthIssues.map((x) => x.key).join(", ")}`,
        );
      }
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", issue: i }, null, 2) }] };
    }
    type J = {
      key: string;
      fields: {
        summary: string;
        description: { content: unknown } | string | null;
        status: { name: string };
        assignee: { displayName: string } | null;
        reporter: { displayName: string } | null;
        issuetype: { name: string };
        comment: { comments: Array<{ author: { displayName: string }; body: { content: unknown } | string; created: string }> };
      };
    };
    const res = await jiraFetch<J>(`/rest/api/3/issue/${encodeURIComponent(key)}`, {}, "issue.get");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: "live",
              issue: {
                key: res.key,
                summary: res.fields.summary,
                status: res.fields.status.name,
                assignee: res.fields.assignee?.displayName ?? null,
                reporter: res.fields.reporter?.displayName ?? null,
                type: res.fields.issuetype.name,
                description: res.fields.description,
                comments: res.fields.comment.comments.map((c) => ({
                  author: c.author.displayName,
                  body: c.body,
                  created: c.created,
                })),
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
  "jira_create_issue",
  "Create a new Jira issue. Honors DRY_RUN=true (logs to stderr instead of creating). WRITE OPERATION — the PreToolUse hook in this repo gates this when DRY_RUN is unset.",
  {
    project_key: z.string().regex(/^[A-Z][A-Z0-9_]+$/, "expected project key like 'PLAN'"),
    summary: z.string().min(1).max(255),
    description: z.string().optional(),
    issue_type: z.string().default("Task"),
    assignee_account_id: z.string().optional(),
  },
  async ({ project_key, summary, description, issue_type, assignee_account_id }) => {
    if (SYNTHETIC || DRY_RUN) {
      log.info(
        { tool: "jira_create_issue", project_key, issue_type, summary, mode: SYNTHETIC ? "synthetic" : "dry-run" },
        "would-have-created",
      );
      const fakeKey = `${project_key}-${Math.floor(Math.random() * 9000 + 1000)}`;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { mode: SYNTHETIC ? "synthetic" : "dry-run", created: false, would_have_created: { key: fakeKey, project: project_key, summary, type: issue_type, description } },
              null,
              2,
            ),
          },
        ],
      };
    }
    const body = {
      fields: {
        project: { key: project_key },
        summary,
        issuetype: { name: issue_type },
        ...(description
          ? { description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: description }] }] } }
          : {}),
        ...(assignee_account_id ? { assignee: { accountId: assignee_account_id } } : {}),
      },
    };
    const res = await jiraFetch<{ key: string; id: string; self: string }>(
      "/rest/api/3/issue",
      { method: "POST", body: JSON.stringify(body) },
      "issue.create",
    );
    log.info({ key: res.key, project_key, issue_type }, "created issue");
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", key: res.key, id: res.id }, null, 2) }] };
  },
);

server.tool(
  "jira_add_comment",
  "Add a comment to an existing issue. Honors DRY_RUN=true. WRITE OPERATION — gated by PreToolUse hook.",
  { key: z.string().regex(/^[A-Z][A-Z0-9_]+-\d+$/), body: z.string().min(1) },
  async ({ key, body }) => {
    if (SYNTHETIC || DRY_RUN) {
      log.info({ tool: "jira_add_comment", key, body_preview: body.slice(0, 200), mode: SYNTHETIC ? "synthetic" : "dry-run" }, "would-have-commented");
      return { content: [{ type: "text", text: JSON.stringify({ mode: SYNTHETIC ? "synthetic" : "dry-run", posted: false, would_have_posted: { key, body } }, null, 2) }] };
    }
    const payload = { body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] } };
    const res = await jiraFetch<{ id: string; created: string }>(
      `/rest/api/3/issue/${encodeURIComponent(key)}/comment`,
      { method: "POST", body: JSON.stringify(payload) },
      "issue.comment.create",
    );
    log.info({ key, comment_id: res.id }, "commented on issue");
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", id: res.id, created: res.created }, null, 2) }] };
  },
);

log.info({ mode: SYNTHETIC ? "synthetic" : "live", dry_run: DRY_RUN, host: HOST }, `jira MCP server starting ${note()}`);
await server.connect(new StdioServerTransport());
