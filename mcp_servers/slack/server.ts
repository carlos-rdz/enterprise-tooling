/**
 * slack MCP server
 *
 * Exposes read + write operations against a Slack workspace via the official
 * @slack/web-api SDK. Designed to be safe to demo:
 *
 *   - If SLACK_BOT_TOKEN is unset → all tools return synthetic FlexPay-shaped
 *     responses. Lets `npm install && npx tsx` work without any real workspace.
 *   - If SLACK_BOT_TOKEN is set but DRY_RUN=true → reads hit the real API, but
 *     writes (post_message, send_dm) are logged to stderr instead of sent.
 *   - If SLACK_BOT_TOKEN is set and DRY_RUN is unset → real reads + writes.
 *
 * Required bot scopes for full functionality:
 *   channels:history, channels:read, groups:history, groups:read,
 *   im:write, chat:write, search:read, users:read, users:read.email
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebClient } from "@slack/web-api";
import { z } from "zod";
import {
  channels as synthChannels,
  users as synthUsers,
  messagesByChannel as synthMessagesByChannel,
  searchableMessages as synthSearchable,
} from "./synthetic.js";

const TOKEN = process.env.SLACK_BOT_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "true";
const SYNTHETIC = !TOKEN;
const slack = TOKEN ? new WebClient(TOKEN) : null;

function note(): string {
  if (SYNTHETIC) return " (SYNTHETIC — set SLACK_BOT_TOKEN for real workspace)";
  if (DRY_RUN) return " (DRY_RUN — writes are logged, not sent)";
  return "";
}

const server = new McpServer({ name: "slack", version: "0.1.0" });

server.tool(
  "slack_list_channels",
  "List channels the bot can see. Returns {id, name, topic} entries.",
  {},
  async () => {
    if (SYNTHETIC) {
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", channels: synthChannels }, null, 2) }] };
    }
    const result = await slack!.conversations.list({ exclude_archived: true, limit: 100 });
    const out = (result.channels ?? []).map((c) => ({ id: c.id, name: c.name, topic: c.topic?.value ?? "" }));
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", channels: out }, null, 2) }] };
  },
);

server.tool(
  "slack_read_messages",
  "Fetch recent messages from a channel. Provide channel id (e.g. 'C0PLANIT') or name (e.g. 'flexpay-eng').",
  {
    channel: z.string().describe("Channel id or name"),
    limit: z.number().int().positive().max(100).default(20),
  },
  async ({ channel, limit }) => {
    if (SYNTHETIC) {
      const match =
        synthChannels.find((c) => c.id === channel || c.name === channel) ?? null;
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
      const list = await slack!.conversations.list({ exclude_archived: true, limit: 200 });
      const hit = (list.channels ?? []).find((c) => c.name === channel);
      if (!hit?.id) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `channel '${channel}' not found` }) }], isError: true };
      }
      channelId = hit.id;
    }
    const history = await slack!.conversations.history({ channel: channelId, limit });
    const messages = (history.messages ?? []).map((m) => ({ ts: m.ts, user: m.user, text: m.text }));
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", channel: channelId, messages }, null, 2) }] };
  },
);

server.tool(
  "slack_search",
  "Search messages across all accessible channels. Uses Slack search.messages.",
  { query: z.string().describe("Search query (Slack search syntax)"), max: z.number().int().positive().max(50).default(20) },
  async ({ query, max }) => {
    if (SYNTHETIC) {
      const needle = query.toLowerCase();
      const hits = synthSearchable.filter((m) => m.text.toLowerCase().includes(needle)).slice(0, max);
      return { content: [{ type: "text", text: JSON.stringify({ mode: "synthetic", query, matches: hits }, null, 2) }] };
    }
    const res = await slack!.search.messages({ query, count: max });
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
  "Look up a Slack user by email. Useful for resolving meeting attendees to Slack IDs before DMing them.",
  { email: z.string().email() },
  async ({ email }) => {
    if (SYNTHETIC) {
      const u = synthUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(u ? { mode: "synthetic", user: u } : { mode: "synthetic", error: "user not found" }, null, 2),
          },
        ],
        isError: !u,
      };
    }
    const res = await slack!.users.lookupByEmail({ email });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { mode: "live", user: { id: res.user?.id, real_name: res.user?.real_name, email: res.user?.profile?.email } },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "slack_post_message",
  `Post a message to a channel. Honors DRY_RUN=true (logs to stderr instead of sending).${"  "}NOTE: write operation.`,
  { channel: z.string(), text: z.string() },
  async ({ channel, text }) => {
    if (SYNTHETIC || DRY_RUN) {
      console.error(`[slack ${SYNTHETIC ? "synthetic" : "dry-run"}] post → ${channel}: ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`);
      return {
        content: [
          { type: "text", text: JSON.stringify({ mode: SYNTHETIC ? "synthetic" : "dry-run", channel, posted: false, would_have_posted: text }, null, 2) },
        ],
      };
    }
    const res = await slack!.chat.postMessage({ channel, text });
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", ok: res.ok, ts: res.ts, channel: res.channel }, null, 2) }] };
  },
);

server.tool(
  "slack_send_dm",
  `DM a user by their Slack ID (use slack_get_user first to resolve email→id). Honors DRY_RUN=true.${"  "}NOTE: write operation.`,
  { user_id: z.string(), text: z.string() },
  async ({ user_id, text }) => {
    if (SYNTHETIC || DRY_RUN) {
      console.error(`[slack ${SYNTHETIC ? "synthetic" : "dry-run"}] DM → ${user_id}: ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ mode: SYNTHETIC ? "synthetic" : "dry-run", user_id, posted: false, would_have_posted: text }, null, 2),
          },
        ],
      };
    }
    const open = await slack!.conversations.open({ users: user_id });
    const channelId = open.channel?.id;
    if (!channelId) throw new Error("could not open DM channel");
    const res = await slack!.chat.postMessage({ channel: channelId, text });
    return { content: [{ type: "text", text: JSON.stringify({ mode: "live", ok: res.ok, ts: res.ts, channel: channelId }, null, 2) }] };
  },
);

console.error(`slack MCP server starting${note()}`);
await server.connect(new StdioServerTransport());
