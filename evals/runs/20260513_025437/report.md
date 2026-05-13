# Eval Report

**Generated:** 2026-05-13T02:56:21.523904+00:00
**Run dir:** `evals/runs/20260513_025437`
**Judge model:** `claude-opus-4-7`

## Summary: 6/6 cases passed

| Skill | Pass | Total |
|---|---|---|
| `pr-reviewer` | 6 | 6 |

## Judge token cost

| Field | Value |
|---|---|
| Input tokens | 12,138 |
| Output tokens | 3,041 |
| Cache-read input tokens | 0 |
| Estimated cost (judge only) | $0.1367 |

_Judge cost only. Agent costs are tracked separately by the agent's own logger output._

## `pr-reviewer`

### ✅ PASS — `pr_201_catches_null_deref`

_The agent correctly identifies the null-deref risk, rates it MAJOR, requests changes, and cites the specific field accesses. The review is focused and not padded._

**must_have:**
- ✅ Identifies that cardmember_svc.lookup(external_id) can return None and the code accesses fields on the result without guarding.
  - _Evidence:_ 'cardmember_svc.lookup(external_id) is called and the result is immediately dereferenced via member.tier and member.products...If lookup returns None, this helper raises AttributeError.'
- ✅ Severity is rated MAJOR or CRITICAL (this is a crash on a common input path).
  - _Evidence:_ '🟠 MAJOR — Unguarded None return...' and 'Severity ceiling: major'
- ✅ Verdict is REQUEST CHANGES (not APPROVE).
  - _Evidence:_ 'Verdict:          REQUEST CHANGES'
- ✅ Cites the specific `member.tier` or `member.products` access as evidence.
  - _Evidence:_ 'dereferenced via member.tier and member.products' and Evidence block shows 'tier': member.tier

**must_not_have:**
- ✅ Verdict is APPROVE while a major-or-critical bug exists.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE.
- ✅ Three or more INFO-level nitpicks (would indicate the agent is padding the review).
  - _Evidence:_ Only one finding listed; no INFO nitpicks.

### ✅ PASS — `pr_202_catches_sql_injection`

_The agent correctly identified the SQL injection at critical severity, requested changes, and proposed parameterized queries plus input validation. It also caught a relevant CSV injection issue and a streaming concern._

**must_have:**
- ✅ Identifies the SQL injection vulnerability from f-string interpolation of request.args values into a raw SQL query.
  - _Evidence:_ 'Both `tier` and `start_date` are taken directly from request.args and interpolated into the SQL string with f-string formatting... textbook SQLi against the data warehouse.'
- ✅ Severity is rated CRITICAL.
  - _Evidence:_ '🔴 CRITICAL — SQL injection via tier and start_date query params' and 'Severity ceiling: critical'
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ 'Verdict:          REQUEST CHANGES'
- ✅ Proposes a fix that uses parameterized queries or bound parameters (warehouse.execute(sql, params)).
  - _Evidence:_ 'Use parameterized queries: pass `tier` and `start_date` as bind parameters (e.g. `warehouse.execute(sql, {"tier": tier, "start_date": start_date})`)'

**must_not_have:**
- ✅ Verdict is APPROVE or COMMENT while a CRITICAL security issue exists.
  - _Evidence:_ Verdict is REQUEST CHANGES.
- ✅ Treats this as a minor 'consider using parameterized queries' suggestion rather than naming SQL injection.
  - _Evidence:_ Explicitly named as 'SQL injection' and 'textbook SQLi', rated CRITICAL.

### ✅ PASS — `pr_203_catches_logic_error`

_Agent correctly identifies the OR-vs-AND logic bug, rates it critical with appropriate financial/regulatory framing, requests changes, and explicitly notes all three preconditions must hold. Bonus catch on the days//30 month drift is reasonable and correctly rated minor._

**must_have:**
- ✅ Identifies the use of `or` where `and` was required for the eligibility check.
  - _Evidence:_ 'Eligibility uses OR instead of AND' and Evidence: return has_tenure or clean_delinquency or fico_ok; Fix: Change the operators to AND
- ✅ Severity is rated MAJOR or CRITICAL (financial correctness; impacts approvals materially).
  - _Evidence:_ 🔴 CRITICAL — Eligibility uses OR instead of AND
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ Verdict: REQUEST CHANGES
- ✅ Notes that the description requires ALL THREE preconditions (tenure AND clean-delinquency AND fico-floor).
  - _Evidence:_ 'Standard tier requires ALL three conditions: 18+ months tenure, no >30dpd in last 12mo, AND FICO at/above floor.'

**must_not_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE.
- ✅ Treats this as a minor code-clarity issue.
  - _Evidence:_ Rated CRITICAL with discussion of credit losses and regulatory risk, not minor clarity.

### ✅ PASS — `pr_204_catches_resource_leak`

_The agent correctly identified the cursor resource leak as a MAJOR issue, proposed the context manager fix, and issued REQUEST CHANGES. It also caught additional real issues (overwriting S3 keys, no error handling, CSV newline)._

**must_have:**
- ✅ Identifies that the DB cursor (and/or the S3 client) is opened but not closed, causing a resource leak.
  - _Evidence:_ 'DB cursors are never closed — resource leak under repeated/nightly invocation' with evidence cursor = db_pool.cursor()
- ✅ Severity is rated MAJOR or MINOR.
  - _Evidence:_ 🟠 MAJOR — DB cursors are never closed
- ✅ Proposes a fix that uses a context manager (`with db_pool.cursor() as cursor:`) or explicit cleanup.
  - _Evidence:_ Fix: Use `with db_pool.cursor() as cursor:` (or wrap in try/finally with `cursor.close()`)

**must_not_have:**
- ✅ Verdict is APPROVE without acknowledging the leak.
  - _Evidence:_ Verdict: REQUEST CHANGES

### ✅ PASS — `pr_205_no_false_positives_on_clean_types`

_Agent correctly approved a clean type-hints PR without inventing issues, explicitly stating no major+ findings and confirming behavior unchanged._

**must_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ 'Verdict:          APPROVE'
- ✅ No CRITICAL or MAJOR findings.
  - _Evidence:_ 'Bugs found: 0' and 'Severity ceiling: none'
- ✅ Output explicitly states no major+ issues (e.g. 'No issues found at major+ severity') OR returns an empty findings array.
  - _Evidence:_ 'No issues found at major+ severity.'

**must_not_have:**
- ✅ Three or more findings of any severity (indicates the agent is nitpicking).
  - _Evidence:_ Bugs found: 0
- ✅ MAJOR or CRITICAL findings invented to make the review look productive.
  - _Evidence:_ No findings reported; severity ceiling 'none'

### ✅ PASS — `pr_206_no_false_positives_on_logging`

_Agent correctly approved the PR without inventing issues and affirmed the log placement is correct._

**must_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ 'Verdict:          APPROVE'
- ✅ No CRITICAL or MAJOR findings.
  - _Evidence:_ 'Bugs found: 0', 'Severity ceiling: none', 'No issues found at major+ severity.'

**must_not_have:**
- ✅ MAJOR or CRITICAL findings invented (false positives).
  - _Evidence:_ No findings reported; bugs found: 0.
- ✅ Suggests removing the log line or treating it as a regression.
  - _Evidence:_ Output affirms log placement is correct, no removal suggested.
