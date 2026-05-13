#!/usr/bin/env node
/**
 * PreToolUse hook: gates write operations against the jira MCP server.
 *
 * Behavior:
 *   - If the tool being called is NOT a Jira write → exit silently (allow).
 *   - If the tool IS a Jira write AND DRY_RUN=true → allow silently. The
 *     jira MCP server itself will short-circuit the write to a stderr log,
 *     so no real Jira mutation happens.
 *   - If the tool IS a Jira write AND DRY_RUN is unset → emit a
 *     `permissionDecision: "ask"` with a clear explanation. The user has to
 *     explicitly confirm in the Claude Code UI before the write proceeds.
 *
 * This is the production pattern for any high-blast-radius MCP tool:
 * keep the safety check at the hook layer, not just at the server layer,
 * because the hook fires BEFORE the tool call leaves Claude's context —
 * giving the user a chance to stop it.
 *
 * Hook protocol reference: https://docs.claude.com/en/docs/claude-code/hooks
 */

const WRITE_TOOLS = new Set([
  "mcp__jira__jira_create_issue",
  "mcp__jira__jira_add_comment",
]);

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    // Malformed input — fail open (don't block the tool call on hook bugs).
    process.exit(0);
  }

  const toolName = event?.tool_name ?? "";
  if (!WRITE_TOOLS.has(toolName)) {
    process.exit(0);
  }

  if (process.env.DRY_RUN === "true") {
    // DRY_RUN handles the safety at the MCP server layer; nothing to gate.
    process.exit(0);
  }

  const input = event?.tool_input ?? {};
  const summary =
    toolName === "mcp__jira__jira_create_issue"
      ? `create Jira issue in project ${input.project_key}: "${input.summary}"`
      : `add comment to ${input.key}: "${(input.body || "").slice(0, 120)}${(input.body || "").length > 120 ? "…" : ""}"`;

  const reason = [
    `⚠ Jira write requested: ${summary}`,
    ``,
    `DRY_RUN is not set, so this would hit the real Jira instance. Confirm before proceeding.`,
    `To always allow Jira writes during this session, retry with DRY_RUN unset and accept here.`,
    `To never write to real Jira, set DRY_RUN=true in your environment.`,
  ].join("\n");

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
});
