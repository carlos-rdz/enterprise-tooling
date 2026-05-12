# Postmortem: Mobile App Crash Spike (iOS 18.2)
**Date:** 2025-10-22
**Authors:** Aiko Tanaka, Marcus Webb

## Summary
iOS 18.2 release caused crash rate to spike from 0.4% to 3.8% over 48 hours.
Root cause: deprecated UIWebView usage in the FlexPay in-app flow. Apple finally removed it.

## Why this hit FlexPay specifically
FlexPay mobile flow shipped in 2024 using a UIWebView wrapper for the plan-creation step (faster to ship than native). It was tech debt — see ADR-0042 in the FlexPay launch PRD. Estimated 2 sprints to migrate to native, never prioritized.

## Resolution
Hotfix shipped 2025-10-24 replacing UIWebView with native view. Crash rate returned to baseline.

## Lesson
The "we'll fix it in Q1 2025" promise from 2024 became a P0 incident in Q4 2025. Tech debt in mobile flows has a clock — vendor deprecations force the migration eventually, usually badly.

## Open items
- The server-side eligibility-check migration (also flagged in the 2024 PRD) is still unaddressed. This will be next year's incident.
