======================================================================
Q: We're being asked to ship FlexPay Standard expansion in Q3. What do I need to know?
======================================================================

Q3 ship is not real unless three preconditions are met right now: (1) the server-side eligibility migration (PLAN-1893, 4 sprints) is staffed and in flight, (2) UDAAP review (COMP-2026-44, 6-8 weeks) is kicked off this week, and (3) risk modeling for thin-file 18-24 segment (RISK-1102) lands with acceptable loss bounds. None of these are on track for Q3 today. This is the exact expansion that was killed in 2025-Q3 for the same reasons — if you commit to Q3 without fixing the gates first, you will either slip publicly or ship with the same client-side eligibility bug that's already been a customer-trust problem.

⚠ WARNING
You are about to re-run the exact expansion that was killed 12 months ago for reasons that are still true today. The kill doc explicitly says 'any future expansion conversation must START with' the three gates — server-side migration, UDAAP kickoff, current risk model. None of them are done. If you accept the Q3 date without those gates locked in writing this week, you own the slip or the incident. Also: do not let anyone propose 'just ship with the client-side check and force an app update' — that path already produced a P0 in Oct 2025 and an active UX bug driving customers to compare us to Affirm.

CONTEXT YOU NEED
FlexPay launched 2024-Q2 as Premier-only with a known tech debt: eligibility is checked client-side in the mobile app. That debt was promised a Q1 2025 fix and never shipped (PLAN-1247 bumped twice, then closed Won't Do). The same shortcut already caused: (a) a P0 iOS crash incident in Oct 2025 (UIWebView deprecation, MOBILE-3401), and (b) ongoing UX bug MOBILE-3201 where Standard cardmembers see the FlexPay entry point then get a 'not eligible' error — driving negative VOC and direct competitor comparisons (Affirm). FlexPay is currently functioning as a Premier retention hook (VOC-2026-01-77), which is a strategic argument against tier expansion at all — worth surfacing before you commit.

WHAT'S BEEN TRIED
  • 2025-Q3: Standard expansion was formally explored and KILLED. Reasons: 2.4x loss rate vs Premier on thin-file segment, +14 FTE servicing with no budget, client-side eligibility gate blocks tier expansion without server-side migration or forced app update, and UDAAP not started. The killed-doc explicitly recorded the lesson: any future expansion conversation must START by confirming server-side gate, UDAAP kickoff, and current risk modeling.
  • 2024-Q3: Lowered fraud step-up threshold (different product, but same pattern of trying to skip a gate) — lost too much fraud catch. Pattern: skipping the gate to hit a date doesn't work here.
  • Server-side eligibility migration itself has been filed twice (PLAN-1247 closed Won't Do, PLAN-1893 reopened April 2026) and bumped every time PM bandwidth went elsewhere.

OWNER TODAY: Priya Shankar owns FlexPay product. Aiko Tanaka owns the mobile/eligibility migration work (PLAN-1893). Sasha Pereira is doing the risk refresh (RISK-1102) for Dana Liu. Brett Holloway is the compliance owner for UDAAP (COMP-2026-44) but has not started. Wendell appears to be the exec who made the Q3 expansion commitment — confirm scope alignment with him before anything else.

OPEN RISKS
  • PLAN-1893 (server-side eligibility, 4 sprints) has no confirmed eng capacity. Without it, expansion either requires a forced app update (UX hostile, won't reach all users) or ships with the existing client-side check, which means Standard members will keep hitting the 'see button, get rejected' bug already documented in VOC-2025-11-403.
  • COMP-2026-44 (UDAAP) not kicked off. 6-8 weeks minimum. If Q3 means Jul-Sep, you are already inside the window — every week of delay is a week of slip.
  • RISK-1102 in progress but Sasha has flagged thin-file CIs will be wide. Plan for the possibility that the risk read comes back 'don't ship at these terms' and you need different plan terms / fee structure for Standard, which restarts UDAAP.
  • Three other flows still use UIWebView (MOBILE-3402) — same tech-debt clock as the FlexPay crash. Unrelated to expansion but will compete for Aiko's time.
  • Servicing FTE: the 2025 kill doc projected +14 FTE for Standard volume. No evidence that budget has been approved. Confirm with Tomás before committing.
  • Strategic risk: VOC-2026-01-77 indicates FlexPay is a Premier retention driver. Diluting to Standard may reduce Premier upgrade/retention pull. No one has modeled this cannibalization.

CITATIONS
  - prds/2024_plan_it_launch.md
  - prds/2025_plan_it_gold_explore.md
  - prds/2025_mobile_crash_postmortem.md
  - prds/2025_fraud_signup_friction.md
  - tickets/tickets.md
  - convos/customer_calls.md
