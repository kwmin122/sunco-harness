---
name: sunco:manager
description: Interactive command center — shows current phase, overall progress, blockers, open todos, seeded ideas, recent activity, and recommended next action with one-command navigation.
argument-hint: "[--phase N] [--do <action>] [--compact] [--json] [--refresh]"
allowed-tools:
  - Read
  - Bash
---

<context>
**Arguments:**
- None. This command takes no positional arguments.

**Flags:**
- `--phase N` — Show detailed drill-down for a specific phase instead of full dashboard.
- `--do <action>` — Skip dashboard and immediately route to a named action (discuss, plan, execute, verify, ship, next, health, progress, debug).
- `--compact` — Condensed single-line status + next action.
- `--json` — Machine-readable JSON output.
- `--refresh` — Force-reload all context instead of using cached state.
</context>

<objective>
Display a comprehensive, real-time command center for the current SUNCO project. Reads STATE.md, ROADMAP.md, and recent git log to surface the full picture: what is done, what is in progress, what is blocked, and exactly what to do next.

**After this command:** Follow the recommended next action shown at the bottom of the dashboard.
</objective>

<process>
## Step 1: Handle --do shortcut

If `--do <action>` is set: skip all rendering and immediately route.

| Action name | Routes to |
|-------------|-----------|
| `discuss` | `/sunco:discuss [current_phase]` |
| `plan` | `/sunco:plan [current_phase]` |
| `execute` | `/sunco:execute [current_phase]` |
| `verify` | `/sunco:verify [current_phase]` |
| `ship` | `/sunco:ship [current_phase]` |
| `next` | `/sunco:next` |
| `health` | `/sunco:health` |
| `progress` | `/sunco:progress` |
| `map` | `/sunco:map-codebase` |
| `debug` | `/sunco:debug` |

If action is not recognized:
```
Unknown action: "[action]"
Available: discuss, plan, execute, verify, ship, next, health, progress, map, debug
```

---

## Step 2: Read project artifacts

Read in order:
1. `.planning/STATE.md` — current phase, decisions, blockers, last updated
2. `.planning/ROADMAP.md` — all phases with goals and deliverables
3. `.planning/REQUIREMENTS.md` — v1/v2 requirement list (skip if absent)
4. `.planning/phases/*/` — all phase directories (check which artifacts exist)

If `.planning/STATE.md` does not exist:
```
No SUNCO project found in this directory.
Run /sunco:init to get started.
```
Stop.

---

## Step 3: Gather git activity

```bash
git log --oneline -20
git branch --show-current
git log --oneline --since="7 days ago" | wc -l
git status --short | wc -l
```

---

## Step 4: Build phase status map

For each phase in ROADMAP.md, classify status:

| Class | Marker | Meaning |
|-------|--------|---------|
| `done` | `✓` | Verified and complete |
| `active` | `▶` | Currently in progress |
| `blocked` | `⚠` | Has unresolved blockers or failed verification |
| `ready` | `→` | Prerequisite complete, ready to start |
| `pending` | `○` | Not yet started |

Determine artifact status per phase:
- No artifacts → `pending`
- CONTEXT.md only → `discussing` (→ `ready` for plan)
- PLAN.md exists → `planned` (→ `ready` for execute)
- Some SUMMARY.md exist → `executing` (→ `active`)
- All SUMMARY.md exist → `verifying`
- VERIFICATION.md passed → `done`
- VERIFICATION.md failed → `blocked`

---

## Step 5: Identify blockers

Collect blockers from:
1. CONTEXT.md `## Blockers` section for the current phase
2. Any PLAN.md file with `blocked: true` in frontmatter
3. VERIFICATION.md files with `NEEDS FIXES` status
4. STATE.md explicit blocker entries

For each blocker, assign severity:
- `CRITICAL` — blocks execution of the current phase
- `HIGH` — blocks progress but has a workaround
- `INFO` — tracked item, does not block

---

## Step 6: Determine recommended next action

Apply priority order:

1. If any phase has `blocked` status → `/sunco:verify [N]`
2. If uncommitted changes > 0 → `/sunco:quick "commit pending changes"`
3. If current phase is `executing` → `/sunco:execute [N]`
4. If current phase is `planned` → `/sunco:execute [N]`
5. If current phase is `discussing` → `/sunco:plan [N]`
6. If current phase is `pending` → `/sunco:discuss [N]`
7. If all phases `done` → `/sunco:milestone complete` or `/sunco:ship`
8. If no phases exist → `/sunco:new` or `/sunco:init`

Surface only the single highest-priority recommendation with a one-sentence reason.

---

## Step 7: Render full dashboard

```
╔══════════════════════════════════════════════════════════════╗
║  [project_name] · SUNCO Manager                              ║
║  [current_date] · Last activity: [last_activity]             ║
╚══════════════════════════════════════════════════════════════╝

▶ CURRENT PHASE

  Phase [N]: [phase_name]
  Status: [status]    Plans: [done]/[total]
  Milestone: [milestone_name]

  [If blockers exist:]
  ⚠ Blockers:
    [CRITICAL] [blocker 1]
    [HIGH]     [blocker 2]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALL PHASES

  [milestone_name] [range]
  ┌────────────────────────────────────────────────────┐
  │ ✓  01  [phase name]            4/4 plans           │
  │ ✓  02  [phase name]            3/3 plans           │
  │ ▶  03  [phase name]            2/5 plans  ← HERE   │
  │ →  04  [phase name]            0/4 plans  (ready)  │
  │ ○  05  [phase name]            —                   │
  │ ○  06  [phase name]            —                   │
  └────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REQUIREMENTS
  v1: [N]/[total] covered ([%])
  v2: [N] planned

OPEN TODOS

  [If todos exist:]
  ☐ [todo 1]
  ☐ [todo 2]
  ☐ [todo 3]
  [If > 3: "(+N more — run /sunco:todo for full list)"]

  [If no todos: "(no open todos)"]

GIT ACTIVITY (7 days)
  Commits this week: [N]
  Uncommitted changes: [N files]
  Recent: [last 3 commit messages]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

★ RECOMMENDED NEXT ACTION

  [command]

  [one-sentence reason]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK COMMANDS

  /sunco:discuss [N]   — gather phase decisions
  /sunco:plan [N]      — create execution plans
  /sunco:execute [N]   — run the plans
  /sunco:verify [N]    — 5-layer verification
  /sunco:ship          — create PR and ship
  /sunco:progress      — full progress dashboard
  /sunco:help          — all commands

  Phase drill-down: /sunco:manager --phase [N]
  Jump to action:   /sunco:manager --do <action>
```

---

## Step 8: Compact view (--compact)

```
[project] · Phase [N]/[total] · [status] · [plans_done]/[plans_total] plans

[If blockers: "⚠ [count] blocker(s)"]

★ Next: [command] — [why]

Phases: [01✓ 02✓ 03▶ 04→ 05○ 06○]
Todos: [N] open
```

---

## Step 9: Phase drill-down (--phase N)

Show detailed status for a specific phase:

```
Phase [N]: [phase_name]
Status: [status]
Directory: .planning/phases/[dir]/

Plans ([done]/[total]):
  [plan_id]  [plan_title]      Wave [W]  [status]
  [plan_id]  [plan_title]      Wave [W]  [status]

Decisions made:
  [decision 1]
  [decision 2]

Blockers:
  [blocker 1 or "(none)"]

Artifacts:
  CONTEXT.md       [exists/missing]
  PLAN files       [N] files
  SUMMARY files    [N]/[total] done
  VERIFICATION.md  [exists/missing]

Available actions:
  /sunco:discuss [N]   — re-open discussion
  /sunco:plan [N]      — create/update plans
  /sunco:execute [N]   — execute plans
  /sunco:verify [N]    — run verification
  /sunco:context [N]   — view decisions
```

---

## Step 10: JSON output (--json)

```json
{
  "project": "[name]",
  "timestamp": "[ISO]",
  "current_phase": {
    "number": "03",
    "name": "[name]",
    "status": "[status]",
    "plans_done": 2,
    "plans_total": 5,
    "blockers": []
  },
  "milestone": {
    "name": "[name]",
    "phase_range": "[range]"
  },
  "phases": [
    {"number": "01", "name": "[name]", "class": "done", "plans_done": 4, "plans_total": 4},
    {"number": "03", "name": "[name]", "class": "active", "plans_done": 2, "plans_total": 5}
  ],
  "todos": { "open": 3, "items": ["[todo 1]", "[todo 2]", "[todo 3]"] },
  "uncommitted_changes": 2,
  "recommended": {
    "command": "/sunco:execute 3",
    "reason": "Phase 3 has 3 incomplete plans."
  }
}
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init`." |
| STATE.md missing | Render partial dashboard from ROADMAP.md only |
| ROADMAP.md missing | Render phase list from `.planning/phases/` directory scan |
| `--phase N` not found | "Phase [N] not found. Run `/sunco:status` to list phases." |
| `--do` action unknown | List valid actions, stop |

---

Manager is always a starting point, never a terminal action. Every view ends with the recommended next action or explicit quick commands. The user always knows exactly what to run next.

---

## Relationship to Other Commands

| Command | Relationship |
|---------|-------------|
| `/sunco:progress` | Subset of manager — phase + requirements dashboard, no todos or seeds |
| `/sunco:status` | Lighter — only current phase status, one-liner |
| `/sunco:next` | Action-only — routes immediately without dashboard |
| `/sunco:stats` | Deeper — full metrics across all milestones |
| `/sunco:query` | Machine-readable — JSON snapshot, no display |

Manager is the recommended daily entry point. Run it first when starting a session.

---

## Seeded Ideas Ready Section

The dashboard includes a "SEEDED IDEAS READY" section when seeds have triggered:

```
SEEDED IDEAS READY

  ◈ Add streaming support — condition met: Phase 3 complete
  ◈ Research Zod v4 migration — condition met: TypeScript 6 detected
```

Seeds are planted with `/sunco:seed` and trigger when their condition is met. Manager surfaces triggered seeds so they don't get forgotten. The user can act on them with `/sunco:quick "[seed title]"` or promote to a phase with `/sunco:phase`.

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init`." |
| STATE.md missing | Render partial dashboard from ROADMAP.md only |
| ROADMAP.md missing | Render phase list from `.planning/phases/` scan |
| `--phase N` not found | "Phase [N] not found. Run `/sunco:status` to list phases." |
| `--do` action unknown | List valid actions and stop |
| Git not initialized | Skip git section; show warning |
</process>
