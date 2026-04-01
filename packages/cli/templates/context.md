# Phase {{phase_number}} Context

Decisions, constraints, and gray area resolutions for Phase {{phase_number}}. Created by `/sunco:discuss {{phase_number}}`. Read by `/sunco:plan {{phase_number}}` before creating plans.

**Phase name:** {{phase_name}}
**Captured:** {{captured_date}}
**Mode:** {{capture_mode}}
*(discuss | assumptions)*

---

## Phase Goal

{{phase_goal}}

*Source: .planning/ROADMAP.md Phase {{phase_number}}*

## Requirements Covered

{{requirements_covered}}

*(REQ-IDs this phase is responsible for delivering)*

---

## Decisions Made

### {{decision_1_title}}

**Question:** {{decision_1_question}}
**Decision:** {{decision_1_choice}}
**Reason:** {{decision_1_reason}}
**Impact:** {{decision_1_impact}}
**Trade-offs accepted:** {{decision_1_tradeoffs}}

---

### {{decision_2_title}}

**Question:** {{decision_2_question}}
**Decision:** {{decision_2_choice}}
**Reason:** {{decision_2_reason}}
**Impact:** {{decision_2_impact}}
**Trade-offs accepted:** {{decision_2_tradeoffs}}

---

### {{decision_3_title}}

**Question:** {{decision_3_question}}
**Decision:** {{decision_3_choice}}
**Reason:** {{decision_3_reason}}
**Impact:** {{decision_3_impact}}
**Trade-offs accepted:** {{decision_3_tradeoffs}}

---

### {{decision_4_title}}

**Question:** {{decision_4_question}}
**Decision:** {{decision_4_choice}}
**Reason:** {{decision_4_reason}}
**Impact:** {{decision_4_impact}}
**Trade-offs accepted:** {{decision_4_tradeoffs}}

---

## Decisions Table (Quick Reference)

| # | Title | Decision | Locked? |
|---|-------|----------|---------|
| 1 | {{decision_1_title}} | {{decision_1_choice}} | {{decision_1_locked}} |
| 2 | {{decision_2_title}} | {{decision_2_choice}} | {{decision_2_locked}} |
| 3 | {{decision_3_title}} | {{decision_3_choice}} | {{decision_3_locked}} |
| 4 | {{decision_4_title}} | {{decision_4_choice}} | {{decision_4_locked}} |

*Locked = YES: planner MUST honor. Locked = NO: at planner's discretion.*

---

## Constraints

Constraints that apply specifically to this phase's execution.

- {{constraint_1}}
- {{constraint_2}}
- {{constraint_3}}
- {{constraint_4}}
- {{constraint_5}}

---

## Specifics & Concrete Values

Exact values the planner and executor must use. No guessing.

| Item | Value | Source |
|------|-------|--------|
| {{specific_1_item}} | `{{specific_1_value}}` | {{specific_1_source}} |
| {{specific_2_item}} | `{{specific_2_value}}` | {{specific_2_source}} |
| {{specific_3_item}} | `{{specific_3_value}}` | {{specific_3_source}} |
| {{specific_4_item}} | `{{specific_4_value}}` | {{specific_4_source}} |

---

## Canonical References

Files and docs the planner and executor must read before acting.

| Reference | Path | Why |
|-----------|------|-----|
| {{ref_1_name}} | `{{ref_1_path}}` | {{ref_1_why}} |
| {{ref_2_name}} | `{{ref_2_path}}` | {{ref_2_why}} |
| {{ref_3_name}} | `{{ref_3_path}}` | {{ref_3_why}} |

---

## Out of Scope (Phase {{phase_number}})

Things that might seem related but are explicitly excluded from this phase. Named to prevent scope creep during execution.

- {{out_of_scope_1}}
- {{out_of_scope_2}}
- {{out_of_scope_3}}
- {{out_of_scope_4}}

---

## Deferred Ideas

Ideas raised during discussion that were valuable but not ready for this phase.
Logged here so they aren't lost. Do NOT implement these.

| Idea | Why Deferred | Route To |
|------|-------------|---------|
| {{deferred_1_idea}} | {{deferred_1_reason}} | {{deferred_1_route}} |
| {{deferred_2_idea}} | {{deferred_2_reason}} | {{deferred_2_route}} |
| {{deferred_3_idea}} | {{deferred_3_reason}} | {{deferred_3_route}} |

---

## Assumptions (if captured via --mode assumptions)

These were inferred from the codebase and confirmed by the user.

| # | Assumption | Confidence | Confirmed | Source |
|---|-----------|------------|-----------|--------|
| 1 | {{assumption_1}} | {{confidence_1}} | {{confirmed_1}} | {{assumption_1_source}} |
| 2 | {{assumption_2}} | {{confidence_2}} | {{confirmed_2}} | {{assumption_2_source}} |
| 3 | {{assumption_3}} | {{confidence_3}} | {{confirmed_3}} | {{assumption_3_source}} |
| 4 | {{assumption_4}} | {{confidence_4}} | {{confirmed_4}} | {{assumption_4_source}} |

---

## Open Questions

Should be **empty** before `/sunco:plan` runs. If non-empty, resolve before planning.

{{open_questions}}

*(Empty means planning can proceed)*

---

## Pre-Planning Checklist

Before running `/sunco:plan {{phase_number}}`, verify:

- [ ] All locked decisions confirmed by user
- [ ] Specifics table filled with concrete values
- [ ] Canonical references are accessible
- [ ] Out-of-scope list reviewed and agreed
- [ ] Open questions list is empty
- [ ] Deferred ideas routed to backlog

---

*Phase {{phase_number}} context captured by: /sunco:discuss {{phase_number}}*
*Last updated: {{last_updated}}*
*Read by: /sunco:plan {{phase_number}}*
