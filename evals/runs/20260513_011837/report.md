# Eval Report

**Generated:** 2026-05-13T01:23:49.292609+00:00
**Run dir:** `evals/runs/20260513_011837`
**Judge model:** `claude-opus-4-7`

## Summary: 7/8 cases passed

| Skill | Pass | Total |
|---|---|---|
| `meeting-killer` | 0 | 1 |
| `pm-memory` | 3 | 3 |
| `cross-team` | 2 | 2 |
| `oncall-companion` | 2 | 2 |

## Judge token cost

| Field | Value |
|---|---|
| Input tokens | 24,348 |
| Output tokens | 5,919 |
| Cache-read input tokens | 0 |
| Estimated cost (judge only) | $0.2697 |

_Judge cost only. Agent costs are tracked separately by the agent's own logger output._

## `meeting-killer`

### ❌ FAIL — `flexpay_q3_sync`

_The output is high-quality and substantive: strong action graph with owners and dates, sharp structural observations, and an excellent followup to Wendell challenging Q3 feasibility. However, it fails the sync score criterion — rubric requires 5 or below, agent gave 6/10. The agent justified the 6 by arguing dependency discovery needed humans in a room, which is defensible but does not meet the rubric threshold. Overall_pass is false solely due to this._

**must_have:**
- ❌ Sync score is 5 or below — this meeting did not need to be synchronous.
  - _Evidence:_ SYNC SCORE: 6/10 — above the 5 threshold required by the rubric.
- ✅ Wendell Ngata is classified as borderline or could_have_been_briefed (joined late, left early, no substantive contribution).
  - _Evidence:_ [CUT] Wendell Ngata — Joined late, left after 5 minutes, contributed only 'Q3 is the commitment, find a way.'
- ✅ Action items have explicit owners and a due date.
  - _Evidence:_ Each action has bracketed owner and 'Due:' line, e.g., '[Aiko Tanaka] ... Due: Wednesday'.
- ✅ Followup draft to Wendell or Marcus flags the Q3 commitment as not actually feasible without the structural prerequisites being met.
  - _Evidence:_ Wendell email: 'Even with parallelization and aggressive execution, Q3 ship is high-risk... Need a steer before we commit the team to a date that isn't real.'
- ✅ Structural observations call out at least one of: late surfacing of the client-side eligibility gate, UDAAP review not started, no single owner declared until Priya volunteered.
  - _Evidence:_ 'Critical architectural fact — client-side eligibility gate — surfaced 30+ minutes into the meeting' and 'No single owner for the cross-functional timeline existed until Marcus explicitly asked for one.'

**must_not_have:**
- ✅ Vague 'good discussion, action items captured' summary with no challenge to the meeting's existence.
  - _Evidence:_ Output directly challenges the meeting: 'Half this meeting was a status-sync that a written doc would have surfaced faster' and recommends cuts.
- ✅ Marking Wendell as 'essential' attendance without explanation.
  - _Evidence:_ Wendell marked [CUT] with explanation of late arrival/early exit.

## `pm-memory`

### ✅ PASS — `q3_expansion_blunt_warning`

_Strong blunt response hitting all required elements: identifies prior kill, lists three preconditions, gives explicit do-not-repeat warning, cites the kill doc, and names Priya Shankar as owner. Adds useful detail on ticket ownership and parallel mobile risks._

**must_have:**
- ✅ Identifies that this expansion was already killed in 2025-Q3 for substantively the same reasons.
  - _Evidence:_ 'Standard expansion was explored in 2025-Q3 and KILLED for four reasons: 2.4x loss rate on thinner files, +14 FTE servicing... mobile eligibility gate... UDAAP not started.'
- ✅ Calls out the three preconditions from the kill doc (server-side eligibility migration, UDAAP review, current risk modeling).
  - _Evidence:_ 'three preconditions (server-side eligibility gate, UDAAP review kicked off, current risk modeling)'
- ✅ Emits a blunt warning — not just historical context but explicit do-not-repeat language.
  - _Evidence:_ '⚠ WARNING ... If you commit to Q3 in a steering review without those three green, you own the resulting miss — and the postmortem will cite the doc that told you not to.'
- ✅ Cites prds/2025_plan_it_gold_explore.md (or equivalent killed-exploration doc).
  - _Evidence:_ Citations include 'prds/2025_plan_it_gold_explore.md'
- ✅ Names current owner: Priya Shankar (or equivalent product owner).
  - _Evidence:_ 'OWNER TODAY: Priya Shankar owns FlexPay overall.'

**must_not_have:**
- ✅ Bland summary of what FlexPay is without the historical landmine warning.
  - _Evidence:_ Output leads with warning and kill-doc landmines, not bland summary.
- ✅ Treats this as a greenfield question with no prior precedent.
  - _Evidence:_ Explicitly references 2025-Q3 kill and prior PM warning.

### ✅ PASS — `why_killed`

_Strong, specific answer covering all four kill reasons, citing the kill doc, and adding valuable current-state context about the Q3 re-commitment risk._

**must_have:**
- ✅ Names at least 3 of: 2.4x loss rate on thin-file segment, 14 FTE servicing without budget, client-side eligibility gate, UDAAP not started.
  - _Evidence:_ All four are named: 'loss rates ~2.4x Premier', 'servicing projections required 14 unfunded FTE', 'mobile eligibility check is still client-side', and 'UDAAP review... was never started'.
- ✅ Cites the kill doc explicitly.
  - _Evidence:_ 'The kill doc explicitly says: do not have the expansion conversation again...' and citation 'prds/2025_plan_it_gold_explore.md'.

**must_not_have:**
- ✅ Generic 'priorities shifted' or 'capacity constraints' answer that doesn't reflect the specific blockers in the corpus.
  - _Evidence:_ Response is highly specific with ticket IDs (PLAN-1893, COMP-2026-44, RISK-1102) and concrete blockers, not generic.

### ✅ PASS — `mobile_eligibility_landmine`

_The agent's response thoroughly addresses all criteria: explicitly identifies the client-side nature, links the issue to both the UIWebView P0 incident and the Q3 Standard expansion blocker, and provides a detailed timeline of PLAN-1247's repeated deferrals starting from Q1 2025. It also adds valuable warnings, ownership info, and citations._

**must_have:**
- ✅ Identifies the check is client-side.
  - _Evidence:_ 'FlexPay's eligibility check is implemented client-side in the mobile app' and 'the mobile app decides locally whether to show the entry point'
- ✅ Connects it to either the 2025 mobile crash incident OR the current expansion blocker (ideally both).
  - _Evidence:_ Connects to expansion blocker ('single biggest blocker to any tier expansion', Q3 Standard expansion) AND the UIWebView P0 incident ('same class of tech debt that caused the Oct 2025 UIWebView P0')
- ✅ Notes the migration was promised in Q1 2025 and bumped multiple times (PLAN-1247).
  - _Evidence:_ 'PLAN-1247 was filed in 2024-09 to migrate, bumped in Jan 2025 for Standard expansion exploration, bumped again in April 2025 for fraud signup work, and closed Won't Do in Sept 2025'

**must_not_have:**
- ✅ Describes only the current state without the historical context of repeated deferral.
  - _Evidence:_ Extensive 'WHAT'S BEEN TRIED' timeline documents repeated deferrals from 2024-09 through 2026-04

## `cross-team`

### ✅ PASS — `q3_expansion_cross_team_risk`

_The output cleanly identifies the biometric library collision across plan-it/mobile/auth-platform, the explicit deprecation by auth-platform, the unstarted UDAAP review as critical path, and names specific owners with concrete next actions. The single biggest warning is sharply framed as UDAAP-this-week-or-Q4. All must-haves satisfied; no must-not-haves violated._

**must_have:**
- ✅ Surfaces the biometric collision involving 3 or more of: plan-it, mobile-platform, auth-platform, fraud-risk.
  - _Evidence:_ Section 1 explicitly names Mobile (MOBILE-3501), Plan-it (PLAN-1925), and Auth-platform (AUTH-455) colliding on the legacy biometric library.
- ✅ Specifically notes that auth-platform is deprecating the legacy biometric shared library mobile-platform is building against.
  - _Evidence:_ 'Auth-platform (AUTH-455) is re-architecting biometrics into a centralized service and explicitly deprecating that legacy library in Q3' alongside Mobile shipping FaceID against the legacy library.
- ✅ Surfaces UDAAP review not being started (COMP-2026-44) as a critical-path risk.
  - _Evidence:_ Section 2: 'UDAAP review for Standard expansion has not started — 6-8 week lead time… COMP-2026-44 is Not Started'; also called out as 'the deterministic Q3 killer.'
- ✅ Names specific owners to contact today (e.g. Hiroshi Sato for auth, Aiko Tanaka for mobile, Brett Holloway for UDAAP).
  - _Evidence:_ 'People to talk to TODAY' list names Brett Holloway (compliance), Hiroshi Sato (auth-platform), Aiko Tanaka (mobile-platform), plus Marcus Webb and Tomás Reyes.
- ✅ Provides a single 'biggest warning' framed as 'align this week or ship slips'.
  - _Evidence:_ 'The single biggest "align on this or ship Q4 not Q3" warning: Start the UDAAP review (COMP-2026-44) this week.'

**must_not_have:**
- ✅ Generic 'coordinate with other teams' advice with no specific overlaps named.
  - _Evidence:_ Advice is concrete with named tickets (AUTH-455, MOBILE-3501, PLAN-1925, COMP-2026-44, PLAN-1893) and named owners.
- ✅ Misses the biometric collision entirely.
  - _Evidence:_ Biometric collision is the #1 critical hidden dependency.

### ✅ PASS — `biometric_specific`

_The agent provides a thorough cross-team picture with specific tickets, owners, the architectural collision clearly articulated, and actionable next steps. Meets all criteria strongly._

**must_have:**
- ✅ Names at least three teams from: plan-it (PLAN-1925), mobile-platform (MOBILE-3501), auth-platform (AUTH-455), fraud-risk (FRAUD-1120).
  - _Evidence:_ All four teams named with tickets: auth-platform AUTH-455, mobile-platform MOBILE-3501, plan-it PLAN-1925, fraud-risk FRAUD-1120.
- ✅ Notes the architectural collision: auth-platform's centralized service ETA Q3 vs mobile-platform's inline integration with the legacy library.
  - _Evidence:_ 'AUTH-455 deprecates the library MOBILE-3501 and PLAN-1925 are actively building on' and AUTH-455 ETA Q3 vs MOBILE-3501 'built on the legacy shared lib Hiroshi is killing'.

**must_not_have:**
- ✅ Reports only one team's biometric work as if no others exist.
  - _Evidence:_ Output covers five teams in a comprehensive table.

## `oncall-companion`

### ✅ PASS — `first_biometric_page_no_memory`

_Strong, specific triage response. Correctly identifies empty memory state, names the service and FlexPay downstream impact, gives concrete diagnostic and mitigation steps with named commands and fallback strategies, and explicitly logs memory writes. Includes thoughtful pattern-watch criteria for future recurrence._

**must_have:**
- ✅ Acknowledges this is the first occurrence (empty memory / no prior pages).
  - _Evidence:_ 'First occurrence — memory empty for this signal. No prior entries under /memories/incidents/ or /memories/patterns/. Treating as net-new.'
- ✅ Identifies the affected service and downstream impact (FlexPay plan creation).
  - _Evidence:_ 'auth-service, specifically the biometric validation endpoint... biometric validation is a gating step in FlexPay plan creation, customers... dropping out of the funnel.'
- ✅ Suggests a concrete next step — mitigate, escalate, or record — not generic 'investigate further'.
  - _Evidence:_ 'Pull the per-dependency latency breakdown... flip the biometric step to degraded-mode (skip + queue for async re-verify)... check kubectl get hpa auth-service... Page FlexPay on-call'
- ✅ Indicates that a memory note WAS written (the agent should report writing to memory, even if the harness doesn't verify the bytes).
  - _Evidence:_ 'NOTES WRITTEN: /memories/incidents/2024-XX-XX__auth-service__biometric-validate-p99-latency.md ...'

**must_not_have:**
- ✅ Claims to recall prior incidents that don't exist in the empty-memory setup.
  - _Evidence:_ Explicitly says 'memory empty' and 'Treating as net-new'; no fabricated prior incidents.
- ✅ Vague 'check the logs and escalate as needed' response with no specific action.
  - _Evidence:_ Provides specific commands (kubectl get hpa) and concrete mitigation (degraded-mode async re-verify, page FlexPay on-call).

### ✅ PASS — `recurring_biometric_page_with_memory`

_Output clearly pattern-matches the prior incident, names it as 2nd occurrence, recommends structural escalation through AUTH-590, and cites memory paths. Note: rubric mentions AUTH-455 as example but agent uses AUTH-590 from its memory — this is consistent with the agent's referenced prior incident and satisfies the structural-fix intent._

**must_have:**
- ✅ Pattern-matches against the prior 2026-04-29 incident from memory.
  - _Evidence:_ 'Prior: /memories/incidents/2026-04-29__auth-service__biometric-latency.md — same endpoint /v1/biometric/validate'
- ✅ Names this as the second (or N≥2) occurrence of the biometric-latency pattern.
  - _Evidence:_ '2nd occurrence of a known pattern' and '2nd occurrence of the `biometric-latency` pattern.'
- ✅ Recommends escalating to a structural conversation (e.g. prioritizing AUTH-455 / centralized biometric service) rather than just mitigating.
  - _Evidence:_ 'AUTH-590 needs to move from "filed" to a real structural fix — pool scale-up, dedicated FlexPay path, or retiring the legacy shared lib.'
- ✅ Cites the specific memory paths it drew from.
  - _Evidence:_ Cites /memories/incidents/2026-04-29__auth-service__biometric-latency.md, /memories/patterns/biometric-latency.md, /memories/owners.md

**must_not_have:**
- ✅ Treats this as a fresh first-occurrence incident with no prior context.
  - _Evidence:_ Explicitly flagged as 2nd occurrence with prior incident referenced.
- ✅ Suggests only 'restart the service' or other reactive-only response without naming the recurring pattern.
  - _Evidence:_ Includes structural escalation via AUTH-590; not reactive-only.
