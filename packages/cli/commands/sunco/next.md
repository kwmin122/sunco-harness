---
name: sunco:next
description: Auto-detect the next logical step based on STATE.md and planning artifacts, then execute it. Zero-argument workflow advancement.
argument-hint: "[--dry-run] [--list]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Flags:**
- `--dry-run` — Show what would be run next without actually running it.
- `--list` — Show all possible next steps ranked by priority.
</context>

<objective>
Detect the current state of the project and automatically advance to the logical next step. No arguments needed — reads STATE.md and planning artifacts to determine what to do.

**After this command:** Whatever the next step was is now done.
</objective>

<process>
## Step 1: Read current state

Read (in order of priority):
1. `.sun/auto.lock` — if exists, pipeline is running
2. `.planning/STATE.md` — current phase and status
3. `.planning/ROADMAP.md` — phase structure
4. `.planning/phases/` — what artifacts exist

## Step 2: Determine state

Build state model:

```
current_phase = [N]
has_context = [CONTEXT.md exists for phase N]
has_plans = [PLAN.md files exist for phase N]
plans_executed = [SUMMARY.md files exist]
verification_done = [VERIFICATION.md exists and shows PASS]
has_uncommitted = [git status has changes]
lint_failing = [last lint run had errors]
```

## Step 3: Apply decision rules

Apply rules in priority order:

1. **If lint is failing** → "Fix lint errors first: run `/sunco:lint`"
2. **If auto.lock exists and status=running** → "Pipeline is running. Check status with `/sunco:progress`"
3. **If uncommitted changes exist** → "Uncommitted changes detected. Commit or stash before proceeding."
4. **If current phase has no CONTEXT.md** → run `/sunco:discuss [N]`
5. **If current phase has CONTEXT.md but no PLANs** → run `/sunco:plan [N]`
6. **If plans exist but no SUMMARYs** → run `/sunco:execute [N]`
7. **If SUMMARYs exist but no VERIFICATION.md** → run `/sunco:verify [N]`
8. **If VERIFICATION.md exists with PASS but no PR** → run `/sunco:ship [N]`
9. **If phase [N] is complete, phase [N+1] exists** → run `/sunco:discuss [N+1]`
10. **If all phases complete** → "All phases complete! Run `/sunco:progress` for summary."

## Step 4: If --list

Show all possible next steps:
```
Next steps (in priority order):
1. [RECOMMENDED] /sunco:[command] — [reason]
2. /sunco:[alternative] — [when to choose this instead]
3. /sunco:[alternative] — [when to choose this instead]
```

## Step 5: If --dry-run

Show: "Next action would be: `/sunco:[command] [args]`"
Explain why this was chosen.
Do NOT execute.

## Step 6: Execute

Otherwise: execute the determined next action immediately.

Before executing: show "Detected state: [brief description]. Running: `/sunco:[command] [args]`"
</process>
