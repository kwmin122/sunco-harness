---
name: sunco:execute
description: Wave-based parallel execution of phase plans. Spawns sunco-executor agents per plan, runs mandatory lint-gate after each, writes SUMMARY.md per plan. Run after /sunco:plan.
argument-hint: "<phase> [--wave N] [--interactive] [--gaps-only]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number. Required.

**Flags:**
- `--wave N` — Execute only Wave N. Use for pacing, quota management, or staged rollout.
- `--interactive` — Execute plans sequentially inline (no subagents). Lower token usage. Use for small phases, bug fixes, or pair-programming style.
- `--gaps-only` — Execute only plans with `gap_closure: true` in frontmatter. Use after `/sunco:verify` creates gap plans.
</context>

<objective>
Execute all plans in a phase using wave-based parallelization. Orchestrator stays lean: discover plans, group by wave, spawn one `sunco-executor` agent per plan, enforce mandatory lint-gate after each plan completes, write per-plan SUMMARY.md, atomic commit per plan, then aggregate results.

**Orchestrator role:** Coordinate and verify — do not execute tasks directly. Each executor agent loads its plan file and follows instructions exactly. Orchestrator reads only SUMMARY.md and lint output.

**SUNCO execution guarantees:**
- Lint-gate after EACH plan (non-negotiable, cannot be skipped)
- Atomic commit per plan (not per task, not per wave)
- SUMMARY.md per plan before moving to next plan
- STATE.md updated after all waves complete

**Creates:**
- `.planning/phases/[N]-[name]/[N]-[M]-SUMMARY.md` — per-plan execution summary
- `.planning/phases/[N]-[name]/[N]-VERIFICATION.md` — phase execution checklist

**After this command:** Run `/sunco:verify [N]` for 6-layer verification.
</objective>

<process>

## Step 1: Parse arguments and initialize

Extract phase number from $ARGUMENTS (first positional token).

If no phase number: output "Phase number required. Usage: /sunco:execute <phase>" and stop.

Parse flags (a flag is active ONLY if its literal token appears in $ARGUMENTS):
- `--wave N` active → extract N as WAVE_FILTER
- `--interactive` active → switch to inline sequential execution mode
- `--gaps-only` active → filter to gap_closure plans only

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE}[-_]* 2>/dev/null | head -1)
```

**Load context:**
1. `.planning/ROADMAP.md` — Phase N goal
2. `.planning/STATE.md` — current status
3. `${PHASE_DIR}/*-PLAN.md` — all plan files

**If no plans found:** output "No plans found in ${PHASE_DIR}. Run /sunco:plan [N] first." and exit.

**Update STATE.md for phase start:**
```bash
node $HOME/.claude/sunco/bin/sunco-tools.cjs state-update \
  --phase ${PHASE} \
  --status "executing" \
  --next "/sunco:verify ${PHASE}" \
  2>/dev/null || true
```

## Step 2: Discover and group plans by wave

Read each `[N]-*-PLAN.md` file. From each file's YAML frontmatter, extract:
- `plan:` — plan number (M)
- `wave:` — wave number
- `depends_on:` — list of plan numbers this depends on
- `title:` — plan title
- `files_modified:` — list of files
- `gap_closure:` — boolean (default false)

**Apply filters:**
- Skip plans where a corresponding `[N]-[M]-SUMMARY.md` already exists (already completed — resumable)
- If `--gaps-only`: skip plans where `gap_closure` is not `true`
- If `WAVE_FILTER` is set: skip plans where `wave` does not equal WAVE_FILTER

**Wave safety check:** If WAVE_FILTER > 1, check that all Wave 1 plans (within the current filter set) have SUMMARY.md files. If any Wave 1 plan is incomplete: stop and tell the user to complete Wave 1 first.

If all plans already have SUMMARY.md: "Phase [N] is already fully executed. Run `/sunco:verify [N]`." and exit.

**Report execution plan:**
```
## Phase [N]: [Name] — Execution Plan

[N] plan(s) across [W] wave(s)

| Wave | Plan | Title | Files |
|------|------|-------|-------|
| 1 | [N]-01 | [title] | [file count] files |
| 1 | [N]-02 | [title] | [file count] files |
| 2 | [N]-03 | [title] | [file count] files |

[If WAVE_FILTER: "Wave filter active: executing only Wave {WAVE_FILTER}"]
[If --gaps-only: "Gap closure mode: executing only gap-closure plans"]
```

## Step 3: Check interactive mode

**If `--interactive` flag is active:**

Execute plans sequentially inline without spawning subagents. For each plan (in wave order, ignoring parallel grouping):

1. Present the plan:
   ```
   ## Plan [N]-[M]: [title]

   Objective: [from <objective> block]
   Tasks: [task count]
   Files: [files_modified list]

   Options: Execute | Review first | Skip | Stop
   ```

2. If "Review first": read and display full plan file, then re-ask Execute/Skip.
3. If "Execute": read the plan file inline and follow ALL task instructions exactly, one task at a time. Do not spawn a subagent.
4. After completing all tasks in the plan:
   - Run lint-gate (Step 5 logic, inline)
   - Write SUMMARY.md (Step 6 template, inline)
   - Run atomic commit (Step 7 logic, inline)
5. Proceed to next plan.

After all interactive plans complete: skip to Step 8 (aggregate results).

## Step 4: Execute waves (parallel mode — default)

For each wave in ascending order:

### Before each wave: describe what's being built

Read each plan's `<objective>` block. Summarize concisely what this wave builds and why.

```
---
## Wave [W]

**[N]-01: [Title]**
[2-3 sentences: what this builds, technical approach, what it enables]

**[N]-02: [Title]**
[2-3 sentences: what this builds, technical approach, what it enables]

Spawning [count] executor agent(s)...
---
```

### Spawn one Task per plan in the wave

Spawn all plans in the current wave simultaneously (parallel).

```
Task(
  subagent_type="sunco-executor",
  prompt="
    <objective>
    Execute plan [N]-[M] of phase [N] ([phase name]) completely.
    Read the plan file. Follow ALL task instructions exactly. Commit after completing all tasks.
    Create SUMMARY.md. Do not skip any task.
    </objective>

    <files_to_read>
    Read these files at the start using the Read tool:
    - .planning/phases/[N]-[name]/[N]-[M]-PLAN.md  (your plan)
    - .planning/ROADMAP.md                          (project roadmap)
    - .planning/STATE.md                            (current state)
    - CLAUDE.md                                     (project conventions — follow these)
    - .planning/phases/[N]-[name]/[N]-CONTEXT.md    (decisions from discuss phase)
    </files_to_read>

    <execution_instructions>
    1. Read the plan file completely before starting any work.
    2. Execute each <task> in order. Do not skip tasks.
    3. For each task: read the files listed in <files>, follow the <action> instructions, verify each <acceptance_criteria> is met before moving on.
    4. Use the exact file paths specified in the plan's files_modified list.
    5. After completing ALL tasks: run the lint check and fix any errors.
    6. Stage ONLY the files listed in files_modified (plus any test files created).
    7. Create the SUMMARY.md (template below).
    8. Commit: git add [modified files] && git commit -m "feat(phase-[N]-[M]): [plan title summary]"
    </execution_instructions>

    <summary_template>
    Write .planning/phases/[N]-[name]/[N]-[M]-SUMMARY.md with this structure:

    # Plan [N]-[M] Summary: [title]

    ## Tasks Completed
    | Task | Status | Notes |
    |------|--------|-------|
    | [task name] | done | [any notable detail] |

    ## Files Modified
    [List each file actually modified]

    ## Test Status
    [vitest run output snippet — pass/fail counts, or "no tests" if none exist for this plan]

    ## Lint Status
    [eslint/tsc output — pass or list of errors fixed]

    ## Commit
    [git commit hash and message]

    ## Issues Encountered
    [Any deviation from plan, unexpected behavior, or decisions made during execution. "None" if clean.]
    </summary_template>

    <acceptance_check>
    Before writing SUMMARY.md, verify each item in the plan's <done_when> checklist.
    If any criterion is not met: fix it before writing SUMMARY.md.
    If a criterion cannot be met (blocker): note it clearly in Issues Encountered.
    </acceptance_check>
  "
)
```

### Wait for all agents in the wave to complete

**Completion signal fallback:** If a spawned agent does not return a completion signal but appears to have finished, do NOT block. Verify via:

```bash
# For each plan in the wave:
SUMMARY_EXISTS=$(test -f ".planning/phases/${PHASE}-*/${PHASE}-${PLAN_PADDED}-SUMMARY.md" && echo "true" || echo "false")
COMMITS_FOUND=$(git log --oneline --all --grep="${PHASE}-${PLAN_PADDED}" --since="1 hour ago" | head -1)
```

If SUMMARY.md exists AND commits are found: treat as completed. Log: `[spot-check] [N]-[M] completed (completion signal not received — verified via filesystem)`.
If SUMMARY.md does NOT exist after reasonable wait and no recent commits: treat as failed.

## Step 5: Mandatory lint-gate (after EACH plan — non-negotiable)

Run after each plan completes, before moving to the next plan or wave:

```bash
npx eslint . --max-warnings 0 2>/dev/null || npx tsc --noEmit 2>/dev/null
```

**Lint-gate decision tree:**
- **PASS** (exit code 0): log `[lint-gate] [N]-[M]: pass` — continue to next plan
- **FAIL** (non-zero exit): STOP. Do not execute remaining plans.

On lint failure:
```
## Lint Gate Failed — Plan [N]-[M]

Errors:
[paste first 20 lines of lint output]

Options:
- Fix now: describe the errors and I'll fix them inline
- Skip (not recommended): log warning, continue with remaining plans
- Abort: stop execution, report partial completion
```

Use AskUserQuestion to present these options. If "Fix now": read the flagged files, fix each lint error, re-run lint gate. If clean: commit the fix and continue. If "Abort": write partial VERIFICATION.md and exit.

## Step 6: Read SUMMARY.md and spot-check

After each agent completes:

1. Read `${PHASE_DIR}/[N]-[M]-SUMMARY.md`
2. Verify: first 2 files from "Files Modified" exist on disk
3. Check: `git log --oneline --all --grep="${PHASE}-${PLAN_PADDED}"` returns at least 1 commit
4. Check: SUMMARY.md does NOT contain `## Self-Check: FAILED`

If any spot-check fails: report which plan failed. Ask: "Retry this plan?" or "Continue with remaining plans?"

## Step 7: Atomic commit per plan

Each executor agent handles its own commit. Orchestrator verifies the commit exists via git log.

If an agent did not commit (verified via spot-check):
```bash
git add [files_modified from plan frontmatter]
git commit -m "feat(phase-${PHASE}-${PLAN}): [plan title]"
```

## Step 8: Pre-wave dependency check (waves 2+ only)

Before spawning Wave 2 agents, verify Wave 1 outputs exist:

For each Wave 2 plan, check the `depends_on` list. For each dependency:
1. Read the Wave 1 plan's `files_modified` list
2. Verify each file exists on disk
3. Check the git log for the Wave 1 commit

If any Wave 1 output is missing: STOP. Report the specific missing output and ask if the user wants to retry Wave 1 or continue anyway.

## Step 9: Aggregate results after all waves

After all selected waves complete:

```markdown
## Phase [N]: [Name] — Execution Complete

**Waves:** [W] | **Plans:** [completed]/[total]

| Wave | Plan | Title | Status | Lint |
|------|------|-------|--------|------|
| 1 | [N]-01 | [title] | done | pass |
| 1 | [N]-02 | [title] | done | pass |
| 2 | [N]-03 | [title] | done | pass |

### What Was Built
[1-2 sentences per plan from SUMMARY.md — what was built, not "tasks completed"]

### Issues Encountered
[Aggregate from all SUMMARY.md "Issues Encountered" sections, or "None"]
```

## Step 10: Write VERIFICATION.md

Write `.planning/phases/[N]-[name]/[N]-VERIFICATION.md`:

```markdown
# Phase [N] Execution Verification

## Execution Summary

| Plan | Title | Wave | Status | Lint Gate | Commit |
|------|-------|------|--------|-----------|--------|
| [N]-01 | [title] | 1 | done | pass | [hash] |

## Files Modified
[Aggregate files_modified from all plans — deduplicated]

## Lint Gate Results
- Plan [N]-01: [pass/fail]
- Plan [N]-02: [pass/fail]

## Ready for Verification
[yes — if all plans done and all lint gates passed]
[no — list what's incomplete or failed]
```

## Step 11: Update STATE.md and commit planning artifacts

```bash
node $HOME/.claude/sunco/bin/sunco-tools.cjs state-update \
  --phase ${PHASE} \
  --status "executed" \
  --next "/sunco:verify ${PHASE}" \
  2>/dev/null || true
```

Commit:
```bash
git add .planning/phases/${PHASE}-*/
git commit -m "docs(phase-${PHASE}): execution complete — summaries and verification checklist"
```

## Step 12: Route

**If --wave N was used and incomplete plans remain:**
```
Wave [N] complete. Phase [N] still has incomplete plans.

/sunco:execute [N] --wave [next wave]   # run next wave
/sunco:execute [N]                       # run all remaining waves
```
Do NOT run verification. Do NOT mark phase complete. Stop here.

**If all plans complete and all lint gates passed:**
```
Phase [N] execution complete. [M] plans executed, all lint gates passed.

Run /sunco:verify [N] for 6-layer verification.
```

**If any plans failed or lint gate was skipped:**
```
Phase [N] execution finished with issues.

Issues:
- Plan [N]-[M]: [what failed]

Fix the issues above, then:
/sunco:execute [N] --wave [wave number]   # re-run the failed wave
/sunco:execute [N]                         # re-run all incomplete plans
```

</process>
