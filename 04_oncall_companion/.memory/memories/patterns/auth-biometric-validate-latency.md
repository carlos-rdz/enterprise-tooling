# Pattern: auth-service /v1/biometric/validate latency

Tracking recurrence of p99 latency spikes on biometric validate endpoint, which gates FlexPay plan creation.

## Occurrences
- 2024-03-32 03:32 ET — p99 1.2s vs 180ms baseline, 5+ min. See `/memories/incidents/2024-03-32__auth-service__biometric-validate-p99-latency.md`.

## Suspected structural causes (to revisit on 2nd hit)
- Synchronous dependency on 3rd-party biometric vendor with no circuit breaker / async fallback.
- FlexPay flow has biometric on the critical path of plan creation — single point of failure.

## Structural fix candidates
- Add circuit breaker + timeout budget on outbound biometric client.
- Async / deferred biometric verification for low-risk plans.
- Vendor redundancy or graceful-degrade mode.
