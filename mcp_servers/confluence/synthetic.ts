/**
 * Synthetic Confluence corpus for when CONFLUENCE_HOST / EMAIL / API_TOKEN
 * aren't all set. Shaped to extend the FlexPay scenario: a few internal
 * wiki pages a PM-historian agent might actually find useful.
 */

export interface SyntheticPage {
  id: string;
  space_key: string;
  title: string;
  author: string;
  updated: string;
  body: string;
  labels: string[];
}

export const pages: SyntheticPage[] = [
  {
    id: "8001",
    space_key: "FLEXPAY",
    title: "FlexPay product principles",
    author: "Priya Shankar",
    updated: "2026-04-12",
    labels: ["principles", "product"],
    body: `# FlexPay product principles

1. Premier-first. The product was built for Premier retention; every tier expansion is judged against that anchor.
2. Eligibility is a server-side concern. Client-side gates have caused two production incidents — never again.
3. Compliance reviews start at scoping, not at handoff.
4. We do not ship without an active risk model for the segment being targeted.

These four principles were ratified in the 2025-Q4 product offsite. See related: 2025_plan_it_gold_explore (kill doc), 2025_mobile_crash_postmortem.`,
  },
  {
    id: "8002",
    space_key: "FLEXPAY",
    title: "Q3 2026 expansion gating checklist",
    author: "Priya Shankar",
    updated: "2026-05-10",
    labels: ["q3-expansion", "checklist"],
    body: `# Q3 2026 expansion gating checklist

Per Kowalski's 2025 kill doc, do NOT consider Standard expansion green until ALL of the following are confirmed in writing this week:

- [ ] Server-side eligibility migration (PLAN-1893) in flight with named eng owner
- [ ] UDAAP review (COMP-2026-44) kicked off with named reviewer and 6-8 wk deadline
- [ ] Refreshed 18-24 segment delinquency model with defensible CIs (RISK-1102)
- [ ] Servicing FTE delta budgeted (~14 FTE per Tomás's volume projection)
- [ ] AUTH-455 (centralized biometric service) timeline pinned vs Q3 ship date

Without all five, Q3 is not real. We've been here before.`,
  },
  {
    id: "8003",
    space_key: "ENG",
    title: "Engineering on-call rotation — escalation paths",
    author: "Hiroshi Sato",
    updated: "2026-03-22",
    labels: ["oncall", "runbook"],
    body: `# Engineering on-call rotation — escalation paths

Service → primary owner → escalation contact:

- auth-service / biometric → Hiroshi Sato → Aiko Tanaka (mobile-platform)
- flexpay-api → Marcus Webb → Priya Shankar (PM, FlexPay)
- fraud-decisioning → Dana Liu → CFO office for >$10k impact
- mobile-gateway → Aiko Tanaka → Marcus (for FlexPay-bound issues)

For sustained pattern (3+ pages on the same service in 14 days), escalate to the service owner's manager AND file a pattern note in the on-call companion's memory.`,
  },
  {
    id: "8004",
    space_key: "ENG",
    title: "ADR-0042: client-side FlexPay eligibility check (2024)",
    author: "S. Kowalski",
    updated: "2024-03-08",
    labels: ["adr", "tech-debt", "flexpay"],
    body: `# ADR-0042: client-side FlexPay eligibility check

## Status
ACCEPTED 2024-03 — explicit tech debt taken to hit launch. SUPERSEDED in spirit; physical migration still pending as of 2026-05.

## Context
We need eligibility filtering in the mobile app before the FlexPay launch. Server-side checks need a new API surface; we have 3 weeks.

## Decision
Ship the eligibility check client-side as a temporary measure. Server-side migration tracked as PLAN-1247 (later closed Won't Do, reopened as PLAN-1893).

## Consequences
- Tier expansion impossible without app force-update OR migrating the check.
- Failure mode if eligibility is misconfigured: misleading entry-point UX (the "see button, hit decline" pattern documented in VOC-2025-11-403).
- See 2025 Mobile crash postmortem for the second-order effect (UIWebView deprecation).`,
  },
  {
    id: "8005",
    space_key: "RISK",
    title: "SR 11-7 model risk template — workflow",
    author: "Brett Holloway",
    updated: "2026-04-30",
    labels: ["sr-11-7", "compliance", "model-risk"],
    body: `# SR 11-7 model risk template — workflow

Required for any new credit-decisioning model. Steps:

1. Model card (purpose, data sources, training set, known limitations) — Risk-modeling team owns.
2. Independent validation — separate team or external; must include a documented adverse-action mapping.
3. Performance monitoring plan — including thresholds for model-drift retraining.
4. Backout plan — what we do if the model is suspended in production.
5. Sign-off from Compliance Engineering AND Risk-modeling lead.

Typical lead time: 4-6 weeks. Start early. See COMP-2026-58 for an in-flight example.`,
  },
];
