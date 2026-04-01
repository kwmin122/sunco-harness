# Phase {{phase_number}}-{{plan_number}} Execution Summary

**Plan title:** {{plan_title}}
**Wave:** {{wave_number}}
**Completed:** {{completion_date}}
**Agent session duration:** {{duration}}

---

## Tasks Completed

| Task | Name | Status | Commit |
|------|------|--------|--------|
| {{phase_number}}-{{plan_number}}-01 | {{task_1_name}} | {{task_1_status}} | {{task_1_commit}} |
| {{phase_number}}-{{plan_number}}-02 | {{task_2_name}} | {{task_2_status}} | {{task_2_commit}} |
| {{phase_number}}-{{plan_number}}-03 | {{task_3_name}} | {{task_3_status}} | {{task_3_commit}} |

**Overall:** {{completed_count}}/{{total_count}} tasks completed

---

## Files Modified

```
{{files_modified_list}}
```

**Files created (new):** {{created_count}}
**Files modified (existing):** {{modified_count}}
**Files deleted:** {{deleted_count}}

---

## Tests Status

```
{{test_output_summary}}
```

**Passed:** {{tests_passed}}
**Failed:** {{tests_failed}}
**New tests added:** {{new_tests}}
**Coverage delta:** {{coverage_delta}}

---

## Lint Gate

**Status:** {{lint_status}}
*(PASS | FAIL)*

{{lint_details}}

---

## TypeScript Gate

**Status:** {{tsc_status}}
*(PASS | FAIL)*

{{tsc_details}}

---

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| {{criterion_1}} | {{criterion_1_status}} | {{criterion_1_evidence}} |
| {{criterion_2}} | {{criterion_2_status}} | {{criterion_2_evidence}} |
| {{criterion_3}} | {{criterion_3_status}} | {{criterion_3_evidence}} |

*Status: ✓ VERIFIED | ✗ FAILED | ⚠️ PARTIAL*

---

## Must-Haves Verification

Derived from PLAN.md frontmatter. All must be true for plan to count as complete.

### Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | {{truth_1}} | {{truth_1_status}} | {{truth_1_evidence}} |
| 2 | {{truth_2}} | {{truth_2_status}} | {{truth_2_evidence}} |

### Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `{{artifact_1}}` | {{artifact_1_status}} | {{artifact_1_details}} |
| `{{artifact_2}}` | {{artifact_2_status}} | {{artifact_2_details}} |

### Key Links

| From | To | Status | Evidence |
|------|----|--------|----------|
| {{link_1_from}} | {{link_1_to}} | {{link_1_status}} | {{link_1_evidence}} |
| {{link_2_from}} | {{link_2_to}} | {{link_2_status}} | {{link_2_evidence}} |

---

## Acceptance Criteria Evidence Table

Full evidence for each acceptance criterion from the PLAN.md. This table is what `/sunco:verify` reads to confirm the plan is genuinely complete — not just claimed complete.

| # | Criterion | Verification Method | Evidence (command + output excerpt) | Status |
|---|-----------|--------------------|------------------------------------|--------|
| 1 | {{ac_1_criterion}} | {{ac_1_method}} | `{{ac_1_evidence_command}}` → {{ac_1_evidence_output}} | {{ac_1_status}} |
| 2 | {{ac_2_criterion}} | {{ac_2_method}} | `{{ac_2_evidence_command}}` → {{ac_2_evidence_output}} | {{ac_2_status}} |
| 3 | {{ac_3_criterion}} | {{ac_3_method}} | `{{ac_3_evidence_command}}` → {{ac_3_evidence_output}} | {{ac_3_status}} |
| 4 | {{ac_4_criterion}} | {{ac_4_method}} | `{{ac_4_evidence_command}}` → {{ac_4_evidence_output}} | {{ac_4_status}} |

*Verification methods: run-command | read-file | visual-inspect | test-case | type-check*
*Status: ✓ VERIFIED | ✗ FAILED | ⚠️ PARTIAL | ? NEEDS HUMAN*

---

## Technical Debt Introduced

New debt created during execution of this plan. Log it now — do not silently accept it.

| Item | File | Description | Severity | Recommended Fix Phase |
|------|------|-------------|----------|----------------------|
| {{debt_1_item}} | `{{debt_1_file}}` | {{debt_1_description}} | {{debt_1_severity}} | {{debt_1_fix_phase}} |
| {{debt_2_item}} | `{{debt_2_file}}` | {{debt_2_description}} | {{debt_2_severity}} | {{debt_2_fix_phase}} |

*Severity: high — impacts correctness | medium — impacts maintainability | low — cosmetic*

*(Empty if no debt introduced)*

---

## Issues Encountered

{{issues_encountered}}

*(Empty if execution was clean)*

---

## Decisions Made During Execution

Decisions that deviate from or extend the original plan. Each must be justified.

| Decision | Original Plan Said | What Was Done Instead | Reason | Impact |
|----------|-------------------|----------------------|--------|--------|
| {{exec_decision_1}} | {{exec_decision_1_original}} | {{exec_decision_1_actual}} | {{exec_decision_1_reason}} | {{exec_decision_1_impact}} |
| {{exec_decision_2}} | {{exec_decision_2_original}} | {{exec_decision_2_actual}} | {{exec_decision_2_reason}} | {{exec_decision_2_impact}} |

*(Empty if execution followed plan exactly)*

---

## Next Steps

Immediate next actions following this plan's completion.

| Priority | Action | Command | Depends On |
|----------|--------|---------|------------|
| 1 | {{next_1_action}} | `{{next_1_command}}` | {{next_1_depends}} |
| 2 | {{next_2_action}} | `{{next_2_command}}` | {{next_2_depends}} |
| 3 | {{next_3_action}} | `{{next_3_command}}` | {{next_3_depends}} |

**Recommended immediate next command:** `{{recommended_next_command}}`

---

## Scope Drift Log

Items that were almost implemented but held back as out of scope. Prevents re-discovery.

| Item | Why Out of Scope | Route To |
|------|-----------------|----------|
| {{drift_1_item}} | {{drift_1_reason}} | {{drift_1_route}} |
| {{drift_2_item}} | {{drift_2_reason}} | {{drift_2_route}} |

*(Empty if executor stayed within plan scope)*

---

*Written by execution agent on: {{written_date}}*
*Plan file: .planning/phases/{{phase_number}}-{{phase_slug}}/{{phase_number}}-{{plan_number}}-PLAN.md*
*Agent session ID: {{agent_session_id}}*
