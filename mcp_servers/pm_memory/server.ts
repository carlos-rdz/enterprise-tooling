/**
 * pm-memory MCP server
 *
 * Exposes a corpus of PRDs, tickets, and customer-call summaries as MCP tools
 * so any subagent or Claude Code session can query the enterprise product history without
 * hardcoded knowledge.
 *
 * In production this MCP server would back onto Confluence + Jira + Gong;
 * for the demo it reads from ../../02_pm_memory/corpus/.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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

const server = new McpServer({
  name: "pm-memory",
  version: "0.1.0",
});

server.tool(
  "list_documents",
  "List every document in the enterprise product-memory corpus. Returns a JSON array of {path, kind, summary} entries. Use this first to see what's available before fetching specific documents.",
  {},
  async () => {
    const docs = [...corpus.entries()].map(([path, body]) => {
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
    return { content: [{ type: "text", text: JSON.stringify(docs, null, 2) }] };
  },
);

server.tool(
  "get_document",
  "Fetch the full text of one document from the corpus. Path is the relative path returned by list_documents (e.g. 'prds/2024_plan_it_launch.md').",
  { path: z.string().describe("Relative path of the document to fetch") },
  async ({ path }) => {
    const body = corpus.get(path);
    if (!body) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `unknown document '${path}'`,
              available: [...corpus.keys()],
            }),
          },
        ],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: body }] };
  },
);

server.tool(
  "search_corpus",
  "Case-insensitive keyword search across every document. Returns a JSON array of {path, snippet} hits, with ±2 lines of surrounding context per match. Use this to find relevant history without reading every doc.",
  {
    query: z.string().describe("Keyword or short phrase to search for"),
    max_hits: z.number().int().positive().max(50).default(10),
  },
  async ({ query, max_hits }) => {
    const needle = query.toLowerCase();
    const hits: { path: string; snippet: string }[] = [];
    for (const [path, body] of corpus) {
      const lines = body.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          const lo = Math.max(0, i - 2);
          const hi = Math.min(lines.length, i + 3);
          hits.push({ path, snippet: lines.slice(lo, hi).join("\n") });
          if (hits.length >= max_hits) break;
        }
      }
      if (hits.length >= max_hits) break;
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ query, hit_count: hits.length, hits }, null, 2),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
