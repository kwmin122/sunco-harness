---
name: sunco:session-report
description: Generate a session summary with work done, decisions made, outcomes, and next steps. Run at the end of a work session.
argument-hint: "[--since <time>] [--out <path>]"
allowed-tools:
  - Read
  - Bash
  - Write
---

<context>
**Flags:**
- `--since <time>` — Report period (e.g., "2 hours ago", "today"). Default: since last session report or last 8 hours.
- `--out <path>` — Output file path. Default: `.sun/reports/session-[timestamp].md`
</context>

<objective>
Generate a comprehensive session report capturing what was accomplished, decisions made, issues encountered, and what to do next. Useful for end-of-day documentation and handoffs.

**Creates:**
- `.sun/reports/session-[timestamp].md` — session report
</objective>

<process>
## Step 1: Determine time range

If `--since` in $ARGUMENTS: use that time range.
Otherwise: check `.sun/reports/` for the most recent report date and use that as the start.
If no previous reports: use "8 hours ago".

## Step 2: Gather session activity

**Git activity:**
```bash
git log --oneline --since="[time]"
git diff --stat HEAD~[N] HEAD
```

**Planning changes:**
```bash
git log --oneline --since="[time]" -- .planning/
```

**Files modified:**
```bash
git diff --name-only HEAD~[N] HEAD
```

**State changes:**
Read current `.planning/STATE.md` and compare with git history.

## Step 3: Extract key events

From git log and planning artifacts, identify:
- Phases started/completed
- Plans created/executed
- Tests added
- Issues found and resolved
- Decisions made (from CONTEXT.md changes)

## Step 4: Generate report

```markdown
# Session Report

## Period
[start time] → [end time]

## Summary
[2-3 sentence summary of what was accomplished]

## Work Done

### Phases
- Phase [N] [started/completed/partially completed]

### Commits
[git log --oneline for period]

### Files Changed
[count] files modified, [additions] additions, [deletions] deletions

## Decisions Made
[from CONTEXT.md changes during session]

## Issues Encountered
[from debug sessions or forensics reports created]

## Outcomes
- [key result 1]
- [key result 2]

## What's Next
- [next action from STATE.md]
- Run: /sunco:next

## Token Estimate (rough)
[estimate based on session length and complexity]
```

## Step 5: Write report

Create `.sun/reports/` if needed.
Write to `.sun/reports/session-[YYYY-MM-DD-HH-MM].md`.

Show summary inline. Report: "Session report saved at [path]"
</process>
