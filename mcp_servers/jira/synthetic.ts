/**
 * Synthetic Jira responses used when JIRA_HOST / JIRA_EMAIL / JIRA_API_TOKEN
 * are not all configured. Shaped to match the FlexPay scenario.
 */

export type SyntheticIssue = {
  key: string;
  project: string;
  status: string;
  summary: string;
  description: string;
  reporter: string;
  assignee: string | null;
  type: string;
  comments: { author: string; body: string; created: string }[];
};

export const projects = [
  { key: "PLAN", name: "FlexPay product engineering" },
  { key: "MOBILE", name: "Mobile platform" },
  { key: "AUTH", name: "Auth platform" },
  { key: "RISK", name: "Risk + fraud" },
  { key: "COMP", name: "Compliance engineering" },
  { key: "SVC", name: "Servicing" },
];

export const issues: SyntheticIssue[] = [
  {
    key: "PLAN-1893",
    project: "PLAN",
    status: "Open",
    summary: "Move FlexPay eligibility check server-side",
    description:
      "Reopened per Q3 Standard expansion commitment. Cannot expand eligibility while gate is client-side. ~4 sprints. Original ticket PLAN-1247 closed Won't Do in 2025-Q3.",
    reporter: "Aiko Tanaka",
    assignee: null,
    type: "Story",
    comments: [
      { author: "Aiko Tanaka", body: "Re-filing per Wendell's Q3 expansion commitment. Cannot expand without this.", created: "2026-04-22" },
      { author: "Priya Shankar", body: "Confirmed required. Sized at 4 sprints. Need to find eng capacity.", created: "2026-04-23" },
    ],
  },
  {
    key: "PLAN-1925",
    project: "PLAN",
    status: "In Progress",
    summary: "Add biometric step-up to plan creation flow (>$1000)",
    description: "Step-up auth for high-value FlexPay plan creation. Coordinating with mobile-platform on integration.",
    reporter: "Priya Shankar",
    assignee: "Marcus Webb",
    type: "Story",
    comments: [],
  },
  {
    key: "MOBILE-3501",
    project: "MOBILE",
    status: "In Progress",
    summary: "Integrate FaceID step-up into FlexPay mobile flow",
    description: "Using existing biometric shared library. Chose inline integration over centralized service for speed.",
    reporter: "Aiko Tanaka",
    assignee: "Aiko Tanaka",
    type: "Story",
    comments: [],
  },
  {
    key: "MOBILE-3402",
    project: "MOBILE",
    status: "Open",
    summary: "Audit + remediate remaining UIWebView usage",
    description: "Found in 3 flows post the Oct 2025 incident. Not yet remediated.",
    reporter: "Aiko Tanaka",
    assignee: null,
    type: "Task",
    comments: [],
  },
  {
    key: "AUTH-455",
    project: "AUTH",
    status: "In Progress",
    summary: "Re-architect biometric service (centralized)",
    description: "Moving FaceID/TouchID validation from shared library to centralized service. ETA Q3. Deprecates the legacy shared library.",
    reporter: "Hiroshi Sato",
    assignee: "Hiroshi Sato",
    type: "Epic",
    comments: [],
  },
  {
    key: "AUTH-441",
    project: "AUTH",
    status: "In Progress",
    summary: "Migrate legacy session token storage to vault-backed scheme",
    description: "Compliance-driven (legal flag Q3 2025).",
    reporter: "Hiroshi Sato",
    assignee: "Hiroshi Sato",
    type: "Story",
    comments: [],
  },
  {
    key: "RISK-1102",
    project: "RISK",
    status: "In Progress",
    summary: "Refresh delinquency model for 18-24 segment (FlexPay Standard)",
    description: "Needed for Q3 expansion read. Thin-file challenges expected, confidence intervals will be wide.",
    reporter: "Dana Liu",
    assignee: "Sasha Pereira",
    type: "Task",
    comments: [
      { author: "Sasha Pereira", body: "Pulling data this week. CIs will be wide.", created: "2026-05-08" },
    ],
  },
  {
    key: "FRAUD-1120",
    project: "RISK",
    status: "Open",
    summary: "Step-up auth v2 — add existing-customer-relationship signal",
    description: "Per VOC-2026-02-118 — existing cardmembers should not face same step-up as cold prospects.",
    reporter: "Dana Liu",
    assignee: null,
    type: "Story",
    comments: [],
  },
  {
    key: "COMP-2026-44",
    project: "COMP",
    status: "Not Started",
    summary: "UDAAP review — FlexPay Standard expansion to 18-24 segment",
    description: "Not yet kicked off. Estimated 6-8 weeks. Gates Servicing's Standard launch readiness.",
    reporter: "Brett Holloway",
    assignee: "Brett Holloway",
    type: "Task",
    comments: [],
  },
  {
    key: "COMP-2026-58",
    project: "COMP",
    status: "Not Started",
    summary: "SR 11-7 model risk doc for new 18-24 delinquency model",
    description: "Required for any credit product using the new model.",
    reporter: "Brett Holloway",
    assignee: null,
    type: "Task",
    comments: [],
  },
  {
    key: "SVC-3411",
    project: "SVC",
    status: "Blocked",
    summary: "New servicing scripts for FlexPay Standard",
    description: "Blocked on UDAAP outcome (COMP-2026-44).",
    reporter: "Tomás Reyes",
    assignee: null,
    type: "Task",
    comments: [],
  },
];

export function jqlMatch(jql: string, issue: SyntheticIssue): boolean {
  const lower = jql.toLowerCase();
  if (lower.includes("project = ") || lower.includes("project=")) {
    const m = lower.match(/project\s*=\s*"?([a-z0-9]+)"?/);
    if (m && issue.project.toLowerCase() !== m[1]) return false;
  }
  if (lower.includes("status = ") || lower.includes("status=")) {
    const m = lower.match(/status\s*=\s*"([^"]+)"/);
    if (m && issue.status.toLowerCase() !== m[1].toLowerCase()) return false;
  }
  if (lower.includes("assignee = currentuser")) {
    return false;
  }
  if (lower.includes("text ~ ") || lower.includes("text~")) {
    const m = lower.match(/text\s*~\s*"([^"]+)"/);
    if (m) {
      const haystack = (issue.summary + " " + issue.description).toLowerCase();
      if (!haystack.includes(m[1].toLowerCase())) return false;
    }
  }
  return true;
}
