# Meeting Transcript
## FlexPay Q3 Eligibility Expansion — Cross-functional Sync
**Date:** 2026-05-12 11:00–12:00 ET
**Attendees:** Priya Shankar (PM, FlexPay), Marcus Webb (Eng Lead, FlexPay Platform), Dana Liu (Risk/Fraud), Tomás Reyes (Servicing PM), Aiko Tanaka (Mobile Eng), Brett Holloway (Compliance), Sasha Pereira (Data Science), Wendell Ngata (VP, Consumer Lending — joined late, left early)

---

**Priya:** Okay, thanks everyone for joining. Goal today is to align on the Q3 expansion of FlexPay eligibility to Standard cardmembers in the 18-24 segment. We had the prelim conversation last week, want to lock in scope and timeline.

**Marcus:** Before we go there — did anyone actually read the eligibility doc I sent Friday? Because the proposal in there assumes we keep the existing FICO floor and I want to make sure that's still the call.

**Priya:** I read it. Yes, FICO floor stays. Dana, did Risk weigh in?

**Dana:** We're still modeling. I sent Sasha the segment data yesterday but we don't have a delinquency projection yet. Realistically that's two more weeks.

**Sasha:** I got the data. Running the model now. I can probably have a v1 by Thursday but I want to caveat — the 18-24 segment has thin file issues so confidence intervals will be wide.

**Marcus:** Two more weeks pushes us past the engineering kickoff window. We need a risk signal by next Monday at the latest or Q3 ship is at risk.

**Priya:** Okay, Dana, can we get a directional read by Monday? Not the full model, just thumbs up/down?

**Dana:** ...probably. I'll need to pull Carlos in from the credit risk side.

**Tomás:** Quick question — is servicing in scope here? Because if eligibility expands, our call volume on FlexPay questions goes up and we haven't staffed for it.

**Priya:** Servicing impact was in the doc but yes, you should be in the staffing conversation. Can you put together a volume projection?

**Tomás:** I can. Need eligibility numbers from Sasha first.

**Aiko:** I want to flag — the mobile flow for FlexPay currently has a hardcoded eligibility check at the client. We'd need to ship a new app version OR move the check server-side. That's a 4-week eng effort either way.

**Marcus:** Wait. The eligibility check is client-side? That's news to me.

**Aiko:** It's been client-side since the original 2024 launch. We talked about server-siding it last year but it got deprioritized.

**Marcus:** Okay that changes the timeline. We can't expand eligibility if the gate is in the app.

**Brett:** From a compliance perspective — any expansion to the 18-24 segment will trigger a UDAAP review. That's 6-8 weeks minimum. Has that been started?

**Priya:** ...not yet.

**Brett:** Then your real timeline is whatever-the-eng-timeline-is PLUS six weeks of compliance review running in parallel, not after.

**[Wendell joins at 11:34]**

**Wendell:** Sorry I'm late. Where are we?

**Priya:** We're aligning on Q3 scope. Discovered a few dependencies.

**Wendell:** Okay. Look, I just need to know: are we shipping in Q3 or not? Board commitment.

**Marcus:** With the client-side eligibility issue and the UDAAP review, Q3 is going to be very tight. Q4 is realistic.

**Wendell:** Q3 is the commitment. Find a way. I have to drop in five for the lending review.

**[Wendell leaves at 11:39]**

**Priya:** Okay. So action items as I see them: Sasha gets directional risk read by Monday, Aiko gets the mobile eng scoping done by Wednesday, Brett kicks off UDAAP this week, Tomás does volume projection once Sasha's numbers land.

**Marcus:** Can we get someone to own the cross-functional timeline? Because right now we have four parallel tracks and no single throat to choke.

**Priya:** I'll own it.

**Dana:** Are we doing a fraud risk review separately or is that bundled into Brett's UDAAP?

**Brett:** Separate. UDAAP is consumer protection. Fraud is its own thing.

**Dana:** Okay, I'll loop in fraud strategy.

**Tomás:** Do we need another meeting on this or async from here?

**Priya:** Let's do async until Monday, then re-sync once we have Dana's read.

**[meeting ends 11:58]**

---

*Note: Marcus stayed silent for ~12 minutes between 11:42 and 11:54. Aiko did not speak after the mobile flag.*
