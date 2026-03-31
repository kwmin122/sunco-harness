---
name: sunco:pause
description: Save session state and create a handoff document. Use when stopping work mid-session so you or another agent can resume with full context.
argument-hint: "[--note <message>]"
allowed-tools:
  - Read
  - Bash
  - Write
---

<context>
**Flags:**
- `--note <message>` — Add a note about why you're pausing or what to do next.
</context>

<objective>
Capture full session context into a handoff document so work can resume cleanly from any context window.

**Creates:**
- `.sun/HANDOFF.json` — machine-readable session state
- `.sun/HANDOFF.md` — human-readable handoff document

**After this command:** Run `/sunco:resume` in a new session to restore context.
</objective>

<process>
## Step 1: Gather current state

Read:
1. `.planning/STATE.md` — current phase and status
2. `.planning/ROADMAP.md` — phase structure
3. Current git status: `git status --short`
4. Recent git log: `git log --oneline -10`
5. Any in-progress files (modified but not committed)
6. `.sun/auto.lock` if exists (running pipeline state)

## Step 2: Identify what's in progress

Determine:
- Current phase number
- Which plans are done / in-progress / not started
- Any failing tests or lint errors
- Uncommitted work
- Any pending decisions

## Step 3: Write HANDOFF.json

```json
{
  "timestamp": "[ISO timestamp]",
  "project": "[name from package.json]",
  "currentPhase": [N],
  "currentPlan": "[N-M or null]",
  "status": "paused",
  "gitBranch": "[branch name]",
  "uncommittedFiles": ["[files]"],
  "pendingDecisions": ["[decision 1]"],
  "nextAction": "[what to do when resuming]",
  "note": "[--note content if provided]",
  "planningState": {
    "completedPhases": [[phases]],
    "inProgressPhase": [N],
    "blockers": ["[blocker]"]
  }
}
```

## Step 4: Write HANDOFF.md

```markdown
# Session Handoff

**Paused:** [timestamp]
**Branch:** [branch]

## What I Was Doing
[current phase and plan description]

## What's Done
- Phase [N]: [status]
- Current plan [N-M]: [status]

## What's NOT Done Yet
- [ ] [remaining task 1]
- [ ] [remaining task 2]

## Uncommitted Work
[list of modified files and what they contain]

## Pending Decisions
[list]

## To Resume
Run `/sunco:resume` and continue from [specific next step].

## Note
[--note content if provided]
```

## Step 5: Report

Show: "Session saved. Run `/sunco:resume` to continue."
If uncommitted work: "Warning: [N] files are uncommitted. Consider committing before resuming."
</process>
