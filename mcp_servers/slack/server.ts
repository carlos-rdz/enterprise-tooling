/**
 * slack MCP server (prod-grade)
 *
 * Read + write tools against a Slack workspace via @slack/web-api.
 *
 * Operational modes:
 *   - SLACK_BOT_TOKEN unset → SYNTHETIC mode (synthetic.ts fixtures).
 *   - Token set + DRY_RUN=true → real reads, writes log to stderr only.
 *   - Token set + DRY_RUN unset → full read+write.
 *
 * Prod hardening:
 *   - Structured logging via pino (stderr)
 *   - LRU cache on read-heavy endpoints (channel list, user lookups)
 *   - Retry-with-backoff on transient Slack errors (rate limits, network)
 *   - Pagination support on read endpoints
 *   - McpError types instead of {isError:true}
 *   - health_check tool for readiness probes
 *
 * Required bot scopes: channels:history, channels:read, groups:history,
 * groups:read, im:write, chat:write, search:read, users:read, users:read.email
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { WebClient, ErrorCode as SlackErrorCode } from "@slack/web-api";
import { z } from "zod";
import { makeLogger } from "../_shared/logger.js";
import { LRUCache } from "../_shared/cache.js";
import { retry, RetryableHttpError } from "../_shared/retry.js";
import {
  channels as synthChannels,
  users as synthUsers,
  messagesByChannel as synthMessagesByChannel,
  searchableMessages as synthSearchable,
} from "./synthetic.js";

const log = makeLogger("slack");
const TOKEN = process.env.SLACK_BOT_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "true";
const SYNTHETIC = !TOKEN;
const slack = TOKEN ? new WebClient(TOKEN, { logger: undefined }) : null;

const channelCache = new LRUCache<string, { id: string; name: string; topic: string }[]>({
  capacity: 4,
  ttlMs: 5 * 60 * 1000,
});
const userCache = new LRUCache<string, { id: string; real_name: string; email: string }>({
  capacity: 256,
  ttlMs: 30 * 60 * 1000,
});

function note(): string {
  if (SYNTHETIC) return "(SYNTHETIC mode — set SLACK_BOT_TOKEN for real workspace)";
  if (DRY_RUN) return "(DRY_RUN — writes logged, not sent)";
  return "(live — read + write enabled)";
}

function wrapSlackError(err: unknown): Error {
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: string; data?: { error?: string; retry_after?: number } };
    if (e.code === SlackErrorCode.RateLimitedError || e.data?.error === "ratelimited") {
      const retryAfterMs = (e.data?.retry_after ?? 1) * 1000;
      return new RetryableHttpError(429, "slack rate-limited", retryAfterMs);
    }
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function callSlack<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
  return retry(async () => {
    try {
      return await fn();
    } catch (err) {
      throw wrapSlackError(err);
    }
  }, { logger: log, operationName });
}

const server = new McpServer({ name: "slack", version: "0.2.0" });

server.tool(
  "health_check",
  "Verify the slack MCP server is reachable and its upstream is healthy. Returns mode, dry_run, and (in live mode) an auth.test result. Safe to poll.",
  {},
  async () => {
    const base = { mode: SYNTHETIC ? "synthetic" : "live", dry_run: DRY_RUN } as Record<string, unknown>;
    if (SYNTHETIC) return { content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok" }, null, 2) }] };
    try {
      const auth = await callSlack("auth.test", () => slack!.auth.test());
      return {
        content: [{ type: "text", text: JSON.stringify({ ...base, status: "ok", team: auth.team, user: auth.user }, null, 2) }],
      };
    } catch (err) {
      log.error({ err }, "health_check failed");
      throw new McpError(ErrorCode.InternalError, `slack auth.test failed: ${(err as Error).message}`);
    }
  },
);

server.tool(
  "slack_list_channels",
  "List channels the bot can see. Cached 5 min. Returns {id, name, topic} entries.",
  {
    cursor: z.string().optional().describe("Pagination cursor returned by a prior call. Omit for first page."),
  },
  async ({ cursor }) => {
    if (SYNTHETIC) {
      return {
        content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", channels: synthChannels, next_cursor: null }, null, 2) }],
      };
    }
    // Cache only the unpaginated first-page case — pagination cursors are short-lived upstream.
    if (!cursor) {
      const cached = channelCache.get("first_page");
      if (cached) {
        log.debug({ count: cached.length }, "channel cache hit");
        return { content: [{ type: "text", text: JSON.stringify({ mode: "live", channels: cached, next_cursor: null, cache: "hit" }, null, 2) }] };
      }
    }
    const result = await callSlack("conversations.list", () =>
      slack!.conversations.list({ exclude_archived: true, limit: 100, cursor }),
    );
    const out = (result.channels ?? []).map((c) => ({
      id: c.id ?? "",
      name: c.name ?? "",
      topic: c.topic?.value ?? "",
    }));
    if (!cursor) channelCache.set("first_page", out);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { mode: "live", channels: out, next_cursor: result.response_metadata?.next_cursor ?? null },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "slack_read_messages",
  "Fetch recent messages from a channel. Accepts channel id (e.g. 'C0PLANIT') or name (e.g. 'flexpay-eng').",
  {
    channel: z.string().min(1).describe("Channel id or name"),
    limit: z.number().int().positive().max(100).default(20),
  },
  async ({ channel, limit }) => {
    if (SYNTHETIC) {
      const match = synthChannels.find((c) => c.id === channel || c.name === channel) ?? null;
      const msgs = match ? synthMessagesByChannel[match.id] ?? [] : [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { mode: "synthetic", channel: match?.name ?? channel, messages: msgs.slice(0, limit) },
              null,
              2,
            ),
          },
        ],
      };
    }
    let channelId = channel;
    if (!channelId.startsWith("C") && !channelId.startsWith("G")) {
      // Resolve name → id from the cached channel list.
      const list = channelCache.get("first_page") ?? (await (async () => {
        const r = await callSlack("conversations.list", () =>
          slack!.conversations.list({ exclude_archived: true, limit: 200 }),
        );
        const norm = (r.channels ?? []).map((c) => ({ id: c.id ?? "", name: c.name ?? "", topic: c.topic?.value ?? "" }));
        channelCache.set("first_page", norm);
        return norm;
      })());
      const hit = list.find((c) => c.name === channel);
      if (!hit?.id) {
        throw new McpError(ErrorCode.InvalidParams, `channel '${channel}' not found`);
      }
      channelId = hit.id;
    }
    const history = await callSlack("conversations.history", () =>
      slack!.conversations.history({ channel: channelId, limit }),
    );
    const messages = (history.messages ?? []).map((m) => ({ ts: m.ts, user: m.user, text: m.text }));
    return {
      content: [{ type: "text", text: JSON.stringify({ mode: "live", channel: channelId, messages }, null, 2) }],
    };
  },
);

server.tool(
  "slack_search",
  "Search messages across accessible channels via Slack search.messages. Supports Slack search syntax (in:#channel, from:@user, etc).",
  {
    query: z.string().min(1),
    max: z.number().int().positive().max(50).default(20),
  },
  async ({ query, max }) => {
    if (SYNTHETIC) {
      const needle = query.toLowerCase();
      const hits = synthSearchable.filter((m) => m.text.toLowerCase().includes(needle)).slice(0, max);
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", query, matches: hits }, null, 2) }] };
    }
    const res = await callSlack("search.messages", () => slack!.search.messages({ query, count: max }));
    const matches = (res.messages?.matches ?? []).map((m) => ({
      ts: m.ts,
      user: m.user,
      channel: m.channel?.name,
      text: m.text,
      permalink: m.permalink,
    }));
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", query, matches }, null, 2) }] };
  },
);

server.tool(
  "slack_get_user",
  "Look up a Slack user by email. Cached 30 min. Useful for resolving meeting attendees to Slack IDs before DMing them.",
  { email: z.string().email() },
  async ({ email }) => {
    const key = email.toLowerCase();
    if (SYNTHETIC) {
      const u = synthUsers.find((u) => u.email.toLowerCase() === key);
      if (!u) throw new McpError(ErrorCode.InvalidParams, `user '${email}' not found in synthetic workspace`);
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", user: u }, null, 2) }] };
    }
    const cached = userCache.get(key);
    if (cached) return { content: [{ type: "text", text: JSON.stringify({ mode: "live", user: cached, cache: "hit" }, null, 2) }] };
    const res = await callSlack("users.lookupByEmail", () => slack!.users.lookupByEmail({ email }));
    if (!res.user?.id) throw new McpError(ErrorCode.InvalidParams, `user '${email}' not found`);
    const user = { id: res.user.id, real_name: res.user.real_name ?? "", email: res.user.profile?.email ?? email };
    userCache.set(key, user);
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", user }, null, 2) }] };
  },
);

server.tool(
  "slack_post_message",
  "Post a message to a channel. Honors DRY_RUN=true (logs to stderr instead of sending). WRITE OPERATION.",
  { channel: z.string().min(1), text: z.string().min(1) },
  async ({ channel, text }) => {
    if (SYNTHETIC || DRY_RUN) {
      log.info({ tool: "slack_post_message", channel, text_preview: text.slice(0, 200), mode: SYNTHETIC ? "synthetic" : "dry-run" }, "would-have-posted");
      return {
        content: [
          { type: "text", text: JSON.stringify({ mode: SYNTHETIC ? "synthetic" : "dry-run", channel, posted: false, would_have_posted: text }, null, 2) },
        ],
      };
    }
    const res = await callSlack("chat.postMessage", () => slack!.chat.postMessage({ channel, text }));
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", ok: res.ok, ts: res.ts, channel: res.channel }, null, 2) }] };
  },
);

server.tool(
  "slack_send_dm",
  "DM a user by Slack ID (use slack_get_user to resolve email → id). Honors DRY_RUN=true. WRITE OPERATION.",
  { user_id: z.string().min(1), text: z.string().min(1) },
  async ({ user_id, text }) => {
    if (SYNTHETIC || DRY_RUN) {
      log.info({ tool: "slack_send_dm", user_id, text_preview: text.slice(0, 200), mode: SYNTHETIC ? "synthetic" : "dry-run" }, "would-have-sent-dm");
      return {
        content: [
          { type: "text", text: JSON.stringify({ mode: SYNTHETIC ? "synthetic" : "dry-run", user_id, posted: false, would_have_posted: text }, null, 2) },
        ],
      };
    }
    const open = await callSlack("conversations.open", () => slack!.conversations.open({ users: user_id }));
    const channelId = open.channel?.id;
    if (!channelId) throw new McpError(ErrorCode.InternalError, "could not open DM channel");
    const res = await callSlack("chat.postMessage", () => slack!.chat.postMessage({ channel: channelId, text }));
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", ok: res.ok, ts: res.ts, channel: channelId }, null, 2) }] };
  },
);

log.info({ mode: SYNTHETIC ? "synthetic" : "live", dry_run: DRY_RUN }, `slack MCP server starting ${note()}`);
await server.connect(new StdioServerTransport());
