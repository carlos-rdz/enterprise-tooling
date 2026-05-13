# Page #002 — FlexPay plan-creation 5xx spike
**Time:** 2026-05-13 11:22 ET
**Pager:** Marcus Webb (FlexPay on-call)
**Source:** Datadog monitor "flexpay-api plan_create error rate > 2% for 3 min"

## Initial signal
- Error rate hit 4.1% on `/flexpay/plans` POST for ~7 min
- Errors were 502 Bad Gateway returning from auth-service
- Affected: ~340 plan creation attempts failed in the window
- Customer impact: real, ~340 cardmembers saw plan creation fail

## Pattern recognition needed
- This looks like the auth-service latency from yesterday (Page #001) tipping over from slow to outright failing.
- Hiroshi's team has been seeing biometric validation latency spikes for 2 weeks.
- Filed PLAN-1948 for FlexPay-side observability ("why didn't we degrade gracefully when auth got slow?")

## Open question for the companion
Is this the third biometric incident in 16 days? If yes, this should not be an isolated incident — it's a trend.
