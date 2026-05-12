# Customer call summaries (Voice-of-customer extracts, anonymized)

---

**Call ID: VOC-2025-11-403** | Product: FlexPay | Sentiment: Negative
**Summary:** Cardmember (Standard tier) tried to use FlexPay on a $1,400 purchase. Got "not eligible" error with no explanation. Called in frustrated, said competitor (Affirm) offered same on the same merchant at checkout.
**Resolution:** Rep explained FlexPay is Premier-only. Cardmember said "then why does it show me the button in the app."
**Engineering note:** This is the client-side eligibility check showing the entry point to all tiers, then failing the check post-tap. UX bug filed MOBILE-3201, never fixed.

---

**Call ID: VOC-2026-02-118** | Product: Digital Signup | Sentiment: Negative
**Summary:** Prospect abandoned signup at step-up auth step. Called to complain about "ridiculous extra steps." Said they have a Premier card at home and shouldn't have to do this. Was applying for a Business card.
**Resolution:** Step-up logic doesn't currently consider existing customer relationship. Renata's team flagged for v2 of conditional step-up.

---

**Call ID: VOC-2025-10-29** | Product: Mobile App | Sentiment: Negative
**Summary:** App crash spike. Cardmember called because FlexPay crash made them think a $4,200 purchase was double-charged. It wasn't, but they were terrified.
**Resolution:** Reassured. Crash hotfix shipped 2 days later.
**Strategic note:** Even a transient crash on a financial flow creates persistent trust damage. Cardmember asked "do I need to switch cards if your app can't be trusted." Tomás flagged this in servicing leadership review.

---

**Call ID: VOC-2026-01-77** | Product: FlexPay | Sentiment: Positive
**Summary:** Repeat FlexPay user. Loves it. Said "this is why I keep Premier."
**Strategic note:** FlexPay is functioning as a Premier retention tool. Argues for premium-tier-exclusive positioning even if Standard expansion ships.
