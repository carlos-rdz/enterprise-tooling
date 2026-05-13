Output videos/meeting-killer.mp4
Output videos/meeting-killer.gif

Set FontSize 16
Set Width 1200
Set Height 700
Set Theme "Dracula"
Set Padding 20
Set TypingSpeed 50ms
Set PlaybackSpeed 1.5

# Setup: cd to repo and silence the prompt extras (Hidden so it doesn't leak in)
Hide
Type "cd /Users/crodriguez/interview && clear"
Enter
Sleep 500ms
Show

Type "# Meeting Killer demo: turn a 60-min meeting transcript into a postmortem + action graph"
Enter
Sleep 1500ms

Type "source .venv/bin/activate"
Enter
Sleep 800ms

Type "# (using captured output to avoid burning API tokens on every demo render)"
Enter
Sleep 1200ms

Type "python 01_meeting_killer/agent.py < 01_meeting_killer/transcript.md"
Enter
Sleep 1500ms

# Print canned response and dwell long enough to actually read it.
Hide
Type "clear && cat 01_meeting_killer/captured_output.md | head -60"
Enter
Show
Sleep 18000ms

Type "exit"
Enter
Sleep 500ms
