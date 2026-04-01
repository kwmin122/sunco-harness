# Discussion Log — Phase {{phase_number}}

**Phase:** {{phase_number}} — {{phase_name}}
**Discussed:** {{discussion_date}}
**Mode:** {{discussion_mode}}
*(discuss | assumptions)*
**Facilitator:** {{facilitator}}
**Participants:** {{participants}}

> This log is created by `/sunco:discuss {{phase_number}}` and read by `/sunco:plan {{phase_number}}`.
> It captures every question raised and every decision made during the discussion session.
> The planner MUST honor all locked decisions.

---

## Phase Goal Recap

{{phase_goal}}

*Source: .planning/ROADMAP.md Phase {{phase_number}}*

---

## Questions Raised

### Q1: {{question_1_title}}

**Question:** {{question_1_full}}
**Why it matters:** {{question_1_why}}
**Stakes:** {{question_1_stakes}}
*(high | medium | low)*

**Answer:** {{question_1_answer}}
**Decision status:** {{question_1_decision_status}}
*(locked | deferred | open)*

---

### Q2: {{question_2_title}}

**Question:** {{question_2_full}}
**Why it matters:** {{question_2_why}}
**Stakes:** {{question_2_stakes}}

**Answer:** {{question_2_answer}}
**Decision status:** {{question_2_decision_status}}

---

### Q3: {{question_3_title}}

**Question:** {{question_3_full}}
**Why it matters:** {{question_3_why}}
**Stakes:** {{question_3_stakes}}

**Answer:** {{question_3_answer}}
**Decision status:** {{question_3_decision_status}}

---

### Q4: {{question_4_title}}

**Question:** {{question_4_full}}
**Why it matters:** {{question_4_why}}
**Stakes:** {{question_4_stakes}}

**Answer:** {{question_4_answer}}
**Decision status:** {{question_4_decision_status}}

---

## Locked Decisions

Decisions confirmed by the user. The planner MUST implement exactly as stated.

| # | Title | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | {{locked_1_title}} | {{locked_1_decision}} | {{locked_1_rationale}} |
| 2 | {{locked_2_title}} | {{locked_2_decision}} | {{locked_2_rationale}} |
| 3 | {{locked_3_title}} | {{locked_3_decision}} | {{locked_3_rationale}} |
| 4 | {{locked_4_title}} | {{locked_4_decision}} | {{locked_4_rationale}} |

---

## At Claude's Discretion

These areas were discussed but left to the agent's judgment. The planner may choose freely.

- {{discretion_1}}
- {{discretion_2}}
- {{discretion_3}}

---

## Deferred Ideas

These ideas were raised but explicitly excluded from Phase {{phase_number}}.
Do NOT plan or implement these. Log them to backlog if valuable.

| Idea | Reason Deferred | Backlog Status |
|------|----------------|----------------|
| {{deferred_1_idea}} | {{deferred_1_reason}} | {{deferred_1_backlog}} |
| {{deferred_2_idea}} | {{deferred_2_reason}} | {{deferred_2_backlog}} |
| {{deferred_3_idea}} | {{deferred_3_reason}} | {{deferred_3_backlog}} |

---

## Constraints Confirmed

Constraints that emerged from the discussion and must be honored during planning:

- {{confirmed_constraint_1}}
- {{confirmed_constraint_2}}
- {{confirmed_constraint_3}}

---

## Open Questions

These questions could NOT be resolved during discussion. Planning is BLOCKED until resolved.

{{open_questions_list}}

*(Empty means planning can proceed immediately)*

---

## Discussion Metadata

**Total questions raised:** {{total_questions}}
**Locked decisions:** {{locked_count}}
**Deferred ideas:** {{deferred_count}}
**Open blockers:** {{open_blockers}}
**Duration:** {{discussion_duration}}

**Ready for planning:** {{ready_for_planning}}
*(yes | no — resolve open questions first)*

---

*Discussion log for: Phase {{phase_number}}-{{phase_slug}}*
*Created by: /sunco:discuss {{phase_number}}*
*File: .planning/phases/{{phase_number}}-{{phase_slug}}/DISCUSSION.md*
*Read by: /sunco:plan {{phase_number}}*
