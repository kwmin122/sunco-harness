# Phase {{phase_number}}-{{plan_number}} Execution Summary (Complex)

**Plan title:** {{plan_title}}
**Wave:** {{wave_number}}
**Completed:** {{completion_date}}
**Agent session duration:** {{duration}}
**Complexity:** {{complexity_level}}
*(complex — use this summary format for plans with 5+ tasks, multi-wave dependencies, or significant decisions)*

---

## Executive Summary

{{executive_summary}}

**Net result:** {{net_result}}
**Phase goal contribution:** {{phase_goal_contribution}}

---

## Tasks Completed

| Task | Name | Status | Commit | Notes |
|------|------|--------|--------|-------|
| {{phase_number}}-{{plan_number}}-01 | {{task_1_name}} | {{task_1_status}} | {{task_1_commit}} | {{task_1_notes}} |
| {{phase_number}}-{{plan_number}}-02 | {{task_2_name}} | {{task_2_status}} | {{task_2_commit}} | {{task_2_notes}} |
| {{phase_number}}-{{plan_number}}-03 | {{task_3_name}} | {{task_3_status}} | {{task_3_commit}} | {{task_3_notes}} |
| {{phase_number}}-{{plan_number}}-04 | {{task_4_name}} | {{task_4_status}} | {{task_4_commit}} | {{task_4_notes}} |
| {{phase_number}}-{{plan_number}}-05 | {{task_5_name}} | {{task_5_status}} | {{task_5_commit}} | {{task_5_notes}} |

**Overall:** {{completed_count}}/{{total_count}} tasks completed

---

## Checkpoint Resolutions

*(Only present if plan had checkpoint tasks)*

### Checkpoint {{checkpoint_1_id}}: {{checkpoint_1_title}}

**Type:** {{checkpoint_1_type}}
**Decision made:** {{checkpoint_1_decision}}
**Chosen by:** {{checkpoint_1_chosen_by}}
**Rationale:** {{checkpoint_1_rationale}}
**Impact on remaining tasks:** {{checkpoint_1_impact}}

---

## Files Modified

```
{{files_modified_list}}
```

**Created:** {{created_count}} new files
**Modified:** {{modified_count}} existing files
**Deleted:** {{deleted_count}} files
**Largest changes:** {{largest_changes}}

### Notable New Files

| File | Purpose | Why Created |
|------|---------|------------|
| `{{new_file_1}}` | {{new_file_1_purpose}} | {{new_file_1_why}} |
| `{{new_file_2}}` | {{new_file_2_purpose}} | {{new_file_2_why}} |

---

## Tests

### Test Results

```
{{test_output_full}}
```

| Suite | Passed | Failed | Skipped | Coverage |
|-------|--------|--------|---------|---------|
| {{test_suite_1}} | {{suite_1_passed}} | {{suite_1_failed}} | {{suite_1_skipped}} | {{suite_1_coverage}} |
| {{test_suite_2}} | {{suite_2_passed}} | {{suite_2_failed}} | {{suite_2_skipped}} | {{suite_2_coverage}} |

**New tests written:** {{new_tests}}
**Tests removed:** {{removed_tests}}
**Coverage delta:** {{coverage_delta}}

---

## Quality Gates

| Gate | Command | Status | Output |
|------|---------|--------|--------|
| Lint (architecture) | `/sunco:lint` | {{lint_status}} | {{lint_output}} |
| ESLint | `npx eslint src/` | {{eslint_status}} | {{eslint_output}} |
| TypeScript | `npx tsc --noEmit` | {{tsc_status}} | {{tsc_output}} |
| Tests | `{{test_command}}` | {{test_gate_status}} | {{test_gate_output}} |

---

## Acceptance Criteria

| ID | Criterion | Status | Evidence | Verified By |
|----|-----------|--------|----------|------------|
| {{ac_1_id}} | {{ac_1_criterion}} | {{ac_1_status}} | {{ac_1_evidence}} | {{ac_1_verified_by}} |
| {{ac_2_id}} | {{ac_2_criterion}} | {{ac_2_status}} | {{ac_2_evidence}} | {{ac_2_verified_by}} |
| {{ac_3_id}} | {{ac_3_criterion}} | {{ac_3_status}} | {{ac_3_evidence}} | {{ac_3_verified_by}} |
| {{ac_4_id}} | {{ac_4_criterion}} | {{ac_4_status}} | {{ac_4_evidence}} | {{ac_4_verified_by}} |
| {{ac_5_id}} | {{ac_5_criterion}} | {{ac_5_status}} | {{ac_5_evidence}} | {{ac_5_verified_by}} |

*Status: ✓ VERIFIED | ✗ FAILED | ⚠️ PARTIAL | ? DEFERRED*

---

## Issues Encountered

### Issue 1: {{issue_1_title}}

**Type:** {{issue_1_type}}
*(blocker | time-sink | workaround-needed | surprise)*
**Description:** {{issue_1_description}}
**Resolution:** {{issue_1_resolution}}
**Time lost:** {{issue_1_time_lost}}

---

### Issue 2: {{issue_2_title}}

**Type:** {{issue_2_type}}
**Description:** {{issue_2_description}}
**Resolution:** {{issue_2_resolution}}

---

## Decisions Made During Execution

Decisions that deviate from, extend, or clarify the original plan.

### Decision 1: {{exec_decision_1_title}}

**Context:** {{exec_decision_1_context}}
**Decision:** {{exec_decision_1_decision}}
**Rationale:** {{exec_decision_1_rationale}}
**Impact:** {{exec_decision_1_impact}}

---

### Decision 2: {{exec_decision_2_title}}

**Context:** {{exec_decision_2_context}}
**Decision:** {{exec_decision_2_decision}}
**Rationale:** {{exec_decision_2_rationale}}
**Impact:** {{exec_decision_2_impact}}

---

## Dependencies Introduced

| Package | Version | Why Added | Alternatives Considered |
|---------|---------|-----------|------------------------|
| {{new_dep_1}} | {{new_dep_1_version}} | {{new_dep_1_why}} | {{new_dep_1_alternatives}} |
| {{new_dep_2}} | {{new_dep_2_version}} | {{new_dep_2_why}} | {{new_dep_2_alternatives}} |

---

## Deferred Items

Items from this plan that were explicitly deferred to a future plan.

| Item | Reason | Suggested Plan |
|------|--------|----------------|
| {{deferred_1}} | {{deferred_1_reason}} | {{deferred_1_plan}} |
| {{deferred_2}} | {{deferred_2_reason}} | {{deferred_2_plan}} |

---

## Next Steps

{{next_steps}}

**Blocking the next plan:** {{blocking_next}}
**Recommended next action:** {{recommended_next_action}}

---

*Written by execution agent on: {{written_date}}*
*Plan file: .planning/phases/{{phase_number}}-{{phase_slug}}/{{phase_number}}-{{plan_number}}-PLAN.md*
*Session ID: {{session_id}}*
