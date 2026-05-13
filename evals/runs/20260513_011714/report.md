# Eval Report

**Generated:** 2026-05-13T01:18:30.232486+00:00
**Run dir:** `evals/runs/20260513_011714`
**Judge model:** `claude-opus-4-7`

## Summary: 2/2 cases passed

| Skill | Pass | Total |
|---|---|---|
| `oncall-companion` | 2 | 2 |

## Judge token cost

| Field | Value |
|---|---|
| Input tokens | 4,476 |
| Output tokens | 1,435 |
| Cache-read input tokens | 0 |
| Estimated cost (judge only) | $0.0583 |

_Judge cost only. Agent costs are tracked separately by the agent's own logger output._

## `oncall-companion`

### ✅ PASS — `first_biometric_page_no_memory`

_Strong triage response with concrete branching next steps, clear impact statement, acknowledgment of empty memory, and reported memory writes. Minor oddity: filename '2024_03_32ET' has an invalid date (March 32), but this isn't covered by rubric._

**must_have:**
- ✅ Acknowledges this is the first occurrence (empty memory / no prior pages).
  - _Evidence:_ 'First occurrence — memory empty for this signal. No prior `/memories/incidents/` or `/memories/patterns/` entries exist for auth-service or biometric latency.'
- ✅ Identifies the affected service and downstream impact (FlexPay plan creation).
  - _Evidence:_ 'auth-service biometric validation endpoint is ~7x slower than baseline. FlexPay can't complete plan creation because that flow waits synchronously on /v1/biometric/validate'
- ✅ Suggests a concrete next step — mitigate, escalate, or record — not generic 'investigate further'.
  - _Evidence:_ 'split the request time into outbound vendor call vs internal handler... If vendor call is >900ms, page the biometric-vendor owner... ask FlexPay on-call whether they have a feature flag... flip it if yes.'
- ✅ Indicates that a memory note WAS written (the agent should report writing to memory, even if the harness doesn't verify the bytes).
  - _Evidence:_ 'NOTES WRITTEN: /memories/incidents/... /memories/patterns/... /memories/owners.md'

**must_not_have:**
- ✅ Claims to recall prior incidents that don't exist in the empty-memory setup.
  - _Evidence:_ Explicitly states 'first occurrence — memory empty', no false recall.
- ✅ Vague 'check the logs and escalate as needed' response with no specific action.
  - _Evidence:_ Provides specific branching actions (vendor call vs internal handler, feature flag, rollback).

### ✅ PASS — `recurring_biometric_page_with_memory`

_Output cleanly pattern-matches the recurring incident, cites the relevant memory files, calls out this as the 2nd occurrence, and recommends structural escalation (P1 bump + node pool isolation or migration). Mitigation steps are present but accompany the structural conversation rather than replacing it._

**must_have:**
- ✅ Pattern-matches against the prior 2026-04-29 incident from memory.
  - _Evidence:_ 'Prior: /memories/incidents/2026-04-29__auth-service__biometric-latency.md (p99 1.4s for 8 min, auto-recovered, AUTH-590 filed)'
- ✅ Names this as the second (or N≥2) occurrence of the biometric-latency pattern.
  - _Evidence:_ 'Second occurrence in ~24h' and '2nd occurrence of biometric-latency pattern'
- ✅ Recommends escalating to a structural conversation (e.g. prioritizing AUTH-455 / centralized biometric service) rather than just mitigating.
  - _Evidence:_ 'Escalate AUTH-590 from filed to P1. Conversation... (a) isolating the biometric shared lib onto its own node pool... or (b) migrating FlexPay's biometric validation off the legacy validator.'
- ✅ Cites the specific memory paths it drew from.
  - _Evidence:_ Cites /memories/incidents/2026-04-29__auth-service__biometric-latency.md and /memories/patterns/biometric-latency.md

**must_not_have:**
- ❌ Treats this as a fresh first-occurrence incident with no prior context.
  - _Evidence:_ Explicitly frames as second occurrence with prior context referenced.
- ❌ Suggests only 'restart the service' or other reactive-only response without naming the recurring pattern.
  - _Evidence:_ Includes structural escalation actions alongside mitigation.
