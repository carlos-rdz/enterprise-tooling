/**
 * pm-memory MCP server (prod-grade)
 *
 * Exposes a corpus of PRDs, tickets, and customer-call summaries as MCP tools
 * so any subagent or Claude Code session can query product history.
 *
 * Local data: reads from ../../02_pm_memory/corpus/. In production this would
 * back onto Confluence + Jira + Gong.
 *
 * Prod hardening:
 *   - Structured logging via pino (stderr)
 *   - Corpus loaded once at startup; LRU cache for search results
 *   - Pagination on search + list
 *   - McpError types
 *   - health_check tool
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { makeLogger } from "../_shared/logger.js";
import { LRUCache } from "../_shared/cache.js";

const log = makeLogger("pm-memory");
const HERE = fileURLToPath(new URL(".", import.meta.url));
const CORPUS_ROOT = join(HERE, "..", "..", "02_pm_memory", "corpus");

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else if (entry.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function loadCorpus(): Map<string, string> {
  const corpus = new Map<string, string>();
  for (const path of listFiles(CORPUS_ROOT)) {
    const key = relative(CORPUS_ROOT, path).replace(/\\/g, "/");
    corpus.set(key, readFileSync(path, "utf8"));
  }
  return corpus;
}

const corpus = loadCorpus();
log.info({ doc_count: corpus.size, corpus_root: CORPUS_ROOT }, "corpus loaded");

const searchCache = new LRUCache<string, { path: string; snippet: string }[]>({
  capacity: 64,
  ttlMs: 5 * 60 * 1000,
});

const server = new McpServer({ name: "pm-memory", version: "0.2.0" });

server.tool(
  "health_check",
  "Verify the pm-memory MCP server is healthy. Returns corpus size and root path. Safe to poll.",
  {},
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({ status: "ok", doc_count: corpus.size, corpus_root: CORPUS_ROOT }, null, 2),
      },
    ],
  }),
);

server.tool(
  "list_documents",
  "List every document in the product-memory corpus. Returns {path, kind, summary}. Supports pagination.",
  {
    cursor: z.number().int().nonnegative().default(0).describe("Pagination cursor (0 for first page)."),
    limit: z.number().int().positive().max(100).default(50),
  },
  async ({ cursor, limit }) => {
    const all = [...corpus.entries()].map(([path, body]) => {
      const kind = path.startsWith("prds/")
        ? "prd"
        : path.startsWith("tickets/")
          ? "ticket_log"
          : path.startsWith("convos/")
            ? "customer_calls"
            : "other";
      const firstLine = body.split("\n").find((l) => l.startsWith("# ")) ?? path;
      return { path, kind, summary: firstLine.replace(/^#\s+/, "") };
    });
    const slice = all.slice(cursor, cursor + limit);
    const next = cursor + slice.length;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: all.length,
              cursor,
              returned: slice.length,
              next_cursor: next < all.length ? next : null,
              documents: slice,
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
  "get_document",
  "Fetch the full text of one document. Path is relative (e.g. 'prds/2024_plan_it_launch.md').",
  { path: z.string().min(1).describe("Relative path returned by list_documents") },
  async ({ path }) => {
    const body = corpus.get(path);
    if (!body) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `unknown document '${path}'. Use list_documents to see available paths.`,
      );
    }
    return { content: [{ type: "text", text: body }] };
  },
);

server.tool(
  "search_corpus",
  "Case-insensitive keyword search across every document. Returns hits with ±2 lines of surrounding context per match. Results cached 5 min.",
  {
    query: z.string().min(1),
    max_hits: z.number().int().positive().max(50).default(10),
  },
  async ({ query, max_hits }) => {
    const key = `${query.toLowerCase()}|${max_hits}`;
    const hits = await searchCache.memo(key, async () => {
      const needle = query.toLowerCase();
      const out: { path: string; snippet: string }[] = [];
      for (const [path, body] of corpus) {
        const lines = body.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(needle)) {
            const lo = Math.max(0, i - 2);
            const hi = Math.min(lines.length, i + 3);
            out.push({ path, snippet: lines.slice(lo, hi).join("\n") });
            if (out.length >= max_hits) break;
          }
        }
        if (out.length >= max_hits) break;
      }
      return out;
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ query, hit_count: hits.length, hits }, null, 2) }],
    };
  },
);

log.info("pm-memory MCP server starting");
await server.connect(new StdioServerTransport());
