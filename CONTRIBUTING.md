# Contributing

This is a personal project exploring how the Claude Code + Claude API stack composes against upstream-coordination engineering workflows. Contributions are welcome.

## Setup

```bash
git clone https://github.com/carlos-rdz/enterprise-tooling
cd enterprise-tooling

npm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Conventions

### Code

- **TypeScript:** `tsc --noEmit` must pass. Tools live behind Zod schemas; no untyped tool inputs.
- **Python:** mypy strict mode must pass. Pydantic for structured outputs from Claude.
- **Logging:** pino for TypeScript, stdlib `logging` for Python. No `console.log` / `print` for diagnostics — use the logger so log level is controllable in production.
- **Errors from MCP tools:** raise `McpError` with the appropriate `ErrorCode` rather than returning `{ isError: true, content: [...] }`.

### Tests

- **TypeScript:** `npm test` runs Vitest. New MCP tools must have at least one synthetic-mode test verifying the response shape.
- **Python:** `pytest` runs the suite. Agents are tested with the `anthropic` client mocked — no live API calls in CI.

### Evals

- Behavior changes to skills, subagents, or system prompts must pass the existing eval baseline (`evals/report.md`).
- Net-new skills must add a `evals/golden/<skill>.yaml` rubric with at least one case.
- The CI eval-gate (`.github/workflows/ci.yml`) runs the eval suite on every PR and fails if pass rate regresses.

### Commits

- Conventional-style commit messages encouraged (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- One logical change per commit. Don't bundle a refactor with a feature.

### MCP servers

- Every MCP server exposes `health_check` for readiness checks.
- Live-API servers must fall back to a coherent synthetic dataset when credentials are missing — `npm install && npx tsx <server>` must always work for someone cloning fresh.
- Write operations must honor `DRY_RUN=true` and log to stderr instead of executing.

## Submitting a change

1. Open an issue describing the change unless it's trivial.
2. Branch from `main`, write code + tests + eval cases if applicable.
3. Run `npm run typecheck && npm test && pytest && python evals/run.py` locally.
4. Open a PR. CI must be green; reviewers may push back on missing tests or missing eval coverage.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.
