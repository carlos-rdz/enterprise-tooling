# Team activity snapshots (simulated cross-team data)

These represent what an MCP-style integrator would pull from Jira, Confluence,
and an internal service registry. Each team is intentionally siloed — they
don't know what the others are doing.

---

## team: auth-platform
**Mission:** Authentication and identity for cardmember-facing surfaces.
**Lead:** Hiroshi Sato

### current sprint
- AUTH-441: Migrate legacy session token storage to vault-backed scheme (compliance-driven, see legal flag from Q3)
- AUTH-450: Add WebAuthn passkey support for web login
- AUTH-455: **Re-architect biometric service** — currently FaceID/TouchID validation lives in a shared library called by each consuming team. Moving to centralized service. ETA Q3.

### recent decisions
- 2026-04: Decided to deprecate the v2 auth SDK by EOY. Consumers must migrate to v3.
- 2026-03: Approved WebAuthn rollout plan, contingent on session token migration.

---

## team: mobile-platform
**Mission:** iOS and Android shared infrastructure.
**Lead:** Aiko Tanaka

### current sprint
- MOBILE-3402: Audit + remediate remaining UIWebView usage
- MOBILE-3501: **Add biometric step-up for high-value FlexPay transactions** — Aiko's team is integrating FaceID into the FlexPay mobile flow. They are using the legacy biometric shared library.
- MOBILE-3510: Native rewrite of MR redemption confirmation (post-UIWebView postmortem)

### recent decisions
- 2026-04: Chose to embed biometric calls inline in FlexPay mobile flow rather than refactor to a service call. Decision made without consulting auth-platform.

---

## team: plan-it
**Mission:** FlexPay / FlexPay product.
**Lead PM:** Priya Shankar — **Lead Eng:** Marcus Webb

### current sprint
- PLAN-1893: Server-side eligibility migration (reopened — see ticket history)
- PLAN-1920: Q3 Standard expansion scoping
- PLAN-1925: Add biometric step-up to plan creation flow (>$1000)

### recent decisions
- 2026-05: Committed to Q3 ship of Standard expansion per Wendell.
- 2026-05: Decided to coordinate with mobile-platform on biometric. Owner: Priya.

---

## team: fraud-risk
**Mission:** Fraud detection and risk decisioning.
**Lead:** Dana Liu

### current sprint
- FRAUD-1120: Step-up auth v2 — add existing-customer-relationship signal (see VOC-2026-02-118 customer call)
- FRAUD-1135: Re-tune signup fraud model on 2026-Q1 data
- RISK-1102: 18-24 segment delinquency model for FlexPay Standard

### recent decisions
- 2026-04: Started conversations with auth-platform about biometric signal availability for risk decisioning. **No formal alignment yet.**

---

## team: servicing
**Mission:** Customer service tooling and workflows.
**Lead PM:** Tomás Reyes

### current sprint
- SVC-3401: Reduce avg handle time on FlexPay-related calls (currently 8.2 min vs 4.1 target)
- SVC-3411: New script training for FlexPay Standard (pending UDAAP outcome)

### recent decisions
- 2026-05: Tomás flagged to finance: FlexPay Standard expansion adds 14 FTE if call volume projection holds.

---

## team: compliance-engineering
**Mission:** Tooling for compliance reviews, UDAAP, GLBA, model-risk workflows.
**Lead:** Brett Holloway

### current sprint
- COMP-2026-44: UDAAP review for FlexPay Standard (not started)
- COMP-2026-51: Privacy review for behavioral biometrics expansion (linked to fraud team)
- COMP-2026-58: SR 11-7 model risk doc for new 18-24 delinquency model
