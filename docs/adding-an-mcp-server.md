# Adding an MCP server

This repo is built around the assumption that **every external system gets an MCP server**. New PRD source? MCP server. Confluence? MCP server. Internal ticket store, vendor risk DB, model registry, knowledge graph, expense system — all MCP servers.

This guide walks you through adding one to the `enterprise-coordination` plugin. The contract is small: implement 1 file (`server.ts`), register it in 2 places (`.mcp.json` + `plugin.json`), and the rest of the stack — gateway, audit log, cost dashboard, eval harness, hooks — picks it up automatically.

---

## When to add a new MCP server vs extending an existing one

| Situation | What to do |
|---|---|
| New external system (Confluence, Notion, Linear, internal API) | New MCP server |
| New tool on an existing system | Add tool to existing server |
| Bridging two existing servers' data | Build the bridge in the **agent** or **skill**, not a new server |
| Local-only synthetic data for a workflow | New MCP server, no live API |

Rule of thumb: one MCP server == one authentication boundary. If two surfaces share a credential, they're one server.

---

## The contract

A new MCP server must:

1. Live at `mcp_servers/<server-name>/server.ts`
2. Export an `McpServer` over `StdioServerTransport`
3. Provide a `health_check` tool returning `{ status: "ok", ... }`
4. Fall back to a coherent **synthetic mode** when its env-var credentials are missing — `npm install && npx tsx <path>` must always work for a fresh clone
5. Use `McpError` (not `{isError: true}`) for all error returns
6. Honor `DRY_RUN=true` on every write operation by logging the would-have-payload to stderr instead of executing
7. Log via `makeLogger("<server-name>")` from `mcp_servers/_shared/logger.ts` — JSON to stderr, never stdout (stdio MCP)
8. Use the shared `retry()` helper from `_shared/retry.ts` for any upstream API call
9. Pass `npx tsc --noEmit` and the synthetic-mode contract tests in `tests/mcp-servers.test.ts`

---

## Walkthrough — adding a `linear` server

### 1. Scaffold

```bash
mkdir -p mcp_servers/linear
touch mcp_servers/linear/server.ts mcp_servers/linear/synthetic.ts
```

### 2. Write the synthetic data

`mcp_servers/linear/synthetic.ts`:

```ts
export type SyntheticIssue = { id: string; title: string; state: string; team: string };

export const issues: SyntheticIssue[] = [
  { id: "ENG-101", title: "Add audit log retention policy", state: "Todo", team: "platform" },
  // ...
];
```

Make it FlexPay-scenario-consistent so the existing demos still tell a coherent story when the server is wired in.

### 3. Implement the server

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { makeLogger } from "../_shared/logger.js";
import { retry } from "../_shared/retry.js";
import { issues as synthIssues } from "./synthetic.js";

const log = makeLogger("linear");
const API_KEY = process.env.LINEAR_API_KEY;
const SYNTHETIC = !API_KEY;
const DRY_RUN = process.env.DRY_RUN === "true";

const server = new McpServer({ name: "linear", version: "0.1.0" });

server.tool(
  "health_check",
  "Verify linear MCP server is reachable.",
  {},
  async () => {
    if (SYNTHETIC) {
      return { content: [{ type: "text", text: JSON.stringify({ status: "ok", mode: "synthetic" }) }] };
    }
    // In live mode, hit /viewer to verify the API key
    const me = await retry(
      () => fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: { Authorization: API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ viewer { id name } }" }),
      }).then((r) => r.json()),
      { logger: log, operationName: "viewer" },
    );
    return { content: [{ type: "text", text: JSON.stringify({ status: "ok", mode: "live", as: me }) }] };
  },
);

server.tool(
  "search_issues",
  "Search Linear issues by keyword. Returns id, title, state, team.",
  { query: z.string().min(1) },
  async ({ query }) => {
    if (SYNTHETIC) {
      const q = query.toLowerCase();
      const hits = synthIssues.filter((i) => i.title.toLowerCase().includes(q));
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", hits }) }] };
    }
    // ... real GraphQL query ...
    throw new McpError(ErrorCode.InternalError, "live mode not implemented yet");
  },
);

log.info({ mode: SYNTHETIC ? "synthetic" : "live", dry_run: DRY_RUN }, "linear MCP server starting");
await server.connect(new StdioServerTransport());
```

### 4. Register in `.mcp.json`

```json
{
  "mcpServers": {
    "...existing servers...": "...",
    "linear": {
      "command": "npx",
      "args": ["tsx", "mcp_servers/linear/server.ts"],
      "description": "Linear issue tracker. Synthetic fallback when LINEAR_API_KEY unset.",
      "env": {
        "LINEAR_API_KEY": "${LINEAR_API_KEY}",
        "DRY_RUN": "${DRY_RUN:-}"
      }
    }
  }
}
```

### 5. Register in `.claude-plugin/plugin.json`

No change needed for the MCP server itself (it's bundled by reference from `.mcp.json`). But if you're also adding a **skill** or **subagent** that uses the server, add those to `components.skills` / `components.agents` arrays.

### 6. Wire into the MCP gateway

Add to `BACKENDS` map in `mcp_gateway/gateway.ts`:

```ts
const BACKENDS: Record<string, string> = {
  // ...existing entries...
  linear: join(REPO_ROOT, "mcp_servers/linear/server.ts"),
};
```

And update `users.example.json` so allowlists can include `"linear"`.

### 7. Add a test

In `tests/mcp-servers.test.ts`, add `{ name: "linear", path: "mcp_servers/linear/server.ts" }` to the `describe.each` array. The shared contract tests (health_check returns status=ok, tools/list returns at least 1 tool) run automatically. Add server-specific tests in their own `describe()` block.

Run:

```bash
npx tsc --noEmit
npm test
```

### 8. Add eval coverage (optional but recommended)

If the new server unlocks a new workflow, add cases to `evals/golden/<workflow>.yaml`. The runner picks up new YAML files automatically.

### 9. Add to architecture matrix

Update `architecture.md` matrix to include the new server's coverage.

### 10. Document the env-var requirement

Update `.env.example` with the new credentials your live mode reads.

---

## Production checklist

Before deploying a new server to a real environment, audit it against:

- [ ] `health_check` tool exists and verifies upstream connectivity in live mode
- [ ] Synthetic mode returns shape-equivalent data when credentials are missing
- [ ] All upstream calls go through `retry()` from `_shared/retry.ts`
- [ ] `DRY_RUN=true` short-circuits every write operation to a stderr log
- [ ] Logger uses `makeLogger("<name>")` — no `console.log`
- [ ] No secrets in tool descriptions or default values (Zod schemas are sent to the model)
- [ ] All errors throw `McpError` with appropriate `ErrorCode`
- [ ] Read tools support pagination if the upstream is paginated
- [ ] LRU cache wrapped around read calls that are frequent + slow-changing
- [ ] Vitest tests added under the `describe.each` table
- [ ] Architecture matrix updated
- [ ] `.env.example` has the new env vars documented with required scopes
- [ ] Gateway `users.example.json` notes the new server in `allowed_servers`

If you're contributing to this repo, open a PR with the above checklist filled in. CI will catch the typecheck, tests, and golden-YAML validation; the human reviewer catches the rest.
