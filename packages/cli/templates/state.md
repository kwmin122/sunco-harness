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

## Model Profile

**Current profile:** {{model_profile}}
*(quality | balanced | budget | inherit)*

---

*State initialized: {{created_date}}*
*Last updated: {{last_updated}} by {{last_updated_by}}*
