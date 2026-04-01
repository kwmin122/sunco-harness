# {{project_name}}

> {{tagline}}

## Vision

{{vision}}

## Problem

{{problem}}

## Target Users

{{users}}

**Current alternative:** {{current_alternative}}

**Success in 10 minutes:** {{success_metric_10min}}

## Success Metrics

{{metrics}}

## Technical Constraints

{{constraints}}

**Primary stack:** {{tech_stack}}
**Deployment target:** {{deployment_target}}
**Performance requirements:** {{performance_requirements}}

## Goals

{{goals}}

## Key Decisions

These decisions were made during project bootstrap and govern all subsequent phases.
They are locked — changing them requires explicit revision via `/sunco:discuss`.

{{key_decisions}}

---

## Constraints Detail

Constraints that apply across ALL phases and milestones. Every plan must respect these.

### Technical Constraints

| Constraint | Rule | Rationale |
|------------|------|-----------|
| {{tech_constraint_1}} | {{tech_constraint_1_rule}} | {{tech_constraint_1_rationale}} |
| {{tech_constraint_2}} | {{tech_constraint_2_rule}} | {{tech_constraint_2_rationale}} |
| {{tech_constraint_3}} | {{tech_constraint_3_rule}} | {{tech_constraint_3_rationale}} |
| {{tech_constraint_4}} | {{tech_constraint_4_rule}} | {{tech_constraint_4_rationale}} |

### Process Constraints

- {{process_constraint_1}}
- {{process_constraint_2}}
- {{process_constraint_3}}

### Hard Limits

| Area | Limit | Enforcement |
|------|-------|-------------|
| {{limit_1_area}} | {{limit_1_value}} | {{limit_1_enforcement}} |
| {{limit_2_area}} | {{limit_2_value}} | {{limit_2_enforcement}} |
| {{limit_3_area}} | {{limit_3_value}} | {{limit_3_enforcement}} |

---

## Context

Project-level context that informs every decision. Read by planners, researchers, and executors.

### Why this project exists

{{why_exists}}

### Key insight that makes it possible

{{key_insight}}

### What has been tried before

{{prior_attempts}}

*(Empty if greenfield)*

### Non-obvious constraints

{{non_obvious_constraints}}

*(Things that are not in the tech stack docs but will bite implementers)*

---

## Evolution Rules

Rules for how this project's own spec evolves. Changes require an explicit decision — no silent drift.

| Artifact | Who can change it | How | Requires discussion? |
|----------|------------------|-----|---------------------|
| PROJECT.md | Lead + SUNCO | `/sunco:discuss` then manual edit | Yes |
| ROADMAP.md | Lead + SUNCO | `/sunco:phase add` or `/sunco:plan` | Yes |
| REQUIREMENTS.md | Lead + SUNCO | Manual + `/sunco:discuss` | Yes for locked reqs |
| .sun/config.toml | SUNCO via `/sunco:settings` | Automated | No |
| CLAUDE.md | Lead | Manual | Recommended |

**Drift prevention:** If an executor finds PROJECT.md out of sync with what was built, they must flag it in SUMMARY.md. They must NOT silently update PROJECT.md to match their implementation.

---

## Milestone: {{milestone_name}} ({{milestone_version}})

{{milestone_description}}

**Goal:** {{milestone_goal}}
**Exit criteria:** {{milestone_exit_criteria}}
**Target date:** {{milestone_target_date}}

### Milestone progression

| Milestone | Version | Status | Focus |
|-----------|---------|--------|-------|
| {{prev_milestone_name}} | {{prev_milestone_version}} | {{prev_milestone_status}} | {{prev_milestone_focus}} |
| **{{milestone_name}}** | **{{milestone_version}}** | **Active** | **{{milestone_focus}}** |
| {{next_milestone_name}} | {{next_milestone_version}} | Planned | {{next_milestone_focus}} |

---

## Non-Goals

Explicitly out of scope for the entire project (not just the current milestone):

- {{non_goal_1}}
- {{non_goal_2}}
- {{non_goal_3}}

These are captured to prevent well-intentioned scope creep during planning.

---

## Glossary

Terms used consistently throughout planning artifacts.

| Term | Definition |
|------|------------|
| {{term_1}} | {{term_1_definition}} |
| {{term_2}} | {{term_2_definition}} |
| {{term_3}} | {{term_3_definition}} |
| {{term_4}} | {{term_4_definition}} |

---

*Created: {{created_date}}*
*Last updated: {{last_updated}}*
*Bootstrap method: /sunco:new*
