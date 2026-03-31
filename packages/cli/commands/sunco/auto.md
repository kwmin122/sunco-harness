---
name: sunco:auto
description: Full autonomous pipeline — runs discuss→plan→execute→lint-gate→verify for all remaining phases without manual intervention. Includes crash recovery and adaptive replanning.
argument-hint: "[--from <phase>] [--no-resume] [--budget <tokens>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Flags:**
- `--from <phase>` — Start from a specific phase number. Default: read from STATE.md.
- `--no-resume` — Start fresh even if a previous auto run was interrupted.
- `--budget <tokens>` — Hard token ceiling. Stop before exceeding. Default: no limit.
</context>

<objective>
Run the full SUNCO pipeline autonomously for all remaining phases.

**Pipeline per phase:**
1. discuss (assumptions mode) → confirm with user
2. plan → verify plans
3. execute (with blast radius check + lint-gate)
4. verify (5-layer)
5. Update STATE.md → move to next phase

**SUNCO diff from GSD autonomous:**
- Mandatory lint-gate after EACH plan in execute step
- Blast radius check before EACH phase execution
- Adaptive replan: re-reads ROADMAP.md after each phase (phases may shift)
- Crash recovery via AutoLock file

**After this command:** All phases shipped, or stopped at first unresolvable issue.
</objective>

<process>
## Step 1: Initialize

Check for AutoLock: `.sun/auto.lock`
- If lock exists and `--no-resume` NOT in $ARGUMENTS: resume from locked state
- If lock exists and `--no-resume` in $ARGUMENTS: delete lock, start fresh
- If no lock: create it

Read `.planning/STATE.md`:
- Get current phase
- Get all phases from ROADMAP.md
- If `--from` in $ARGUMENTS: override start phase

Write AutoLock:
```json
{
  "startedAt": "[timestamp]",
  "currentPhase": [N],
  "completedPhases": [],
  "status": "running"
}
```

## Step 2: Phase loop

For each remaining phase (from start phase to last phase):

### 2a. Adaptive ROADMAP check

Re-read `.planning/ROADMAP.md` at the START of each phase.
- If ROADMAP changed since last phase (new phases added, phases removed): acknowledge and adjust loop.
- This handles cases where a previous phase's execution modified the roadmap.

### 2b. Discuss (assumptions mode)

Run `/sunco:discuss [N] --mode assumptions`.

Show the user the assumption list.
Ask: "These are my assumptions for Phase [N]. Proceed? [yes/edit/abort]"
- If edit: run `/sunco:discuss [N]` in interactive mode to capture corrections
- If abort: update AutoLock with status=paused, stop loop
- If yes: continue

### 2c. Plan

Run `/sunco:plan [N]`.
If plan fails (e.g., insufficient context): ask user for clarification and retry once.

### 2d. Blast radius check

Before executing, check blast radius for Phase [N]:
- Read all `files_modified` from plans
- Check if overlap with previous phase's outputs
- Flag if blast radius > 10 files

### 2e. Execute with lint-gate

Run `/sunco:execute [N]`.
- Lint-gate is mandatory inside execute — this is enforced there.

If execution fails:
1. Check if failure is transient (e.g., network) → retry once
2. If lint-gate fails: ask user "Fix lint and continue? [fix/skip/abort]"
3. If agent fails: log and continue with remaining plans

### 2f. Verify

Run `/sunco:verify [N]`.

If verify FAILS:
1. Show list of failures
2. Ask: "Auto-fix issues? [yes/no]"
3. If yes: spawn fix agents for each issue, re-verify (max 2 retries)
4. If still failing after 2 retries: pause and ask user

### 2g. Update state

Update AutoLock:
```json
{
  "completedPhases": [..., N],
  "currentPhase": N+1
}
```

Update `.planning/STATE.md`:
- Mark phase N as complete
- Set current phase to N+1

### 2h. Stuck detection

Track time per phase. If a phase takes > 3x the average of completed phases:
- Ask user: "Phase [N] is taking longer than expected. Continue waiting? [yes/no]"

### 2i. Budget check

If `--budget` is set: estimate tokens used so far.
If approaching limit (> 80%): warn user and ask to continue.
If at limit: pause cleanly, update AutoLock.

## Step 3: Completion

When all phases complete:

1. Update AutoLock: status=complete
2. Update STATE.md: all phases complete
3. Show summary:
```
Autonomous pipeline complete.
  Phases completed: [N]
  Plans executed: [M]
  Issues found and fixed: [K]
  Final status: all phases verified

Run `/sunco:ship` to create PRs or `/sunco:progress` for full summary.
```

4. Delete AutoLock file.
</process>
