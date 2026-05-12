# PRD: Digital Signup Fraud Friction Reduction
**Status:** Shipped 2025-Q4
**Author:** Renata Boz (PM, Acquisition)

## Problem
Digital signup conversion dropped 4.2pp YoY. Root cause: fraud team added a step-up auth step in Q2 2024 after a synthetic-ID fraud spike. The step-up catches fraud but kills 6.1% of legitimate applications.

## Proposal
Replace blanket step-up with risk-scored conditional step-up. Use device signal + behavioral biometrics to gate the step-up. Low-risk apps skip it.

## What we tried before this
- 2024-Q3: Tried lowering the threshold for step-up. Lost too much fraud catch.
- 2024-Q4: Tried alternative auth method (SMS OTP). 11% of legitimate users couldn't complete (carrier issues, foreign numbers).
- 2025-Q1: Tried server-side device fingerprinting only. Insufficient signal.
- 2025-Q2: Combined device + behavioral. Worked. Shipped Q4.

## Result
Conversion recovered 3.1pp of the 4.2pp lost. Fraud catch rate held within 0.3% of prior.

## Compliance notes
- Behavioral biometrics required new privacy disclosure. Legal sign-off filed PRIV-2025-118.
- GLBA review completed.

## Owner today
Renata Boz.
