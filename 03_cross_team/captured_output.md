======================================================================
Q: I'm leading the FlexPay Q3 Standard expansion. What should I be worried about across other teams?
======================================================================

# FlexPay Q3 Standard — Cross-Team Risk Brief

You have **at least three teams making Q3-impacting decisions about your product**, and they're not converging. Here's what I found:

## 🔥 Critical hidden dependencies / overlaps

**1. Biometric step-up is a three-way collision in flight.**
- Your team (PLAN-1925) is adding biometric step-up for >$1000 plan creation.
- mobile-platform (MOBILE-3501) is integrating FaceID *inline* in the FlexPay mobile flow using the **legacy biometric shared library**, and they explicitly decided this in April **without consulting auth-platform**.
- auth-platform (AUTH-455) is **re-architecting biometric into a centralized service, ETA Q3** — i.e., deprecating the library Mobile just built against.
- fraud-risk (FRAUD-1120) wants the biometric signal piped into Step-Up Auth v2 for risk decisioning, and Dana notes **"no formal alignment yet"** with auth-platform.
- Net: you have four teams converging on biometric in the same quarter with zero shared architecture. Whoever ships first dictates the contract — and right now Mobile is racing toward a path that breaks on Hiroshi's cutover.

**2. UDAAP review for FlexPay Standard has not started (COMP-2026-44).**
- Brett's team has it on the sprint as "not started."
- Servicing's SVC-3411 (Standard agent scripts) is explicitly **blocked on UDAAP outcome**.
- UDAAP reviews for new lending behavior have multi-month lead times. This is the single most likely cause of a Q3→Q4 slip.

**3. The 18-24 delinquency model (RISK-1102) is your underwriting backbone — and it needs SR 11-7 sign-off you don't own.**
- fraud-risk is building it; compliance-engineering (COMP-2026-58) owns the model-risk doc. Model-risk approval is not optional for a credit product expansion. If this isn't scheduled with model risk this week, your underwriting story doesn't exist at launch.

**Bonus drag:** Tomás (servicing) already flagged finance that Standard adds **14 FTE** based on his call-volume projection. If that headcount isn't approved, AHT (already 8.2 min vs. 4.1 target) explodes the day Standard launches and execs will blame the product, not staffing.

## 📞 People to talk to TODAY

| Who | Team | Why |
|---|---|---|
| **Hiroshi Sato** | auth-platform | Lock the biometric integration contract before Mobile cements the legacy path. Get AUTH-455 timeline pinned against your Q3 date. |
| **Aiko Tanaka** | mobile-platform | Stop MOBILE-3501 from hardening on the legacy library. Force the three-way with Hiroshi. |
| **Brett Holloway** | compliance-engineering | Get COMP-2026-44 (UDAAP) and COMP-2026-58 (SR 11-7) **started this week**, with named reviewers and a deadline. |
| **Dana Liu** | fraud-risk | Confirm RISK-1102 readiness and align on biometric signal consumption so FRAUD-1120 ↔ your flow share one definition. |
| **Tomás Reyes** | servicing | Confirm the 14-FTE ask is moving with finance, and that scripts can be drafted in parallel with UDAAP (not after). |

## ⚠️ The one warning

**If you do not get UDAAP review (COMP-2026-44) formally kicked off with a named reviewer and a date this week, FlexPay Standard ships in Q4, not Q3.** Everything else (biometric, model risk, staffing) is recoverable with engineering effort. Compliance lead time is not. It is currently "not started" and it gates Servicing's launch readiness directly.
