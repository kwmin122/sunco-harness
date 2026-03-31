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

---

## Lint Gate

**Status:** {{lint_status}}
*(PASS | FAIL)*

{{lint_details}}

---

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| {{criterion_1}} | {{criterion_1_status}} | {{criterion_1_evidence}} |
| {{criterion_2}} | {{criterion_2_status}} | {{criterion_2_evidence}} |
| {{criterion_3}} | {{criterion_3_status}} | {{criterion_3_evidence}} |

---

## Issues Encountered

{{issues_encountered}}

*(Empty if execution was clean)*

---

## Decisions Made During Execution

These decisions were made during execution and deviate from or extend the original plan.

{{execution_decisions}}

*(Empty if execution followed plan exactly)*

---

## Next Steps

{{next_steps}}

---

*Written by execution agent on: {{written_date}}*
*Plan file: .planning/phases/{{phase_number}}-{{phase_name}}/{{phase_number}}-{{plan_number}}-PLAN.md*
