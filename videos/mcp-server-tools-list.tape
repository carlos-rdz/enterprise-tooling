Output videos/mcp-server-tools-list.mp4
Output videos/mcp-server-tools-list.gif

Set FontSize 14
Set Width 1280
Set Height 720
Set Theme "Dracula"
Set Padding 20
Set TypingSpeed 40ms
Set PlaybackSpeed 1.5

Hide
Type "cd /Users/crodriguez/interview && clear"
Enter
Sleep 500ms
Show

Type "# Raw MCP server demo: initialize + tools/list against pm_memory over stdio"
Enter
Sleep 1500ms

Type `printf '%s\n%s\n%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"0.1"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | npx tsx mcp_servers/pm_memory/server.ts 2>/dev/null | head -c 1400`
Enter
Sleep 6000ms

Type ""
Enter
Sleep 500ms

Type "# That's the pm_memory tool surface — no gateway, no agent, just JSON-RPC."
Enter
Sleep 2000ms

Type "exit"
Enter
Sleep 500ms
