/**
 * Tests for the PreToolUse / PostToolUse hooks.
 *
 * Each hook is a small Node script that reads JSON from stdin and either
 * exits silently (allow) or prints a hookSpecificOutput JSON (deny/ask).
 * We just spawn each as a subprocess and assert on the output.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function runHook(scriptRelPath: string, input: object, env: Record<string, string> = {}): { stdout: string; stderr: string; code: number } {
  const result = spawnSync("node", [join(ROOT, scriptRelPath)], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { stdout: result.stdout, stderr: result.stderr, code: result.status ?? -1 };
}

describe("gate-jira-writes hook", () => {
  const HOOK = ".claude/hooks/gate-jira-writes.mjs";

  it("silently allows when DRY_RUN=true", () => {
    const r = runHook(
      HOOK,
      { tool_name: "mcp__jira__jira_create_issue", tool_input: { project_key: "PLAN", summary: "x" } },
      { DRY_RUN: "true" },
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("emits ask permission decision when DRY_RUN is unset", () => {
    const r = runHook(
      HOOK,
      { tool_name: "mcp__jira__jira_create_issue", tool_input: { project_key: "PLAN", summary: "prod ticket" } },
      { DRY_RUN: "" },
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"permissionDecision":"ask"');
    expect(r.stdout).toContain("prod ticket");
  });

  it("is silent on non-jira tools", () => {
    const r = runHook(HOOK, { tool_name: "Read", tool_input: { file_path: "/etc/passwd" } });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
  });
});

describe("scan-secrets hook", () => {
  const HOOK = ".claude/hooks/scan-secrets.mjs";

  it("allows clean Slack messages", () => {
    const r = runHook(HOOK, {
      tool_name: "mcp__slack__slack_post_message",
      tool_input: { channel: "flexpay-eng", text: "Reminder: standup at 10am" },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
  });

  // The fixtures below are synthesized at runtime from a non-secret prefix
  // plus an obviously-fake EXAMPLE suffix, so they trigger the scanner's
  // regexes but won't trip GitHub's secret-scanning push protection or any
  // upstream rotator. Never paste real tokens into tests.
  const FAKE = "x".repeat(30); // 30 chars, exceeds the 20-char minimums

  it("denies Slack bot tokens (xoxb-)", () => {
    const r = runHook(HOOK, {
      tool_name: "mcp__slack__slack_post_message",
      tool_input: { channel: "x", text: `rotate this: xoxb-EXAMPLE-${FAKE}` },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"permissionDecision":"deny"');
    expect(r.stdout).toContain("Slack bot token");
  });

  it("denies GitHub PATs in Jira descriptions", () => {
    const r = runHook(HOOK, {
      tool_name: "mcp__jira__jira_create_issue",
      tool_input: {
        project_key: "PLAN",
        summary: "deploy issue",
        description: `used gh${"p"}_EXAMPLE${FAKE}${FAKE}`,
      },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"permissionDecision":"deny"');
    expect(r.stdout).toContain("GitHub PAT");
  });

  it("denies Anthropic keys", () => {
    const r = runHook(HOOK, {
      tool_name: "mcp__jira__jira_add_comment",
      tool_input: { key: "PLAN-1", body: `config: sk-ant-EXAMPLE_${FAKE}` },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"permissionDecision":"deny"');
  });

  it("denies AWS access key ids", () => {
    // Use a build-time concat so static scanners don't match the literal.
    const akid = "AK" + "IA" + "EXAMPLE000000000";
    const r = runHook(HOOK, {
      tool_name: "mcp__jira__jira_create_issue",
      tool_input: { project_key: "PLAN", summary: `${akid} config error` },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"permissionDecision":"deny"');
  });

  it("denies JWTs", () => {
    // Synthesize a JWT-shaped string at runtime — the regex requires `eyJ`
    // prefix on the header (base64 of '{"'). Header JSON starting with '{"alg'
    // base64s to `eyJhbGciOi...`.
    const seg = (s: string) => Buffer.from(s).toString("base64url").padEnd(15, "A");
    const jwtish = [seg('{"alg":"none"}'), seg("PAYLOAD"), seg("SIGNATURE")].join(".");
    const r = runHook(HOOK, {
      tool_name: "mcp__slack__slack_send_dm",
      tool_input: { user_id: "U_X", text: `Bearer ${jwtish}` },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"permissionDecision":"deny"');
  });

  it("is silent on non-write tools", () => {
    const r = runHook(HOOK, {
      tool_name: "mcp__jira__jira_search_issues",
      tool_input: { jql: 'project = PLAN and text ~ "xoxb-anything"' },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
  });
});
