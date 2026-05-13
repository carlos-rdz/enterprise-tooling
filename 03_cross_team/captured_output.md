======================================================================
Q: I'm leading the FlexPay Q3 Standard expansion. What should I be worried about across other teams?
======================================================================

# FlexPay Q3 Standard Expansion — Cross-Team Risk Report

I dug across team-registry, Jira, and Slack. You have a real mess brewing. Here's the unvarnished read.

## 🔴 The 3 Critical Hidden Dependencies

### 1. UDAAP review hasn't started — and it's a 6–8 week gate
- **COMP-2026-44** (UDAAP review for FlexPay Standard) is **Not Started** in Jira.
- Brett Holloway posted in #flexpay-xfn: *"Reminder UDAAP review for Standard expansion has NOT been kicked off. 6-8 wks lead time."*
- **SVC-3411** (servicing scripts for Standard) is already **Blocked** waiting on this.
- Your plan-it decisions log doesn't mention UDAAP at all. This is the #1 schedule killer and nobody on your team owns it.

### 2. Biometric step-up is a 3-team collision course on the legacy library
- **PLAN-1925** (your team): biometric step-up for >$1000 plans — In Progress.
- **MOBILE-3501** (Aiko's team): FaceID in FlexPay mobile flow, **using the legacy biometric shared lib** — decision made in April **without consulting auth-platform**.
- **AUTH-455** (Hiroshi): centralized biometric service rewrite, ETA Q3, **explicitly deprecates the legacy shared lib mobile is building on**.
- **FRAUD-1120** (Dana): needs the biometric signal too; fraud-risk's own notes say *"No formal alignment yet"* with auth-platform.
- Priya logged "coordinate with mobile-platform on biometric" — but the actual collision is with **auth-platform**, who she hasn't looped in. You're stacking three integrations on a library that's being deleted this quarter.

### 3. Server-side eligibility migration is unfunded and on the critical path
- **PLAN-1893** (server-side eligibility) is **reopened**, Marcus says it's 4 sprints and *"need to find capacity."*
- Notably the reporter is **Aiko Tanaka** (mobile) — meaning mobile needs this server-side before they can ship cleanly. If you launch Standard without it, you're shipping eligibility logic on the client for a brand-new regulated segment. Auditors will love that.

## 👥 Talk to these people TODAY

| Person | Why | Topic |
|---|---|---|
| **Brett Holloway** (compliance-eng) | UDAAP not started, blocks servicing | Kick off COMP-2026-44 *this week*, not next |
| **Hiroshi Sato** (auth-platform) | AUTH-455 deprecates the lib MOBILE-3501 + PLAN-1925 are building on | Decide: do you wait for AUTH-455 or ship on legacy and re-platform? |
| **Aiko Tanaka** (mobile-platform) | MOBILE-3501 + reporter on PLAN-1893 | Align biometric integration path + eligibility migration capacity |
| **Tomás Reyes** (servicing) | Flagged **14 FTE** needed if call volume projection holds; SVC-3411 blocked | Confirm staffing plan with Wendell's finance team |
| **Dana Liu** (fraud-risk) | RISK-1102 (18-24 delinquency model) is *the* model for Standard; FRAUD-1120 needs biometric signal | Lock model delivery date + biometric signal contract |

## ⚠️ The One Warning

**If you don't kick off the UDAAP review this week, FlexPay Standard ships Q4, not Q3.** Six-to-eight weeks of lead time from a "Not Started" ticket in late May lands you at the edge of Q3 with zero slack — and that's assuming compliance has zero findings. Servicing scripts are already blocked behind it. Everything else (biometric, eligibility, model) is technically recoverable; UDAAP is not.

Close second: get Priya and Hiroshi in a room about AUTH-455 before mobile finishes wiring up a deprecated library.
