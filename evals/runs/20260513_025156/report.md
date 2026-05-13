# Eval Report

**Generated:** 2026-05-13T02:53:57.774771+00:00
**Run dir:** `evals/runs/20260513_025156`
**Judge model:** `claude-opus-4-7`

## Summary: 5/6 cases passed

| Skill | Pass | Total |
|---|---|---|
| `pr-reviewer` | 5 | 6 |

## Judge token cost

| Field | Value |
|---|---|
| Input tokens | 13,115 |
| Output tokens | 3,232 |
| Cache-read input tokens | 0 |
| Estimated cost (judge only) | $0.1464 |

_Judge cost only. Agent costs are tracked separately by the agent's own logger output._

## `pr-reviewer`

### ✅ PASS — `pr_201_catches_null_deref`

_The agent correctly identified the null-deref bug, cited member.tier as evidence, rated it MAJOR, and issued REQUEST CHANGES. No padding nitpicks were added._

**must_have:**
- ✅ Identifies that cardmember_svc.lookup(external_id) can return None and the code accesses fields on the result without guarding.
  - _Evidence:_ 'a None return will cause an AttributeError on member.tier'
- ✅ Severity is rated MAJOR or CRITICAL (this is a crash on a common input path).
  - _Evidence:_ '🟠 MAJOR — Unguarded use of cardmember_svc.lookup return value'
- ✅ Verdict is REQUEST CHANGES (not APPROVE).
  - _Evidence:_ 'Verdict:          REQUEST CHANGES'
- ✅ Cites the specific `member.tier` or `member.products` access as evidence.
  - _Evidence:_ 'Evidence: member = cardmember_svc.lookup(external_id)... "tier": member.tier'

**must_not_have:**
- ❌ Verdict is APPROVE while a major-or-critical bug exists.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE.
- ❌ Three or more INFO-level nitpicks (would indicate the agent is padding the review).
  - _Evidence:_ Only one finding plus a 'VERIFIED SAFE' checklist; no INFO nitpicks.

### ✅ PASS — `pr_202_catches_sql_injection`

_The agent correctly identifies the SQL injection from f-string interpolation, rates it CRITICAL, requests changes, and proposes parameterized queries plus input validation. Additional findings (CSV injection, unbounded results, missing auth) are reasonable and well-targeted._

**must_have:**
- ✅ Identifies the SQL injection vulnerability from f-string interpolation of request.args values into a raw SQL query.
  - _Evidence:_ 'SQL injection via tier and start_date query params... values come directly from request.args and are interpolated into the SQL string via f-string.'
- ✅ Severity is rated CRITICAL.
  - _Evidence:_ '🔴 CRITICAL — SQL injection via tier and start_date query params' and 'Severity ceiling: critical'
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ 'Verdict:          REQUEST CHANGES'
- ✅ Proposes a fix that uses parameterized queries or bound parameters (warehouse.execute(sql, params)).
  - _Evidence:_ 'Use parameterized queries (e.g. warehouse.execute("... WHERE member_tier = %s AND created_at >= %s", (tier, start_date)))'

**must_not_have:**
- ❌ Verdict is APPROVE or COMMENT while a CRITICAL security issue exists.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE/COMMENT.
- ❌ Treats this as a minor 'consider using parameterized queries' suggestion rather than naming SQL injection.
  - _Evidence:_ Explicitly names 'SQL injection' and rates CRITICAL with attack examples.

### ✅ PASS — `pr_203_catches_logic_error`

_Agent correctly identifies the or/and bug, rates it critical, requests changes, and explicitly references the three required preconditions. Also verifies comparison directions as safe, which is a nice touch._

**must_have:**
- ✅ Identifies the use of `or` where `and` was required for the eligibility check.
  - _Evidence:_ 'Eligibility uses OR instead of AND' and 'return has_tenure or clean_delinquency or fico_ok' with fix to change to `and`.
- ✅ Severity is rated MAJOR or CRITICAL (financial correctness; impacts approvals materially).
  - _Evidence:_ '🔴 CRITICAL' and 'Severity ceiling: critical'.
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ 'Verdict: REQUEST CHANGES'.
- ✅ Notes that the description requires ALL THREE preconditions (tenure AND clean-delinquency AND fico-floor).
  - _Evidence:_ 'Standard tier requires all three conditions to hold: 18+ months tenure, no >30dpd in last 12mo, AND FICO at-or-above floor.'

**must_not_have:**
- ❌ Verdict is APPROVE.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE.
- ❌ Treats this as a minor code-clarity issue.
  - _Evidence:_ Labeled CRITICAL and described as credit-policy/UDAAP violation.

### ✅ PASS — `pr_204_catches_resource_leak`

_The review catches the cursor leak with appropriate MAJOR severity and recommends a context-manager fix. It also identifies additional substantive issues (overwriting S3 keys, cross-table isolation, missing CSV header, /tmp cleanup) and correctly issues REQUEST CHANGES._

**must_have:**
- ✅ Identifies that the DB cursor (and/or the S3 client) is opened but not closed, causing a resource leak.
  - _Evidence:_ 'Cursor is never closed; connection-pool exhaustion under repeated runs' — explicitly identifies the cursor leak.
- ✅ Severity is rated MAJOR or MINOR.
  - _Evidence:_ Finding labeled '🟠 MAJOR — Cursor is never closed'.
- ✅ Proposes a fix that uses a context manager (`with db_pool.cursor() as cursor:`) or explicit cleanup.
  - _Evidence:_ 'Use `with db_pool.cursor() as cursor:` (or wrap in try/finally with `cursor.close()`)'

**must_not_have:**
- ✅ Verdict is APPROVE without acknowledging the leak.
  - _Evidence:_ Verdict is 'REQUEST CHANGES' and the leak is explicitly called out.

### ✅ PASS — `pr_205_no_false_positives_on_clean_types`

_The agent correctly approved a clean type-hint-only PR with zero invented findings, explicitly noted no major+ issues, and provided brief verification notes rather than nitpicks._

**must_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ 'Verdict:          APPROVE'
- ✅ No CRITICAL or MAJOR findings.
  - _Evidence:_ 'Bugs found:       0' and 'Severity ceiling: none'
- ✅ Output explicitly states no major+ issues (e.g. 'No issues found at major+ severity') OR returns an empty findings array.
  - _Evidence:_ 'No issues found at major+ severity.'

**must_not_have:**
- ✅ Three or more findings of any severity (indicates the agent is nitpicking).
  - _Evidence:_ Only 3 'VERIFIED SAFE' confirmations, no findings listed (Bugs found: 0).
- ✅ MAJOR or CRITICAL findings invented to make the review look productive.
  - _Evidence:_ No findings raised; severity ceiling is 'none'.

### ❌ FAIL — `pr_206_no_false_positives_on_logging`

_The agent invented a speculative MAJOR finding about a potential None deref that it could not verify from the diff, and issued REQUEST CHANGES rather than APPROVE. This is a classic false positive on a benign logging PR. While it didn't suggest removing the log line, the invented major finding and non-approval verdict fail the core rubric._

**must_have:**
- ❌ Verdict is APPROVE.
  - _Evidence:_ Verdict: REQUEST CHANGES
- ❌ No CRITICAL or MAJOR findings.
  - _Evidence:_ 🟠 MAJOR — Unguarded None deref on pager.get() result will crash ack endpoint

**must_not_have:**
- ❌ MAJOR or CRITICAL findings invented (false positives).
  - _Evidence:_ Agent raised a MAJOR finding about pager.get() returning None, admitting 'Cannot mechanically prove from the diff that `pager.get` is exhaustive.' This is speculative and not a real regression introduced by the logging PR.
- ✅ Suggests removing the log line or treating it as a regression.
  - _Evidence:_ Agent does not suggest removing the log line; it suggests guarding None and wrapping log in try/except, but keeps the log.
