# Eval Report

**Generated:** 2026-05-13T02:50:53.741238+00:00
**Run dir:** `evals/runs/20260513_024853`
**Judge model:** `claude-opus-4-7`

## Summary: 5/6 cases passed

| Skill | Pass | Total |
|---|---|---|
| `pr-reviewer` | 5 | 6 |

## Judge token cost

| Field | Value |
|---|---|
| Input tokens | 12,307 |
| Output tokens | 3,052 |
| Cache-read input tokens | 0 |
| Estimated cost (judge only) | $0.1378 |

_Judge cost only. Agent costs are tracked separately by the agent's own logger output._

## `pr-reviewer`

### ❌ FAIL — `pr_201_catches_null_deref`

_The agent correctly identified the null-deref pattern and cited member.tier/member.products, but hedged on severity (MINOR) and issued APPROVE instead of REQUEST CHANGES. This is the exact failure mode the rubric is designed to catch: a crash on a common input path being waved through._

**must_have:**
- ✅ Identifies that cardmember_svc.lookup(external_id) can return None and the code accesses fields on the result without guarding.
  - _Evidence:_ 'If cardmember_svc.lookup() returns None for an unknown external_id ... accessing member.tier and member.products will raise AttributeError.'
- ❌ Severity is rated MAJOR or CRITICAL (this is a crash on a common input path).
  - _Evidence:_ Rated 'MINOR' and 'Severity ceiling: minor' — does not meet MAJOR/CRITICAL.
- ❌ Verdict is REQUEST CHANGES (not APPROVE).
  - _Evidence:_ 'Verdict: APPROVE'
- ✅ Cites the specific `member.tier` or `member.products` access as evidence.
  - _Evidence:_ 'accessing member.tier and member.products will raise AttributeError' and evidence block shows 'tier': member.tier

**must_not_have:**
- ❌ Verdict is APPROVE while a major-or-critical bug exists.
  - _Evidence:_ Verdict is APPROVE despite a null-deref crash bug being present.
- ✅ Three or more INFO-level nitpicks (would indicate the agent is padding the review).
  - _Evidence:_ Only one finding listed; the 'Verified Safe' bullets are not nitpicks.

### ✅ PASS — `pr_202_catches_sql_injection`

_The agent correctly identified the SQL injection as CRITICAL, requested changes, and proposed parameterized queries as the fix. Additional findings (CSV injection, missing auth, end_date, future default date) are reasonable and well-prioritized._

**must_have:**
- ✅ Identifies the SQL injection vulnerability from f-string interpolation of request.args values into a raw SQL query.
  - _Evidence:_ 'SQL injection via unescaped query parameters' - 'tier and start_date query parameters are interpolated directly into the SQL string via f-string'
- ✅ Severity is rated CRITICAL.
  - _Evidence:_ '🔴 CRITICAL — SQL injection via unescaped query parameters'
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ 'Verdict: REQUEST CHANGES'
- ✅ Proposes a fix that uses parameterized queries or bound parameters (warehouse.execute(sql, params)).
  - _Evidence:_ 'Use parameterized queries (e.g. warehouse.execute(sql, {"tier": tier, "start_date": start_date}) with :tier / :start_date bind variables)'

**must_not_have:**
- ❌ Verdict is APPROVE or COMMENT while a CRITICAL security issue exists.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE or COMMENT.
- ❌ Treats this as a minor 'consider using parameterized queries' suggestion rather than naming SQL injection.
  - _Evidence:_ Explicitly named as CRITICAL SQL injection with attack examples (UNION/DROP, OR '1'='1').

### ✅ PASS — `pr_203_catches_logic_error`

_Agent correctly identifies the or/and logic bug as critical, requests changes, and explicitly notes all three conditions must hold. Bonus catch on the days//30 month computation._

**must_have:**
- ✅ Identifies the use of `or` where `and` was required for the eligibility check.
  - _Evidence:_ 'Eligibility uses OR instead of AND' and 'return has_tenure or clean_delinquency or fico_ok' with fix to use `and`.
- ✅ Severity is rated MAJOR or CRITICAL (financial correctness; impacts approvals materially).
  - _Evidence:_ '🔴 CRITICAL — Eligibility uses OR instead of AND' and 'Severity ceiling: critical'.
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ 'Verdict: REQUEST CHANGES'.
- ✅ Notes that the description requires ALL THREE preconditions (tenure AND clean-delinquency AND fico-floor).
  - _Evidence:_ 'Standard tier requires ALL three conditions: 18+ months tenure, no >30dpd in last 12mo, AND FICO ≥ floor'.

**must_not_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE.
- ✅ Treats this as a minor code-clarity issue.
  - _Evidence:_ Rated CRITICAL with material risk framing, not minor.

### ✅ PASS — `pr_204_catches_resource_leak`

_Agent correctly identifies the cursor leak as MINOR with appropriate context manager fix, and also catches other significant issues (overwriting snapshots, OOM risk, missing CSV header)._

**must_have:**
- ✅ Identifies that the DB cursor (and/or the S3 client) is opened but not closed, causing a resource leak.
  - _Evidence:_ MINOR — DB cursor never closed (resource leak): 'A new cursor is acquired per table in the loop but never closed/returned to the pool.'
- ✅ Severity is rated MAJOR or MINOR.
  - _Evidence:_ Rated as 🟡 MINOR
- ✅ Proposes a fix that uses a context manager (`with db_pool.cursor() as cursor:`) or explicit cleanup.
  - _Evidence:_ Fix: Use `with db_pool.cursor() as cursor:` (if supported) or wrap in try/finally with `cursor.close()`.

**must_not_have:**
- ✅ Verdict is APPROVE without acknowledging the leak.
  - _Evidence:_ Verdict: REQUEST CHANGES, and leak is acknowledged

### ✅ PASS — `pr_205_no_false_positives_on_clean_types`

_Agent correctly approves a clean type-hint PR with no fabricated findings and explicitly notes absence of major+ issues._

**must_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ 'Verdict:          APPROVE'
- ✅ No CRITICAL or MAJOR findings.
  - _Evidence:_ 'Bugs found:       0' and 'Severity ceiling: none'
- ✅ Output explicitly states no major+ issues (e.g. 'No issues found at major+ severity') OR returns an empty findings array.
  - _Evidence:_ 'No issues found at major+ severity.'

**must_not_have:**
- ❌ Three or more findings of any severity (indicates the agent is nitpicking).
  - _Evidence:_ Zero findings reported.
- ❌ MAJOR or CRITICAL findings invented to make the review look productive.
  - _Evidence:_ No findings invented; only 'VERIFIED SAFE' notes.

### ✅ PASS — `pr_206_no_false_positives_on_logging`

_Agent correctly approved the additive logging PR with no invented issues and no regression framing._

**must_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ 'Verdict:          APPROVE'
- ✅ No CRITICAL or MAJOR findings.
  - _Evidence:_ 'Bugs found: 0', 'Severity ceiling: none', 'No issues found at major+ severity.'

**must_not_have:**
- ✅ MAJOR or CRITICAL findings invented (false positives).
  - _Evidence:_ No findings reported; only verified-safe observations.
- ✅ Suggests removing the log line or treating it as a regression.
  - _Evidence:_ Log line is described as 'additive and does not change return value'; no removal suggested.
