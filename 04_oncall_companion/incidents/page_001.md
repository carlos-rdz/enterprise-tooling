# Page #001 — Auth latency spike on FlexPay plan creation
**Time:** 2026-05-12 03:41 ET
**Pager:** Hiroshi Sato (auth-platform on-call)
**Source:** PagerDuty alert "auth-service p99 latency > 800ms for 5 min"

## Initial signal
- PD alert: auth-service `/v1/biometric/validate` p99 latency 1.2s (baseline 180ms)
- Affected: FlexPay plan-creation flow (the only consumer of biometric validation right now)
- Started ~03:32 ET
- Error rate normal — slow, not failing

## What was tried
- Checked deploy log: no auth-service deploy in last 6 hours
- Checked downstream (vault): vault latency normal
- Looked at /v1/biometric/validate request shape: nothing unusual

## Status at handoff
Mitigated, not resolved. Latency dropped at 04:08 ET. Suspect a noisy-neighbor on the shared biometric library node pool, but no confirmed root cause. Filed AUTH-602 for follow-up investigation.

## What I want the on-call companion to remember
- This is the SECOND biometric latency spike in 2 weeks (last one was 2026-04-29, also unresolved)
- Hiroshi is leading AUTH-455 (centralized biometric service rewrite). Pattern is consistent with the legacy shared library being capacity-constrained.
- Next page on biometric → escalate to AUTH-455 prioritization conversation, not just mitigate-and-move-on.
