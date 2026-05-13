/**
 * confluence MCP server (Atlassian Cloud)
 *
 * Read-only access to Confluence pages — search + fetch by id. Built for the
 * pm-historian subagent (and any future skill that needs internal-wiki
 * context). Read-only because every fintech I've talked to wants AI agents
 * to retrieve from wikis, not write to them.
 *
 * Operational modes:
 *   - CONFLUENCE_HOST / EMAIL / API_TOKEN not all set → SYNTHETIC mode.
 *   - All set → live read access.
 *
 * No write tools exposed — by design.
 *
 * Docs: https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { makeLogger } from "../_shared/logger.js";
import { LRUCache } from "../_shared/cache.js";
import { retry, RetryableHttpError } from "../_shared/retry.js";
import { pages as synthPages, type SyntheticPage } from "./synthetic.js";

const log = makeLogger("confluence");
const HOST = process.env.CONFLUENCE_HOST;
const EMAIL = process.env.CONFLUENCE_EMAIL;
const TOKEN = process.env.CONFLUENCE_API_TOKEN;
const SYNTHETIC = !(HOST && EMAIL && TOKEN);
const FETCH_TIMEOUT_MS = Number(process.env.CONFLUENCE_FETCH_TIMEOUT_MS ?? "30000");

const authHeader = SYNTHETIC ? "" : "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

const searchCache = new LRUCache<string, SyntheticPage[]>({ capacity: 32, ttlMs: 5 * 60 * 1000 });

async function confluenceFetch<T>(path: string, op = "confluence"): Promise<T> {
  return retry(
    async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`https://${HOST}${path}`, {
          signal: ctrl.signal,
          headers: {
            Accept: "application/json",
            Authorization: authHeader,
            "User-Agent": "enterprise-coordination-confluence",
          },
        });
        if (res.ok) return (await res.json()) as T;
        if (res.status === 429) {
          const ra = res.headers.get("Retry-After");
          throw new RetryableHttpError(429, `confluence ${path} 429`, ra ? Number(ra) * 1000 : undefined);
        }
        if (res.status >= 500) throw new RetryableHttpError(res.status, `confluence ${path} ${res.status}`);
        const body = await res.text();
        throw new Error(`confluence ${path} ${res.status}: ${body.slice(0, 200)}`);
      } finally {
        clearTimeout(timer);
      }
    },
    { logger: log, operationName: op },
  );
}

const server = new McpServer({ name: "confluence", version: "0.1.0" });

server.tool(
  "health_check",
  "Verify confluence MCP server is reachable. Returns mode and (in live mode) the authenticated user.",
  {},
  async () => {
    const base = { mode: SYNTHETIC ? "synthetic" : "live", host: HOST ?? "(synthetic)" } as Record<string, unknown>;
    if (SYNTHETIC) {
      return { content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok", synthetic_pages: synthPages.length }, null, 2) }] };
    }
    try {
      const me = await confluenceFetch<{ email: string; displayName: string }>("/wiki/rest/api/user/current", "user.current");
      return { content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok", as: me.email }, null, 2) }] };
    } catch (err) {
      throw new McpError(ErrorCode.InternalError, `confluence health check failed: ${(err as Error).message}`);
    }
  },
);

server.tool(
  "search_pages",
  "Search Confluence pages by keyword. Returns id/title/space/url. Cached 5 min in synthetic and live.",
  {
    query: z.string().min(1),
    space_key: z.string().optional().describe("Restrict to one space, e.g. 'FLEXPAY'"),
    max: z.number().int().positive().max(50).default(10),
  },
  async ({ query, space_key, max }) => {
    const cacheKey = `${query.toLowerCase()}|${space_key ?? ""}|${max}`;
    const hits = await searchCache.memo(cacheKey, async () => {
      if (SYNTHETIC) {
        const q = query.toLowerCase();
        return synthPages.filter((p) => {
          if (space_key && p.space_key !== space_key) return false;
          return (
            p.title.toLowerCase().includes(q) ||
            p.body.toLowerCase().includes(q) ||
            p.labels.some((l) => l.includes(q))
          );
        }).slice(0, max);
      }
      const cql = space_key
        ? `space = "${space_key}" AND text ~ "${query}"`
        : `text ~ "${query}"`;
      const url = `/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${max}`;
      type CqlRes = { results: Array<{ id: string; title: string; space: { key: string }; _links: { webui: string } }> };
      const res = await confluenceFetch<CqlRes>(url, "search");
      return res.results.map((r) => ({
        id: r.id,
        space_key: r.space.key,
        title: r.title,
        author: "(unknown)",
        updated: "",
        body: "",
        labels: [],
      }));
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { mode: SYNTHETIC ? "synthetic" : "live", query, hit_count: hits.length, hits: hits.map((h) => ({ id: h.id, space: h.space_key, title: h.title })) },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "get_page",
  "Fetch one Confluence page by id, including body (in synthetic mode this is the full markdown; in live mode it's the storage-format HTML).",
  { page_id: z.string().min(1) },
  async ({ page_id }) => {
    if (SYNTHETIC) {
      const p = synthPages.find((x) => x.id === page_id);
      if (!p) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `page id '${page_id}' not found. Available: ${synthPages.map((x) => x.id).join(", ")}`,
        );
      }
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", page: p }, null, 2) }] };
    }
    type LivePage = {
      id: string;
      title: string;
      space: { key: string };
      version: { when: string };
      history: { createdBy: { email: string } };
      body: { storage: { value: string } };
      metadata?: { labels: { results: Array<{ name: string }> } };
    };
    const url = `/wiki/rest/api/content/${page_id}?expand=body.storage,space,version,history,metadata.labels`;
    const p = await confluenceFetch<LivePage>(url, "page.get");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: "live",
              page: {
                id: p.id,
                title: p.title,
                space_key: p.space.key,
                author: p.history.createdBy.email,
                updated: p.version.when,
                body: p.body.storage.value,
                labels: p.metadata?.labels.results.map((l) => l.name) ?? [],
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

log.info({ mode: SYNTHETIC ? "synthetic" : "live" }, `confluence MCP server starting`);
await server.connect(new StdioServerTransport());
