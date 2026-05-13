/**
 * MCP Gateway (sketch)
 *
 * A single front-door HTTP server that proxies JSON-RPC requests through to
 * the 4 backend MCP servers. Provides three things every enterprise fintech
 * deployment requires:
 *
 *   1. AUTH — bearer-token validation against a user allowlist (users.json).
 *      Production upgrade path: replace `loadUsers()` + `authenticate()` with
 *      a JWT validator that hits your IdP's JWKS endpoint. The downstream
 *      interface stays the same.
 *
 *   2. RATE LIMITS — per-user fixed-window counter (1-min window). Production:
 *      swap the in-memory Map for Redis + a sliding window.
 *
 *   3. AUDIT — every authenticated request emits a structured audit event to
 *      audit_logs/audit-YYYY-MM-DD.jsonl. SOX / SR 11-7 / GLBA-compatible
 *      schema; see audit_logs/SCHEMA.md.
 *
 * Wire format: standard JSON-RPC over HTTP POST to /v1/mcp/{server_name}.
 * Body is the same MCP request you'd send to the server over stdio. Headers:
 *   Authorization: Bearer <token>
 *   Content-Type: application/json
 *
 * Run:
 *   cp mcp_gateway/users.example.json mcp_gateway/users.json
 *   # fill in tokens
 *   npx tsx mcp_gateway/gateway.ts
 *
 * The gateway listens on PORT (default 8765). Each request spawns the
 * appropriate backend server, sends the request via stdio, returns the
 * response. In production you'd keep persistent connections in a pool —
 * see the comments in `forwardToBackend` for the upgrade path.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeLogger } from "../mcp_servers/_shared/logger.js";

const log = makeLogger("mcp-gateway");
const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(HERE, "..");
const AUDIT_DIR = join(REPO_ROOT, "audit_logs");
const PORT = Number(process.env.PORT ?? "8765");
const USERS_FILE = process.env.MCP_GATEWAY_USERS_FILE ?? join(HERE, "users.json");

// ---- User store --------------------------------------------------------------

interface User {
  user_id: string;
  team: string;
  token: string;
  allowed_servers: string[];
  rate_limit_per_min: number;
  monthly_token_budget_usd: number;
}

interface UsersFile {
  users: User[];
}

function loadUsers(): Map<string, User> {
  try {
    const raw = readFileSync(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw) as UsersFile;
    const byToken = new Map<string, User>();
    for (const u of parsed.users) {
      if (u.token.startsWith("REPLACE_")) continue;
      byToken.set(u.token, u);
    }
    log.info({ count: byToken.size }, "users loaded");
    return byToken;
  } catch (err) {
    log.warn({ err: (err as Error).message, file: USERS_FILE }, "no users file — gateway will reject ALL requests");
    return new Map();
  }
}

const users = loadUsers();

// ---- Rate limiting -----------------------------------------------------------

interface RateBucket {
  windowStart: number;
  count: number;
}
const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(user: User): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = rateBuckets.get(user.user_id);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    rateBuckets.set(user.user_id, { windowStart: now, count: 1 });
    return true;
  }
  if (bucket.count >= user.rate_limit_per_min) return false;
  bucket.count++;
  return true;
}

// ---- Audit log ---------------------------------------------------------------

mkdirSync(AUDIT_DIR, { recursive: true });

interface AuditEvent {
  ts: string;
  request_id: string;
  user_id: string;
  team: string;
  server: string;
  method: string;
  tool_name?: string;
  status: "allowed" | "denied_auth" | "denied_rate_limit" | "denied_server_acl" | "error";
  denial_reason?: string;
  latency_ms?: number;
  client_ip?: string;
  user_agent?: string;
}

function auditPath(): string {
  const ymd = new Date().toISOString().slice(0, 10);
  return join(AUDIT_DIR, `audit-${ymd}.jsonl`);
}

function emitAudit(event: AuditEvent): void {
  appendFileSync(auditPath(), JSON.stringify(event) + "\n");
}

// ---- Auth --------------------------------------------------------------------

function authenticate(req: IncomingMessage): User | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return users.get(token) ?? null;
}

// ---- Backend forwarding ------------------------------------------------------

const BACKENDS: Record<string, string> = {
  "pm-memory": join(REPO_ROOT, "mcp_servers/pm_memory/server.ts"),
  "team-registry": join(REPO_ROOT, "mcp_servers/team_registry/server.ts"),
  slack: join(REPO_ROOT, "mcp_servers/slack/server.ts"),
  jira: join(REPO_ROOT, "mcp_servers/jira/server.ts"),
};

/**
 * Spawn the backend server, complete MCP initialize handshake, send the
 * caller's RPC payload, return the matching response, then shut down.
 *
 * Production upgrade: maintain a pool of long-lived backend processes
 * (one per server, or a small fleet), route requests through it, recycle
 * on N requests or T minutes. The spawn-per-request shape here is for
 * sketch readability — every call pays ~300ms of startup latency.
 */
async function forwardToBackend(server: string, rpc: unknown): Promise<unknown> {
  const path = BACKENDS[server];
  if (!path) throw new Error(`unknown backend: ${server}`);

  return new Promise((resolve, reject) => {
    const proc = spawn("npx", ["tsx", path], {
      cwd: REPO_ROOT,
      env: { ...process.env, LOG_LEVEL: "error" },
    });

    let buf = "";
    let initialized = false;
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(new Error("backend timeout"));
      }
    }, 30_000);

    proc.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: { id?: number };
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (!initialized && msg.id === 0) {
          initialized = true;
          proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
          proc.stdin.write(JSON.stringify(rpc) + "\n");
        } else if (initialized && !resolved) {
          resolved = true;
          clearTimeout(timer);
          proc.stdin.end();
          proc.kill();
          resolve(msg);
        }
      }
    });

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    // Kick off the MCP initialize handshake.
    proc.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mcp-gateway", version: "0.1.0" },
        },
      }) + "\n",
    );
  });
}

// ---- HTTP handler ------------------------------------------------------------

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function genRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const t0 = Date.now();
  const requestId = genRequestId();
  const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? "unknown";

  if (req.method === "GET" && req.url === "/healthz") {
    send(res, 200, { status: "ok", users_loaded: users.size, backends: Object.keys(BACKENDS) });
    return;
  }

  if (req.method !== "POST" || !req.url?.startsWith("/v1/mcp/")) {
    send(res, 404, { error: "not found", request_id: requestId });
    return;
  }

  const server = req.url.slice("/v1/mcp/".length);
  if (!(server in BACKENDS)) {
    send(res, 404, { error: `unknown backend '${server}'`, request_id: requestId });
    return;
  }

  // ---- Auth
  const user = authenticate(req);
  if (!user) {
    emitAudit({
      ts: new Date().toISOString(),
      request_id: requestId,
      user_id: "anonymous",
      team: "unknown",
      server,
      method: "?",
      status: "denied_auth",
      denial_reason: "missing or invalid bearer token",
      client_ip: clientIp,
      user_agent: userAgent,
    });
    send(res, 401, { error: "unauthorized", request_id: requestId });
    return;
  }

  // ---- Server ACL
  if (!user.allowed_servers.includes(server)) {
    emitAudit({
      ts: new Date().toISOString(),
      request_id: requestId,
      user_id: user.user_id,
      team: user.team,
      server,
      method: "?",
      status: "denied_server_acl",
      denial_reason: `user not in allowlist for server '${server}'`,
      client_ip: clientIp,
      user_agent: userAgent,
    });
    send(res, 403, { error: `forbidden: not allowed on '${server}'`, request_id: requestId });
    return;
  }

  // ---- Rate limit
  if (!checkRateLimit(user)) {
    emitAudit({
      ts: new Date().toISOString(),
      request_id: requestId,
      user_id: user.user_id,
      team: user.team,
      server,
      method: "?",
      status: "denied_rate_limit",
      denial_reason: `${user.rate_limit_per_min}/min exceeded`,
      client_ip: clientIp,
      user_agent: userAgent,
    });
    send(res, 429, { error: "rate limited", retry_after_seconds: 60, request_id: requestId });
    return;
  }

  // ---- Forward
  const bodyText = await readBody(req);
  let rpc: { method?: string; params?: { name?: string } };
  try {
    rpc = JSON.parse(bodyText);
  } catch {
    send(res, 400, { error: "invalid json", request_id: requestId });
    return;
  }

  try {
    const response = await forwardToBackend(server, rpc);
    emitAudit({
      ts: new Date().toISOString(),
      request_id: requestId,
      user_id: user.user_id,
      team: user.team,
      server,
      method: rpc.method ?? "?",
      tool_name: rpc.params?.name,
      status: "allowed",
      latency_ms: Date.now() - t0,
      client_ip: clientIp,
      user_agent: userAgent,
    });
    send(res, 200, response);
  } catch (err) {
    emitAudit({
      ts: new Date().toISOString(),
      request_id: requestId,
      user_id: user.user_id,
      team: user.team,
      server,
      method: rpc.method ?? "?",
      status: "error",
      denial_reason: (err as Error).message,
      latency_ms: Date.now() - t0,
      client_ip: clientIp,
      user_agent: userAgent,
    });
    send(res, 502, { error: "backend error", request_id: requestId, detail: (err as Error).message });
  }
}

// ---- Boot --------------------------------------------------------------------

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    log.error({ err: (err as Error).message }, "unhandled error");
    if (!res.headersSent) send(res, 500, { error: "internal" });
  });
});

server.listen(PORT, () => {
  log.info({ port: PORT, backends: Object.keys(BACKENDS), users_loaded: users.size }, "MCP gateway listening");
});
