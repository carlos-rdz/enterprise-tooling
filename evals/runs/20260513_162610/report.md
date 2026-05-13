# Eval Report

**Generated:** 2026-05-13T16:29:08.734583+00:00
**Run dir:** `evals/runs/20260513_162610`
**Judge model:** `claude-opus-4-7`

## Summary: 8/8 cases passed

| Skill | Pass | Total |
|---|---|---|
| `pr-reviewer` | 6 | 6 |
| `cross-team` | 2 | 2 |

## Judge token cost

| Field | Value |
|---|---|
| Input tokens | 18,905 |
| Output tokens | 4,518 |
| Cache-read input tokens | 0 |
| Estimated cost (judge only) | $0.2075 |

_Judge cost only. Agent costs are tracked separately by the agent's own logger output._

## `pr-reviewer`

### ✅ PASS — `pr_201_catches_null_deref`

_The review correctly identifies the unguarded None dereference, cites member.tier and member.products specifically, rates it MAJOR, and requests changes. No padding nitpicks._

**must_have:**
- ✅ Identifies that cardmember_svc.lookup(external_id) can return None and the code accesses fields on the result without guarding.
  - _Evidence:_ 'Unguarded None return from cardmember_svc.lookup will crash on unknown external_id' and 'If lookup returns None, this helper will raise AttributeError.'
- ✅ Severity is rated MAJOR or CRITICAL (this is a crash on a common input path).
  - _Evidence:_ '🟠 MAJOR' and 'Severity ceiling: major'
- ✅ Verdict is REQUEST CHANGES (not APPROVE).
  - _Evidence:_ 'Verdict:          REQUEST CHANGES'
- ✅ Cites the specific `member.tier` or `member.products` access as evidence.
  - _Evidence:_ 'immediately dereferenced via `member.tier` and `member.products`' and evidence block showing 'tier': member.tier

**must_not_have:**
- ✅ Verdict is APPROVE while a major-or-critical bug exists.
  - _Evidence:_ Verdict is REQUEST CHANGES.
- ✅ Three or more INFO-level nitpicks (would indicate the agent is padding the review).
  - _Evidence:_ Only one finding listed; 'VERIFIED SAFE' section contains positive checks, no INFO nitpicks.

### ✅ PASS — `pr_202_catches_sql_injection`

_Agent correctly identifies SQLi as critical, requests changes, and proposes parameterized queries plus input validation. Bonus catches on CSV escaping and confusing default date._

**must_have:**
- ✅ Identifies the SQL injection vulnerability from f-string interpolation of request.args values into a raw SQL query.
  - _Evidence:_ 'SQL injection via tier and start_date query params... taken directly from request.args and interpolated into the SQL string with f-string formatting.'
- ✅ Severity is rated CRITICAL.
  - _Evidence:_ '🔴 CRITICAL — SQL injection...'
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ 'Verdict: REQUEST CHANGES'
- ✅ Proposes a fix that uses parameterized queries or bound parameters (warehouse.execute(sql, params)).
  - _Evidence:_ 'Use parameterized queries: warehouse.execute("... WHERE member_tier = %s AND created_at >= %s ...", (tier, start_date))'

**must_not_have:**
- ✅ Verdict is APPROVE or COMMENT while a CRITICAL security issue exists.
  - _Evidence:_ Verdict is REQUEST CHANGES.
- ✅ Treats this as a minor 'consider using parameterized queries' suggestion rather than naming SQL injection.
  - _Evidence:_ Explicitly labels it CRITICAL SQL injection with attack example.

### ✅ PASS — `pr_203_catches_logic_error`

_The agent correctly identified the or/and logic error, rated it MAJOR, requested changes, and explicitly referenced the three required preconditions from the PR description. Fix suggestion and test recommendation are appropriate._

**must_have:**
- ✅ Identifies the use of `or` where `and` was required for the eligibility check.
  - _Evidence:_ 'Eligibility uses OR instead of AND' and evidence quote 'return has_tenure or clean_delinquency or fico_ok'
- ✅ Severity is rated MAJOR or CRITICAL (financial correctness; impacts approvals materially).
  - _Evidence:_ '🟠 MAJOR' and 'Severity ceiling: major'
- ✅ Verdict is REQUEST CHANGES.
  - _Evidence:_ 'Verdict: REQUEST CHANGES'
- ✅ Notes that the description requires ALL THREE preconditions (tenure AND clean-delinquency AND fico-floor).
  - _Evidence:_ 'Standard tier requires tenure AND clean delinquency AND FICO floor'

**must_not_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ Verdict is REQUEST CHANGES, not APPROVE
- ✅ Treats this as a minor code-clarity issue.
  - _Evidence:_ Rated MAJOR and described as 'UDAAP/credit-risk correctness violation'

### ✅ PASS — `pr_204_catches_resource_leak`

_Agent correctly identifies the cursor leak as a MAJOR issue, provides the canonical context-manager fix, and issues REQUEST CHANGES. Also surfaces additional legitimate issues (overwrite key, cross-table consistency, missing header, /tmp cleanup) which add value._

**must_have:**
- ✅ Identifies that the DB cursor (and/or the S3 client) is opened but not closed, causing a resource leak.
  - _Evidence:_ 'Database cursors are never closed' — 'A cursor is acquired from db_pool once per table and never closed (no with block, no cursor.close(), no try/finally).'
- ✅ Severity is rated MAJOR or MINOR.
  - _Evidence:_ The cursor leak finding is tagged '🟠 MAJOR'.
- ✅ Proposes a fix that uses a context manager (`with db_pool.cursor() as cursor:`) or explicit cleanup.
  - _Evidence:_ 'Fix: Use `with db_pool.cursor() as cursor:` (or explicit try/finally with `cursor.close()`).'

**must_not_have:**
- ✅ Verdict is APPROVE without acknowledging the leak.
  - _Evidence:_ Verdict is 'REQUEST CHANGES' and the leak is explicitly called out.

### ✅ PASS — `pr_205_no_false_positives_on_clean_types`

_The agent correctly approved a clean type-annotation PR without inventing issues, and provided concise verification notes._

**must_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ 'Verdict: APPROVE'
- ✅ No CRITICAL or MAJOR findings.
  - _Evidence:_ 'Bugs found: 0' and 'Severity ceiling: none'
- ✅ Output explicitly states no major+ issues (e.g. 'No issues found at major+ severity') OR returns an empty findings array.
  - _Evidence:_ 'No issues found at major+ severity.'

**must_not_have:**
- ✅ Three or more findings of any severity (indicates the agent is nitpicking).
  - _Evidence:_ Zero findings reported.
- ✅ MAJOR or CRITICAL findings invented to make the review look productive.
  - _Evidence:_ No findings invented; only verified-safe notes listed.

### ✅ PASS — `pr_206_no_false_positives_on_logging`

_Agent correctly approved a benign logging PR with zero findings and explicitly noted no behavior change beyond log emission._

**must_have:**
- ✅ Verdict is APPROVE.
  - _Evidence:_ 'Verdict:          APPROVE'
- ✅ No CRITICAL or MAJOR findings.
  - _Evidence:_ 'Bugs found:       0' and 'No issues found at major+ severity.'

**must_not_have:**
- ✅ MAJOR or CRITICAL findings invented (false positives).
  - _Evidence:_ No findings reported; severity ceiling 'none'.
- ✅ Suggests removing the log line or treating it as a regression.
  - _Evidence:_ Output marks log emission as verified safe with no behavior change concerns.

## `cross-team`

### ✅ PASS — `q3_expansion_cross_team_risk`

_The output meets all rubric criteria with specific evidence: it names the four-way biometric collision, calls out the legacy library deprecation, flags UDAAP as critical-path, names specific owners (Hiroshi, Aiko, Brett, Dana, Marcus, Tomás) and ends with a sharp single warning framed as a ship-slip risk. It also adds useful secondary context (servicing FTE, model risk docs) without diluting the critical findings._

**must_have:**
- ✅ Surfaces the biometric collision involving 3 or more of: plan-it, mobile-platform, auth-platform, fraud-risk.
  - _Evidence:_ Section 1 explicitly names all four: plan-it (PLAN-1925), mobile (MOBILE-3501), auth-platform (AUTH-455), and fraud (FRAUD-1120) as colliding on biometrics.
- ✅ Specifically notes that auth-platform is deprecating the legacy biometric shared library mobile-platform is building against.
  - _Evidence:_ 'Mobile... using the legacy biometric shared library' and 'Auth-platform... rewriting the biometric service and deprecating that legacy library, ETA Q3... You will ship on a library that's being deleted under you.'
- ✅ Surfaces UDAAP review not being started (COMP-2026-44) as a critical-path risk.
  - _Evidence:_ 'COMP-2026-44 (Brett Holloway) status: Not Started... That's a hard regulatory gate' and the biggest-warning section is built around it.
- ✅ Names specific owners to contact today (e.g. Hiroshi Sato for auth, Aiko Tanaka for mobile, Brett Holloway for UDAAP).
  - _Evidence:_ 'Hiroshi Sato (auth-platform)', 'Aiko Tanaka' for mobile, 'Brett Holloway (compliance-engineering)' for UDAAP all named in the 'Who you talk to today' list.
- ✅ Provides a single 'biggest warning' framed as 'align this week or ship slips'.
  - _Evidence:_ 'The single biggest warning: If COMP-2026-44 (UDAAP review) is not kicked off this week, FlexPay Standard ships in Q4, not Q3.'

**must_not_have:**
- ✅ Generic 'coordinate with other teams' advice with no specific overlaps named.
  - _Evidence:_ Output is highly specific with ticket IDs (PLAN-1925, AUTH-455, MOBILE-3501, FRAUD-1120, COMP-2026-44) and named owners.
- ✅ Misses the biometric collision entirely.
  - _Evidence:_ Biometric collision is the headline item #1.

### ✅ PASS — `biometric_specific`

_Thorough cross-team analysis correctly identifying all four teams, the legacy-vs-centralized collision, and the fraud signal contract gap._

**must_have:**
- ✅ Names at least three teams from: plan-it (PLAN-1925), mobile-platform (MOBILE-3501), auth-platform (AUTH-455), fraud-risk (FRAUD-1120).
  - _Evidence:_ All four named: AUTH-455 auth-platform, MOBILE-3501 mobile-platform, PLAN-1925 plan-it, FRAUD-1120 fraud-risk.
- ✅ Notes the architectural collision: auth-platform's centralized service ETA Q3 vs mobile-platform's inline integration with the legacy library.
  - _Evidence:_ 'AUTH-455... re-architecting biometric into a centralized service, killing the shared library this quarter' vs 'MOBILE-3501... integrating FaceID into FlexPay using the legacy shared lib... inline calls without consulting auth-platform.'

**must_not_have:**
- ✅ Reports only one team's biometric work as if no others exist.
  - _Evidence:_ Four teams discussed with cross-team dependencies.
