# 2026-04-29 — auth-service biometric latency spike
PD alert: /v1/biometric/validate p99 1.4s for 8 min. Mitigated, root cause unconfirmed.
Suspected noisy-neighbor on legacy biometric shared lib node pool. Filed AUTH-590.
