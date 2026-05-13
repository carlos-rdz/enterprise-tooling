======================================================================
MEETING POSTMORTEM
======================================================================

VERDICT: Should have been a written status thread — the only real synchronous moment was discovering the client-side eligibility gate, and that could have surfaced in a doc comment.
SYNC SCORE: 3/10

----------------------------------------------------------------------
ACTION GRAPH
----------------------------------------------------------------------
1. [Sasha Pereira] Deliver directional thumbs up/down risk read on 18-24 segment (v1 model with caveats on thin-file confidence intervals)
   Due: Monday (2026-05-18)
   Depends on: Dana Liu pulling in Carlos from credit risk
   Risk if missed: Engineering kickoff window slips; Q3 ship commitment to the board is dead.

2. [Dana Liu] Pull Carlos in from credit risk to support Monday directional read; separately loop in fraud strategy for a parallel fraud risk review
   Due: Monday (2026-05-18) for risk read; fraud loop-in this week
   Risk if missed: Sasha can't produce a defensible directional read; fraud review becomes a late-stage blocker.

3. [Aiko Tanaka] Scope mobile eng work to move FlexPay eligibility check from client-side to server-side (or ship new app version) — 4-week effort either path
   Due: Wednesday (2026-05-13)
   Risk if missed: Eligibility cannot be expanded at all — the client-side gate is a hard blocker on Q3.

4. [Brett Holloway] Kick off UDAAP review for 18-24 segment expansion, running in parallel with eng, not after
   Due: This week (week of 2026-05-12)
   Risk if missed: 6-8 week compliance review becomes serial instead of parallel; Q3 is mathematically impossible.

5. [Tomás Reyes] Produce servicing call-volume projection and staffing ask for expanded eligibility population
   Due: After Sasha's eligibility numbers land (target end of week of 2026-05-18)
   Depends on: Sasha Pereira's eligibility/segment sizing
   Risk if missed: Launch with under-staffed servicing; call abandonment and complaint volume spike post-launch.

6. [Priya Shankar] Own the cross-functional timeline across risk, mobile eng, compliance, fraud, and servicing tracks; schedule re-sync after Monday
   Due: Ongoing; re-sync Monday 2026-05-18
   Risk if missed: Four parallel tracks drift; Marcus's 'no single throat to choke' concern materializes.

7. [Marcus Webb] Reconcile eng timeline against client-side gate discovery and UDAAP parallel track; surface revised Q3 vs Q4 call with evidence for Wendell
   Due: By Monday re-sync (2026-05-18)
   Risk if missed: Wendell's 'find a way' directive goes unchallenged with data; team commits to an undeliverable Q3 date.

----------------------------------------------------------------------
ATTENDANCE AUDIT
----------------------------------------------------------------------
[KEEP]  Priya Shankar — Driving the agenda and ended up accepting cross-functional ownership. Has to be in the room.
[KEEP]  Marcus Webb — Surfaced that nobody read the doc and reacted in real time to the client-side eligibility revelation — the single most consequential moment of the meeting.
[KEEP]  Aiko Tanaka — Dropped the client-side gate bomb that reshaped the entire timeline. Without her this meeting produces a wrong plan.
[KEEP]  Brett Holloway — UDAAP 6-8 week parallel-vs-serial point is a schedule-defining constraint; needed to be stated and heard by Wendell-level.
[?]     Dana Liu — Contributed the 'two weeks' pushback and the fraud-vs-UDAAP clarification, but could have handled both in a thread. Worth attending only because the Monday commitment was negotiated live.
[?]     Sasha Pereira — Status update ('Thursday v1, wide CIs') is a Slack message. Only value-add was confirming feasibility of the Monday directional read.
[CUT]   Tomás Reyes — His action item is blocked on Sasha's numbers anyway. A 'FYI servicing impact incoming, send a volume projection when sizing lands' email would have sufficed.
[CUT]   Wendell Ngata — Joined 34 minutes late, left after 5 minutes, contributed 'Q3 is the commitment, find a way.' That's a Slack message, not a meeting appearance. Worse, he left before hearing the constraints that make Q3 unrealistic.

----------------------------------------------------------------------
STRUCTURAL OBSERVATIONS
----------------------------------------------------------------------
• Critical architectural fact (client-side eligibility gate) surfaced 30+ minutes in from Aiko and was news to the Eng Lead — indicates platform documentation and onboarding gaps, not just a meeting problem.
• No single owner of the cross-functional timeline existed until Marcus explicitly asked for one — ownership should be declared in the agenda, not negotiated mid-meeting.
• Pre-read (Marcus's eligibility doc) was not read by most attendees. Either enforce pre-reads or stop writing them.
• UDAAP review was not started despite being a known 6-8 week dependency for a Q3 commitment — compliance is being treated as a downstream gate instead of a parallel workstream. This is a repeatable failure pattern worth a separate post-mortem.
• VP (Wendell) joined 34 min late, left after 5 min, and re-affirmed a Q3 board commitment without hearing the constraints that make it infeasible. Executive drive-bys like this manufacture commitments the team cannot honor.
• Fraud vs UDAAP scope ambiguity (Dana's question to Brett) suggests no clear risk/compliance RACI for FlexPay — should be documented once, not re-litigated per initiative.
• Two attendees (Marcus silent 12 min, Aiko silent after one flag) suggest the meeting could have been split: a 15-min eng/architecture sync and an async status thread for everyone else.
• Servicing was nearly omitted from scope until Tomás self-advocated — downstream operational owners are being treated as afterthoughts in product planning.

----------------------------------------------------------------------
FOLLOWUP DRAFTS
----------------------------------------------------------------------

To: Sasha Pereira
Subject: FlexPay 18-24: Monday directional read — confirming scope

Sasha — confirming what we agreed: directional thumbs up/down on 18-24 delinquency risk by EOD Monday 5/18, not the full model. Wide CIs are fine and expected given thin-file; just flag them. Full v1 model still targeting Thursday 5/21. Dana is pulling Carlos in on the credit risk side — please coordinate directly with him so you're not blocked. Ping me if you hit anything that threatens Monday. — Priya

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

To: Dana Liu
Subject: FlexPay 18-24: Monday directional + fraud loop-in

Dana — two asks coming out of today: (1) get Carlos engaged today/tomorrow so Sasha has what she needs for the Monday directional read; (2) kick off the separate fraud strategy loop-in this week — Brett confirmed UDAAP does not cover fraud. If Monday slips, I need to know by Thursday so I can re-plan with Marcus. — Priya

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

To: Aiko Tanaka
Subject: FlexPay mobile eligibility — scoping due Wed

Aiko — need your written scope by EOD Wednesday 5/13 on the two paths: (a) server-side eligibility check, (b) new app version with updated client gate. For each: eng weeks, dependencies, risk, and your recommendation. This is now on the critical path for Q3 — Marcus and I will use your doc to take the Q3-vs-Q4 conversation back to Wendell. Also: I want to understand how a client-side eligibility gate shipped in 2024 and stayed undocumented at the platform level — not a blame thing, a process thing. Can we 15-min on that next week? — Priya

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

To: Brett Holloway
Subject: FlexPay 18-24: UDAAP kickoff this week

Brett — please open the UDAAP review file this week for the 18-24 Standard cardmember expansion. Per your point, we are running this in parallel with eng, not after. Can you send me (1) the intake doc you need from product, (2) the names of the reviewers, and (3) your best-case and realistic timelines? I'll get you the product intake within 48 hours of your template landing. — Priya

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

To: Tomás Reyes
Subject: FlexPay servicing volume projection — queued behind Sasha

Tomás — to confirm: your volume projection is queued behind Sasha's eligibility sizing. I'll forward her numbers the moment they land (targeting week of 5/18). Please have a draft projection and staffing ask within one week of receiving them. Flag now if your servicing leadership needs a heads-up before then. — Priya

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

To: Marcus Webb
Subject: FlexPay Q3: ownership + the Wendell conversation

Marcus — I'm owning the cross-functional timeline as discussed. Two things from me: (1) by Monday's re-sync I want a joint eng position from you and Aiko on Q3 feasibility given the client-side gate + 6-8 week UDAAP parallel; (2) I want you and me to take that position to Wendell before he re-commits Q3 externally again. 'Find a way' is not a plan and I'd rather have the hard conversation now than in August. Send me a 30-min slot. — Priya

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

To: Wendell Ngata
Subject: FlexPay Q3 expansion — material constraints surfaced after you left

Wendell — flagging two constraints that surfaced after you dropped: (1) FlexPay's mobile eligibility check is client-side and requires a 4-week eng effort to move server-side or ship a new app version; (2) UDAAP review for the 18-24 segment is 6-8 weeks and must run in parallel with eng, not after. Marcus and I will come to you next week with a concrete Q3-vs-Q4 recommendation backed by Aiko's scoping and Brett's compliance timeline. Want to make sure you have the full picture before any board reconfirmation. — Priya

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
