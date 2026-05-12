# PRD: FlexPay Launch (Consumer Premier)
**Status:** Shipped 2024-Q2
**Author:** S. Kowalski (PM, since departed)
**Owner since 2025:** Priya Shankar

## Problem
Consumer Premier cardmembers complete large purchases (>$100) on the card but lack flexible repayment. Competitor offerings (Affirm, Klarna) capture intent at checkout. We are losing share-of-wallet on big-ticket post-purchase financing.

## Proposal
Allow eligible Premier members to convert qualifying purchases (>$100, posted within 30 days) into a fixed monthly plan with a flat fee. Available in-app and on web.

## Scope (v1)
- Premier only
- US only
- Min purchase $100, max $10,000
- 3 / 6 / 12 month plan options
- Flat fee (no APR shown to user)

## Out of scope
- Standard / Green tiers
- International
- Non-US currency
- Pre-purchase financing
- Auto-enrollment

## Success metrics
- Activation: 8% of eligible Premier members try FlexPay in first 90 days
- Repeat usage: 35% of activators use a second plan in 180 days
- Loss rate: stay within risk-approved corridor
- NPS: no negative delta on overall card NPS

## Compliance notes
- UDAAP review completed 2024-03; approved with disclosure language attached.
- TILA disclosure required at plan creation.
- Servicing scripts updated, see ticket SVC-2204.

## Known issues at launch
- Eligibility check is implemented client-side in the mobile app (forced by sprint constraints — see ADR-0042).
- This was flagged as tech debt and slated for 2025 Q1 — DID NOT SHIP.
