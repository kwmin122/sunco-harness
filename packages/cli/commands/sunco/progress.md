---
name: sunco:progress
description: Show overall project progress, current phase status, and route to next action. A dashboard view of where you are.
argument-hint: "[--verbose] [--phase N]"
allowed-tools:
  - Read
  - Bash
---

<context>
**Flags:**
- `--verbose` — Show full details for each phase.
- `--phase N` — Show detailed progress for a specific phase only.
</context>

<objective>
Show a comprehensive progress dashboard: completed phases, current phase status, upcoming phases, and the recommended next action. Read-only — does not modify any files.
</objective>

<process>
## Step 1: Read project state

Read:
1. `.planning/STATE.md`
2. `.planning/ROADMAP.md`
3. `.planning/REQUIREMENTS.md`
4. `.planning/phases/*/` — all phase directories

## Step 2: Build phase status map

For each phase in ROADMAP.md:
- Check if CONTEXT.md exists
- Check if PLAN.md files exist (count)
- Check if SUMMARY.md files exist (count)
- Check if VERIFICATION.md exists (and result)
- Determine status: NOT_STARTED | DISCUSSING | PLANNING | EXECUTING | VERIFYING | COMPLETE

## Step 3: Count requirements coverage

Read REQUIREMENTS.md.
For each requirement, check if it appears in completed phase plans.
Calculate: [N/total] v1 requirements covered.

## Step 4: Git stats

```bash
git log --oneline --since="7 days ago" | wc -l
git log --oneline main..HEAD | wc -l
```

## Step 5: Display dashboard

```
== SUNCO Progress ==

Project: [name]
Branch: [branch]
Last Update: [date from STATE.md]

PHASES
------
[1] Phase 1: [title]                    [COMPLETE ✓]
[2] Phase 2: [title]                    [IN PROGRESS →]
    └─ Context: ✓ | Plans: 2/3 | Executed: 1/3 | Verified: -
[3] Phase 3: [title]                    [NOT STARTED]
[4] Phase 4: [title]                    [NOT STARTED]

REQUIREMENTS
------------
v1: [N/total] complete ([%])
v2: [N/total] planned

GIT ACTIVITY (7 days)
---------------------
Commits: [N]
Files changed: [N]

NEXT ACTION
-----------
→ /sunco:[command] [args]
   Reason: [why this is next]
```

If `--verbose`: expand each phase with plan titles and acceptance criteria summary.

If `--phase N`: show detailed breakdown of that phase only with task-level status.
</process>
