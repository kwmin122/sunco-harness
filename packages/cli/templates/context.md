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

## Constraints

Constraints that apply specifically to this phase's execution.

- {{constraint_1}}
- {{constraint_2}}
- {{constraint_3}}

---

## Out of Scope (Phase {{phase_number}})

Things that might seem related but are explicitly excluded from this phase. Named to prevent scope creep during execution.

- {{out_of_scope_1}}
- {{out_of_scope_2}}
- {{out_of_scope_3}}

---

## Assumptions (if captured via --mode assumptions)

These were inferred from the codebase and confirmed by the user.

| # | Assumption | Confidence | Confirmed |
|---|-----------|------------|-----------|
| 1 | {{assumption_1}} | {{confidence_1}} | {{confirmed_1}} |
| 2 | {{assumption_2}} | {{confidence_2}} | {{confirmed_2}} |
| 3 | {{assumption_3}} | {{confidence_3}} | {{confirmed_3}} |

---

## Open Questions

Should be **empty** before `/sunco:plan` runs. If non-empty, resolve before planning.

{{open_questions}}

*(Empty means planning can proceed)*

---

*Phase {{phase_number}} context captured by: /sunco:discuss {{phase_number}}*
*Last updated: {{last_updated}}*
