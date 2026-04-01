# Manager Workflow

Interactive command center. Shows a dashboard of current state, lists all phases with status, highlights the recommended next action, and enables one-command navigation to any phase or workflow. Used by `/sunco:manager`.

---

## Overview

Manager is the "home screen" of SUNCO. It does not execute work — it surfaces state and routes the user to the right command. Think of it as a mission control view.

Three modes:

| Mode | Trigger | Behavior |
|------|---------|---------|
| Dashboard | (no args) | Show full dashboard, suggest next action |
| Phase drill-down | `--phase <N>` | Show detailed phase status |
| Action route | `--do <action>` | Execute a named action directly |

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--phase <N>` | `PHASE_FILTER` | unset |
| `--do <action>` | `DO_ACTION` | unset |
| `--refresh` | `REFRESH` | false |
| `--json` | `JSON_OUTPUT` | false |
| `--compact` | `COMPACT` | false |

If `--do` is set: skip all rendering and immediately route to the named action (see Step 6).

---

## Step 2: Load Context

Load all project context. Reuse cache if available and `--refresh` not set.

```bash
INIT=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" init manager)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse fields:
- `project_name`
- `current_phase.number`, `current_phase.name`, `current_phase.status`
- `current_phase.plans_done`, `current_phase.plans_total`
- `milestone.name`, `milestone.phase_range`
- `blockers[]`
- `last_activity`
- `all_phases[]` — array of phase objects with status

Additionally, read:

```bash
# ROADMAP.md for phase list
ROADMAP=$(cat .planning/ROADMAP.md 2>/dev/null)

# Open todos
TODOS=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" todos list 2>/dev/null | head -10)

# Recent seeds that have triggered
SEEDS=$(grep -l "triggered: true" .planning/seeds/*.md 2>/dev/null | head -3)

# Open blockers from CONTEXT.md
CONTEXT_FILE=$(ls ".planning/phases/${PADDED}-"*"/CONTEXT.md" 2>/dev/null | head -1)
BLOCKERS=$(grep -A2 "## Blockers" "$CONTEXT_FILE" 2>/dev/null | grep -v "^#" | head -5)
```

---

## Step 3: Compute Dashboard State

### Phase status classification

For each phase in `all_phases[]`, classify:

| Class | Marker | Meaning |
|-------|--------|---------|
| `done` | `✓` | Shipped or verified |
| `active` | `▶` | Currently in progress |
| `blocked` | `⚠` | Has blockers |
| `ready` | `→` | Prerequisite complete, ready to start |
| `pending` | `○` | Not yet started |

### Progress bars

Phase progress: `completed_phases / total_phases`
Plan progress (current phase): `plans_done / plans_total`

### Recommended next action

Apply the same decision logic as `progress.md` (Step 5), but surface only the single highest-priority recommendation.

### Blockers

Collect blockers from:
1. CONTEXT.md `## Blockers` section for the current phase
2. Any PLAN.md file with `blocked: true` in frontmatter
3. VERIFICATION.md files with `NEEDS FIXES` status

---

## Step 4: Render Dashboard

If `--compact`: jump to compact view.

### Full dashboard

```
╔══════════════════════════════════════════════════════════╗
║  {project_name} · SUNCO Manager                          ║
║  {current_date} · Last activity: {last_activity}         ║
╚══════════════════════════════════════════════════════════╝

▶ CURRENT PHASE

  Phase {N}: {phase_name}
  Status: {status}    Plans: {done}/{total}
  Milestone: {milestone_name}

  {If blockers exist:}
  ⚠ Blockers:
    - {blocker 1}
    - {blocker 2}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALL PHASES

  {milestone_name} [{range}]
  ┌────────────────────────────────────────────────────┐
  │ ✓  01  {phase name}            4/4 plans           │
  │ ✓  02  {phase name}            3/3 plans           │
  │ ▶  03  {phase name}            2/5 plans  ← HERE   │
  │ →  04  {phase name}            0/4 plans  (ready)  │
  │ ○  05  {phase name}            —                   │
  │ ○  06  {phase name}            —                   │
  └────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPEN TODOS

  {If todos exist:}
  ☐ {todo 1}
  ☐ {todo 2}
  ☐ {todo 3}
  {If > 3: "(+N more — run /sunco:todo for full list)"}

  {If no todos: "(no open todos)"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEEDED IDEAS READY

  {If triggered seeds:}
  ◈ {seed title} — condition met: {trigger condition}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

★ RECOMMENDED NEXT ACTION

  {command}

  {one-sentence explanation}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK COMMANDS

  /sunco:discuss {N}   — gather phase decisions
  /sunco:plan {N}      — create execution plans
  /sunco:execute {N}   — run the plans
  /sunco:verify {N}    — run verification
  /sunco:ship {N}      — create PR
  /sunco:progress      — full progress dashboard
  /sunco:health        — codebase health score
  /sunco:help          — all commands

  Phase drill-down: /sunco:manager --phase <N>
```

### Compact view (--compact)

```
{project_name} · Phase {N}/{total} · {status} · {plans_done}/{plans_total} plans

{If blockers: "⚠ {blocker_count} blocker(s)"}

★ Next: {command} ({why})

Phases: {01✓ 02✓ 03▶ 04→ 05○ 06○}
Todos: {N} open · Seeds: {N} ready
```

---

## Step 5: Phase Drill-Down (--phase N)

If `--phase` is set, show detailed status for that specific phase.

```bash
PADDED=$(printf "%02d" "$PHASE_FILTER")
PHASE_DIR=$(ls -d ".planning/phases/${PADDED}-"* 2>/dev/null | head -1)
```

Read:
- `{N}-CONTEXT.md` — decisions, requirements, blockers
- All `{N}-*-PLAN.md` files — tasks, acceptance criteria, wave assignments
- All `{N}-*-SUMMARY.md` files — execution results
- `{N}-VERIFICATION.md` — if present

Render:

```
Phase {N}: {phase_name}
Status: {status}
Directory: {phase_dir}

Plans ({done}/{total}):
  {plan_id}  {plan_title}      Wave {W}  {status}
  {plan_id}  {plan_title}      Wave {W}  {status}

Decisions made:
  {decision 1}
  {decision 2}

Blockers:
  {blocker 1 or "(none)"}

Artifacts:
  CONTEXT.md       {exists/missing}
  PLAN files       {N} files
  SUMMARY files    {N}/{total} done
  VERIFICATION.md  {exists/missing}

Available actions:
  /sunco:discuss {N}   — re-open discussion
  /sunco:plan {N}      — create/update plans
  /sunco:execute {N}   — execute plans
  /sunco:verify {N}    — run verification
  /sunco:context {N}   — view decisions
```

---

## Step 6: Action Route (--do)

Recognized action names and their mappings:

| Action name | Routes to |
|-------------|-----------|
| `discuss` | `/sunco:discuss {current_phase}` |
| `plan` | `/sunco:plan {current_phase}` |
| `execute` | `/sunco:execute {current_phase}` |
| `verify` | `/sunco:verify {current_phase}` |
| `ship` | `/sunco:ship {current_phase}` |
| `next` | `/sunco:next` |
| `health` | `/sunco:health` |
| `progress` | `/sunco:progress` |
| `map` | `/sunco:map-codebase` |
| `debug` | `/sunco:debug` |

If action is not recognized:

```
Unknown action: "{DO_ACTION}"

Available actions: discuss, plan, execute, verify, ship, next, health, progress, map, debug
```

---

## Step 7: JSON Output (--json)

If `--json`:

```json
{
  "project": "{name}",
  "timestamp": "{ISO}",
  "current_phase": {
    "number": "03",
    "name": "{name}",
    "status": "{status}",
    "plans_done": 2,
    "plans_total": 5,
    "blockers": []
  },
  "milestone": {
    "name": "{name}",
    "phase_range": "{range}"
  },
  "phases": [
    {"number": "01", "name": "{name}", "class": "done", "plans_done": 4, "plans_total": 4},
    {"number": "02", "name": "{name}", "class": "done", "plans_done": 3, "plans_total": 3},
    {"number": "03", "name": "{name}", "class": "active", "plans_done": 2, "plans_total": 5}
  ],
  "todos": {
    "open": 3,
    "items": ["{todo 1}", "{todo 2}", "{todo 3}"]
  },
  "seeds_triggered": 1,
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
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init` to initialize." |
| STATE.md missing | Render partial dashboard from ROADMAP.md only |
| ROADMAP.md missing | Render phase list from directory scan of `.planning/phases/` |
| `--phase N` not found | "Phase ${N} not found. Run `/sunco:status` to list phases." |
| `--do` action unknown | List valid actions, stop |

---

## Route

Manager is always a starting point, never a terminal action.

Every rendered view ends with the recommended next action. The user can:
1. Run the recommended command
2. Navigate via `--phase N` to inspect a specific phase
3. Navigate via `--do <action>` to jump directly to any workflow
4. Use the quick commands listed at the bottom of the dashboard
