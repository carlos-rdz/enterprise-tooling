/**
 * End-to-end smoke tests for all 4 MCP servers in synthetic mode.
 *
 * Each test spawns the server as a child process, completes the MCP
 * initialize/initialized handshake over stdio, calls a representative tool,
 * and asserts the response shape. No network access required — every server
 * runs in its env-var-free synthetic fallback path.
 *
 * Coverage:
 *   - pm_memory:    list_documents pagination, get_document error path, search_corpus
 *   - team_registry: list_teams, get_team_activity error path, search_across_teams
 *   - slack:        list_channels, search, get_user, post_message (dry-run-style)
 *   - jira:         list_projects, search_issues with JQL, create_issue (synthetic dry-run)
 *   - all:          health_check returns status=ok
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

interface RpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    tools?: Array<{ name: string }>;
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

class McpClient {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = "";
  private waiters = new Map<number, (msg: RpcResponse) => void>();
  private nextId = 1;
  private exitErr: Error | null = null;

  constructor(serverPath: string) {
    this.proc = spawn("npx", ["tsx", serverPath], {
      cwd: ROOT,
      env: { ...process.env, LOG_LEVEL: "error" },
    });
    this.proc.stdout.on("data", (chunk: Buffer) => this.handle(chunk.toString("utf8")));
    this.proc.on("error", (err) => (this.exitErr = err));
  }

  private handle(text: string): void {
    this.buffer += text;
    let nl;
    while ((nl = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      let msg: RpcResponse;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.id !== undefined) {
        const w = this.waiters.get(msg.id);
        if (w) {
          this.waiters.delete(msg.id);
          w(msg);
        }
      }
    }
  }

  send(method: string, params: Record<string, unknown> = {}, notification = false): Promise<RpcResponse> {
    if (this.exitErr) return Promise.reject(this.exitErr);
    if (notification) {
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
      return Promise.resolve({ jsonrpc: "2.0" });
    }
    const id = this.nextId++;
    return new Promise<RpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(id);
        reject(new Error(`MCP call '${method}' timed out`));
      }, 10_000);
      this.waiters.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  async init(): Promise<void> {
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0" },
    });
    await this.send("notifications/initialized", {}, true);
  }

  async listTools(): Promise<string[]> {
    const r = await this.send("tools/list", {});
    return (r.result?.tools ?? []).map((t) => t.name);
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<{ text: string; isError: boolean }> {
    const r = await this.send("tools/call", { name, arguments: args });
    if (r.error) {
      return { text: r.error.message, isError: true };
    }
    const first = r.result?.content?.[0];
    // An MCP tool can signal an error two ways:
    //  - throw McpError → server returns { result: { isError: true, content: [...] } }
    //  - return { isError: true, content: [...] } directly
    // Both surface as result.isError === true.
    return { text: first?.text ?? "", isError: r.result?.isError === true };
  }

  async close(): Promise<void> {
    this.proc.stdin.end();
    this.proc.kill();
    await new Promise<void>((r) => this.proc.on("exit", () => r()));
  }
}

function parse(text: string): Record<string, unknown> {
  return JSON.parse(text);
}

describe.each([
  { name: "pm-memory", path: "mcp_servers/pm_memory/server.ts" },
  { name: "team-registry", path: "mcp_servers/team_registry/server.ts" },
  { name: "slack", path: "mcp_servers/slack/server.ts" },
  { name: "jira", path: "mcp_servers/jira/server.ts" },
  { name: "github", path: "mcp_servers/github/server.ts" },
  { name: "confluence", path: "mcp_servers/confluence/server.ts" },
  { name: "grafana", path: "mcp_servers/grafana/server.ts" },
])("MCP server: $name (synthetic mode)", ({ name, path }) => {
  let client: McpClient;

  beforeAll(async () => {
    client = new McpClient(path);
    await client.init();
  }, 15_000);

  afterAll(async () => {
    await client.close();
  });

  it("lists tools and includes health_check", async () => {
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools).toContain("health_check");
  });

  it("health_check returns status=ok", async () => {
    const { text, isError } = await client.callTool("health_check", {});
    expect(isError).toBe(false);
    const body = parse(text);
    expect(body.status).toBe("ok");
  });
});

describe("pm-memory specifics", () => {
  let client: McpClient;
  beforeAll(async () => {
    client = new McpClient("mcp_servers/pm_memory/server.ts");
    await client.init();
  }, 15_000);
  afterAll(async () => client.close());

  it("list_documents returns paginated results", async () => {
    const { text } = await client.callTool("list_documents", { cursor: 0, limit: 100 });
    const body = parse(text) as { total: number; documents: Array<{ path: string; kind: string }> };
    expect(body.total).toBeGreaterThanOrEqual(4);
    expect(body.documents.some((d) => d.kind === "prd")).toBe(true);
  });

  it("get_document raises on unknown path", async () => {
    const r = await client.callTool("get_document", { path: "nonexistent.md" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/unknown document/);
  });

  it("search_corpus finds FlexPay-related hits", async () => {
    const { text } = await client.callTool("search_corpus", { query: "FlexPay", max_hits: 5 });
    const body = parse(text) as { hit_count: number };
    expect(body.hit_count).toBeGreaterThan(0);
  });
});

describe("team-registry specifics", () => {
  let client: McpClient;
  beforeAll(async () => {
    client = new McpClient("mcp_servers/team_registry/server.ts");
    await client.init();
  }, 15_000);
  afterAll(async () => client.close());

  it("list_teams returns multiple teams", async () => {
    const { text } = await client.callTool("list_teams", {});
    const body = parse(text) as Array<{ name: string }>;
    expect(body.length).toBeGreaterThanOrEqual(4);
    expect(body.map((t) => t.name)).toContain("plan-it");
  });

  it("get_team_activity raises on unknown team", async () => {
    const r = await client.callTool("get_team_activity", { team_name: "nonexistent-team" });
    expect(r.isError).toBe(true);
  });

  it("search_across_teams finds biometric collisions", async () => {
    const { text } = await client.callTool("search_across_teams", { query: "biometric" });
    const body = parse(text) as { hits: Array<{ team: string }> };
    const teams = new Set(body.hits.map((h) => h.team));
    expect(teams.size).toBeGreaterThanOrEqual(3);
  });
});

describe("slack specifics", () => {
  let client: McpClient;
  beforeAll(async () => {
    client = new McpClient("mcp_servers/slack/server.ts");
    await client.init();
  }, 15_000);
  afterAll(async () => client.close());

  it("slack_list_channels returns synthetic channels", async () => {
    const { text } = await client.callTool("slack_list_channels", {});
    const body = parse(text) as { mode: string; channels: Array<{ name: string }> };
    expect(body.mode).toBe("synthetic");
    expect(body.channels.length).toBeGreaterThanOrEqual(5);
  });

  it("slack_post_message in synthetic mode does not post", async () => {
    const { text } = await client.callTool("slack_post_message", { channel: "flexpay-eng", text: "test message" });
    const body = parse(text) as { mode: string; posted: boolean };
    expect(body.posted).toBe(false);
    expect(body.mode).toMatch(/synthetic|dry-run/);
  });

  it("slack_get_user errors on unknown email", async () => {
    const r = await client.callTool("slack_get_user", { email: "ghost@nowhere.example" });
    expect(r.isError).toBe(true);
  });
});

describe("github specifics", () => {
  let client: McpClient;
  beforeAll(async () => {
    client = new McpClient("mcp_servers/github/server.ts");
    await client.init();
  }, 15_000);
  afterAll(async () => client.close());

  it("list_open_prs returns the 6 synthetic PRs", async () => {
    const { text } = await client.callTool("list_open_prs", {});
    const body = parse(text) as { mode: string; prs: Array<{ number: number }> };
    expect(body.mode).toBe("synthetic");
    expect(body.prs.length).toBeGreaterThanOrEqual(6);
  });

  it("get_pr hides the planted_bug answer key from the agent", async () => {
    const { text } = await client.callTool("get_pr", { number: 201 });
    const body = parse(text) as { pr: Record<string, unknown> };
    expect(body.pr).not.toHaveProperty("planted_bug");
    expect(body.pr.title).toBeTruthy();
  });

  it("get_pr_diff returns the file diff text", async () => {
    const { text } = await client.callTool("get_pr_diff", { number: 202 });
    const body = parse(text) as { files: Array<{ path: string; diff: string }> };
    expect(body.files.length).toBeGreaterThan(0);
    expect(body.files[0].diff.length).toBeGreaterThan(0);
  });

  it("post_review_comment in synthetic mode does not post", async () => {
    const { text } = await client.callTool("post_review_comment", {
      number: 201,
      body: "test review comment",
      severity: "major",
    });
    const body = parse(text) as { mode: string; posted: boolean };
    expect(body.posted).toBe(false);
  });
});

describe("confluence specifics", () => {
  let client: McpClient;
  beforeAll(async () => {
    client = new McpClient("mcp_servers/confluence/server.ts");
    await client.init();
  }, 15_000);
  afterAll(async () => client.close());

  it("search_pages finds FlexPay-tagged content", async () => {
    const { text } = await client.callTool("search_pages", { query: "FlexPay" });
    const body = parse(text) as { hits: Array<{ title: string }> };
    expect(body.hits.length).toBeGreaterThan(0);
  });

  it("get_page raises on unknown id", async () => {
    const r = await client.callTool("get_page", { page_id: "9999" });
    expect(r.isError).toBe(true);
  });

  it("get_page returns body for a real synthetic page", async () => {
    const { text } = await client.callTool("get_page", { page_id: "8001" });
    const body = parse(text) as { page: { title: string; body: string } };
    expect(body.page.title).toMatch(/FlexPay/);
    expect(body.page.body.length).toBeGreaterThan(50);
  });
});

describe("grafana specifics", () => {
  let client: McpClient;
  beforeAll(async () => {
    client = new McpClient("mcp_servers/grafana/server.ts");
    await client.init();
  }, 15_000);
  afterAll(async () => client.close());

  it("search_metrics finds auth-service metric by substring", async () => {
    const { text } = await client.callTool("search_metrics", { query: "auth_service" });
    const body = parse(text) as { hits: Array<{ metric: string }> };
    expect(body.hits.length).toBeGreaterThan(0);
    expect(body.hits[0].metric).toMatch(/auth_service/);
  });

  it("get_metric_series returns ~60 data points for the biometric latency metric", async () => {
    const { text } = await client.callTool("get_metric_series", {
      metric: "auth_service_p99_latency_ms",
    });
    const body = parse(text) as { series: Array<{ points: Array<[number, number]> }> };
    expect(body.series[0].points.length).toBeGreaterThanOrEqual(30);
  });

  it("list_dashboards filtered by tag returns matching dashboards", async () => {
    const { text } = await client.callTool("list_dashboards", { tag: "biometric" });
    const body = parse(text) as { dashboards: Array<{ title: string }> };
    expect(body.dashboards.length).toBeGreaterThan(0);
    expect(body.dashboards[0].title).toMatch(/[Aa]uth/);
  });

  it("get_dashboard raises on unknown uid", async () => {
    const r = await client.callTool("get_dashboard", { uid: "no-such-dash" });
    expect(r.isError).toBe(true);
  });
});

describe("jira specifics", () => {
  let client: McpClient;
  beforeAll(async () => {
    client = new McpClient("mcp_servers/jira/server.ts");
    await client.init();
  }, 15_000);
  afterAll(async () => client.close());

  it("jira_search_issues with biometric JQL finds collision tickets", async () => {
    const { text } = await client.callTool("jira_search_issues", {
      jql: 'text ~ "biometric"',
      max: 10,
      start_at: 0,
    });
    const body = parse(text) as { total: number; issues: Array<{ key: string }> };
    expect(body.total).toBeGreaterThanOrEqual(3);
    const keys = body.issues.map((i) => i.key);
    expect(keys).toContain("PLAN-1925");
    expect(keys).toContain("AUTH-455");
  });

  it("jira_get_issue raises with helpful message on unknown key", async () => {
    const r = await client.callTool("jira_get_issue", { key: "GHOST-9999" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/not found/);
  });

  it("jira_create_issue in synthetic mode does not create", async () => {
    const { text } = await client.callTool("jira_create_issue", {
      project_key: "PLAN",
      summary: "test",
      issue_type: "Task",
    });
    const body = parse(text) as { mode: string; created: boolean };
    expect(body.created).toBe(false);
    expect(body.mode).toMatch(/synthetic|dry-run/);
  });
});
