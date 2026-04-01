# Project State

Live project memory. Updated by SUNCO commands after each significant action. Read by all commands to determine current context.

---

## Current Phase

{{current_phase}}

**Status:** {{phase_status}}
*(not started | in progress | executing | verifying | complete)*

## Current Milestone

{{current_milestone}} — {{milestone_name}}

## Last Action

**Command:** {{last_command}}
**Date:** {{last_action_date}}
**Result:** {{last_action_result}}

## Next Action

{{next_action}}

---

## Progress

| Phase | Name | Status | Plans | Verified |
|-------|------|--------|-------|----------|
| 1 | {{phase_1_name}} | {{phase_1_status}} | {{phase_1_plans}} | {{phase_1_verified}} |
| 2 | {{phase_2_name}} | {{phase_2_status}} | {{phase_2_plans}} | {{phase_2_verified}} |
| 3 | {{phase_3_name}} | {{phase_3_status}} | {{phase_3_plans}} | {{phase_3_verified}} |

**Requirements covered:** {{covered_reqs}}/{{total_reqs}} v1

---

## Decisions

Key decisions made during the project. These inform all future phases.

| Decision | Chosen | Reason | Date |
|----------|--------|--------|------|
| {{decision_1_topic}} | {{decision_1_choice}} | {{decision_1_reason}} | {{decision_1_date}} |
| {{decision_2_topic}} | {{decision_2_choice}} | {{decision_2_reason}} | {{decision_2_date}} |

---

## Blockers

Active issues that must be resolved before the next action can proceed.

{{blockers}}

*(Empty if no blockers)*

---

## Workstreams

Active parallel workstreams (if using `/sunco:workstreams`).

| ID | Name | Phase | Status | Owner |
|----|------|-------|--------|-------|
| {{ws_1_id}} | {{ws_1_name}} | {{ws_1_phase}} | {{ws_1_status}} | {{ws_1_owner}} |

---

## Blocker Detail

Active blockers with resolution tracking. Must be empty before `/sunco:execute` runs.

| ID | Description | Blocking Phase | Reported | Owner | Resolution |
|----|-------------|---------------|----------|-------|------------|
| {{blocker_1_id}} | {{blocker_1_description}} | Phase {{blocker_1_phase}} | {{blocker_1_date}} | {{blocker_1_owner}} | {{blocker_1_resolution}} |
| {{blocker_2_id}} | {{blocker_2_description}} | Phase {{blocker_2_phase}} | {{blocker_2_date}} | {{blocker_2_owner}} | {{blocker_2_resolution}} |

*Owner: human | claude | external*
*Resolution: open | investigating | resolved — <how>*

---

## Session History

Recent sessions for context reconstruction. Latest first.

| Date | Duration | Phase | Commands Run | Outcome |
|------|----------|-------|-------------|---------|
| {{session_1_date}} | {{session_1_duration}} | Phase {{session_1_phase}} | {{session_1_commands}} | {{session_1_outcome}} |
| {{session_2_date}} | {{session_2_duration}} | Phase {{session_2_phase}} | {{session_2_commands}} | {{session_2_outcome}} |
| {{session_3_date}} | {{session_3_duration}} | Phase {{session_3_phase}} | {{session_3_commands}} | {{session_3_outcome}} |
| {{session_4_date}} | {{session_4_duration}} | Phase {{session_4_phase}} | {{session_4_commands}} | {{session_4_outcome}} |

**Total sessions:** {{total_sessions}}
**Total execution time:** {{total_execution_time}}

---

## Progress with Dates

Phase completion tracking with timestamps for timeline analysis.

| Phase | Name | Plans | Started | Completed | Duration |
|-------|------|-------|---------|-----------|----------|
| 1 | {{phase_1_name}} | {{phase_1_plans}} | {{phase_1_started}} | {{phase_1_completed}} | {{phase_1_duration}} |
| 2 | {{phase_2_name}} | {{phase_2_plans}} | {{phase_2_started}} | {{phase_2_completed}} | {{phase_2_duration}} |
| 3 | {{phase_3_name}} | {{phase_3_plans}} | {{phase_3_started}} | {{phase_3_completed}} | {{phase_3_duration}} |

**Milestone velocity:** {{milestone_velocity}}
*(Average time per phase — use to calibrate remaining estimates)*

---

## Workstream Detail

Active parallel workstreams (if using `/sunco:workstreams`).

| ID | Name | Branch | Phase | Status | Diverged | Plans Done |
|----|------|--------|-------|--------|----------|------------|
| {{ws_1_id}} | {{ws_1_name}} | `{{ws_1_branch}}` | Phase {{ws_1_phase}} | {{ws_1_status}} | {{ws_1_diverged}} | {{ws_1_plans}} |
| {{ws_2_id}} | {{ws_2_name}} | `{{ws_2_branch}}` | Phase {{ws_2_phase}} | {{ws_2_status}} | {{ws_2_diverged}} | {{ws_2_plans}} |

*Status: active | paused | merged | abandoned*
*Diverged: commits since branching from main*

**Merge conflicts risk:** {{merge_conflict_risk}}
*(Low | Medium | High — based on file overlap between workstreams)*

---

## Pending Decisions

Decisions that have been raised but not yet resolved. Blocks proceed past current phase.

| # | Question | Context | Options | Deadline |
|---|----------|---------|---------|----------|
| {{pending_1_id}} | {{pending_1_question}} | {{pending_1_context}} | {{pending_1_options}} | {{pending_1_deadline}} |
| {{pending_2_id}} | {{pending_2_question}} | {{pending_2_context}} | {{pending_2_options}} | {{pending_2_deadline}} |

---

## Model Profile

**Current profile:** {{model_profile}}
*(quality | balanced | budget | inherit)*

**Profile history:**

| Changed | From | To | Reason |
|---------|------|----|--------|
| {{profile_change_1_date}} | {{profile_change_1_from}} | {{profile_change_1_to}} | {{profile_change_1_reason}} |

---

## Health Indicators

Quick-read status of the project's mechanical health.

| Indicator | Status | Last Checked |
|-----------|--------|--------------|
| Lint gate | {{health_lint}} | {{health_lint_date}} |
| TypeScript | {{health_tsc}} | {{health_tsc_date}} |
| Tests | {{health_tests}} | {{health_tests_date}} |
| Coverage | {{health_coverage}} | {{health_coverage_date}} |
| Open blockers | {{health_blockers}} | — |

*Status: PASS | FAIL | SKIP | unknown*

---

*State initialized: {{created_date}}*
*Last updated: {{last_updated}} by {{last_updated_by}}*
