---
phase: {{phase_number}}-{{phase_slug}}
plan: {{plan_number}}
type: execute
wave: {{wave_number}}
depends_on: {{depends_on}}
files_modified: {{files_modified}}
autonomous: {{autonomous}}
requirements: {{requirements}}
user_setup: {{user_setup}}

must_haves:
  truths: {{must_have_truths}}
  artifacts: {{must_have_artifacts}}
  key_links: {{must_have_key_links}}
---

# Phase {{phase_number}}-{{plan_number}} Execution Prompt

> This file is the executable agent prompt for Plan {{plan_number}} of Phase {{phase_number}}.
> It is created by `/sunco:plan {{phase_number}}` and consumed by `/sunco:execute {{phase_number}}`.
> Naming convention: `{{phase_number}}-{{plan_number}}-PLAN.md`

---

<objective>
{{objective}}

**Purpose:** {{purpose}}
**Output:** {{output_artifacts}}
**Requirements fulfilled:** {{requirements_covered}}
**Phase goal contribution:** {{phase_goal_contribution}}
</objective>

---

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/{{phase_number}}-{{phase_slug}}/CONTEXT.md

{{#if prior_plan_summaries}}
<!-- Prior plan summaries referenced only when genuine dependency exists -->
{{prior_plan_summaries}}
{{/if}}

<!-- Relevant source files for this plan -->
{{relevant_source_files}}
</execution_context>

---

<harness>
## Execution Harness

Before starting any task:
1. Read all files listed in `<execution_context>` above
2. Verify you understand the phase goal and how this plan contributes
3. Do NOT start Task N+1 before Task N is complete and verified
4. After ALL tasks: run verification checklist and write SUMMARY.md

**Lint gate:** `/sunco:lint` must pass with zero errors before declaring complete.
**Type gate:** `npx tsc --noEmit` must pass with zero errors.
**Test gate:** `{{test_command}}` must pass (or new tests added where none existed).
</harness>

---

<tasks>

<task id="{{phase_number}}-{{plan_number}}-01" type="{{task_1_type}}">
  <name>{{task_1_name}}</name>
  <files>{{task_1_files}}</files>
  <read_first>{{task_1_read_first}}</read_first>
  <action>
    {{task_1_action}}

    **Concrete values:**
    - {{task_1_concrete_value_1}}
    - {{task_1_concrete_value_2}}

    **Do NOT:**
    - {{task_1_dont_1}}
    - {{task_1_dont_2}}
  </action>
  <verify>{{task_1_verify_command}}</verify>
  <acceptance_criteria>
    - {{task_1_criterion_1}}
    - {{task_1_criterion_2}}
    - {{task_1_criterion_3}}
  </acceptance_criteria>
  <done>{{task_1_done_condition}}</done>
</task>

<task id="{{phase_number}}-{{plan_number}}-02" type="{{task_2_type}}">
  <name>{{task_2_name}}</name>
  <files>{{task_2_files}}</files>
  <read_first>{{task_2_read_first}}</read_first>
  <action>
    {{task_2_action}}

    **Concrete values:**
    - {{task_2_concrete_value_1}}
    - {{task_2_concrete_value_2}}

    **Do NOT:**
    - {{task_2_dont_1}}
  </action>
  <verify>{{task_2_verify_command}}</verify>
  <acceptance_criteria>
    - {{task_2_criterion_1}}
    - {{task_2_criterion_2}}
  </acceptance_criteria>
  <done>{{task_2_done_condition}}</done>
</task>

<task id="{{phase_number}}-{{plan_number}}-03" type="{{task_3_type}}">
  <name>{{task_3_name}}</name>
  <files>{{task_3_files}}</files>
  <read_first>{{task_3_read_first}}</read_first>
  <action>
    {{task_3_action}}
  </action>
  <verify>{{task_3_verify_command}}</verify>
  <acceptance_criteria>
    - {{task_3_criterion_1}}
    - {{task_3_criterion_2}}
  </acceptance_criteria>
  <done>{{task_3_done_condition}}</done>
</task>

<!-- Checkpoint task example — use when human decision or verification is required -->
<!--
<task id="{{phase_number}}-{{plan_number}}-04" type="checkpoint:decision" gate="blocking">
  <decision>{{checkpoint_decision_question}}</decision>
  <context>{{checkpoint_decision_context}}</context>
  <options>
    <option id="option-a">
      <name>{{option_a_name}}</name>
      <pros>{{option_a_pros}}</pros>
      <cons>{{option_a_cons}}</cons>
    </option>
    <option id="option-b">
      <name>{{option_b_name}}</name>
      <pros>{{option_b_pros}}</pros>
      <cons>{{option_b_cons}}</cons>
    </option>
  </options>
  <resume-signal>Select: option-a or option-b</resume-signal>
</task>
-->

<!-- Human-verify checkpoint example — use when visual/runtime check needed -->
<!--
<task id="{{phase_number}}-{{plan_number}}-05" type="checkpoint:human-verify" gate="blocking">
  <what-built>{{what_was_built}}</what-built>
  <how-to-verify>{{how_to_verify_instructions}}</how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
-->

</tasks>

---

<verification>
## Pre-Completion Checklist

Before declaring this plan complete, verify ALL of the following:

- [ ] {{verification_check_1}}
- [ ] {{verification_check_2}}
- [ ] {{verification_check_3}}
- [ ] `/sunco:lint` passes with zero errors
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `{{test_command}}` passes (or new tests written)
- [ ] No `TODO`, `FIXME`, or `placeholder` comments left in modified files
- [ ] All acceptance criteria from every task confirmed
- [ ] No files modified outside `files_modified` list (unless justified)
</verification>

---

<success_criteria>
## Plan Success Criteria

This plan is complete when:

- [ ] {{success_criterion_1}}
- [ ] {{success_criterion_2}}
- [ ] {{success_criterion_3}}
- [ ] All tasks completed and individually verified
- [ ] Verification checklist above is fully checked
- [ ] SUMMARY.md written to `.planning/phases/{{phase_number}}-{{phase_slug}}/{{phase_number}}-{{plan_number}}-SUMMARY.md`
</success_criteria>

---

<output>
After completion, write:
`.planning/phases/{{phase_number}}-{{phase_slug}}/{{phase_number}}-{{plan_number}}-SUMMARY.md`

Use the summary.md template format. Include:
- All tasks completed with status and commit hashes
- Files modified (created / modified / deleted counts)
- Test results summary
- Lint gate status
- Acceptance criteria verification table
- Any issues encountered or deviations from plan
- Decisions made during execution
</output>

---

## Frontmatter Reference

| Field | Required | Purpose |
|-------|----------|---------|
| `phase` | Yes | Phase identifier (e.g., `01-foundation`) |
| `plan` | Yes | Plan number within phase (e.g., `01`, `02`) |
| `type` | Yes | `execute` for standard, `tdd` for TDD plans |
| `wave` | Yes | Execution wave number (1, 2, 3...). Pre-computed at plan time. |
| `depends_on` | Yes | Array of plan IDs this plan requires. `[]` for Wave 1. |
| `files_modified` | Yes | All files this plan creates or modifies. |
| `autonomous` | Yes | `true` if no checkpoints, `false` if has checkpoints |
| `requirements` | Yes | Requirement IDs from ROADMAP. MUST NOT be empty. |
| `user_setup` | No | Array of human-required setup items (external services) |
| `must_haves.truths` | Yes | Observable behaviors that must be true after execution |
| `must_haves.artifacts` | Yes | Files that must exist with real implementation |
| `must_haves.key_links` | Yes | Critical connections between artifacts |

## Wave Assignment Rules

**Wave 1 (parallel):** Plans with `depends_on: []` and no file conflicts.
**Wave N+1 (sequential):** Plans that depend on Wave N output or share files.

Two plans can run in parallel if they:
1. Have no entries in `depends_on` pointing to each other
2. Have zero overlap in `files_modified`
3. Do not consume each other's exports

## Task Type Reference

| Type | When to Use |
|------|-------------|
| `auto` | Standard implementation task, no human input needed |
| `tdd` | Write failing tests first, then implement to pass |
| `checkpoint:decision` | Gate on a human architectural choice |
| `checkpoint:human-verify` | Gate on visual/runtime verification |
| `checkpoint:user-setup` | Gate on human action (API keys, account setup) |

---

*Plan {{phase_number}}-{{plan_number}} created by: /sunco:plan {{phase_number}}*
*Expected executor: /sunco:execute {{phase_number}}*
*Created: {{created_date}}*
