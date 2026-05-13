Output videos/oncall-companion.mp4
Output videos/oncall-companion.gif

Set FontSize 16
Set Width 1200
Set Height 700
Set Theme "Dracula"
Set Padding 20
Set TypingSpeed 50ms
Set PlaybackSpeed 1.5

Hide
Type "cd /Users/crodriguez/interview && clear"
Enter
Sleep 500ms
Show

Type "# Oncall Companion demo: feed a page in, get a triage card out + persistent memory"
Enter
Sleep 1500ms

Type "source .venv/bin/activate"
Enter
Sleep 800ms

Type "python 04_oncall_companion/agent.py < 04_oncall_companion/incidents/page_001.md"
Enter
Sleep 1500ms

# Canned triage card baked directly into the tape (no captured_output.md for this one).
Hide
Type "clear"
Enter
Show
Type "PATTERN MATCH:  First occurrence — memory empty for this signal"
Enter
Sleep 250ms
Type "SERVICE / IMPACT: auth-service /v1/biometric/validate. FlexPay plan creation latency-sensitive."
Enter
Sleep 250ms
Type "LIKELY CAUSE:   Legacy biometric shared library node-pool saturation. Co-tenant?"
Enter
Sleep 250ms
Type "NEXT STEP:      Page Hiroshi (auth-platform) to confirm node-pool state. Mitigate by routing to spare capacity."
Enter
Sleep 250ms
Type "ESCALATION:     — first occurrence, no escalation yet"
Enter
Sleep 250ms
Type "NOTES WRITTEN:  /memories/incidents/2026-05-13__auth-service__biometric-latency.md"
Enter
Sleep 4000ms

Type "exit"
Enter
Sleep 500ms
