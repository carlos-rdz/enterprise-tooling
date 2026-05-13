# auth-service /v1/biometric/validate p99 latency spike

- **Time:** ~03:32 ET, 5+ min sustained at time of page
- **Signal:** p99 1.2s vs baseline 180ms (~6.6x)
- **Endpoint:** POST /v1/biometric/validate
- **Affected flow:** FlexPay plan creation (blocks at biometric step)
- **Source:** PagerDuty

## Hypotheses (ranked)
1. Downstream biometric vendor (likely 3rd-party — Jumio/Onfido/Incode class) latency or thread-pool saturation. Validate via vendor status page + outbound HTTP client metrics.
2. DB / cache miss storm on auth-service (token/session lookup) — check connection pool wait + Redis hit rate.
3. Deploy correlation — check last auth-service deploy timestamp vs 03:32.
4. Noisy-neighbor on the auth-service node pool / HPA lag during traffic ramp.

## Immediate actions taken
- Triage issued; mitigation step = check vendor status + roll back last deploy if within window.

## Open questions
- Error rate (4xx/5xx) — is this pure latency or also failure?
- Upstream traffic shape — concurrent FlexPay campaign / marketing push?
- Region scoped or global?

## Follow-ups
- If vendor: confirm circuit-breaker / fallback path exists for biometric validate. If not — this is the structural gap.
- Capture vendor incident ID if applicable.
