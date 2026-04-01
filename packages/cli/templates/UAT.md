# UAT — User Acceptance Testing

**Phase:** {{phase_number}} — {{phase_name}}
**UAT scope:** {{uat_scope}}
**Tester:** {{tester_name}}
**Started:** {{uat_start_date}}
**Completed:** {{uat_end_date}}
**Status:** {{uat_status}}
*(pending | in-progress | passed | failed | partial)*

---

## Scope & Goals

**What this UAT covers:**
{{uat_coverage_description}}

**Success definition:**
{{uat_success_definition}}

**Out of scope:**
{{uat_out_of_scope}}

---

## Environment

| Item | Value |
|------|-------|
| OS | {{env_os}} |
| Node version | {{env_node}} |
| Package version | {{env_package_version}} |
| Config | {{env_config}} |
| Test data | {{env_test_data}} |
| Setup command | `{{env_setup_command}}` |

---

## Test Cases

### Feature 1: {{feature_1_name}}

**Scenario:** {{feature_1_scenario}}

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | {{feature_1_step_1_action}} | {{feature_1_step_1_expected}} | {{feature_1_step_1_actual}} | {{feature_1_step_1_status}} |
| 2 | {{feature_1_step_2_action}} | {{feature_1_step_2_expected}} | {{feature_1_step_2_actual}} | {{feature_1_step_2_status}} |
| 3 | {{feature_1_step_3_action}} | {{feature_1_step_3_expected}} | {{feature_1_step_3_actual}} | {{feature_1_step_3_status}} |

**Notes:** {{feature_1_notes}}
**Status:** {{feature_1_status}}

---

### Feature 2: {{feature_2_name}}

**Scenario:** {{feature_2_scenario}}

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | {{feature_2_step_1_action}} | {{feature_2_step_1_expected}} | {{feature_2_step_1_actual}} | {{feature_2_step_1_status}} |
| 2 | {{feature_2_step_2_action}} | {{feature_2_step_2_expected}} | {{feature_2_step_2_actual}} | {{feature_2_step_2_status}} |
| 3 | {{feature_2_step_3_action}} | {{feature_2_step_3_expected}} | {{feature_2_step_3_actual}} | {{feature_2_step_3_status}} |

**Notes:** {{feature_2_notes}}
**Status:** {{feature_2_status}}

---

### Feature 3: {{feature_3_name}}

**Scenario:** {{feature_3_scenario}}

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | {{feature_3_step_1_action}} | {{feature_3_step_1_expected}} | {{feature_3_step_1_actual}} | {{feature_3_step_1_status}} |
| 2 | {{feature_3_step_2_action}} | {{feature_3_step_2_expected}} | {{feature_3_step_2_actual}} | {{feature_3_step_2_status}} |

**Notes:** {{feature_3_notes}}
**Status:** {{feature_3_status}}

---

## Edge Cases

| Case | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| {{edge_1_case}} | `{{edge_1_input}}` | {{edge_1_expected}} | {{edge_1_actual}} | {{edge_1_status}} |
| {{edge_2_case}} | `{{edge_2_input}}` | {{edge_2_expected}} | {{edge_2_actual}} | {{edge_2_status}} |
| {{edge_3_case}} | `{{edge_3_input}}` | {{edge_3_expected}} | {{edge_3_actual}} | {{edge_3_status}} |
| {{edge_4_case}} | `{{edge_4_input}}` | {{edge_4_expected}} | {{edge_4_actual}} | {{edge_4_status}} |

---

## Error Handling

| Error Scenario | Trigger | Expected Message | Actual | Status |
|----------------|---------|-----------------|--------|--------|
| {{error_1_scenario}} | {{error_1_trigger}} | {{error_1_expected}} | {{error_1_actual}} | {{error_1_status}} |
| {{error_2_scenario}} | {{error_2_trigger}} | {{error_2_expected}} | {{error_2_actual}} | {{error_2_status}} |
| {{error_3_scenario}} | {{error_3_trigger}} | {{error_3_expected}} | {{error_3_actual}} | {{error_3_status}} |

---

## Issues Found

| # | Severity | Feature | Description | Steps to Reproduce | Status |
|---|----------|---------|-------------|-------------------|--------|
| {{issue_1_id}} | {{issue_1_severity}} | {{issue_1_feature}} | {{issue_1_description}} | {{issue_1_steps}} | {{issue_1_status}} |
| {{issue_2_id}} | {{issue_2_severity}} | {{issue_2_feature}} | {{issue_2_description}} | {{issue_2_steps}} | {{issue_2_status}} |

*Severity: P0 (blocker) | P1 (critical) | P2 (major) | P3 (minor) | P4 (cosmetic)*

---

## Overall Results

| Category | Total | Passed | Failed | Blocked | Pass Rate |
|----------|-------|--------|--------|---------|-----------|
| Test cases | {{total_test_cases}} | {{passed_test_cases}} | {{failed_test_cases}} | {{blocked_test_cases}} | {{test_case_pass_rate}} |
| Edge cases | {{total_edge_cases}} | {{passed_edge_cases}} | {{failed_edge_cases}} | {{blocked_edge_cases}} | {{edge_case_pass_rate}} |
| Error handling | {{total_error_cases}} | {{passed_error_cases}} | {{failed_error_cases}} | {{blocked_error_cases}} | {{error_case_pass_rate}} |

**Overall pass rate:** {{overall_pass_rate}}
**UAT verdict:** {{uat_verdict}}
*(PASS | FAIL | CONDITIONAL PASS)*

---

## Per-Requirement Acceptance

Mapping from requirements to UAT test cases. Each requirement must have at least one passing test case before UAT is complete.

| Req ID | Requirement | Test Case IDs | Passing | Status |
|--------|-------------|---------------|---------|--------|
| {{req_1_id}} | {{req_1_description}} | {{req_1_test_ids}} | {{req_1_passing}} | {{req_1_uat_status}} |
| {{req_2_id}} | {{req_2_description}} | {{req_2_test_ids}} | {{req_2_passing}} | {{req_2_uat_status}} |
| {{req_3_id}} | {{req_3_description}} | {{req_3_test_ids}} | {{req_3_passing}} | {{req_3_uat_status}} |
| {{req_4_id}} | {{req_4_description}} | {{req_4_test_ids}} | {{req_4_passing}} | {{req_4_uat_status}} |

**Requirements fully covered:** {{reqs_covered}}/{{reqs_total}}

---

## Test Case Template

*(Copy this block to add a new feature test case)*

```markdown
### Feature N: {{feature_n_name}}

**Req coverage:** {{feature_n_req_ids}}
**Scenario:** {{feature_n_scenario}}

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1    | ...    | ...      |        | pending |

**Notes:**
**Status:** pending
```

---

## Regression Check

Verify that no previously-passing functionality was broken by this phase.

| Area | Test | Expected | Actual | Status |
|------|------|----------|--------|--------|
| {{regression_1_area}} | {{regression_1_test}} | {{regression_1_expected}} | {{regression_1_actual}} | {{regression_1_status}} |
| {{regression_2_area}} | {{regression_2_test}} | {{regression_2_expected}} | {{regression_2_actual}} | {{regression_2_status}} |
| {{regression_3_area}} | {{regression_3_test}} | {{regression_3_expected}} | {{regression_3_actual}} | {{regression_3_status}} |

---

## Sign-off Protocol

### Step 1: Pre-sign-off checklist

Before signing off, verify:

- [ ] All test cases have an actual result (no empty "Actual" cells)
- [ ] All P0 and P1 issues are resolved or explicitly accepted
- [ ] All requirements in scope have at least one passing test case
- [ ] Regression check complete
- [ ] Edge cases confirmed
- [ ] Error handling confirmed

### Step 2: Verdict determination

| Condition | Verdict |
|-----------|---------|
| All test cases pass, no P0/P1 issues | PASS |
| All P0/P1 issues resolved, minor issues accepted | CONDITIONAL PASS |
| Any P0 issue open, or > {{fail_threshold}}% test cases fail | FAIL |

### Step 3: Sign-off record

**Tester:** {{tester_name}}
**Date:** {{signoff_date}}
**Verdict:** {{uat_verdict}}
**Conditions accepted (if CONDITIONAL PASS):**
- {{conditional_condition_1}}
- {{conditional_condition_2}}

**Issues deferred (accepted as known limitations):**
| Issue ID | Description | Deferred To |
|----------|-------------|-------------|
| {{deferred_issue_1_id}} | {{deferred_issue_1_desc}} | {{deferred_issue_1_phase}} |

**Notes:** {{signoff_notes}}

**This UAT record is authoritative.** It overrides any informal approval given verbally or in chat.

---

*UAT document for phase: {{phase_number}}-{{phase_slug}}*
*Written by: /sunco:audit-uat*
*File: .planning/phases/{{phase_number}}-{{phase_slug}}/UAT.md*
