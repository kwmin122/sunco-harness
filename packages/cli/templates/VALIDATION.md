# Validation Report — Nyquist Test Coverage Audit

**Phase:** {{phase_number}} — {{phase_name}}
**Audited:** {{audit_date}}
**Auditor:** {{auditor}}
*(Claude subagent | human | both)*
**Coverage tool:** {{coverage_tool}}
**Threshold required:** {{coverage_threshold}}%
**Status:** {{validation_status}}
*(passing | failing | partial)*

---

## Coverage Matrix

### Unit Tests

| Module | File | Lines | Branches | Functions | Statements | Status |
|--------|------|-------|----------|-----------|------------|--------|
| {{unit_1_module}} | `{{unit_1_file}}` | {{unit_1_lines}}% | {{unit_1_branches}}% | {{unit_1_functions}}% | {{unit_1_statements}}% | {{unit_1_status}} |
| {{unit_2_module}} | `{{unit_2_file}}` | {{unit_2_lines}}% | {{unit_2_branches}}% | {{unit_2_functions}}% | {{unit_2_statements}}% | {{unit_2_status}} |
| {{unit_3_module}} | `{{unit_3_file}}` | {{unit_3_lines}}% | {{unit_3_branches}}% | {{unit_3_functions}}% | {{unit_3_statements}}% | {{unit_3_status}} |
| {{unit_4_module}} | `{{unit_4_file}}` | {{unit_4_lines}}% | {{unit_4_branches}}% | {{unit_4_functions}}% | {{unit_4_statements}}% | {{unit_4_status}} |

**Unit test aggregate:** Lines {{unit_total_lines}}% | Branches {{unit_total_branches}}% | Functions {{unit_total_functions}}%

### Integration Tests

| Suite | File | Scenarios | Passing | Coverage Area | Status |
|-------|------|-----------|---------|---------------|--------|
| {{int_1_suite}} | `{{int_1_file}}` | {{int_1_scenarios}} | {{int_1_passing}} | {{int_1_area}} | {{int_1_status}} |
| {{int_2_suite}} | `{{int_2_file}}` | {{int_2_scenarios}} | {{int_2_passing}} | {{int_2_area}} | {{int_2_status}} |
| {{int_3_suite}} | `{{int_3_file}}` | {{int_3_scenarios}} | {{int_3_passing}} | {{int_3_area}} | {{int_3_status}} |

**Integration test aggregate:** {{int_total_passing}}/{{int_total_scenarios}} scenarios passing

### Edge Case Tests

| Case | Test ID | Description | Status | Notes |
|------|---------|-------------|--------|-------|
| {{edge_1_case}} | `{{edge_1_id}}` | {{edge_1_description}} | {{edge_1_status}} | {{edge_1_notes}} |
| {{edge_2_case}} | `{{edge_2_id}}` | {{edge_2_description}} | {{edge_2_status}} | {{edge_2_notes}} |
| {{edge_3_case}} | `{{edge_3_id}}` | {{edge_3_description}} | {{edge_3_status}} | {{edge_3_notes}} |
| {{edge_4_case}} | `{{edge_4_id}}` | {{edge_4_description}} | {{edge_4_status}} | {{edge_4_notes}} |
| {{edge_5_case}} | `{{edge_5_id}}` | {{edge_5_description}} | {{edge_5_status}} | {{edge_5_notes}} |

### Failure / Error Path Tests

| Error Scenario | Test ID | Trigger | Expected Behavior | Status |
|----------------|---------|---------|-------------------|--------|
| {{fail_1_scenario}} | `{{fail_1_id}}` | {{fail_1_trigger}} | {{fail_1_expected}} | {{fail_1_status}} |
| {{fail_2_scenario}} | `{{fail_2_id}}` | {{fail_2_trigger}} | {{fail_2_expected}} | {{fail_2_status}} |
| {{fail_3_scenario}} | `{{fail_3_id}}` | {{fail_3_trigger}} | {{fail_3_expected}} | {{fail_3_status}} |
| {{fail_4_scenario}} | `{{fail_4_id}}` | {{fail_4_trigger}} | {{fail_4_expected}} | {{fail_4_status}} |

---

## Per-Requirement Test Mapping

For each requirement listed in REQUIREMENTS.md, the tests that verify it.

| Req ID | Description | Test IDs | Test Count | Status |
|--------|-------------|----------|------------|--------|
| {{req_1_id}} | {{req_1_description}} | {{req_1_test_ids}} | {{req_1_test_count}} | {{req_1_status}} |
| {{req_2_id}} | {{req_2_description}} | {{req_2_test_ids}} | {{req_2_test_count}} | {{req_2_status}} |
| {{req_3_id}} | {{req_3_description}} | {{req_3_test_ids}} | {{req_3_test_count}} | {{req_3_status}} |
| {{req_4_id}} | {{req_4_description}} | {{req_4_test_ids}} | {{req_4_test_count}} | {{req_4_status}} |
| {{req_5_id}} | {{req_5_description}} | {{req_5_test_ids}} | {{req_5_test_count}} | {{req_5_status}} |

*Status: ✓ Covered | ✗ Uncovered | ⚠️ Partial*

**Total requirements:** {{total_reqs}}
**Covered:** {{covered_reqs}}
**Partially covered:** {{partial_reqs}}
**Uncovered:** {{uncovered_reqs}}

---

## Gap Analysis

### Critical Gaps (must fix before ship)

| Gap | Module | Missing Test Type | Risk | Recommended Test |
|-----|--------|------------------|------|-----------------|
| {{crit_gap_1_gap}} | `{{crit_gap_1_module}}` | {{crit_gap_1_type}} | {{crit_gap_1_risk}} | {{crit_gap_1_recommendation}} |
| {{crit_gap_2_gap}} | `{{crit_gap_2_module}}` | {{crit_gap_2_type}} | {{crit_gap_2_risk}} | {{crit_gap_2_recommendation}} |

### Non-Critical Gaps (defer or accept)

| Gap | Module | Missing Test Type | Risk | Decision |
|-----|--------|------------------|------|----------|
| {{minor_gap_1_gap}} | `{{minor_gap_1_module}}` | {{minor_gap_1_type}} | {{minor_gap_1_risk}} | {{minor_gap_1_decision}} |
| {{minor_gap_2_gap}} | `{{minor_gap_2_module}}` | {{minor_gap_2_type}} | {{minor_gap_2_risk}} | {{minor_gap_2_decision}} |

### Untested Branches

Branches reported by coverage tool with < {{branch_threshold}}% coverage:

```
{{untested_branches_output}}
```

---

## Threshold Scores

| Metric | Required | Actual | Delta | Status |
|--------|----------|--------|-------|--------|
| Line coverage | {{threshold_lines}}% | {{actual_lines}}% | {{delta_lines}}% | {{score_lines_status}} |
| Branch coverage | {{threshold_branches}}% | {{actual_branches}}% | {{delta_branches}}% | {{score_branches_status}} |
| Function coverage | {{threshold_functions}}% | {{actual_functions}}% | {{delta_functions}}% | {{score_functions_status}} |
| Statement coverage | {{threshold_statements}}% | {{actual_statements}}% | {{delta_statements}}% | {{score_statements_status}} |
| Requirements mapped | {{threshold_reqs_mapped}}% | {{actual_reqs_mapped}}% | {{delta_reqs_mapped}}% | {{score_reqs_status}} |

**Overall validation verdict:** {{overall_verdict}}
*(PASS | FAIL | CONDITIONAL PASS)*

**Conditions for conditional pass (if applicable):**
{{conditional_conditions}}

---

## Recommendations

1. {{recommendation_1}}
2. {{recommendation_2}}
3. {{recommendation_3}}

---

*Validation report generated by: /sunco:validate*
*Phase: .planning/phases/{{phase_number}}-{{phase_slug}}/*
*File: .planning/phases/{{phase_number}}-{{phase_slug}}/VALIDATION.md*
*Created: {{created_date}}*
