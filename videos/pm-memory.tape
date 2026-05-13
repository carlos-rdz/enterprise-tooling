Output videos/pm-memory.mp4
Output videos/pm-memory.gif

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

Type "# PM Memory demo: years of FlexPay history compressed into a blunt brief"
Enter
Sleep 1500ms

Type "source .venv/bin/activate"
Enter
Sleep 800ms

Type `python 02_pm_memory/agent.py "We're being asked to ship FlexPay Standard expansion in Q3. What do I need to know?"`
Enter
Sleep 1500ms

# Show canned output. The WARNING block is what we want viewers to land on.
Hide
Type "clear && cat 02_pm_memory/captured_output.md | head -40"
Enter
Show
Sleep 20000ms

Type "exit"
Enter
Sleep 500ms
