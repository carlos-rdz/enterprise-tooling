/**
 * team-registry MCP server
 *
 * Exposes the current sprint state and recent decisions for every engineering
 * team as MCP tools, so a cross-team integrator agent can discover hidden
 * overlaps without hardcoded knowledge.
 *
 * In production this would back onto Jira + Confluence + a service-ownership
 * graph; for the demo it parses ../../03_cross_team/team_data/teams.md.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

const server = new McpServer({
  name: "team-registry",
  version: "0.1.0",
});

server.tool(
  "list_teams",
  "List every engineering team with its mission and lead. Returns a JSON array of {name, header} entries. Use this first to see what teams exist before drilling into one.",
  {},
  async () => {
    const out = [...teams.values()].map((t) => ({
      name: t.name,
      header: t.header.slice(0, 240),
    }));
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  },
);

server.tool(
  "get_team_activity",
  "Fetch one team's current sprint items and recent decisions. Use this when you want to know what a specific team is working on right now.",
  {
    team_name: z
      .string()
      .describe("Team slug, e.g. 'plan-it', 'auth-platform', 'mobile-platform'"),
  },
  async ({ team_name }) => {
    const t = teams.get(team_name);
    if (!t) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `unknown team '${team_name}'`,
              available: [...teams.keys()],
            }),
          },
        ],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(t, null, 2) }] };
  },
);

server.tool(
  "search_across_teams",
  "Free-text search across every team's sprint items and recent decisions. Returns matching teams and the matching context. Use this to find hidden cross-team overlaps — e.g. 'biometric', 'UDAAP', 'eligibility'.",
  {
    query: z.string().describe("Concept or keyword to search for"),
  },
  async ({ query }) => {
    const needle = query.toLowerCase();
    const hits: { team: string; section: string; match: string }[] = [];
    for (const t of teams.values()) {
      for (const section of ["current_sprint", "recent_decisions"] as const) {
        const body = t[section];
        if (body && body.toLowerCase().includes(needle)) {
          hits.push({ team: t.name, section, match: body });
        }
      }
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
