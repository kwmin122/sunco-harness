# Debug Session — {{session_id}}

**Started:** {{session_start}}
**Last updated:** {{last_updated}}
**Status:** {{debug_status}}
*(active | paused | resolved | abandoned)*
**Severity:** {{severity}}
*(P0-blocker | P1-critical | P2-major | P3-minor)*
**Assigned to:** {{assigned_to}}

---

## Problem Statement

**What is broken:**
{{problem_statement}}

**Expected behavior:**
{{expected_behavior}}

**Actual behavior:**
{{actual_behavior}}

**First observed:**
{{first_observed}}

**Reproducibility:**
{{reproducibility}}
*(always | intermittent | rare | once)*

---

## Reproduction Steps

```
{{reproduction_steps}}
```

**Minimal reproduction command:**
```bash
{{minimal_repro_command}}
```

**Environment:**

| Item | Value |
|------|-------|
| OS | {{env_os}} |
| Node | {{env_node}} |
| Package version | {{env_package_version}} |
| Config | {{env_config}} |
| Branch | {{env_branch}} |
| Last working commit | {{last_working_commit}} |

---

## Error Output

```
{{error_output}}
```

**Stack trace:**
```
{{stack_trace}}
```

**Logs:**
```
{{relevant_logs}}
```

---

## Investigation Log

### Attempt 1 — {{attempt_1_timestamp}}

**Hypothesis:** {{attempt_1_hypothesis}}
**What was checked:** {{attempt_1_checked}}
**Command/action:** `{{attempt_1_command}}`
**Result:** {{attempt_1_result}}
**Conclusion:** {{attempt_1_conclusion}}

---

### Attempt 2 — {{attempt_2_timestamp}}

**Hypothesis:** {{attempt_2_hypothesis}}
**What was checked:** {{attempt_2_checked}}
**Command/action:** `{{attempt_2_command}}`
**Result:** {{attempt_2_result}}
**Conclusion:** {{attempt_2_conclusion}}

---

### Attempt 3 — {{attempt_3_timestamp}}

**Hypothesis:** {{attempt_3_hypothesis}}
**What was checked:** {{attempt_3_checked}}
**Command/action:** `{{attempt_3_command}}`
**Result:** {{attempt_3_result}}
**Conclusion:** {{attempt_3_conclusion}}

---

## Files Suspected

| File | Why Suspected | Examined | Finding |
|------|--------------|---------|---------|
| `{{suspect_file_1}}` | {{suspect_1_why}} | {{suspect_1_examined}} | {{suspect_1_finding}} |
| `{{suspect_file_2}}` | {{suspect_2_why}} | {{suspect_2_examined}} | {{suspect_2_finding}} |
| `{{suspect_file_3}}` | {{suspect_3_why}} | {{suspect_3_examined}} | {{suspect_3_finding}} |

---

## Root Cause

**Status:** {{root_cause_status}}
*(identified | suspected | unknown)*

**Root cause:**
{{root_cause_description}}

**Category:**
{{root_cause_category}}
*(logic-error | race-condition | config | dependency | type-error | missing-null-check | off-by-one | async | import | other)*

**Evidence:**
{{root_cause_evidence}}

---

## Fix

**Fix approach:**
{{fix_approach}}

**Files to change:**
- `{{fix_file_1}}` — {{fix_file_1_change}}
- `{{fix_file_2}}` — {{fix_file_2_change}}

**Fix applied:** {{fix_applied}}
*(yes | no | partial)*

**Fix commit:** {{fix_commit}}

**Verification command:**
```bash
{{fix_verification_command}}
```

**Verification result:** {{fix_verification_result}}

---

## Prevention

**Why this happened:**
{{prevention_why}}

**How to prevent recurrence:**
{{prevention_how}}

**Tests to add:**
- {{prevention_test_1}}
- {{prevention_test_2}}

**Lint rules or guards to add:**
{{prevention_guards}}

---

## Session State (for /sunco:resume)

```json
{{session_state_json}}
```

**Next action when resuming:**
{{next_action}}

**Context to restore:**
{{context_to_restore}}

---

*Debug session: {{session_id}}*
*Started by: /sunco:debug*
*File: .sun/debug/{{session_id}}.md*
