/**
 * jira MCP server (Jira Cloud, REST API v3)
 *
 * Read + write tools against a Jira Cloud instance using basic auth
 * (email + API token).
 *
 *   - If JIRA_HOST / JIRA_EMAIL / JIRA_API_TOKEN are not all set →
 *     all tools return synthetic FlexPay-shaped responses.
 *   - If credentials are set but DRY_RUN=true → reads hit the real API,
 *     but writes (create_issue, add_comment) are logged to stderr only.
 *   - If credentials are set and DRY_RUN unset → real reads + writes.
 *
 * Required token scopes (Atlassian API token has full account access — scope
 * the bot account itself instead of the token).
 *
 * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { issues as synthIssues, projects as synthProjects, jqlMatch } from "./synthetic.js";

const HOST = process.env.JIRA_HOST;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "true";
const SYNTHETIC = !(HOST && EMAIL && TOKEN);

const authHeader = SYNTHETIC ? "" : "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");

async function jira<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://${HOST}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`jira ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

function note(): string {
  if (SYNTHETIC) return " (SYNTHETIC — set JIRA_HOST + JIRA_EMAIL + JIRA_API_TOKEN for real instance)";
  if (DRY_RUN) return " (DRY_RUN — writes are logged, not sent)";
  return "";
}

const server = new McpServer({ name: "jira", version: "0.1.0" });

server.tool(
  "jira_list_projects",
  "List all Jira projects the bot account can see.",
  {},
  async () => {
    if (SYNTHETIC) {
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", projects: synthProjects }, null, 2) }] };
    }
    const res = await jira<{ values: Array<{ key: string; name: string }> }>("/rest/api/3/project/search?maxResults=100");
    return {
      content: [
        { type: "text", text: JSON.stringify({ mode: "live", projects: res.values.map((p) => ({ key: p.key, name: p.name })) }, null, 2) },
      ],
    };
  },
);

server.tool(
  "jira_search_issues",
  "Search issues with JQL. Returns the first N matches with key, status, summary, assignee. Examples: 'project = PLAN AND status != Done', 'text ~ \"biometric\" ORDER BY updated DESC'.",
  {
    jql: z.string().describe("JQL query"),
    max: z.number().int().positive().max(100).default(20),
  },
  async ({ jql, max }) => {
    if (SYNTHETIC) {
      const hits = synthIssues.filter((i) => jqlMatch(jql, i)).slice(0, max).map((i) => ({
        key: i.key,
        status: i.status,
        summary: i.summary,
        assignee: i.assignee,
        type: i.type,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", jql, total: hits.length, issues: hits }, null, 2) }] };
    }
    const params = new URLSearchParams({ jql, maxResults: String(max), fields: "summary,status,assignee,issuetype" });
    type J = { total: number; issues: Array<{ key: string; fields: { summary: string; status: { name: string }; assignee: { displayName: string } | null; issuetype: { name: string } } }> };
    const res = await jira<J>(`/rest/api/3/search?${params}`);
    const out = res.issues.map((i) => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status.name,
      assignee: i.fields.assignee?.displayName ?? null,
      type: i.fields.issuetype.name,
    }));
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", jql, total: res.total, issues: out }, null, 2) }] };
  },
);

server.tool(
  "jira_get_issue",
  "Fetch one issue by key, including description and comments.",
  { key: z.string().describe("Issue key, e.g. 'PLAN-1893'") },
  async ({ key }) => {
    if (SYNTHETIC) {
      const i = synthIssues.find((x) => x.key === key);
      if (!i) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ mode: "synthetic", error: `issue '${key}' not found`, available: synthIssues.map((x) => x.key) }, null, 2) },
          ],
          isError: true,
        };
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
    const res = await jira<J>(`/rest/api/3/issue/${encodeURIComponent(key)}`);
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
  "Create a new issue. Honors DRY_RUN=true (logs to stderr instead of creating). NOTE: write operation.",
  {
    project_key: z.string().describe("Project key, e.g. 'PLAN'"),
    summary: z.string(),
    description: z.string().optional(),
    issue_type: z.string().default("Task"),
    assignee_account_id: z.string().optional().describe("Atlassian account id of assignee"),
  },
  async ({ project_key, summary, description, issue_type, assignee_account_id }) => {
    if (SYNTHETIC || DRY_RUN) {
      console.error(`[jira ${SYNTHETIC ? "synthetic" : "dry-run"}] create ${project_key}/${issue_type}: ${summary}`);
      const fakeKey = `${project_key}-${Math.floor(Math.random() * 9000 + 1000)}`;
      return {
        content: [
          { type: "text", text: JSON.stringify({ mode: SYNTHETIC ? "synthetic" : "dry-run", created: false, would_have_created: { key: fakeKey, project: project_key, summary, type: issue_type, description } }, null, 2) },
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
    const res = await jira<{ key: string; id: string; self: string }>("/rest/api/3/issue", { method: "POST", body: JSON.stringify(body) });
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", key: res.key, id: res.id }, null, 2) }] };
  },
);

server.tool(
  "jira_add_comment",
  "Add a comment to an existing issue. Honors DRY_RUN=true. NOTE: write operation.",
  { key: z.string(), body: z.string() },
  async ({ key, body }) => {
    if (SYNTHETIC || DRY_RUN) {
      console.error(`[jira ${SYNTHETIC ? "synthetic" : "dry-run"}] comment on ${key}: ${body.slice(0, 200)}${body.length > 200 ? "…" : ""}`);
      return { content: [{ type: "text", text: JSON.stringify({ mode: SYNTHETIC ? "synthetic" : "dry-run", posted: false, would_have_posted: { key, body } }, null, 2) }] };
    }
    const payload = { body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] } };
    const res = await jira<{ id: string; created: string }>(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", id: res.id, created: res.created }, null, 2) }] };
  },
);

console.error(`jira MCP server starting${note()}`);
await server.connect(new StdioServerTransport());
