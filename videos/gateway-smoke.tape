Output videos/gateway-smoke.mp4
Output videos/gateway-smoke.gif

Set FontSize 14
Set Width 1280
Set Height 760
Set Theme "Dracula"
Set Padding 20
Set TypingSpeed 30ms
Set PlaybackSpeed 1.5

Hide
Type "cd /Users/crodriguez/interview && clear"
Enter
Sleep 500ms
# Shorten the noisy ceremony by pre-staging shell vars off-screen.
Type `BODY='{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
Enter
Type "GW=http://localhost:8765"
Enter
Type "clear"
Enter
Sleep 500ms
Show

Type "# MCP Gateway smoke test: healthz, 401, 200, 403"
Enter
Sleep 1500ms

Type "PORT=8765 npx tsx mcp_gateway/gateway.ts > /tmp/mcp-gateway.log 2>&1 &"
Enter
Sleep 3500ms

Type "# 1. /healthz (no auth required)"
Enter
Sleep 600ms
Type "curl -s $GW/healthz; echo"
Enter
Sleep 2500ms

Type "# 2. tools/list with NO token -> 401"
Enter
Sleep 600ms
Type `curl -s -w "\nHTTP %{http_code}\n" -X POST $GW/v1/mcp/pm-memory -H "Content-Type: application/json" -d "$BODY"`
Enter
Sleep 2500ms

Type "# 3. tools/list with VALID token + allowed server -> 200"
Enter
Sleep 600ms
Type `curl -s -X POST $GW/v1/mcp/pm-memory -H "Authorization: Bearer smoketest123" -H "Content-Type: application/json" -d "$BODY" | head -c 500; echo`
Enter
Sleep 3500ms

Type "# 4. tools/list against a FORBIDDEN server -> 403"
Enter
Sleep 600ms
Type `curl -s -w "\nHTTP %{http_code}\n" -X POST $GW/v1/mcp/slack -H "Authorization: Bearer smoketest123" -H "Content-Type: application/json" -d "$BODY"`
Enter
Sleep 3000ms

Hide
Type "kill %1 2>/dev/null; wait 2>/dev/null; clear"
Enter
Show
Sleep 500ms

Type "# Auth, server-ACL, and healthz all wired."
Enter
Sleep 1500ms

Type "exit"
Enter
Sleep 500ms
