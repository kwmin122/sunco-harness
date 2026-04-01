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

## Task Type Reference (Complete Catalog)

### `auto` — Standard implementation task

No human input required. Agent executes fully autonomously.

Use when:
- The implementation path is clear from context
- No external accounts or services need to be configured
- No visual or UX output needs human approval

```xml
<task id="{{phase_number}}-{{plan_number}}-01" type="auto">
  <name>Implement {{function_name}}</name>
  <files>{{target_file_path}}</files>
  <read_first>{{files_to_read_before_acting}}</read_first>
  <action>
    Create `{{function_name}}` in `{{target_file_path}}` with signature:
    `export function {{function_name}}({{params}}): {{return_type}}`

    Behavior:
    - {{behavior_1}}
    - {{behavior_2}}

    Concrete values:
    - {{concrete_value_1}}
    - {{concrete_value_2}}

    Do NOT:
    - {{dont_1}}
  </action>
  <verify>{{verify_command}}</verify>
  <acceptance_criteria>
    - {{criterion_1}}
    - {{criterion_2}}
  </acceptance_criteria>
  <done>All criteria pass and verify command exits 0</done>
</task>
```

---

### `tdd` — Test-first implementation

Write failing tests first. Then implement until tests pass. Do not implement before tests exist.

Use when:
- Behavior is well-defined and testable
- The plan explicitly requires test-first discipline
- Logic is complex enough that tests serve as design tool

```xml
<task id="{{phase_number}}-{{plan_number}}-02" type="tdd">
  <name>TDD: {{function_or_feature_name}}</name>
  <files>{{source_file}}, {{test_file}}</files>
  <read_first>{{files_to_read}}</read_first>
  <action>
    Step 1 — Write failing tests in `{{test_file}}`:
    - `{{test_case_1_description}}`
    - `{{test_case_2_description}}`
    - `{{test_case_3_description}}`

    Confirm tests fail (red phase):
    `{{test_command}}`

    Step 2 — Implement `{{function_name}}` in `{{source_file}}`:
    {{implementation_description}}

    Step 3 — Confirm tests pass (green phase):
    `{{test_command}}`

    Step 4 — Refactor if needed, confirm still green.
  </action>
  <verify>{{test_command}} -- tests pass</verify>
  <acceptance_criteria>
    - Tests were written before implementation (confirm via commit order)
    - All test cases from Step 1 pass
    - No implementation code predates test code in this task
  </acceptance_criteria>
  <done>All tests pass and implementation matches spec</done>
</task>
```

---

### `checkpoint:decision` — Blocking human choice

Gate on an architectural or product decision that requires human judgment. Execution stops until the human selects an option.

Use when:
- Two or more implementation approaches are valid and the choice has lasting consequences
- The choice affects files outside this plan's `files_modified` list
- The user expressed preference for being in the loop on this type of decision

```xml
<task id="{{phase_number}}-{{plan_number}}-03" type="checkpoint:decision" gate="blocking">
  <decision>{{decision_question}}</decision>
  <context>
    {{why_this_decision_matters}}
    Current state: {{current_state_description}}
    This choice affects: {{downstream_impact}}
  </context>
  <options>
    <option id="option-a">
      <name>{{option_a_name}}</name>
      <description>{{option_a_description}}</description>
      <pros>{{option_a_pros}}</pros>
      <cons>{{option_a_cons}}</cons>
      <implementation_effort>{{option_a_effort}}</implementation_effort>
    </option>
    <option id="option-b">
      <name>{{option_b_name}}</name>
      <description>{{option_b_description}}</description>
      <pros>{{option_b_pros}}</pros>
      <cons>{{option_b_cons}}</cons>
      <implementation_effort>{{option_b_effort}}</implementation_effort>
    </option>
    <option id="option-c">
      <name>{{option_c_name}}</name>
      <description>{{option_c_description}}</description>
      <pros>{{option_c_pros}}</pros>
      <cons>{{option_c_cons}}</cons>
      <implementation_effort>{{option_c_effort}}</implementation_effort>
    </option>
  </options>
  <recommendation>{{recommended_option}} — {{recommendation_rationale}}</recommendation>
  <resume-signal>Select: option-a, option-b, or option-c</resume-signal>
</task>
```

---

### `checkpoint:human-verify` — Blocking visual or runtime check

Gate on a human reviewing observable output that cannot be verified programmatically. Execution stops until the human approves.

Use when:
- Output is visual (UI, rendered HTML, terminal colors)
- Behavior depends on external state (network, hardware, third-party service)
- The user needs to confirm the UX matches their mental model

```xml
<task id="{{phase_number}}-{{plan_number}}-04" type="checkpoint:human-verify" gate="blocking">
  <what-built>
    {{description_of_what_was_built}}
    Files involved: {{relevant_files}}
  </what-built>
  <how-to-verify>
    1. Run: `{{step_1_command}}`
    2. {{step_2_instruction}}
    3. Verify that: {{what_to_look_for}}
    4. Confirm: {{confirmation_question}}
  </how-to-verify>
  <pass-criteria>{{what_pass_looks_like}}</pass-criteria>
  <fail-criteria>{{what_fail_looks_like}}</fail-criteria>
  <resume-signal>Type "approved" if it looks correct, or describe the issue</resume-signal>
</task>
```

---

### `checkpoint:user-setup` — Human action required

Gate on a human performing an action outside the codebase — account creation, API key retrieval, environment configuration.

Use when:
- External service requires a human to sign up or authenticate
- API keys must be obtained from a third-party dashboard
- A cloud resource must be provisioned before code can run

```xml
<task id="{{phase_number}}-{{plan_number}}-05" type="checkpoint:user-setup" gate="blocking">
  <what-needed>{{what_the_human_must_do}}</what-needed>
  <instructions>
    1. Go to: {{service_url}}
    2. {{setup_step_1}}
    3. {{setup_step_2}}
    4. Copy the value of: {{value_to_copy}}
    5. Add to `.env`: `{{env_var_name}}={{value_to_copy}}`
  </instructions>
  <verify-command>`{{verify_env_command}}` — should output non-empty</verify-command>
  <resume-signal>Type "done" when the environment variable is set and verified</resume-signal>
</task>
```

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

**File conflict detection:** Before finalizing wave assignment, produce a matrix:

```
         Plan-01   Plan-02   Plan-03
Plan-01    —        SAFE      CONFLICT (shared: src/foo.ts)
Plan-02   SAFE       —        SAFE
Plan-03  CONFLICT  SAFE        —
```

Plans with CONFLICT in any cell must be in different waves or have a dependency relationship.

## Execution Context Template

The `<execution_context>` block should always include:

```xml
<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/{{phase_number}}-{{phase_slug}}/CONTEXT.md

<!-- Include research findings when this plan uses an external library or pattern -->
@.planning/phases/{{phase_number}}-{{phase_slug}}/RESEARCH.md

<!-- Include prior plan summaries only when this plan genuinely depends on their output -->
<!-- Pattern: "{{phase_number}}-{{prior_plan_number}}-SUMMARY.md (needed for: {{what_is_needed}})" -->
{{prior_plan_summaries}}

<!-- Specific source files this plan reads or extends -->
{{relevant_source_files}}
</execution_context>
```

**Rule:** Every file listed in `<execution_context>` must be read before the first task begins. The executor must not assume context from memory.

---

## Must-Haves Writing Guide

Writing strong `must_haves` is the difference between a plan that can be verified and one that requires judgment.

### Good truth examples

```yaml
must_haves:
  truths:
    - "Running `node dist/cli.js --version` outputs `{{version}}` with exit code 0"
    - "Running `npx tsc --noEmit` in packages/core exits 0 with no output"
    - "`packages/core/src/index.ts` exports `defineSkill`, `SkillRegistry`, and `loadSkills`"
    - "File `.sun/config.toml` is created by `sunco init` and is valid TOML"
```

### Bad truth examples (do NOT write these)

```yaml
must_haves:
  truths:
    - "The skill system works"              # Not observable
    - "The code is clean"                   # Subjective
    - "Tests pass"                          # Too vague — which tests?
    - "The feature is implemented"          # What does implemented mean?
```

### Good artifact examples

```yaml
must_haves:
  artifacts:
    - "packages/core/src/skill/define-skill.ts — exports defineSkill function with JSDoc"
    - "packages/core/src/skill/registry.ts — SkillRegistry class with register/resolve/list methods"
    - "packages/core/src/__tests__/define-skill.test.ts — minimum 3 test cases, all passing"
```

### Good key_link examples

```yaml
must_haves:
  key_links:
    - "packages/cli/src/main.ts imports defineSkill from packages/core via workspace dep"
    - "SkillRegistry.resolve() called in packages/cli/src/router.ts before command dispatch"
    - "All skill files export default via defineSkill() — no raw Commander commands"
```

---

## Plan Naming Convention

```
{{phase_number}}-01-PLAN.md    # First plan in wave 1
{{phase_number}}-02-PLAN.md    # Second plan in wave 1 (parallel with 01 if no file conflict)
{{phase_number}}-03-PLAN.md    # Third plan (wave 2 if depends on 01 or 02)
{{phase_number}}-FIX-01-PLAN.md   # Fix plan from verification gap
```

Summary files mirror plan files:
```
{{phase_number}}-01-SUMMARY.md   # Written by executor after 01-PLAN.md completes
{{phase_number}}-02-SUMMARY.md   # Written by executor after 02-PLAN.md completes
```

---

*Plan {{phase_number}}-{{plan_number}} created by: /sunco:plan {{phase_number}}*
*Expected executor: /sunco:execute {{phase_number}}*
*Created: {{created_date}}*
