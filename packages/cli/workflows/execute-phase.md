# Execute Phase Workflow

Wave-based parallel execution orchestration for a SUNCO phase. The orchestrator stays lean — discovers plans, groups them into waves, spawns one sunco-executor Task per plan, enforces a mandatory lint-gate after each plan, and writes a VERIFICATION.md when all waves are done. Resumability is built in: any plan that already has a SUMMARY.md is silently skipped on re-entry.

---

## Core Principle

Orchestrator coordinates, not executes. Each executor loads the full plan context in a fresh window. Orchestrator responsibility chain:

```
parse_args → initialize → check_interactive_mode → handle_branching
→ validate_phase → discover_and_group_plans → execute_waves
→ checkpoint_handling → aggregate_results
```

---

## Step 1: parse_args

Parse `$ARGUMENTS` before loading any context.

| Token | Variable | Default |
|-------|----------|---------|
| First positional token | `PHASE_ARG` | — (required) |
| `--wave N` | `WAVE_FILTER` | unset (all waves) |
| `--interactive` | `INTERACTIVE` | false |
| `--gaps-only` | `GAPS_ONLY` | false |
| `--branch` | `FORCE_BRANCH` | false |

Rules:
- If `PHASE_ARG` is absent → error: "Usage: /sunco:execute <phase>. Run /sunco:status to see available phases."
- `--wave` accepts an integer. `--wave 2` → execute only Wave 2. Safety check applies (see discover_and_group_plans).
- `--gaps-only` → skip any plan whose frontmatter does not contain `gap_closure: true`.
- `--branch` → force branch creation even if `git.branching_strategy` is `"none"`.
- `--interactive` → route to inline execution path after grouping (no subagent spawning).

---

## Step 2: initialize

Load all context in one call. The sunco-tools binary is the single source of truth for phase, plan, and config state.

```bash
INIT=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON fields:

| Field | Type | Description |
|-------|------|-------------|
| `phase_found` | bool | Phase directory exists |
| `phase_dir` | string | Path: `.planning/phases/N-slug/` |
| `phase_number` | string | Phase number (e.g. `"03"`) |
| `phase_name` | string | Human name (e.g. `"skill-system"`) |
| `phase_slug` | string | Kebab slug used in filenames |
| `plans` | array | All plan objects |
| `incomplete_plans` | array | Plans without SUMMARY.md |
| `plan_count` | int | Total plans |
| `incomplete_count` | int | Plans still needing execution |
| `state_exists` | bool | STATE.md present |
| `branching_strategy` | string | `"none"` \| `"phase"` \| `"milestone"` |
| `branch_name` | string | Pre-computed branch name |
| `executor_model` | string | Model slug for executor agents |
| `parallelization` | bool | Spawn agents in parallel within wave |

**Error conditions:**
- `phase_found: false` → error: "Phase `${PHASE_ARG}` not found. Run `/sunco:status` to list phases."
- `plan_count: 0` → error: "No plans found in `${phase_dir}`. Run `/sunco:plan ${PHASE_ARG}` first."
- `state_exists: false` but `.planning/` exists → warn: "STATE.md missing. Run `/sunco:init` to restore harness state."

**Load STATE.md context:**
```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state load
```

This reads `.sun/STATE.md` (or `.planning/STATE.md` for legacy layouts) and returns current phase, last completed plan, and any pending checkpoints.

### Artifact Integrity Check

Before execution, verify no planning artifacts have drifted:

```bash
HASH_CHECK=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" artifact-hash check 2>/dev/null)
```

Parse JSON for `changed` (boolean) and `artifacts` (array).

**If `changed` is true:**
```
⚠ SUNCO detected changes to planning artifacts since last operation:
[list changed files from artifacts array]

Execution is paused. Modified planning artifacts may mean your plans are out of date.

Options:
  1) Run impact analysis first (recommended)
  2) Ignore and continue (changes are intentional and don't affect plans)
  3) Abort execution
```

Use AskUserQuestion. If option 1: invoke impact-analysis workflow and return. If option 3: exit workflow. If option 2: update hashes and continue.

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" artifact-hash compute 2>/dev/null
```

**If `changed` is false:** Continue to check_interactive_mode.

---

## Step 3: check_interactive_mode

If `--interactive` flag was parsed:

1. Proceed through `handle_branching` and `validate_phase` normally.
2. After `discover_and_group_plans`, switch to sequential inline execution — do NOT spawn executor Tasks.
3. For each plan (ignoring wave order):

   **a. Present the plan:**
   ```
   ## Plan {plan_id}: {plan_title}

   Objective: {objective from plan frontmatter}
   Tasks:     {task_count} tasks
   Files:     {files_modified count} files in scope
   Wave:      {wave}

   Options:
     execute  — run all tasks now (inline, this context window)
     review   — show full plan before starting
     skip     — move to next plan
     stop     — end execution, save progress
   ```

   **b. If "review":** Read and display the full plan file. Re-present the options.

   **c. If "execute":** Read the plan file inline. Execute each task. After each task: make an atomic commit, run lint-gate. Show result. Pause briefly for user input before next task.

   **d. After each task:** If user types anything mid-execution, stop and address their input before continuing.

   **e. After plan complete:** Write SUMMARY.md (see SUMMARY.md template), then present the next plan.

4. After all plans: proceed to `aggregate_results`.

**When to use interactive mode:**
- Phases with ≤ 3 plans
- Debugging a specific plan in isolation
- Quota-sensitive sessions
- Pair-programming / review-as-you-go

Interactive mode skips to `handle_branching` after parsing this step.

---

## Step 4: handle_branching

Read `branching_strategy` from the init JSON.

### Strategy: `"none"` (default)

If `--branch` flag was not passed: skip. Stay on current branch.

### Strategy: `"phase"` or `"milestone"` — or `--branch` flag

Use the pre-computed `branch_name` from the init call:

```bash
BRANCH_NAME=$(echo "$INIT" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  process.stdout.write(JSON.parse(d).branch_name);
")

git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
```

Branch name format:
- `phase` strategy: `phase/{phase_number}-{phase_slug}` (e.g. `phase/03-skill-system`)
- `milestone` strategy: `milestone/{milestone_slug}` (e.g. `milestone/alpha`)
- `--branch` flag with no strategy: `phase/{phase_number}-{phase_slug}`

All subsequent commits go to this branch. SUNCO does not merge automatically — the user handles the PR.

**If git branch creation fails:**
```
Branch `{branch_name}` already exists. Checking out existing branch.
Note: this branch may contain prior execution artifacts.
```

---

## Step 5: validate_phase

From the init JSON: verify that execution preconditions are met.

**Checks:**

| Check | Condition | Error |
|-------|-----------|-------|
| CONTEXT.md exists | `.planning/phases/{N}-{slug}/CONTEXT.md` present | "Run `/sunco:context {N}` to generate phase context first." |
| Plans exist | `plan_count > 0` | Already caught in initialize. |
| No dependency cycles | Wave assignments are consistent | Report cycle and abort. |
| STATE.md is not locked | `status != "locked"` | "Phase is locked. Unlock via `/sunco:settings`." |

**Dependency cycle detection:**

For each plan with `depends_on:` in its frontmatter:
- Verify that every upstream plan ID is in a lower-numbered wave.
- If plan A (wave 2) depends on plan B (wave 2) → cycle. Abort with:
  ```
  Dependency cycle detected: plan {A} and plan {B} are in the same wave but {A} depends on {B}.
  Fix wave assignments in the PLAN.md frontmatter before executing.
  ```

**Update STATE.md for phase start:**
```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state begin-phase \
  --phase "${PHASE_NUMBER}" \
  --name "${PHASE_NAME}" \
  --plans "${PLAN_COUNT}"
```

This updates the STATUS field, Last Activity timestamp, Current Focus, and plan counts in STATE.md so the harness reflects the active phase immediately.

Report: "Found {plan_count} plans in `{phase_dir}` ({incomplete_count} incomplete)"

---

## Step 6: discover_and_group_plans

Load the plan inventory with wave grouping:

```bash
PLAN_INDEX=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" phase-plan-index "${PHASE_NUMBER}")
```

Parse JSON fields per plan:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Plan ID (e.g. `"03-01"`) |
| `wave` | int | Wave assignment |
| `title` | string | Human plan title |
| `objective` | string | One-paragraph objective |
| `files_modified` | string[] | Expected file scope |
| `task_count` | int | Number of tasks |
| `has_summary` | bool | SUMMARY.md already present |
| `gap_closure` | bool | Is a gap-closure plan |
| `depends_on` | string[] | Upstream plan IDs |

**Filtering rules (apply in order):**
1. Skip plans where `has_summary: true` (already executed — resumability).
2. If `GAPS_ONLY`: also skip plans where `gap_closure: false`.
3. If `WAVE_FILTER` is set: also skip plans whose `wave != WAVE_FILTER`.

**Wave safety check:**
If `WAVE_FILTER` is set and there are still incomplete plans in any wave numerically lower than `WAVE_FILTER`, STOP:
```
Wave {WAVE_FILTER} was requested but Wave {earlier_wave} has {N} incomplete plans.
Finish earlier waves first, or run: /sunco:execute {phase} --wave {earlier_wave}
```

If all plans are filtered out: "No matching incomplete plans — phase may already be complete."

**Report the execution plan:**
```
## Execution Plan

**Phase {X}: {Name}** — {matching_plan_count} plans across {wave_count} wave(s)
{If WAVE_FILTER: "Wave filter active: executing Wave {WAVE_FILTER} only."}
{If GAPS_ONLY: "Gaps-only mode: executing gap_closure plans only."}

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 03-01, 03-02 | {extracted from plan objectives, 4-8 words each} |
| 2    | 03-03        | ... |
```

---

## Step 7: execute_waves

Execute each selected wave in sequence. Within a wave: spawn agents in parallel if `parallelization: true`, sequential if `false`.

### 7a. Pre-wave: blast radius check (MANDATORY — cannot skip)

Before the FIRST wave begins, run blast radius analysis across all plans in scope.

**Blast radius analysis:**

1. Collect all `files_modified` arrays from all plans in the current execution scope.
2. Check if `.sun/graph/` exists (from `/sunco:graph`). If yes, use the dependency graph.
3. Walk the import tree: which files import from the files being modified?
4. Collect transitive dependents (files that depend on dependents).
5. Classify total blast radius.

**Risk thresholds:**

| Files transitively affected | Risk level | Action |
|-----------------------------|------------|--------|
| 0–3 | LOW | Proceed silently |
| 4–10 | MEDIUM | Show notice, proceed automatically |
| 11–20 | HIGH | Show warning, proceed automatically (log to VERIFICATION.md) |
| > 20 | CRITICAL | Block. Require explicit user confirmation before continuing |
| Any file in `files_modified` touches a public API export | HIGH | Show warning |
| Any file in `files_modified` is under `.planning/` | WARN | "Plans are read-only during execution" — flag as unauthorized scope |

**CRITICAL blast radius prompt (block until answered):**
```
Blast radius check: CRITICAL

Plans declare {N} files in scope.
Transitive impact: {M} additional files affected.

Files beyond declared scope (first 20 shown):
  {file_1} (imported by {imported_by})
  {file_2} (imported by {imported_by})
  ...

This exceeds the 20-file warning threshold.

Proceed? [yes / abort]
```

User must type `yes` explicitly. Any other input → abort. No `--force` flag bypasses this.

**Record blast radius for VERIFICATION.md regardless of risk level:**
```
blast_radius:
  risk: {LOW|MEDIUM|HIGH|CRITICAL}
  files_in_scope: {N}
  files_transitively_affected: {M}
```

---

### 7b. Per-wave execution

For each wave (in ascending wave number order):

**1. Describe what's being built (BEFORE spawning agents):**

Read each plan's `objective` field. Extract what's being built and why in 2-3 sentences.

```
---
## Wave {N}

**{Plan ID}: {Plan Title}**
{What this builds, technical approach, why it matters for the phase goal.
Be specific — name the modules, patterns, or interfaces being created.
Avoid: "Executing terrain generation plan"
Prefer: "Perlin-noise terrain generator — height maps, biome zones, collision meshes. Required before vehicle physics can reference ground surfaces."}

Spawning {count} executor(s)...
---
```

**2. Spawn one sunco-executor Task per plan in the wave:**

```
Task(
  subagent_type="sunco-executor",
  model="{executor_model}",
  prompt="
    <objective>
    Execute plan {plan_id} of phase {phase_number}-{phase_name}.
    Commit each task atomically. Create SUMMARY.md. Do not modify
    files outside the declared scope in the plan frontmatter.
    </objective>

    <parallel_execution_note>
    You are running as a PARALLEL executor agent alongside other agents
    in this wave. Use --no-verify on all git commits to avoid pre-commit
    hook contention with sibling agents. The orchestrator runs hooks once
    after the full wave completes.
    </parallel_execution_note>

    <files_to_read>
    Read these files at the start using the Read tool:
    - {phase_dir}/{plan_id}-PLAN.md          (this plan)
    - .sun/STATE.md                           (project state)
    - .sun/config.toml                        (project config)
    - CLAUDE.md                               (project-level agent instructions, if present)
    - .planning/phases/{phase_dir}/CONTEXT.md (phase decisions and context)
    </files_to_read>

    <execution_steps>
    1. Read the plan file completely before starting any work.
    2. Read every file listed in files_modified (understand current state before touching anything).
    3. Execute each task in order.
    4. After each task: make one atomic git commit.
       Commit format: feat({phase_number}-{plan_number}): {task description}
       Use --no-verify flag on each commit (parallel mode).
    5. After each task: verify its acceptance criteria pass before moving on.
    6. After all tasks: run the lint-gate self-check (see below).
    7. Write SUMMARY.md to {phase_dir}/{plan_id}-SUMMARY.md using the SUMMARY.md template.
    </execution_steps>

    <lint_gate_self_check>
    After completing all tasks, run:
      npx eslint packages/ --max-warnings 0 2>&1
      npx tsc --noEmit 2>&1

    If lint passes: set lint_status = PASS in SUMMARY.md.
    If lint fails: set lint_status = FAIL, include first 10 error lines in SUMMARY.md under ## Lint Errors.
    Do NOT attempt to auto-fix lint errors — report them and let the orchestrator decide.
    </lint_gate_self_check>

    <do_not>
    - Do NOT modify files outside files_modified in the plan frontmatter.
    - Do NOT touch any .planning/ file except to write {plan_id}-SUMMARY.md.
    - Do NOT modify ROADMAP.md, STATE.md, or CONTEXT.md.
    - Do NOT skip tasks unless a blocking dependency is missing.
    - Do NOT merge, rebase, or switch branches.
    </do_not>

    <success_criteria>
    - [ ] All tasks executed
    - [ ] Each task committed individually with correct format
    - [ ] Acceptance criteria verified for each task
    - [ ] SUMMARY.md written to {phase_dir}/{plan_id}-SUMMARY.md
    - [ ] lint_status field set in SUMMARY.md
    </success_criteria>
  "
)
```

**3. Wait for all agents in the wave to complete.**

Completion signal fallback (for runtimes where Task() may not return a completion signal):

```bash
# For each plan in this wave, check if the executor finished:
SUMMARY_EXISTS=$(test -f "{phase_dir}/{plan_id}-SUMMARY.md" && echo "true" || echo "false")
COMMITS_FOUND=$(git log --oneline --all --grep="{phase_number}-{plan_number}" --since="2 hours ago" | head -1)
```

- If SUMMARY.md exists AND commits are found: treat as complete. Log: "✓ {Plan ID} completed (verified via spot-check — no completion signal received)."
- If SUMMARY.md does NOT exist after reasonable wait: check `git log --oneline -5` for recent activity. If commits still appearing, wait. If no activity for 10+ minutes, treat as failed.
- If agent reports "failed" but error contains `classifyHandoffIfNeeded is not defined`: this is a Claude Code runtime bug, not a SUNCO or executor issue. Run the same spot-checks. If SUMMARY.md exists and commits are present: treat as successful.

**4. Post-wave hook validation (parallel mode only):**

When executors committed with `--no-verify`, run pre-commit hooks once after the full wave:

```bash
git hook run pre-commit 2>&1 || echo "Pre-commit hooks failed — review before continuing"
```

If hooks fail: report the failure. Ask "Fix hook issues now?" or "Continue to next wave?". Do not silently skip.

**5. Spot-check each completed SUMMARY.md:**

For each plan that wrote a SUMMARY.md:
- Verify first 2 files from `key_files_created` exist on disk.
- Check `git log --oneline --all --grep="{phase_number}-{plan_number}"` returns ≥ 1 commit.
- Check for `## Self-Check: FAILED` marker in SUMMARY.md.

If any spot-check fails: report which plan failed. Ask "Retry plan?" or "Continue with remaining waves?". Do not silently continue.

---

### 7c. Lint-gate enforcement (per plan, MANDATORY)

After each plan's SUMMARY.md is written, run the lint-gate for that plan.

**Lint-gate execution:**
```bash
# Primary — use SUNCO lint skill
sunco lint

# Fallback if binary unavailable
npx eslint packages/ --max-warnings 0
npx tsc --noEmit
```

**Decision rules:**

| Result | Action |
|--------|--------|
| PASS — zero errors, zero warnings | Continue to next plan |
| FAIL — errors present | STOP. Do not start next plan. Present to user. |

**On lint-gate failure — present to user:**
```
Lint-gate FAILED after plan {plan_id}: {plan_title}

Errors (first 20 shown):
  {file}:{line}:{col}: {error_message} ({rule_id})
  ...

Options:
  fix    — Fix lint errors before continuing (recommended)
  skip   — Log warning and continue (errors will compound)
  abort  — Stop execution, write partial VERIFICATION.md
```

- `fix`: Surface the errors. Let user or agent fix. Re-run lint-gate. If lint passes: continue. If still failing: re-present.
- `skip`: Log a visible `⚠ LINT_SKIPPED` warning. Record in VERIFICATION.md under Lint Gate Results. Continue with degraded confidence.
- `abort`: Write partial VERIFICATION.md with status of all completed plans. Report which plans completed and which did not. STOP.

There is no `--skip-lint` flag. The lint-gate is non-negotiable.

---

### 7d. Wave barrier

All plans in Wave N must complete (SUMMARY.md written, lint-gate passed or explicitly skipped) before Wave N+1 begins.

**Pre-wave-N+1 dependency check:**

Before spawning Wave N+1 agents, verify that key artifacts from Wave N exist:

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" verify key-links \
  "{phase_dir}/{plan_id}-PLAN.md"
```

If any key-link from Wave N's output is missing:
```
Cross-Plan Wiring Gap

| Plan       | Expected artifact         | Status    |
|------------|---------------------------|-----------|
| {plan_id}  | {expected_file_or_export} | NOT FOUND |

Wave {N} artifacts may not be properly wired.
Options:
  1. Investigate and fix before spawning Wave {N+1}
  2. Continue anyway (may cause cascading failures)
```

Use AskUserQuestion to present the options. Do not auto-proceed.

---

### 7e. Wave completion report

After all plans in a wave pass the lint-gate and spot-checks:

```
---
## Wave {N} Complete

**{Plan ID}: {Plan Title}**
{What was built — from SUMMARY.md. Be specific.}
{Notable deviations from the plan, if any.}
{If more waves remain: what this enables for the next wave.}
---
```

Do not write generic messages like "Wave 2 complete. Proceeding to Wave 3."

---

## Step 8: checkpoint_handling

After each wave completes, write a checkpoint JSON to disk. This enables resumption if execution is interrupted between waves.

### Checkpoint write

```bash
CHECKPOINT_FILE=".planning/phases/${PHASE_NUMBER}-${PHASE_SLUG}/checkpoint-wave-${WAVE_NUMBER}.json"
```

**Checkpoint JSON format:**
```json
{
  "schema": "sunco-checkpoint-v1",
  "phase": "03",
  "phase_name": "skill-system",
  "wave_completed": 1,
  "timestamp": "2026-03-31T14:22:00Z",
  "plans_completed": [
    {
      "id": "03-01",
      "title": "defineSkill runtime",
      "status": "completed",
      "lint_status": "PASS",
      "summary_path": ".planning/phases/03-skill-system/03-01-SUMMARY.md",
      "last_commit": "a3f89bc"
    }
  ],
  "plans_pending": [
    {
      "id": "03-02",
      "title": "SkillRegistry",
      "wave": 2,
      "status": "pending"
    }
  ],
  "blast_radius": {
    "risk": "MEDIUM",
    "files_in_scope": 7,
    "files_transitively_affected": 9
  },
  "lint_gate_overrides": [],
  "interrupted": false
}
```

### Checkpoint read (resumption)

On re-entry to execute-phase for the same phase number:

```bash
LATEST_CHECKPOINT=$(ls -t ".planning/phases/${PHASE_NUMBER}-${PHASE_SLUG}/checkpoint-wave-"*.json 2>/dev/null | head -1)
```

If a checkpoint exists:
1. Parse `wave_completed` — the last fully completed wave.
2. Cross-reference with `discover_and_group_plans`: plans where `has_summary: true` are already done.
3. Resume from the first incomplete wave. Report: "Resuming from Wave {N+1} — Wave {N} was completed in a prior session."

If `interrupted: true` in the checkpoint: the wave may be partially complete. Re-run only the incomplete plans within that wave (those still missing SUMMARY.md).

### Interrupt handling

If the user interrupts execution mid-wave (Ctrl+C or timeout):
1. Write an interrupt checkpoint with `interrupted: true`.
2. Set `wave_completed` to the last fully completed wave (not the interrupted one).
3. On next run: re-execute the interrupted wave's incomplete plans only.

---

## Step 9: aggregate_results

After all waves (or the specified `--wave`) complete, read all SUMMARY.md files and aggregate status.

**Per-plan status classification:**

| Condition | Status |
|-----------|--------|
| SUMMARY.md written AND lint passed | `completed` |
| SUMMARY.md written BUT lint failed (user chose skip) | `partial` |
| SUMMARY.md NOT written | `failed` |

**Write VERIFICATION.md:**

Path: `.planning/phases/{N}-{slug}/{N}-VERIFICATION.md`

```markdown
# Phase {N} Execution Report

**Phase:** {N} — {phase_name}
**Executed:** {ISO timestamp}
**Executor model:** {executor_model}

---

## Execution Summary

| Plan | Title | Wave | Status | Lint |
|------|-------|------|--------|------|
| {N}-01 | {title} | 1 | completed | PASS |
| {N}-02 | {title} | 1 | completed | PASS |
| {N}-03 | {title} | 2 | partial   | FAIL (skipped) |
| {N}-04 | {title} | 2 | failed    | —   |

**Plans completed:** {M}/{total}
**Lint gate:** {all pass | N skipped | N failed}

---

## Blast Radius

- Risk level: {LOW|MEDIUM|HIGH|CRITICAL}
- Files in scope (from plan frontmatter): {N}
- Files transitively affected: {M}

---

## Lint Gate Results

- {N}-01: PASS
- {N}-02: PASS
- {N}-03: FAIL — skipped by user
- {N}-04: NOT RUN (plan failed before lint gate)

---

## Wave Checkpoints

- Wave 1: completed at {timestamp} — checkpoint: `checkpoint-wave-1.json`
- Wave 2: completed at {timestamp} — checkpoint: `checkpoint-wave-2.json`

---

## Issues

{For each partial or failed plan:}
- [ ] {N}-03: Lint gate failed — {error_summary}. Re-run: `/sunco:execute {N} --wave 2`
- [ ] {N}-04: SUMMARY.md not written — executor may have failed. Check git log.

---

## Ready for Verify

{yes | no — list blocking reasons if no}
```

**Update STATE.md:**
```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state set \
  "current_phase.status" "executed"
```

**Commit VERIFICATION.md:**
```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" commit \
  "docs(phase-${PHASE_NUMBER}): write execution VERIFICATION.md" \
  --files ".planning/phases/${PHASE_NUMBER}-${PHASE_SLUG}/${PHASE_NUMBER}-VERIFICATION.md"
```

**Suggest next step:**
```
Phase {N} execution complete.

  Plans completed:  {M}/{total}
  Lint gate:        {all pass | N skipped}
  Blast radius:     {LOW|MEDIUM|HIGH|CRITICAL}
  Duration:         {elapsed}

Run /sunco:verify {N} for 6-layer Swiss cheese verification.
```

If partial failures: "Fix the issues listed in VERIFICATION.md, then re-run `/sunco:execute {N} --wave {failed_wave}`."

---

## Step 10: handle_partial_wave_execution

If `--wave N` was used (WAVE_FILTER is set), apply special post-execution logic.

**After the specified wave completes:**

Re-run plan discovery to see if the phase is fully complete:

```bash
POST_INDEX=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" phase-plan-index "${PHASE_NUMBER}")
REMAINING=$(echo "$POST_INDEX" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  process.stdout.write(String(JSON.parse(d).incomplete.length));
")
```

**If incomplete plans remain anywhere in the phase:**

- STOP. Do NOT write the final VERIFICATION.md.
- Do NOT update STATE.md to `"executed"`.
- Do NOT suggest `/sunco:verify`.
- Present:

```
## Wave {WAVE_FILTER} Complete

Wave {WAVE_FILTER} finished successfully. This phase has {REMAINING} incomplete plans remaining.
Phase-level verification was intentionally skipped — the phase is not yet fully executed.

Continue execution:
  /sunco:execute {phase}                        — run all remaining waves
  /sunco:execute {phase} --wave {next_wave}     — run the next wave explicitly
```

**If no incomplete plans remain after the selected wave:**

The specified wave was the last remaining work in the phase. Continue with the full `aggregate_results` flow: write VERIFICATION.md, update STATE.md to `"executed"`, suggest `/sunco:verify`.

---

## Templates

### SUMMARY.md Template

Path: `.planning/phases/{N}-{slug}/{N}-{M}-SUMMARY.md`

```markdown
---
plan: {N}-{M}
title: {plan_title}
phase: {phase_number}
wave: {wave_number}
status: {completed|partial|failed}
lint_status: {PASS|FAIL}
executed_at: {ISO timestamp}
executor_model: {model_slug}
---

# Plan {N}-{M}: {plan_title} — Execution Summary

## Objective Achieved

{One paragraph: what was built and whether the plan objective was met.
Be specific — name files created, interfaces exposed, behaviors enabled.}

## Tasks Completed

| # | Task | Commit | Notes |
|---|------|--------|-------|
| 1 | {task_title} | {short_sha} | {any deviation or note} |
| 2 | {task_title} | {short_sha} | — |
| 3 | {task_title} | {short_sha} | — |

## Key Files

### Created
- `{file_path}` — {one-line description}

### Modified
- `{file_path}` — {what changed and why}

## Acceptance Criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| {criterion from plan} | PASS | — |
| {criterion from plan} | FAIL | {reason, if failed} |

## Lint Gate

**Status:** {PASS | FAIL}

{If FAIL:}
### Lint Errors
```
{first 10 error lines from lint output}
```

## Deviations

{List any files touched outside files_modified, or tasks skipped. If none: "None."}

## Self-Check

{PASS | FAILED}

{If FAILED: brief explanation of what was not completed and why.}
```

---

### Checkpoint JSON Format

Path: `.planning/phases/{N}-{slug}/checkpoint-wave-{W}.json`

```json
{
  "schema": "sunco-checkpoint-v1",
  "phase": "03",
  "phase_name": "skill-system",
  "phase_slug": "03-skill-system",
  "wave_completed": 1,
  "timestamp": "2026-03-31T14:22:00Z",
  "plans_completed": [
    {
      "id": "03-01",
      "title": "defineSkill runtime",
      "status": "completed",
      "lint_status": "PASS",
      "summary_path": ".planning/phases/03-skill-system/03-01-SUMMARY.md",
      "last_commit": "a3f89bc",
      "files_written": [
        "packages/core/src/skill/define-skill.ts",
        "packages/core/src/skill/skill-types.ts"
      ]
    }
  ],
  "plans_pending": [
    {
      "id": "03-02",
      "title": "SkillRegistry",
      "wave": 2,
      "status": "pending"
    }
  ],
  "blast_radius": {
    "risk": "MEDIUM",
    "files_in_scope": 7,
    "files_transitively_affected": 9
  },
  "lint_gate_overrides": [
    {
      "plan_id": "03-01",
      "decision": "skip",
      "reason": "user override",
      "timestamp": "2026-03-31T14:18:00Z"
    }
  ],
  "branch": "phase/03-skill-system",
  "interrupted": false,
  "next_wave": 2
}
```

---

### Git Branch Creation Logic

```bash
# Determine branch name from strategy
STRATEGY=$(echo "$INIT" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  process.stdout.write(JSON.parse(d).branching_strategy);
")

BRANCH_NAME=$(echo "$INIT" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  process.stdout.write(JSON.parse(d).branch_name);
")

# Create or check out branch
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  # Branch exists — check out without error
  git checkout "${BRANCH_NAME}"
  echo "Checked out existing branch: ${BRANCH_NAME}"
else
  # Branch does not exist — create from current HEAD
  git checkout -b "${BRANCH_NAME}"
  echo "Created branch: ${BRANCH_NAME}"
fi
```

Branch naming conventions:
- `"phase"` strategy: `phase/{phase_number}-{phase_slug}` (e.g. `phase/03-skill-system`)
- `"milestone"` strategy: `milestone/{milestone_slug}` (e.g. `milestone/alpha`)
- `--branch` flag override: same as `"phase"` strategy naming

After all waves: commit VERIFICATION.md to the phase branch:
```bash
git add ".planning/phases/${PHASE_NUMBER}-${PHASE_SLUG}/${PHASE_NUMBER}-VERIFICATION.md"
git commit -m "docs(phase-${PHASE_NUMBER}): write execution VERIFICATION.md"
```

---

## Blast Radius Warning Reference

| Threshold | Risk Level | Behavior |
|-----------|------------|----------|
| 0–3 files transitively affected | LOW | Silent. Proceed. |
| 4–10 files transitively affected | MEDIUM | Show notice. Proceed automatically. Log in VERIFICATION.md. |
| 11–20 files transitively affected | HIGH | Show warning. Proceed automatically. Log with prominence in VERIFICATION.md. |
| > 20 files transitively affected | CRITICAL | BLOCK. Require `yes` from user. Cannot proceed without explicit confirmation. |
| Any file touches a public API export (`index.ts` / `src/index.ts`) | HIGH | Show warning. User may proceed without explicit confirmation. |
| Any file in `files_modified` is under `.planning/` | WARN | Flag as unauthorized scope. Block unless user types `yes`. |

**Blast radius is analyzed once before the first wave.** It is not re-analyzed between waves. If Wave 1 adds new imports that expand the blast radius, this will not be recaught — this is acceptable because the plans define the intended scope before execution begins.

---

## Failure Handling

| Failure mode | Detection | Response |
|---|---|---|
| Executor agent fails | SUMMARY.md missing after timeout | Report. Ask "Retry plan?" or "Continue?" |
| Lint-gate fails | Non-zero exit from eslint/tsc | Present errors. Ask fix/skip/abort. |
| Pre-commit hook fails (post-wave) | Non-zero exit from `git hook run` | Report. Ask "Fix now?" or "Continue?" |
| Dependency cycle | Wave analysis in validate_phase | Abort with specific cycle description. |
| Key-link missing (cross-wave) | sunco-tools verify key-links | Block wave N+1. Ask "Fix?" or "Continue?" |
| Blast radius CRITICAL | > 20 files affected | Block. Require `yes` from user. |
| classifyHandoffIfNeeded error | Error string match | Spot-check. If SUMMARY exists + commits present: treat as success. |
| Agent commits with unrelated files | Spot-check deviation section | Log warning in VERIFICATION.md. Do not block. |
| All agents in wave fail | Zero SUMMARY.md files written | Stop. Report systemic failure. Suggest `/sunco:diagnose`. |

---

## Resumption

Re-run `/sunco:execute {phase}` at any time.

`discover_and_group_plans` skips plans where `has_summary: true`. Execution resumes from the first incomplete plan in the lowest incomplete wave.

`checkpoint_handling` reads the most recent checkpoint JSON to determine `wave_completed`. If an interrupted checkpoint is found, only the incomplete plans within that wave are re-executed.

STATE.md tracks: last completed plan, current wave, pending lint overrides.

A clean re-run after full completion produces: "No matching incomplete plans — phase may already be complete. Run `/sunco:verify {N}`."

---

## Routing Summary

| Condition after aggregate_results | Next suggested command |
|----------------------------------|------------------------|
| All complete, lint passes | `/sunco:verify {N}` |
| Some plans partial (lint skipped) | `/sunco:execute {N} --wave {wave}` after fixing lint |
| Some plans failed | `/sunco:execute {N} --wave {wave}` after investigation |
| `--wave N` used and plans remain | `/sunco:execute {N}` or `--wave {next}` |
| `--wave N` used and phase is now complete | `/sunco:verify {N}` |
