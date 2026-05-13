/**
 * team-registry MCP server (prod-grade)
 *
 * Exposes per-team current sprint state and recent decisions, so a
 * cross-team integrator agent can discover hidden overlaps without hardcoded
 * knowledge.
 *
 * Local data: parses ../../03_cross_team/team_data/teams.md. In production
 * this would back onto Jira + Confluence + a service-ownership graph.
 *
 * Prod hardening:
 *   - Structured logging via pino (stderr)
 *   - Team data loaded once at startup; LRU cache for search results
 *   - McpError types
 *   - health_check tool
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeLogger } from "../_shared/logger.js";
import { LRUCache } from "../_shared/cache.js";

const log = makeLogger("team-registry");
const HERE = fileURLToPath(new URL(".", import.meta.url));
const TEAMS_PATH = join(HERE, "..", "..", "03_cross_team", "team_data", "teams.md");

type Team = {
  name: string;
  header: string;
  current_sprint?: string;
  recent_decisions?: string;
};

function loadTeams(): Map<string, Team> {
  const teams = new Map<string, Team>();
  const text = readFileSync(TEAMS_PATH, "utf8");
  let current: Team | null = null;
  let section: "header" | "current_sprint" | "recent_decisions" | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (!current || !section) return;
    const body = buf.join("\n").trim();
    if (section === "header") current.header = body;
    if (section === "current_sprint") current.current_sprint = body;
    if (section === "recent_decisions") current.recent_decisions = body;
  };

  for (const line of text.split("\n")) {
    if (line.startsWith("## team: ")) {
      flush();
      const name = line.replace("## team: ", "").trim();
      current = { name, header: "" };
      teams.set(name, current);
      section = "header";
      buf = [];
    } else if (line.startsWith("### ")) {
      flush();
      const heading = line.replace("### ", "").trim().replace(/ /g, "_");
      section =
        heading === "current_sprint" || heading === "recent_decisions"
          ? (heading as "current_sprint" | "recent_decisions")
          : null;
      buf = [];
    } else if (current && section) {
      buf.push(line);
    }
  }
  flush();
  return teams;
}

const teams = loadTeams();
log.info({ team_count: teams.size }, "team registry loaded");

const searchCache = new LRUCache<string, { team: string; section: string; match: string }[]>({
  capacity: 32,
  ttlMs: 5 * 60 * 1000,
});

const server = new McpServer({ name: "team-registry", version: "0.2.0" });

server.tool(
  "health_check",
  "Verify the team-registry MCP server is healthy. Returns team count. Safe to poll.",
  {},
  async () => ({
    content: [
      { type: "text", text: JSON.stringify({ status: "ok", team_count: teams.size }, null, 2) },
    ],
  }),
);

server.tool(
  "list_teams",
  "List every engineering team with its mission and lead. Returns {name, header}. Use first to see what teams exist.",
  {},
  async () => {
    const out = [...teams.values()].map((t) => ({ name: t.name, header: t.header.slice(0, 240) }));
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  },
);

server.tool(
  "get_team_activity",
  "Fetch one team's current sprint items and recent decisions.",
  { team_name: z.string().min(1).describe("Team slug, e.g. 'plan-it', 'auth-platform'") },
  async ({ team_name }) => {
    const t = teams.get(team_name);
    if (!t) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `unknown team '${team_name}'. Available: ${[...teams.keys()].join(", ")}`,
      );
    }
    return { content: [{ type: "text", text: JSON.stringify(t, null, 2) }] };
  },
);

server.tool(
  "search_across_teams",
  "Free-text search across every team's sprint items and recent decisions. Cached 5 min.",
  { query: z.string().min(1).describe("Concept or keyword, e.g. 'biometric'") },
  async ({ query }) => {
    const key = query.toLowerCase();
    const hits = await searchCache.memo(key, async () => {
      const needle = key;
      const out: { team: string; section: string; match: string }[] = [];
      for (const t of teams.values()) {
        for (const section of ["current_sprint", "recent_decisions"] as const) {
          const body = t[section];
          if (body && body.toLowerCase().includes(needle)) {
            out.push({ team: t.name, section, match: body });
          }
        }
      }
      return out;
    });
    return { content: [{ type: "text", text: JSON.stringify({ query, hit_count: hits.length, hits }, null, 2) }] };
  },
);

log.info("team-registry MCP server starting");
await server.connect(new StdioServerTransport());
