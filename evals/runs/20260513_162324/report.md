# Eval Report

**Generated:** 2026-05-13T16:25:19.740596+00:00
**Run dir:** `evals/runs/20260513_162324`
**Judge model:** `claude-opus-4-7`

## Summary: 3/6 cases passed

| Skill | Pass | Total |
|---|---|---|
| `pr-reviewer` | 3 | 6 |

## Judge token cost

| Field | Value |
|---|---|
| Input tokens | 12,483 |
| Output tokens | 3,052 |
| Cache-read input tokens | 0 |
| Estimated cost (judge only) | $0.1387 |

_Judge cost only. Agent costs are tracked separately by the agent's own logger output._

## `pr-reviewer`

### ✅ PASS — `pr_201_catches_null_deref`

_The agent correctly identifies the null-deref bug, rates it MAJOR, requests changes, and cites the specific member.tier access. The VERIFIED SAFE section provides positive confirmations rather than padding nitpicks. Solid review._

**must_have:**
- ✅ Identifies that cardmember_svc.lookup(external_id) can return None and the code accesses fields on the result without guarding.
  - _Evidence:_ 'cardmember_svc.lookup(external_id) is not checked for None before its attributes are dereferenced.'
- ✅ Severity is rated MAJOR or CRITICAL (this is a crash on a common input path).
  - _Evidence:_ '🟠 MAJOR — Unguarded None return...' and 'Severity ceiling: major'
- ✅ Verdict is REQUEST CHANGES (not APPROVE).
  - _Evidence:_ 'Verdict:          REQUEST CHANGES'
- ✅ Cites the specific `member.tier` or `member.products` access as evidence.
  - _Evidence:_ Evidence block shows 'member = cardmember_svc.lookup(external_id) ... "tier": member.tier,' and message references 'member.tier raises AttributeError'

**must_not_have:**
- ✅ Verdict is APPROVE while a major-or-critical bug exists.
  - _Evidence:_ Verdict is REQUEST CHANGES.
- ✅ Three or more INFO-level nitpicks (would indicate the agent is padding the review).
  - _Evidence:_ No INFO-level nitpicks; only a VERIFIED SAFE section listing checks performed.

### ❌ FAIL — `pr_202_catches_sql_injection`

_Output correctly identifies SQL injection as CRITICAL, requests changes, and proposes parameterized queries with additional input validation. Also catches CSV injection, cursor leaks, and streaming issues as bonus findings._

**must_have:**
- ✅ Identifies the SQL injection vulnerability from f-string interpolation of request.args values into a raw SQL query.
  - _Evidence:_ 'SQL injection via unparameterized f-string interpolation of request args' — '`tier` and `start_date` come straight from `request.args` and are interpolated into the SQL string with an f-string.'
- ✅ Severity is rated CRITICAL.
  - _Evidence:_ '🔴 CRITICAL — SQL injection...'
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ 'Verdict: REQUEST CHANGES'
- ✅ Proposes a fix that uses parameterized queries or bound parameters (warehouse.execute(sql, params)).
  - _Evidence:_ 'Use parameter binding: `warehouse.execute("... WHERE member_tier = %s AND created_at >= %s ...", (tier, start_date))`'

**must_not_have:**
- ❌ Verdict is APPROVE or COMMENT while a CRITICAL security issue exists.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE/COMMENT.
- ❌ Treats this as a minor 'consider using parameterized queries' suggestion rather than naming SQL injection.
  - _Evidence:_ Explicitly named as CRITICAL SQL injection with attack example `tier=' OR '1'='1`.

### ❌ FAIL — `pr_203_catches_logic_error`

_Agent correctly identifies the or/and bug as a major correctness issue, rates it appropriately, requests changes, and references the three-condition requirement. Bonus catch on the days//30 month drift._

**must_have:**
- ✅ Identifies the use of `or` where `and` was required for the eligibility check.
  - _Evidence:_ 'Eligibility uses OR instead of AND' and 'Replace the `or`s with `and`'
- ✅ Severity is rated MAJOR or CRITICAL (financial correctness; impacts approvals materially).
  - _Evidence:_ '🟠 MAJOR — Eligibility uses OR instead of AND'
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ 'Verdict: REQUEST CHANGES'
- ✅ Notes that the description requires ALL THREE preconditions (tenure AND clean-delinquency AND fico-floor).
  - _Evidence:_ 'require ALL THREE conditions (tenure AND clean delinquency AND FICO floor)'

**must_not_have:**
- ❌ Verdict is APPROVE.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE.
- ❌ Treats this as a minor code-clarity issue.
  - _Evidence:_ Rated MAJOR and called 'a UDAAP/credit-risk issue, not a stylistic one'.

### ✅ PASS — `pr_204_catches_resource_leak`

_The agent correctly identifies the cursor resource leak as MAJOR, proposes the context manager fix, and issues REQUEST CHANGES. It also catches additional real issues (S3 overwrite, /tmp cleanup, SELECT * fragility) that strengthen the review._

**must_have:**
- ✅ Identifies that the DB cursor (and/or the S3 client) is opened but not closed, causing a resource leak.
  - _Evidence:_ 'MAJOR — Database cursors are never closed (resource leak across the loop)' with evidence 'cursor = db_pool.cursor()'
- ✅ Severity is rated MAJOR or MINOR.
  - _Evidence:_ Rated 🟠 MAJOR for the cursor leak finding.
- ✅ Proposes a fix that uses a context manager (`with db_pool.cursor() as cursor:`) or explicit cleanup.
  - _Evidence:_ 'Use `with db_pool.cursor() as cursor:` (or explicit try/finally with cursor.close())'

**must_not_have:**
- ✅ Verdict is APPROVE without acknowledging the leak.
  - _Evidence:_ Verdict is 'REQUEST CHANGES' and leak is explicitly called out.

### ❌ FAIL — `pr_205_no_false_positives_on_clean_types`

_The agent correctly approved a clean type-hint PR without inventing findings, explicitly stated no major+ issues, and provided concise verification notes._

**must_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ 'Verdict:          APPROVE'
- ✅ No CRITICAL or MAJOR findings.
  - _Evidence:_ 'Bugs found: 0' and 'Severity ceiling: none'
- ✅ Output explicitly states no major+ issues (e.g. 'No issues found at major+ severity') OR returns an empty findings array.
  - _Evidence:_ 'No issues found at major+ severity.'

**must_not_have:**
- ❌ Three or more findings of any severity (indicates the agent is nitpicking).
  - _Evidence:_ Zero findings reported; only verified-safe checks listed.
- ❌ MAJOR or CRITICAL findings invented to make the review look productive.
  - _Evidence:_ No findings invented; severity ceiling none.

### ✅ PASS — `pr_206_no_false_positives_on_logging`

_The agent correctly approved the PR with zero findings and explicitly verified safety properties of the log line addition without inventing issues._

**must_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ 'Verdict:          APPROVE'
- ✅ No CRITICAL or MAJOR findings.
  - _Evidence:_ 'Bugs found: 0' and 'No issues found at major+ severity.'

**must_not_have:**
- ✅ MAJOR or CRITICAL findings invented (false positives).
  - _Evidence:_ No findings listed; severity ceiling is 'none'.
- ✅ Suggests removing the log line or treating it as a regression.
  - _Evidence:_ Output affirms log placement is safe ('Log line is added after set_ack succeeds') with no removal suggestion.
