<purpose>
Create executable phase plans (PLAN.md files) for a roadmap phase with integrated research, wave assignment, and plan verification. Default flow: Initialize → Check Existing Plans → Research → Create Plans → Verify Plans → Wave Assignment → Write Plans → Commit. Orchestrates sunco-phase-researcher and sunco-plan-checker subagents with a revision loop (max 3 iterations).

**Writing-plans discipline (Superpowers parity):** Every task in this plan MUST be executable by an agent that has zero prior context about this codebase. Assume the executor has read only the files listed in `read_first` and the canonical refs. If a task cannot be completed from its `<action>` text, `<files>` list, and `<acceptance_criteria>` alone, the plan is incomplete — not the executor.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<available_agent_types>
Valid SUNCO subagent types (use exact names — do not fall back to general-purpose):
- sunco-phase-researcher — Researches technical approaches, patterns, and dependencies for a phase
- sunco-plan-checker — Reviews plan quality, coverage, and correctness before execution
</available_agent_types>

<process>

## 1. Initialize

Load project state in a single call:

```bash
INIT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" init plan-phase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON from INIT for: `planning_exists`, `project_root`, `has_git`.

**If `planning_exists` is false:** Error —

```
No .planning/ directory found. Initialize a SUNCO project first:

/sunco:init
```

Exit workflow.

### Artifact Integrity Check

Before proceeding, verify no planning artifacts have been modified since the last operation:

```bash
HASH_CHECK=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash check 2>/dev/null)
```

Parse JSON for `changed` (boolean) and `artifacts` (array).

**If `changed` is true:**
```
⚠ SUNCO detected changes to planning artifacts since last operation:
[list changed files from artifacts array]

Options:
  1) Run impact analysis first (recommended)
  2) Ignore and continue (changes are intentional)
  3) Revert changes
```

Use AskUserQuestion to let user choose. If option 1: invoke impact-analysis workflow and return. If option 3: invoke backtrack workflow and return. If option 2: update hashes and continue.

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash compute 2>/dev/null
```

**If `changed` is false or no stored hashes:** Continue to Parse Arguments.

### Parse Arguments

Extract from $ARGUMENTS:
- Phase number (integer, e.g. `2`) or decimal sub-phase (e.g. `2.1`)
- Flags: `--research`, `--skip-research`, `--gaps`, `--skip-verify`, `--prd <filepath>`, `--auto`

Set `PHASE` to the extracted phase number. If no phase number provided, detect the next unplanned phase from ROADMAP.md (the first phase with no `*-PLAN.md` files in its directory).

Set `GAPS_MODE=true` if `--gaps` flag present.
Set `PRD_MODE=true` if `--prd <filepath>` present. Set `PRD_FILE` to the filepath.
Set `SKIP_RESEARCH=true` if `--skip-research` flag present.
Set `FORCE_RESEARCH=true` if `--research` flag present.
Set `SKIP_VERIFY=true` if `--skip-verify` flag present.
Set `AUTO_MODE=true` if `--auto` flag present.

### Detect Phase Directory

```bash
# Find the phase directory using padded phase number
PADDED_PHASE=$(printf "%02d" "$PHASE")
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* 2>/dev/null | head -1)
```

**If `PHASE_DIR` is empty:** Read ROADMAP.md to validate the phase exists. If found, derive the slug from the phase name:

```bash
# Slugify: lowercase, spaces to hyphens, strip special chars
PHASE_SLUG=$(echo "$PHASE_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')
PHASE_DIR=".planning/phases/${PADDED_PHASE}-${PHASE_SLUG}"
mkdir -p "$PHASE_DIR"
```

If phase not found in ROADMAP.md, error with available phases.

### Detect Existing Artifacts

```bash
HAS_CONTEXT=$(ls "$PHASE_DIR"/*-CONTEXT.md 2>/dev/null | head -1)
HAS_RESEARCH=$(ls "$PHASE_DIR"/*-RESEARCH.md 2>/dev/null | head -1)
HAS_PLANS=$(ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null | head -1)
PLAN_COUNT=$(ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
HAS_VERIFICATION=$(ls "$PHASE_DIR"/*-VERIFICATION.md 2>/dev/null | head -1)
```

Set file path variables for downstream steps:
- `STATE_PATH=.planning/STATE.md`
- `ROADMAP_PATH=.planning/ROADMAP.md`
- `REQUIREMENTS_PATH=.planning/REQUIREMENTS.md`
- `CONTEXT_PATH=$HAS_CONTEXT` (null if empty)
- `RESEARCH_PATH=$HAS_RESEARCH` (null if empty)
- `VERIFICATION_PATH=$HAS_VERIFICATION` (null if empty)

### Read Phase Requirements

```bash
# Extract REQ-IDs assigned to this phase from ROADMAP.md
PHASE_REQ_IDS=$(grep -A 50 "## Phase ${PHASE}" "$ROADMAP_PATH" 2>/dev/null \
  | grep -oE 'REQ-[0-9]+' | sort -u | tr '\n' ', ' | sed 's/,$//')
```

---

## 2. Handle PRD Express Path

**Skip if:** No `--prd` flag in arguments.

**If `PRD_MODE=true`:**

1. Validate PRD file:
```bash
if [ ! -f "$PRD_FILE" ]; then
  echo "Error: PRD file not found: $PRD_FILE"
  exit 1
fi
PRD_CONTENT=$(cat "$PRD_FILE")
```

2. Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► PRD EXPRESS PATH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Using PRD: {PRD_FILE}
Generating CONTEXT.md from requirements...
```

3. Parse the PRD and generate CONTEXT.md. The orchestrator must:
   - Extract all requirements, user stories, acceptance criteria, and constraints from the PRD
   - Map each to a locked decision (treat every PRD statement as a locked decision)
   - Identify areas the PRD does not cover and mark as "Agent's Discretion"
   - Extract canonical refs from ROADMAP.md for this phase and any specs referenced in the PRD — expand to full relative paths (MANDATORY)
   - Create CONTEXT.md at `$PHASE_DIR/$PADDED_PHASE-CONTEXT.md`

4. Write CONTEXT.md using this template:

```markdown
# Phase {X}: {Name} — Context

**Gathered:** {date}
**Status:** Ready for planning
**Source:** PRD Express Path ({PRD_FILE})

## Phase Boundary

{Extracted from PRD — what this phase delivers and what it does not deliver}

<decisions>
## Implementation Decisions

{For each requirement/story/criterion in the PRD, one locked decision:}

### {Category derived from content}
- {Requirement restated as locked decision}
- {Requirement restated as locked decision}

### Agent's Discretion
{Areas not covered by PRD — implementation details, technical choices the agent may decide}

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

{MANDATORY. Use full relative paths. Group by topic.}

### {Topic Area}
- `path/to/spec-or-adr.md` — {What it decides}

{If no external specs: "No external specs — requirements fully captured in decisions above"}

</canonical_refs>

<deferred>
## Deferred

{Items in PRD explicitly marked as future / v2 / out-of-scope}
{If none: "None — PRD covers phase scope"}

</deferred>

---
*Phase: {padded_phase}-{phase_slug}*
*Context gathered: {date} via PRD Express Path*
```

5. Commit:
```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" commit \
  "docs(phase-${PHASE}): generate context from PRD" \
  --files "${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md"
```

6. Set `CONTEXT_PATH=${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md` and continue to step 3 (Check Existing Plans). Skip the CONTEXT.md gate in step 3.

---

## 3. Load CONTEXT.md

**Skip if:** PRD express path was used (CONTEXT.md just created in step 2).

**If `CONTEXT_PATH` is not null:**

Display: `Using phase context from: {CONTEXT_PATH}`

Read CONTEXT.md now. Extract:
- `PHASE_GOAL` — the phase goal statement
- `CANONICAL_REFS` — the full list from `<canonical_refs>` block
- `PHASE_DECISIONS` — the decisions list from `<decisions>` block

These will be passed verbatim into planner and researcher prompts. Do NOT paraphrase canonical refs — copy them exactly. Downstream agents failing to read their canonical refs is the most common cause of misaligned plans.

**If `CONTEXT_PATH` is null (no CONTEXT.md):**

If `GAPS_MODE=true`: Continue to step 4 (gaps mode reads VERIFICATION.md instead of CONTEXT.md).

Otherwise, present options:

```
No CONTEXT.md found for Phase {X}.
Plans will use research and requirements only — your design preferences won't be included.

1. Continue without context — Plan using research + requirements only
2. Run discuss first — Capture design decisions before planning
```

- If "Continue without context" → proceed to step 4.
- If "Run discuss first" → display the command and exit:
  ```
  Run this first, then re-run /sunco:plan {X}:

  /sunco:discuss {X}
  ```
  **Exit. Do not continue.**

---

## 4. Check Existing Plans

```bash
ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null || true
```

**If `PLAN_COUNT` is 0:** Skip to step 5.

**If `PLAN_COUNT` > 0:**

Display:
```
Phase {X} has {PLAN_COUNT} existing plan(s):
{list each plan file with its title from YAML frontmatter}
```

Present options:

```
1. Replan from scratch — discard existing plans and regenerate
2. Add a plan — create one additional plan alongside existing ones
3. View existing plans — show plan summaries then exit
4. Keep existing plans — exit (run /sunco:execute {X} to proceed)
```

- "Replan from scratch": remove existing plans (`rm "$PHASE_DIR"/*-PLAN.md`) and continue to step 5.
- "Add a plan": set `ADD_PLAN_MODE=true`, continue to step 5 (researcher and planner both receive existing plans as context).
- "View existing plans": print plan summaries (frontmatter + objective blocks) and exit.
- "Keep existing plans": exit with message `Plans already exist. Run /sunco:execute {X} to begin execution.`

---

## 5. Research Phase

**Skip if:** `GAPS_MODE=true` OR `SKIP_RESEARCH=true`.

**If `HAS_RESEARCH` is not null AND `FORCE_RESEARCH` is false:** Use existing research. Display: `Using existing research: {RESEARCH_PATH}`. Skip to step 6.

**If `RESEARCH_PATH` is null OR `FORCE_RESEARCH=true`:**

If neither `--research` nor `--skip-research` was passed and `AUTO_MODE=false`:

Present:
```
Research before planning Phase {X}: {phase_name}?

1. Research first (Recommended) — Investigate implementation approaches, patterns, and
   dependencies before planning. Best for new features, unfamiliar integrations, or
   architectural work.
2. Skip research — Plan directly from context and requirements. Best for bug fixes,
   simple refactors, or well-understood work.
```

If "Skip research": set `SKIP_RESEARCH=true` and skip to step 6.

If `AUTO_MODE=true` and no explicit `--research` flag: skip research silently and continue to step 6.

### Display Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► RESEARCHING PHASE {X}: {phase_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning researcher...
```

### Spawn sunco-phase-researcher

Read the phase description from ROADMAP.md:

```bash
PHASE_DESC=$(grep -A 30 "## Phase ${PHASE}" "$ROADMAP_PATH" 2>/dev/null | head -30)
```

Research prompt:

```markdown
<objective>
Research how to implement Phase {phase_number}: {phase_name}.
Answer the question: "What do I need to know to PLAN this phase well?"
</objective>

<files_to_read>
{If CONTEXT_PATH is not null:}
- {CONTEXT_PATH} — USER DECISIONS from /sunco:discuss. Read this FIRST.
  Canonical refs listed in <canonical_refs> are MANDATORY reads — follow every path listed.

- {REQUIREMENTS_PATH} — Full requirements list with REQ-IDs

- {STATE_PATH} — Current project state and active decisions

{If HAS_VERIFICATION is not null (--gaps mode):}
- {VERIFICATION_PATH} — Verification gaps report. Research must target these gaps specifically.
</files_to_read>

<project_context>
**Phase description:**
{PHASE_DESC}

**Phase requirement IDs (MUST address all):** {PHASE_REQ_IDS}

**Tech stack (SUNCO project):**
- TypeScript 6.x, Node.js 24.x LTS
- Commander.js 14.x CLI
- tsup 8.x bundler
- Vitest 4.x tests
- Zod 4.x validation
- smol-toml config
- ESLint 10.x flat config

**Project instructions:** Read ./CLAUDE.md — follow all project-specific guidelines and conventions.
**Skill patterns:** Check .claude/skills/ directory — read any SKILL.md files, research must account for skill architectural patterns.
</project_context>

<research_requirements>
For each viable implementation approach, provide:
1. High-level architecture (3-5 sentences, enough for a planner to act on)
2. Key files/modules to create or modify (with exact relative paths where known)
3. New dependencies required (package name, version, why)
4. Estimated complexity per plan: S (< 30 min), M (30 min – 2h), L (2–4h)
5. Key risks, unknowns, and recommended mitigations
6. Integration points with existing SUNCO architecture (skill-loader, registry, config, state)

Recommend the best-fit approach with reasoning tied to the tech stack constraints.

For each file you expect to be modified or created, include the exact relative path from project root.
</research_requirements>

<output_format>
Write findings to: {PHASE_DIR}/{PADDED_PHASE}-RESEARCH.md

Structure:
## Recommended Approach
[Approach with full reasoning]

## Alternative(s) Considered
[What was considered and why not chosen]

## Implementation Map
[Files to create/modify with paths and brief description]

## Dependencies
[Any new packages needed]

## Risk Register
[Risks with mitigations]

## RESEARCH COMPLETE
</output_format>
```

```
Task(
  prompt=research_prompt,
  subagent_type="sunco-phase-researcher",
  description="Research Phase {PHASE}: {phase_name}"
)
```

### Handle Researcher Return

- **`## RESEARCH COMPLETE`:** Display `Research complete. Proceeding to planning.` Continue to step 6.
- **`## RESEARCH BLOCKED`:** Display the blocker reason. Present:
  1. Provide additional context and retry
  2. Skip research and plan from requirements only
  3. Abort

  If "Skip research": set `SKIP_RESEARCH=true` and continue to step 6 without research.

---

## 6. Gaps Mode Setup

**Skip if:** `GAPS_MODE=false`.

**If `GAPS_MODE=true`:**

```bash
if [ ! -f "$VERIFICATION_PATH" ]; then
  echo "Error: --gaps requires a VERIFICATION.md file in the phase directory."
  echo "Run /sunco:verify {X} first to generate verification results."
  exit 1
fi
```

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► GAP-CLOSURE MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reading: {VERIFICATION_PATH}
Generating targeted fix plans for verification gaps...
```

Read VERIFICATION.md. Extract failed checks, unmet acceptance criteria, and missing coverage items. The planner in step 7 will create plans targeted at closing these specific gaps rather than building new features.

Set `PLANNING_MODE=gap_closure`. Pass the gaps list directly into the planner prompt in step 7.

---

## 7. Create Plans

Display banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► PLANNING PHASE {X}: {phase_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner...
```

### Planner Prompt

```markdown
<planning_context>
**Phase:** {phase_number} — {phase_name}
**Mode:** {standard | gap_closure | add_plan}

<files_to_read>
{If CONTEXT_PATH is not null:}
- {CONTEXT_PATH} — USER DECISIONS. Read FIRST.
  Every path listed in <canonical_refs> is MANDATORY — read each one before planning.

- {ROADMAP_PATH} — Phase goal, deliverables, estimated complexity

- {REQUIREMENTS_PATH} — Full requirements list with REQ-IDs

- {STATE_PATH} — Current project state

{If RESEARCH_PATH is not null:}
- {RESEARCH_PATH} — Technical research findings. Use the Implementation Map for file paths.

{If GAPS_MODE=true:}
- {VERIFICATION_PATH} — Verification gaps. Plans MUST close these gaps specifically.
  Do not plan new features — only plan gap-closure work.

{If ADD_PLAN_MODE=true:}
- {PHASE_DIR}/*-PLAN.md — Existing plans. New plan must not duplicate their scope.
</files_to_read>

**Phase requirement IDs (EVERY ID must appear in at least one plan's requirements field):**
{PHASE_REQ_IDS}

**Project instructions:** Read ./CLAUDE.md — follow all guidelines and conventions.
**Skill patterns:** Check .claude/skills/ — read SKILL.md files, plans must follow skill architectural rules.
</planning_context>

<plan_count_guidance>
- Standard phase: create 1–3 plans
- Wave-1 plans: independently completable, no dependency on each other
- Wave-2 plans: depend on Wave-1 output (e.g. integration glue, cross-cutting wiring)
- Most phases: Wave 1 only. Wave 2 only when Wave-1 output is a hard prerequisite.
- Never more than 2 waves without justification
- Gap-closure mode: 1–2 targeted fix plans, one per distinct failure area
- Add-plan mode: exactly 1 new plan
</plan_count_guidance>

<plan_format>
Each plan MUST be written as a standalone file at: {PHASE_DIR}/{PADDED_PHASE}-NN-PLAN.md

Use this exact structure:

---
phase: {phase_number}
plan: NN
title: {concise action title}
wave: {1 or 2}
depends_on: [{PADDED_PHASE}-MM, ...] or []
files_modified:
  - {exact relative path from project root}
  - {exact relative path from project root}
requirements_addressed:
  - {REQ-ID}
  - {REQ-ID}
gap_closure: {true if --gaps mode, false otherwise}
---

<objective>
{What this plan builds and why it matters for the phase goal.}

Requirements fulfilled: {comma-separated REQ-IDs}
Phase goal contribution: {1–2 sentences connecting this plan's output to the phase goal}
</objective>

<tasks>
<task id="{phase_number}-NN-01" type="auto">
  <name>{Verb-noun action name, e.g. "Implement skill loader registry"}</name>
  <files>
    - {exact relative path of primary file being created or modified}
    - {exact relative path of secondary file}
  </files>
  <read_first>
    - {CONTEXT_PATH} — canonical refs must be read before touching any file
    - {exact path of file being modified — read current state before changing}
    - {any source-of-truth file whose patterns must be replicated}
  </read_first>
  <action>
    {CONCRETE description of what to do. Include:
     - Exact function signatures, class names, interface shapes
     - Exact config keys, values, and types
     - Exact import paths (ESM .js extensions)
     - Exact export names
     - Any SQL, TOML, or JSON structures verbatim
     The executor must be able to complete this task from the action text alone.
     NEVER say "align with X" or "match Y" without specifying the exact target state.}
  </action>
  <acceptance_criteria>
    - {Grep-verifiable: "file.ts contains 'export function skillName('"}
    - {Command-verifiable: "npx tsc --noEmit exits 0"}
    - {File-verifiable: "path/to/file.ts exists"}
    - {Test-verifiable: "vitest run src/x.test.ts exits 0"}
  </acceptance_criteria>
</task>

<task id="{phase_number}-NN-02" type="auto">
  ...same structure...
</task>
</tasks>

<done_when>
- [ ] {Feature-specific: e.g. "skill registry exports loadSkills() and resolves IDs by name"}
- [ ] {Feature-specific: e.g. "sunco init creates .planning/ with all required files"}
- [ ] All task acceptance criteria verified
- [ ] /sunco:lint passes with zero errors
- [ ] npx tsc --noEmit passes with zero errors
- [ ] vitest run passes with zero failures (if test files are in files_modified)
</done_when>
```

</plan_format>

<deep_work_rules>
## Anti-Shallow Execution Rules (MANDATORY)

Every task MUST include all three fields — they are NOT optional:

**`<read_first>`** — Files the executor MUST read before touching anything. Always include:
- The file being modified (so executor sees current state, not assumptions)
- Any canonical ref listed in CONTEXT.md (reference implementations, existing patterns, type definitions, config schemas)
- Any file whose patterns, signatures, or conventions must be replicated

**`<acceptance_criteria>`** — Verifiable conditions that prove the task was done correctly:
- Every criterion must be checkable with grep, file read, test command, or CLI output
- NEVER use subjective language: "looks correct", "properly configured", "consistent with"
- ALWAYS include exact strings, patterns, values, or command outputs that must be present
- Examples:
  - `packages/core/src/skill-loader.ts contains 'export function loadSkills('`
  - `vitest run packages/core/src/__tests__/skill-loader.test.ts exits 0`
  - `.planning/REQUIREMENTS.md exists and contains '## Requirements'`
  - `sunco init exits 0 and creates .planning/STATE.md`

**`<action>`** — Must include CONCRETE values, not references:
- NEVER say "align X with Y" or "match X to Y" without specifying the exact target state
- ALWAYS include: actual values, config keys, function signatures, SQL, class names, import paths, env vars
- If CONTEXT.md has a comparison table or expected values, copy them verbatim into the action
- The executor should complete the task from the action text alone — read_first is for verification, not discovery

**Why this matters:** Executor agents work from plan text. Vague instructions like "update the config to match project conventions" produce one-line changes. Concrete instructions produce complete, correct work. The cost of verbose plans is far less than the cost of re-execution.
</deep_work_rules>

<quality_gate>
Before returning PLANNING COMPLETE, verify:
- [ ] Every plan file exists in phase directory
- [ ] Every plan has valid YAML frontmatter with all required fields
- [ ] Every task has <read_first> with at least the file being modified
- [ ] Every task has <acceptance_criteria> with grep-verifiable conditions
- [ ] Every <action> contains concrete values (no "align X with Y" without specifics)
- [ ] All phase REQ-IDs appear in at least one plan's requirements_addressed
- [ ] Wave assignments are correct (Wave 2 depends on Wave 1, no circular deps)
- [ ] done_when includes /sunco:lint passes and npx tsc --noEmit passes
- [ ] files_modified lists exact relative paths, no wildcards or approximations
Return: ## PLANNING COMPLETE
</quality_gate>
```

```
Task(
  prompt=planner_prompt,
  subagent_type="general-purpose",
  description="Plan Phase {PHASE}: {phase_name}"
)
```

### Handle Planner Return

- **`## PLANNING COMPLETE`:** Display plan count. If `SKIP_VERIFY=true`: skip to step 9. Otherwise continue to step 8.
- **`## PLANNING INCONCLUSIVE`:** Show attempts. Present: 1) Provide additional context and retry, 2) Manual planning, 3) Abort.

---

## 8. Plan Checker Loop

Display banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► VERIFYING PLANS (iteration {N}/3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Track `ITERATION` (starts at 1).

### Spawn sunco-plan-checker

Checker prompt:

```markdown
<verification_context>
**Phase:** {phase_number} — {phase_name}
**Phase Goal:** {goal from ROADMAP.md}

<files_to_read>
- {PHASE_DIR}/*-PLAN.md — Plans to verify (read ALL plan files)
- {ROADMAP_PATH} — Phase goal and deliverables
- {REQUIREMENTS_PATH} — Full requirements list
{If CONTEXT_PATH is not null:}
- {CONTEXT_PATH} — User decisions and canonical refs
{If RESEARCH_PATH is not null:}
- {RESEARCH_PATH} — Technical research findings
</files_to_read>

**Phase requirement IDs (ALL must be covered):** {PHASE_REQ_IDS}

**Project instructions:** Read ./CLAUDE.md — verify plans honor all project guidelines.
**Skill patterns:** Check .claude/skills/ — verify plans follow skill architectural rules.
</verification_context>

<checks>
Run all 6 checks. A plan FAILS if any check fails.

**CHECK 1 — Requirements Coverage**
Does every REQ-ID in {PHASE_REQ_IDS} appear in at least one plan's `requirements_addressed` field?
- PASS: all REQ-IDs covered
- FAIL: list uncovered REQ-IDs

**CHECK 2 — Scope Containment**
Does every plan's objective fall within the phase goal stated in ROADMAP.md?
- PASS: all plan objectives are subsets of the phase goal
- FAIL: list plans that reach into adjacent phases or unrelated concerns

**CHECK 3 — Binary Acceptance Criteria**
Is every acceptance criterion in every task checkable by grep, file existence, CLI output, or test result?
- PASS: all criteria are binary (either satisfied or not, no ambiguity)
- FAIL: list criteria that are subjective ("looks correct", "is implemented", "works properly")

**CHECK 4 — Dependency Correctness**
Are wave assignments and depends_on fields accurate?
- PASS: Wave-2 plans only depend on Wave-1 plans in same phase; no circular dependencies
- FAIL: list incorrect wave assignments or circular deps

**CHECK 5 — File List Accuracy**
Does files_modified list exact relative paths? No wildcards, no "and others"?
- PASS: all paths are exact relative paths from project root
- FAIL: list approximate or missing file paths

**CHECK 6 — Lint Gate Present**
Does every plan's <done_when> include `/sunco:lint passes with zero errors`?
- PASS: lint gate present in all plans
- FAIL: list plans missing the lint gate (this is AUTO-FIX: add lint gate automatically)

**CHECK 7 — TypeScript Gate Present**
Does every plan's <done_when> include `npx tsc --noEmit passes with zero errors`?
- PASS: tsc gate present in all plans
- FAIL: list plans missing the tsc gate (AUTO-FIX: add tsc gate automatically)

**CHECK 8 — read_first Present**
Does every task have a <read_first> block with at least the file being modified?
- PASS: all tasks have read_first
- FAIL: list tasks missing read_first

**CHECK 9 — CONTEXT.md Canonical Refs Carried**
{If CONTEXT_PATH is not null:}
Does at least one task in each plan include the CONTEXT_PATH in its read_first?
- PASS: canonical refs are threaded through to tasks
- FAIL: list plans that don't pass canonical refs to their tasks
</checks>

<output_format>
If ALL checks pass:
## VERIFICATION PASSED
{N} plans verified for Phase {phase_number}.
{list each plan with its wave and complexity estimate}

If ANY check fails:
## ISSUES FOUND
{For each failing check, structured as:}

### Check {N}: {check_name}
**Status:** FAIL
**Plans affected:** {plan file names}
**Issue:** {specific description}
**Required fix:** {exactly what the planner must change}
</output_format>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="sunco-plan-checker",
  description="Verify Phase {PHASE} plans (iteration {ITERATION}/3)"
)
```

### Handle Checker Return

**`## VERIFICATION PASSED`:** Display confirmation. Proceed to step 9.

**`## ISSUES FOUND`:** Display all issues. Check iteration count.

**If `ITERATION` < 3:** Display `Sending back to planner for revision... (iteration {ITERATION}/3)`. Increment `ITERATION`.

Spawn revision planner:

```markdown
<revision_context>
**Phase:** {phase_number}
**Mode:** revision — targeted fixes only, do NOT rewrite plans from scratch

<files_to_read>
- {PHASE_DIR}/*-PLAN.md — Existing plans to revise
{If CONTEXT_PATH is not null:}
- {CONTEXT_PATH} — User decisions
</files_to_read>

**Checker issues from iteration {ITERATION}:**
{STRUCTURED_ISSUES_FROM_CHECKER}
</revision_context>

<instructions>
Make targeted changes to address checker issues.
Do NOT replan from scratch unless the issues are fundamental (wrong objective, wrong scope).
For each issue:
- If missing lint/tsc gate: add to done_when
- If missing read_first: add the file being modified
- If vague acceptance criteria: replace with grep-verifiable criterion
- If uncovered REQ-ID: add to requirements_addressed field and add a task if needed
- If scope violation: narrow the objective and remove out-of-scope tasks

Return only what changed, with the full updated plan file content.
## REVISION COMPLETE
</instructions>
```

After revision planner returns: spawn checker again (step 8), increment ITERATION.

**If `ITERATION` >= 3:**

Display:
```
Max iterations reached. {N} issues remain:

{issue list from final checker run}

Options:
1. Force proceed — accept plans with known issues (WARN flags added to plans)
2. Provide guidance — add context and retry one more time
3. Abort — exit without writing plans
```

- "Force proceed": add `## WARN: verification issues (see above)` to each failing plan's frontmatter and proceed to step 9.
- "Provide guidance": accept user input, spawn one final revision + check cycle, then force-proceed regardless.
- "Abort": exit without writing any files.

---

## 9. Requirements Coverage Gate

After checker passes (or is skipped), verify that all phase requirements are explicitly covered.

**Skip if:** `PHASE_REQ_IDS` is null or empty (no requirements mapped to this phase).

**Step 1: Collect requirement IDs from plan files**

```bash
PLAN_REQS=$(grep -h "requirements_addressed:" "$PHASE_DIR"/*-PLAN.md 2>/dev/null \
  | grep -oE 'REQ-[0-9]+' | sort -u)
```

**Step 2: Compare against phase REQ-IDs**

For each REQ-ID in `PHASE_REQ_IDS`:
- If present in `PLAN_REQS` → covered
- If absent → uncovered gap

**Step 3: Check CONTEXT.md feature coverage**

If `CONTEXT_PATH` is not null: read the `<decisions>` section. Extract feature/capability names. Verify each appears in at least one plan `<objective>` block. Features absent from all objectives → potentially dropped scope.

**Step 4: Report**

If all covered:
```
Requirements coverage: {N}/{N} REQ-IDs covered by plans.
```
Proceed to step 10.

If gaps found:
```
Requirements Coverage Gap

{M} of {N} phase requirements not assigned to any plan:

| REQ-ID | Description | Plans |
|--------|-------------|-------|
| {id}   | {desc}      | None  |

{K} CONTEXT.md features not found in plan objectives:
- {feature} — in CONTEXT.md decisions but no plan covers it

Options:
1. Replan to include missing requirements (recommended)
2. Move uncovered requirements to next phase
3. Proceed with coverage gaps acknowledged
```

- "Replan": spawn planner again (step 7) with uncovered REQ-IDs highlighted as MUST-INCLUDE.
- "Move to next phase": update ROADMAP.md to reassign REQ-IDs, proceed to step 10.
- "Proceed anyway": add `requirements_dropped: [{REQ-ID}]` to STATE.md, proceed to step 10.

---

## 10. Wave Assignment Summary

After checker passes and coverage gate clears, derive the wave structure:

1. Read all plan files. Extract `wave` and `depends_on` from each frontmatter.
2. Build wave groups:
   - Wave 1: all plans with `depends_on: []`
   - Wave 2: all plans with `depends_on` referencing Wave-1 plan IDs
3. Validate wave structure:
   - No plan depends on a plan in a higher wave
   - No circular dependencies
   - Never more than 2 waves for a single phase without explicit justification
4. If only 1 plan exists: Wave 1, no further structure needed.

Display wave structure:

```
Wave Structure for Phase {X}:

  Wave 1 (parallel):  {PADDED_PHASE}-01, {PADDED_PHASE}-02  [{S/M/L}, {S/M/L}]
  Wave 2 (sequential): {PADDED_PHASE}-03                   [{S/M/L}]

  Wave 1 runs in parallel.
  Wave 2 begins only after all Wave-1 plans complete.
```

If wave structure has issues (circular deps, incorrect ordering), surface to user and wait for confirmation before proceeding.

---

## 11. Write Plans and Update State

All plan files should already exist in `PHASE_DIR` (written by the planner agent). Verify:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  test -f "$plan" && echo "OK: $plan" || echo "MISSING: $plan"
done
```

If any plan file is missing: re-run the planner for missing plans before proceeding.

### Update STATE.md

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state-update \
  --phase "${PHASE}" \
  --status "planned" \
  --next "Execute Phase ${PHASE}: /sunco:execute ${PHASE}"
```

### Commit

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" commit \
  "plan(phase-${PHASE}): create ${PLAN_COUNT} plan(s) for ${phase_name}" \
  --files "${PHASE_DIR}/${PADDED_PHASE}-"*-PLAN.md .planning/STATE.md
```

If `HAS_RESEARCH` and RESEARCH.md was created this session, include it in the commit:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" commit \
  "docs(phase-${PHASE}): add research and plans for ${phase_name}" \
  --files "${PHASE_DIR}/" .planning/STATE.md
```

---

## 12. Auto-Advance Check

**If `AUTO_MODE=false`:** Proceed to `<offer_next>`.

**If `AUTO_MODE=true`:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTO-ADVANCING TO EXECUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plans ready. Launching execute-phase...
```

Launch execute using the Skill tool (avoids nested Task sessions):

```
Skill(skill="sunco:execute", args="{PHASE} --auto")
```

**Handle execute return:**

- **Phase complete:** Display final summary:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SUNCO ► PHASE {PHASE} COMPLETE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline complete.
  Next: /sunco:discuss {NEXT_PHASE} --auto
  ```

- **Verification gaps / execution failed:** Stop chain and display:
  ```
  Auto-advance stopped: Execution needs review.

  Review the output above and continue manually:
  /sunco:execute {PHASE}
  ```

</process>

---

## Flag Reference

| Flag | Behavior |
|------|----------|
| `--research` | Force re-research even if RESEARCH.md exists |
| `--skip-research` | Skip research entirely, plan from context only |
| `--gaps` | Gap-closure mode: read VERIFICATION.md, create targeted fix plans. Skips research. |
| `--prd <path>` | PRD express path: generate CONTEXT.md from PRD file, bypasses /sunco:discuss |
| `--skip-verify` | Skip plan checker loop entirely |
| `--auto` | Auto-advance to execute-phase after planning completes |

Flag conflicts:
- `--gaps` + `--prd` → error: cannot combine. Gaps mode requires existing phase artifacts.
- `--gaps` + `--skip-research` → allowed (gaps mode already skips research).

---

## Plan File Contract

Every plan file written by this workflow MUST conform to this contract. The execute-phase workflow depends on every field being present and correct.

### Required YAML Frontmatter

```yaml
---
phase: 3
plan: 01
title: "Implement skill loader and registry"
wave: 1
depends_on: []
files_modified:
  - packages/core/src/skill-loader.ts
  - packages/core/src/skill-registry.ts
  - packages/core/src/__tests__/skill-loader.test.ts
requirements_addressed:
  - REQ-14
  - REQ-15
gap_closure: false
---
```

All fields are required. `depends_on` is an empty list `[]` for Wave-1 plans. `gap_closure` is `true` only in `--gaps` mode.

### Required XML Structure

```xml
<objective>
What this plan builds and why.

Requirements fulfilled: REQ-14, REQ-15
Phase goal contribution: Enables all downstream skill execution by providing the lookup mechanism for registered skills.
</objective>

<tasks>
<task id="3-01-01" type="auto">
  <name>Create skill-loader module</name>
  <files>
    - packages/core/src/skill-loader.ts
  </files>
  <read_first>
    - .planning/phases/03-skill-system/03-CONTEXT.md
    - packages/core/src/types.ts
  </read_first>
  <action>
    Create packages/core/src/skill-loader.ts. Export:
    - loadSkills(dir: string): Promise<SkillManifest[]>
      Reads all *.skill.ts files in dir recursively using glob@11.
      Returns array of SkillManifest (defined in types.ts).
    - resolveSkill(id: string, registry: SkillRegistry): Skill | undefined
      Looks up skill by fully-qualified ID (e.g. "harness.lint").
    Import path: import { glob } from 'glob' (ESM, .js extension).
    Export path: add re-export to packages/core/src/index.ts.
  </action>
  <acceptance_criteria>
    - packages/core/src/skill-loader.ts exists
    - packages/core/src/skill-loader.ts contains "export async function loadSkills("
    - packages/core/src/skill-loader.ts contains "export function resolveSkill("
    - packages/core/src/index.ts contains "export { loadSkills, resolveSkill }"
  </acceptance_criteria>
</task>
</tasks>

<done_when>
- [ ] loadSkills() reads all *.skill.ts files from a given directory
- [ ] resolveSkill() returns the correct skill for a given ID
- [ ] All task acceptance criteria verified
- [ ] /sunco:lint passes with zero errors
- [ ] npx tsc --noEmit passes with zero errors
- [ ] vitest run packages/core/src/__tests__/skill-loader.test.ts exits 0
</done_when>
```

### task type="auto"

All tasks in SUNCO plans use `type="auto"`. This signals to the execute-phase workflow that tasks are fully autonomous — no human checkpoint required. Tasks that need human confirmation before proceeding should use `type="confirm"` and include a `<confirm_prompt>` block.

---

## Canonical Refs Contract

Canonical refs are paths extracted from the `<canonical_refs>` block in CONTEXT.md. They represent the authoritative source of truth for patterns, types, schemas, and decisions that must be respected during execution.

**Rules for the planner:**
1. Every canonical ref from CONTEXT.md must appear in the `<read_first>` of at least one task in every plan
2. Canonical refs must be copied as exact file paths — do not paraphrase or summarize
3. If CONTEXT.md specifies a canonical ref that does not yet exist (it will be created by Wave 1), Wave-2 tasks may include it in read_first with the note: `(created by Wave 1 plan {NN})`

**Example canonical refs block in CONTEXT.md:**
```markdown
<canonical_refs>
## Canonical References

### Type System
- `packages/core/src/types.ts` — SkillManifest, SkillRegistry, PermissionSet interfaces

### Architecture
- `packages/core/src/skill-loader.ts` — Reference implementation for skill scanning

### Config Schema
- `.planning/REQUIREMENTS.md` — REQ-IDs this phase must address
</canonical_refs>
```

The planner must include `packages/core/src/types.ts` and any other listed paths in `<read_first>` blocks — not just in one task, but in every task that touches code that depends on those contracts.

---

## Complexity Calibration

| Complexity | Tasks | Estimated duration |
|------------|-------|--------------------|
| S (small) | 1–2 tasks | < 30 min agent session |
| M (medium) | 2–3 tasks | 30 min – 2h agent session |
| L (large) | 3–4 tasks | 2–4h agent session |

If a plan would exceed L complexity (4+ tasks, > 4h): split into two plans. Assign the split plans to the same wave if independent, or Wave 1 / Wave 2 if the second depends on the first.

The planner must include a complexity estimate (`S`, `M`, or `L`) in each plan's `<objective>` block.

---

## Verification Checks Summary

The plan checker runs 9 checks. Plans that fail checks 1–5 and 8–9 require planner revision. Checks 6–7 (lint gate, tsc gate) are auto-fixed by the checker without planner intervention.

| # | Check | Severity | Auto-fix |
|---|-------|----------|----------|
| 1 | Requirements coverage — every phase REQ-ID in at least one plan | FAIL | No |
| 2 | Scope containment — plan objective within phase boundary | FAIL | No |
| 3 | Binary acceptance criteria — no subjective language | FAIL | No |
| 4 | Dependency correctness — wave ordering valid, no circular deps | FAIL | No |
| 5 | File list accuracy — exact paths, no wildcards | FAIL | No |
| 6 | Lint gate in done_when | WARN | Yes |
| 7 | TypeScript gate in done_when | WARN | Yes |
| 8 | read_first present in every task | FAIL | No |
| 9 | Canonical refs carried into tasks | FAIL | No |

A plan passes when all 9 checks pass. The planner revision loop runs up to 3 iterations before surfacing unresolved issues to the user.

---

<offer_next>
Output this markdown directly (not as a code block):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► PHASE {X} PLANNED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} plan(s) in {M} wave(s)

| Wave | Plans | Complexity | What it builds |
|------|-------|------------|----------------|
| 1    | {PADDED_PHASE}-01, {PADDED_PHASE}-02 | M, S | {objectives} |
| 2    | {PADDED_PHASE}-03 | M | {objective} |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}
Requirements: {N}/{N} REQ-IDs covered

───────────────────────────────────────────────────────────────

## Next Up

**Execute Phase {X}** — run all {N} plans in wave order

/sunco:execute {X}

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{PHASE_DIR_NAME}/*-PLAN.md — review plan files
- /sunco:plan {X} --research — re-run with fresh research
- /sunco:review --phase {X} — cross-AI peer review of plans
- /sunco:plan {X} --gaps — replan after verification failures

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] .planning/ directory validated
- [ ] Phase number parsed and validated against ROADMAP.md
- [ ] Phase directory created if it did not exist
- [ ] CONTEXT.md loaded and canonical refs extracted (step 3)
- [ ] Existing plans checked and user given options (step 4)
- [ ] Research completed, used existing, or explicitly skipped (step 5)
- [ ] sunco-phase-researcher spawned with CONTEXT.md in files_to_read
- [ ] Gaps mode reads VERIFICATION.md when --gaps flag present (step 6)
- [ ] Planner spawned with CONTEXT.md + RESEARCH.md + canonical refs (step 7)
- [ ] Plans created with all required YAML frontmatter fields
- [ ] Every task has read_first, action, and acceptance_criteria
- [ ] sunco-plan-checker spawned (step 8) unless --skip-verify
- [ ] Revision loop runs max 3 iterations before surfacing to user
- [ ] Requirements coverage gate passes or user acknowledges gaps (step 9)
- [ ] Wave structure derived and validated (step 10)
- [ ] Plan files verified on disk, STATE.md updated, commit created (step 11)
- [ ] User sees banner between each agent spawn
- [ ] offer_next displayed with correct plan count and next command
</success_criteria>
