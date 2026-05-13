/**
 * Synthetic Slack responses used when SLACK_BOT_TOKEN is not configured.
 * Shaped to match the FlexPay scenario from the rest of the repo so the MCP
 * server returns coherent data without a real workspace.
 */

export type SyntheticChannel = { id: string; name: string; topic: string };
export type SyntheticMessage = { ts: string; user: string; user_real: string; text: string };
export type SyntheticUser = { id: string; email: string; real_name: string };

export const channels: SyntheticChannel[] = [
  { id: "C0PLANIT", name: "flexpay-eng", topic: "FlexPay product engineering" },
  { id: "C0XTEAM", name: "flexpay-xfn", topic: "FlexPay cross-functional standup" },
  { id: "C0RISK", name: "risk-modeling", topic: "Credit + fraud risk modeling" },
  { id: "C0MOBILE", name: "mobile-platform", topic: "iOS / Android shared infra" },
  { id: "C0AUTH", name: "auth-platform", topic: "Authentication + identity" },
];

export const users: SyntheticUser[] = [
  { id: "U_PRIYA", email: "priya@example.com", real_name: "Priya Shankar" },
  { id: "U_MARCUS", email: "marcus@example.com", real_name: "Marcus Webb" },
  { id: "U_DANA", email: "dana@example.com", real_name: "Dana Liu" },
  { id: "U_AIKO", email: "aiko@example.com", real_name: "Aiko Tanaka" },
  { id: "U_BRETT", email: "brett@example.com", real_name: "Brett Holloway" },
  { id: "U_TOMAS", email: "tomas@example.com", real_name: "Tomás Reyes" },
  { id: "U_SASHA", email: "sasha@example.com", real_name: "Sasha Pereira" },
  { id: "U_HIROSHI", email: "hiroshi@example.com", real_name: "Hiroshi Sato" },
  { id: "U_WENDELL", email: "wendell@example.com", real_name: "Wendell Ngata" },
];

export const messagesByChannel: Record<string, SyntheticMessage[]> = {
  C0PLANIT: [
    { ts: "1715620000.000", user: "U_PRIYA", user_real: "Priya Shankar", text: "Reminder: Q3 Standard expansion scoping doc due Friday. I'll own the cross-functional timeline." },
    { ts: "1715610000.000", user: "U_MARCUS", user_real: "Marcus Webb", text: "PLAN-1893 reopened — server-side eligibility migration, 4 sprints. Need to find capacity." },
    { ts: "1715600000.000", user: "U_AIKO", user_real: "Aiko Tanaka", text: "Heads up: MOBILE-3501 (biometric step-up in FlexPay) is in flight. Using the existing biometric shared lib." },
  ],
  C0XTEAM: [
    { ts: "1715630000.000", user: "U_BRETT", user_real: "Brett Holloway", text: "Reminder UDAAP review for Standard expansion has NOT been kicked off. 6-8 wks lead time. Someone please file." },
    { ts: "1715625000.000", user: "U_TOMAS", user_real: "Tomás Reyes", text: "Servicing AHT on FlexPay is 8.2 min vs 4.1 target. Standard expansion adds projected +14 FTE — finance hasn't approved." },
  ],
  C0AUTH: [
    { ts: "1715635000.000", user: "U_HIROSHI", user_real: "Hiroshi Sato", text: "AUTH-455 (biometric service rewrite) is on track for Q3. Heads up: this deprecates the legacy biometric shared library that several teams call." },
  ],
  C0MOBILE: [
    { ts: "1715640000.000", user: "U_AIKO", user_real: "Aiko Tanaka", text: "Decided to integrate FaceID inline in MOBILE-3501 rather than wait for the centralized service. Faster ship, accepting the migration debt." },
  ],
  C0RISK: [
    { ts: "1715645000.000", user: "U_SASHA", user_real: "Sasha Pereira", text: "RISK-1102 (18-24 segment delinquency model) — thin-file CIs are wide. Directional read possible by Mon, defensible bounds in ~2 wks." },
  ],
};

export const searchableMessages: SyntheticMessage[] = Object.entries(messagesByChannel).flatMap(
  ([_channel, msgs]) => msgs,
);
