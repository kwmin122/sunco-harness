---
name: sunco:manager
description: Interactive command center — shows current phase, overall progress, blockers, recent activity, and recommended next action. Read-only dashboard with quick navigation hints.
argument-hint: "[options]"
allowed-tools:
  - Read
  - Bash
---

<context>
**Arguments:**
- None. This command takes no subcommands and no positional arguments.

**Flags:**
- None. Output is always a full dashboard view.
</context>

<objective>
Display a comprehensive, real-time command center for the current SUNCO project. Reads STATE.md, ROADMAP.md, and recent git log to surface the full picture: what is done, what is in progress, what is blocked, and exactly what to do next.

**After this command:** Follow the recommended next action shown at the bottom of the dashboard.
</objective>

<process>
## Step 1: Read project artifacts

Read in order:
1. `.planning/STATE.md` — current phase, decisions, blockers, last updated
2. `.planning/ROADMAP.md` — all phases with goals and deliverables
3. `.planning/REQUIREMENTS.md` — v1/v2 requirement list
4. `.planning/phases/*/` — all phase directories (list only, check which artifacts exist)

If `.planning/STATE.md` does not exist: show "No SUNCO project found in this directory. Run `/sunco:init` to get started." and stop.

## Step 2: Gather git activity

```bash
git log --oneline -20
git branch --show-current
git log --oneline --since="7 days ago" | wc -l
git status --short | wc -l
```

## Step 3: Build phase status map

For each phase in ROADMAP.md:
- Check if `.planning/phases/[N]-*/[N]-CONTEXT.md` exists → DISCUSSED
- Check if `.planning/phases/[N]-*/*-PLAN.md` files exist → PLANNED
- Check if `.planning/phases/[N]-*/*-SUMMARY.md` files exist → EXECUTED
- Check if `.planning/phases/[N]-*/VERIFICATION.md` exists → VERIFIED
- Determine final status:
  - No artifacts: `planned`
  - Context only: `discussing`
  - Plans exist: `planned`
  - Summaries exist: `executing`
  - Verification exists and passed: `done`
  - Verification exists and failed: `blocked`

## Step 4: Identify blockers

From STATE.md, extract any blockers or open decisions.
From phase status map, flag any phases with failed verification.
From git status, note if there are uncommitted changes.

## Step 5: Determine recommended next action

Apply this priority order:
1. If any phase has status `blocked`: recommend `/sunco:verify [N]` to re-investigate
2. If current phase is `executing` (plans exist, no summaries): recommend `/sunco:execute [N]`
3. If current phase is `planned` (plans exist): recommend `/sunco:execute [N]`
4. If current phase is `discussing` (context exists, no plans): recommend `/sunco:plan [N]`
5. If current phase is `planned` (no context, no plans): recommend `/sunco:discuss [N]`
6. If all phases are `done`: recommend `/sunco:ship` or `/sunco:milestone`
7. If no phases exist: recommend `/sunco:new` or `/sunco:init`

## Step 6: Display dashboard

```
╔══════════════════════════════════════════════════════════════╗
║                    SUNCO COMMAND CENTER                      ║
╚══════════════════════════════════════════════════════════════╝

PROJECT
-------
Name:      [from STATE.md or directory name]
Branch:    [current git branch]
Updated:   [last updated timestamp from STATE.md]
Uncommitted changes: [N files]

CURRENT PHASE
-------------
Phase [N]: [phase title]
Status:    [in-progress / planned / blocked]
Progress:  [Context ✓/–] [Plans ✓/–] [Execution ✓/–] [Verified ✓/–]
Goal:      [phase goal from ROADMAP.md]

PHASE OVERVIEW
--------------
  [✓] Phase 1: [title]                     done
  [→] Phase 2: [title]                     in-progress
  [ ] Phase 3: [title]                     planned
  [ ] Phase 4: [title]                     planned
  [!] Phase 5: [title]                     blocked

REQUIREMENTS
------------
  v1: [N]/[total] covered ([%])
  v2: [N] planned

GIT ACTIVITY (7 days)
---------------------
  Commits this week: [N]
  Recent: [last 3 commit messages]

BLOCKERS
--------
  [list from STATE.md, or "None"]

RECOMMENDED NEXT ACTION
-----------------------
  → /sunco:[command] [args]
     [one-sentence reason why this is the right move]

QUICK NAVIGATION
----------------
  /sunco:progress         Full progress breakdown
  /sunco:discuss [N]      Gather phase context
  /sunco:plan [N]         Create execution plans
  /sunco:execute [N]      Run plans in parallel waves
  /sunco:verify [N]       5-layer verification
  /sunco:ship             Create PR and ship
```

## Step 7: Highlight blockers

If any blockers exist: print them in a visually prominent section after the dashboard. Label each with severity (CRITICAL / HIGH / INFO) based on whether they block execution or are informational.
</process>
