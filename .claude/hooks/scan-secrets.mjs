#!/usr/bin/env node
/**
 * PreToolUse hook: scans Slack/Jira write payloads for embedded secrets.
 *
 * Fires before any of:
 *   mcp__slack__slack_post_message
 *   mcp__slack__slack_send_dm
 *   mcp__jira__jira_create_issue
 *   mcp__jira__jira_add_comment
 *
 * Checks every string field in `tool_input` against:
 *   1. Known credential prefixes (xoxb-, ghp_, gho_, glpat-, ATATT, sk-ant-,
 *      sk-, AWS access-key-ids AKIA*, AWS session ASIA*, slack webhook URLs,
 *      Stripe sk_live_, JWT-shaped strings).
 *   2. AWS secret-key shape (40 chars base64-ish).
 *   3. High-entropy hex strings ≥ 32 chars (probable API tokens).
 *
 * On a positive match → emits permissionDecision: "deny" with a clear reason.
 * The agent then sees the denial and is prompted to remove the secret.
 *
 * Hook protocol: https://docs.claude.com/en/docs/claude-code/hooks
 */

const GATED_TOOLS = new Set([
  "mcp__slack__slack_post_message",
  "mcp__slack__slack_send_dm",
  "mcp__jira__jira_create_issue",
  "mcp__jira__jira_add_comment",
]);

const CREDENTIAL_PATTERNS = [
  { label: "Slack bot token", re: /\bxoxb-[A-Za-z0-9-]{20,}/ },
  { label: "Slack user token", re: /\bxoxp-[A-Za-z0-9-]{20,}/ },
  { label: "Slack app token", re: /\bxapp-[A-Za-z0-9-]{20,}/ },
  { label: "Slack webhook URL", re: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+/ },
  { label: "GitHub PAT", re: /\bgh[poursu]_[A-Za-z0-9]{36,}/ },
  { label: "GitLab PAT", re: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { label: "Atlassian API token", re: /\bATATT[A-Za-z0-9_=-]{20,}/ },
  { label: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { label: "OpenAI API key", re: /\bsk-[A-Za-z0-9]{40,}/ },
  { label: "Stripe live secret key", re: /\bsk_live_[A-Za-z0-9]{20,}/ },
  { label: "Stripe restricted key", re: /\brk_live_[A-Za-z0-9]{20,}/ },
  { label: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "AWS session key id", re: /\bASIA[0-9A-Z]{16}\b/ },
  { label: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { label: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
];

const HIGH_ENTROPY_HEX = /\b[a-f0-9]{32,}\b/i;
const AWS_SECRET_SHAPE = /\b[A-Za-z0-9/+]{40}\b/;

function shannonBits(s) {
  const freq = {};
  for (const c of s) freq[c] = (freq[c] || 0) + 1;
  let bits = 0;
  for (const c of Object.keys(freq)) {
    const p = freq[c] / s.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

function* walkStrings(value, path = "") {
  if (typeof value === "string") {
    yield { path, value };
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walkStrings(value[i], `${path}[${i}]`);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) yield* walkStrings(v, path ? `${path}.${k}` : k);
  }
}

function scan(toolInput) {
  const hits = [];
  for (const { path, value } of walkStrings(toolInput)) {
    for (const pat of CREDENTIAL_PATTERNS) {
      if (pat.re.test(value)) {
        hits.push({ path, kind: pat.label });
      }
    }
    // High-entropy heuristics — only flag if no exact pattern matched, to
    // avoid double-reporting.
    if (hits.length === 0) {
      const hexMatch = value.match(HIGH_ENTROPY_HEX);
      if (hexMatch && shannonBits(hexMatch[0]) > 3.5) {
        hits.push({ path, kind: "high-entropy hex (probable API token)", sample: hexMatch[0].slice(0, 8) + "…" });
      }
      const awsMatch = value.match(AWS_SECRET_SHAPE);
      if (awsMatch && shannonBits(awsMatch[0]) > 4.5) {
        hits.push({ path, kind: "AWS secret-key-shaped string", sample: awsMatch[0].slice(0, 4) + "…" });
      }
    }
  }
  return hits;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = event?.tool_name ?? "";
  if (!GATED_TOOLS.has(toolName)) {
    process.exit(0);
  }

  const toolInput = event?.tool_input ?? {};
  const hits = scan(toolInput);
  if (hits.length === 0) {
    process.exit(0);
  }

  const summary = hits
    .slice(0, 5)
    .map((h) => `  - ${h.kind} at \`${h.path}\`${h.sample ? ` (\"${h.sample}\")` : ""}`)
    .join("\n");

  const reason = [
    `⛔ Secret-scanner blocked this ${toolName} call. ${hits.length} potential secret(s) detected:`,
    "",
    summary,
    "",
    `Posting this to Slack/Jira would persist the secret in a place where it can be searched and leaked.`,
    `Remove or redact the secret value, then retry. If this is a false positive (a string that just looks like a token), explain that in your retry request.`,
  ].join("\n");

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
});
