---
name: sunco:resume
description: Restore session context from the last pause. Reads HANDOFF.json and HANDOFF.md to reconstruct full project state, then routes to the next action.
argument-hint: "[--from <timestamp>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Flags:**
- `--from <timestamp>` — Resume from a specific handoff (if multiple exist). Uses most recent if omitted.
</context>

<objective>
Restore full project context from the last pause and route to the correct next action. Reads handoff document, verifies current git state, and tells you exactly what to do next.

**After this command:** Immediately ready to continue work from where you left off.
</objective>

<process>
## Step 1: Find handoff

Check for handoff files:
```bash
ls .sun/HANDOFF.json 2>/dev/null
ls .sun/HANDOFF.md 2>/dev/null
```

If `--from` in $ARGUMENTS: look for `.sun/handoffs/[timestamp]*.json`

If no handoff found: suggest running `/sunco:progress` instead.

## Step 2: Read handoff state

Read `.sun/HANDOFF.json` and `.sun/HANDOFF.md`.

Read current git state:
```bash
git status --short
git branch --show-current
git log --oneline -5
```

Compare: is the git state the same as when paused? (same branch, similar commit)

## Step 3: Verify project state

Read:
1. `.planning/STATE.md` — verify it matches handoff
2. `.planning/ROADMAP.md` — check for changes since pause
3. Any SUMMARY.md files for in-progress plans

## Step 4: Reconstruct context

Present context restoration:

```
## Session Restored

**Paused:** [timestamp ago]
**Branch:** [branch]

## Where We Left Off
[Phase N — Plan N-M description]
[What was done]

## Uncommitted Work at Pause
[list from handoff]

## Current Git Status
[clean / N files modified]

## What's Changed Since Pause
[any git commits or file changes]
```

## Step 5: Identify next action

Based on handoff state, determine next action:

- If plan was in-progress: "Continue executing Plan [N-M]"
- If plan was done, verification pending: "Run `/sunco:verify [N]`"
- If phase was done, ship pending: "Run `/sunco:ship [N]`"
- If lint was failing: "Fix lint errors first, then continue"
- If discussion was pending: "Run `/sunco:discuss [N]` to continue"

## Step 6: Ask to proceed

Show the next action clearly.
Ask: "Ready to continue? [yes/different action]"

If yes: execute the next action immediately.
If different: ask what they want to do instead.
</process>
