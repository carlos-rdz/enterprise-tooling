# biometric-latency
Endpoint: auth-service /v1/biometric/validate
Downstream blast radius: FlexPay plan creation (confirmed both occurrences).

Occurrences:
- 2026-04-29: p99 1.4s for 8 min. Self-recovered. AUTH-590 filed. Suspected noisy-neighbor on legacy biometric shared lib node pool.
- 2nd occurrence (tonight, 03:32 ET): p99 1.2s for 5 min. Same endpoint, same downstream impact (FlexPay). Pattern confirmed — not a one-off.

Hypothesis (now stronger): legacy biometric shared lib is capacity-constrained.
Mobile-platform + FlexPay ramp is pushing it past headroom during low-traffic windows
(both incidents happened off-hours, suggests batch/cron contention on shared pool, not peak load).

Structural fix conversation to start:
- Re-prioritize AUTH-590 with auth-platform owner.
- Options: dedicated node pool for biometric lib, or migrate FlexPay off legacy path.
- Add p99 SLO + burn-rate alert on /v1/biometric/validate so we stop finding this via PD.
