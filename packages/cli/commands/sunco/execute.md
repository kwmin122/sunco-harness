---
name: sunco:execute
description: Execute all plans in a phase using wave-based parallel execution. Run after /sunco:plan. Includes mandatory lint-gate and blast radius check.
argument-hint: "<phase> [--wave N] [--interactive]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number. Required.

**Flags:**
- `--wave N` — Execute only Wave N. Use for pacing or quota management.
- `--interactive` — Execute plans sequentially inline (no subagents). Use for small phases or pair-programming style.
</context>

<objective>
Execute all plans in a phase using wave-based parallelization. Each plan runs in a fresh agent context. Mandatory lint-gate after each plan. Blast radius check before execution begins.

**SUNCO diff from GSD:**
- Blast radius check via `/sunco:graph --blast` BEFORE any execution
- Mandatory lint-gate (`/sunco:lint`) after EACH plan completes
- Both gates are non-negotiable and cannot be skipped

**Creates:**
- `.planning/phases/[N]-*/[N]-[M]-SUMMARY.md` — per-plan execution summary
- `.planning/phases/[N]-*/[N]-VERIFICATION.md` — phase verification checklist

**After this command:** Run `/sunco:verify [N]` for 6-layer verification.
</objective>

<process>
## Step 1: Discover plans

Read `.planning/phases/[N]-*/` and collect all `[N]-*-PLAN.md` files.

For each plan, read:
- `wave:` field in frontmatter
- `depends_on:` field in frontmatter
- `title:` field

Sort into wave groups.

## Step 2: Blast radius check (MANDATORY — cannot skip)

Before ANY execution begins, run blast radius analysis:

```bash
sunco graph --blast --phase [N]
```

Or if sunco binary not available, spawn an agent to:
1. Read all `files_modified` fields from all plans in this phase
2. Read the code graph (if `.sun/graph/` exists from /sunco:graph)
3. Identify files that transitively depend on files being modified
4. Flag any blast radius > 10 files as HIGH RISK
5. Flag any blast radius > 3 files touching public interfaces as MEDIUM RISK

If HIGH RISK found: ask user to confirm before proceeding.
Show: "These [N] files will be affected beyond the plan scope: [list]"

## Step 3: Execute waves

For each wave (starting from Wave 1):

### Wave execution

If `--interactive` is in $ARGUMENTS:
- Execute plans sequentially inline
- Show progress after each task

Otherwise (default — parallel):
- Spawn one Agent per plan in the wave
- **Agent name:** `sunco-executor` with description `Execute plan [N]-[M]`
- Each agent runs with fresh context (model: sonnet)
- Agents run in parallel within the wave

**Per-plan agent prompt:**
```
Execute this plan completely. Read the plan file first.

Plan: .planning/phases/[N]-[phase-name]/[N]-[M]-PLAN.md

Instructions:
1. Read the plan file
2. Read all referenced files
3. Complete all tasks in order
4. Make atomic commits after each task (not after entire plan)
5. Verify each acceptance criterion before moving to next task
6. Write a SUMMARY.md when done

Commit message format: "feat([scope]): [description]"

When done, write: .planning/phases/[N]-[phase-name]/[N]-[M]-SUMMARY.md
```

### MANDATORY lint-gate after each plan

After each plan completes, run:
```bash
sunco lint
```

Or if binary not available:
```bash
npx eslint packages/ --max-warnings 0
npx tsc --noEmit
```

**Lint-gate rules:**
- If lint PASSES: continue to next plan
- If lint FAILS: STOP. Do not execute next plans.
  - Show which plan caused failures
  - Ask user: "Fix lint errors before continuing? [fix/skip/abort]"
  - If skip: log warning and continue (with visible warning in final report)
  - If abort: stop execution, report partial completion

## Step 4: Collect results

After all waves complete (or after current wave if --wave N):

For each plan, check if `[N]-[M]-SUMMARY.md` was created.
- Plans with SUMMARY = completed
- Plans without SUMMARY = may have failed

## Step 5: Write VERIFICATION.md

```markdown
# Phase [N] Verification

## Execution Summary

| Plan | Title | Wave | Status | Lint |
|------|-------|------|--------|------|
| [N]-01 | [title] | 1 | [done/failed] | [pass/fail] |

## Blast Radius Check
- Status: [clean/warnings/high-risk]
- Files affected beyond scope: [N]

## Lint Gate Results
- Plan [N]-01: [pass/fail]
- Plan [N]-02: [pass/fail]

## Ready for Verify
[yes/no — yes if all plans done and lint passes]
```

## Step 6: Report and route

Show:
```
Phase [N] execution complete.
  Plans completed: [M]/[total]
  Lint gate: [all pass / N failed]
  Blast radius: [clean / warnings]
```

If all complete and lint passes: "Run `/sunco:verify [N]` for 6-layer verification."
If failures: "Fix the issues above, then re-run `/sunco:execute [N] --wave [failed-wave]`."
</process>
