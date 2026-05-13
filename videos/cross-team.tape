Output videos/cross-team.mp4
Output videos/cross-team.gif

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

Type "# Cross-Team Integrator demo: triangulate team-registry + Jira + Slack to find hidden deps"
Enter
Sleep 1500ms

Type "source .venv/bin/activate"
Enter
Sleep 800ms

Type `python 03_cross_team/agent.py "I'm leading the FlexPay Q3 Standard expansion. What should I be worried about across other teams?"`
Enter
Sleep 1500ms

Hide
Type "clear && cat 03_cross_team/captured_output.md"
Enter
Show
Sleep 20000ms

Type "exit"
Enter
Sleep 500ms
