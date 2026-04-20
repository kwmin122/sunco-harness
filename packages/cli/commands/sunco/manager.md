---
name: sunco:manager
description: Interactive command center — current phase, overall progress, blockers, open todos, seeded ideas, recent activity, and Workflow Router recommendation with approval-envelope enforcement.
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
- `--json` — Machine-readable JSON output (now includes `route_decision` block — inline extension).
- `--refresh` — Force-reload all context instead of using cached state.

**Engine:** The "Recommended Next Action" block is sourced from `/sunco:router --recommend-only`. Dashboard rendering remains local; recommendation producer shares the Phase 52b router runtime with `/sunco:do`, `/sunco:next`, and `/sunco:mode`.
</context>

<objective>
Display a comprehensive, real-time command center for the current SUNCO project. Reads STATE.md, ROADMAP.md, recent git log — and the Workflow Router's RouteDecision — to surface the full picture: what is done, what is in progress, what is blocked, and exactly what to do next per the router's evidence-based classification.

**After this command:** Follow the recommended next action shown at the bottom of the dashboard. ACK is required for any `repo_mutate` / `repo_mutate_official` / `remote_mutate` / `external_mutate` operation per the router's `approval_envelope`.
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

## Step 4: Invoke the Workflow Router (recommendation source)

Call the router in recommend-only mode to drive the "Recommended Next Action" block and the drift banner:

```
/sunco:router --recommend-only
```

The router runs the 7-point Freshness Gate, collects evidence, classifies stage, computes confidence, and returns a schema-valid RouteDecision. Manager consumes:
- `freshness.status` → drift banner if `!== 'fresh'`
- `recommended_next` + `action.command` → "Recommended Next Action" block
- `reason[0]` → one-line why
- `confidence` + band → shown alongside recommendation
- `approval_envelope.risk_level` + `forbidden_without_ack[]` → ACK warning when relevant

Per DESIGN §6.4 risk-level-keyed drift policy, `read_only` intent (recommend-only) allows **soft-fresh**; on freshness drift the dashboard still renders with an explicit drift banner instead of refusing to draw. Ephemeral-tier decision log is written per invocation (Gate 53 L2 default).

---

## Step 5: Build phase status map

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

## Step 6: Identify blockers

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

## Step 7: Render full dashboard

```
╔══════════════════════════════════════════════════════════════╗
║  [project_name] · SUNCO Manager                              ║
║  [current_date] · Last activity: [last_activity]             ║
╚══════════════════════════════════════════════════════════════╝

[If freshness.status != 'fresh':]
⚠ ROUTER DRIFT BANNER
  Freshness: [drift|conflicted] — [N]/7 checks failed
  Failing checks: [check-id-1], [check-id-2]
  Recommendation band downgraded to LOW.
  Remediate drift before committing to Recommended Next Action.

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

★ RECOMMENDED NEXT ACTION (Workflow Router · RouteDecision)

  [action.command]
  confidence [n.nn] · [BAND] band · risk=[risk_level] · approval=[action.mode]

  Why: [reason[0]]

  [If approval_envelope.forbidden_without_ack has entries:]
  ACK required. Forbidden-without-ACK triggers:
    - [forbidden_without_ack[0]]
    - [forbidden_without_ack[1]]
  The router proposes; you execute after ACK. L14: remote_mutate and
  external_mutate are NEVER auto_safe regardless of band.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK COMMANDS

  /sunco:router        — router engine (primary UX)
  /sunco:next          — one-shot router recommendation
  /sunco:mode          — persistent router loop
  /sunco:do <text>     — natural-language intent routing
  /sunco:discuss [N]   — gather phase decisions
  /sunco:plan [N]      — create execution plans
  /sunco:execute [N]   — run the plans
  /sunco:verify [N]    — 7-layer verification
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

[If freshness drift: "⚠ Router drift — recommendation downgraded to LOW"]
[If blockers: "⚠ [count] blocker(s)"]

★ Next: [action.command] — confidence [n.nn] [BAND] risk=[risk_level]

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

Router RouteDecision (if phase is current):
  current_stage:    [stage]
  recommended_next: [stage]
  confidence:       [n.nn] ([BAND])
  approval_envelope: risk=[risk_level], ACK=[required|not required]
  freshness:        [fresh|drift|conflicted]

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
  "route_decision": {
    "current_stage": "WORK",
    "recommended_next": "WORK",
    "confidence": 0.86,
    "band": "HIGH",
    "action": { "command": "/sunco:execute 53", "mode": "auto_safe" },
    "approval_envelope": {
      "risk_level": "local_mutate",
      "triggers_required": [],
      "forbidden_without_ack": []
    },
    "freshness": { "status": "fresh", "checks_failed": [] }
  },
  "recommended": {
    "command": "/sunco:execute 53",
    "reason": "PLAN + CONTEXT present, no SUMMARY yet (phase_artifacts_complete signal)."
  }
}
```

The `route_decision` key is an inline extension — no `product-contract.md` command-count change; total commands remain 88.

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init`." |
| STATE.md missing | Render partial dashboard from ROADMAP.md only |
| ROADMAP.md missing | Render phase list from `.planning/phases/` directory scan |
| `--phase N` not found | "Phase [N] not found. Run `/sunco:status` to list phases." |
| `--do` action unknown | List valid actions, stop |
| Router returns UNKNOWN + HOLD | Drift banner shown; "Recommended Next Action" shows `HOLD — remediate drift` with the failing check IDs |
| Router runtime unavailable | Fall back to local artifact-based recommendation (pre-router behavior); emit warning: "Router unavailable; recommendation is local-only" |

---

## Relationship to Other Commands

| Command | Relationship |
|---------|-------------|
| `/sunco:router` | Canonical router engine — manager invokes it with `--recommend-only` |
| `/sunco:next` | One-shot router recommendation — same engine, no dashboard |
| `/sunco:mode` | Persistent router loop — same engine, every prompt routes |
| `/sunco:do <text>` | Intent-wrapper over router — same engine, intent_hint driven |
| `/sunco:progress` | Subset of manager — phase + requirements dashboard, no router block |
| `/sunco:status` | Lighter — only current phase status, one-liner |
| `/sunco:stats` | Deeper — full metrics across all milestones |
| `/sunco:query` | Machine-readable — JSON snapshot, no display |

Manager is the recommended daily entry point with full router awareness. Run it first when starting a session.

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

Manager is always a starting point, never a terminal action. Every view ends with the recommended next action (router-sourced) or explicit quick commands. The user always knows exactly what to run next, with the approval envelope surfaced so `forbidden_without_ack` triggers can't sneak through.
</process>

<constraints>
- "Recommended Next Action" block is ALWAYS sourced from `/sunco:router --recommend-only`; manager does not re-implement stage inference (Gate 53 L4 + L5 + L12).
- Drift banner shown when `freshness.status !== 'fresh'`; LOW band recommendation shown, not hidden.
- `approval_envelope.forbidden_without_ack[]` surfaced verbatim when non-empty. L14 invariant respected: `remote_mutate` / `external_mutate` never auto_safe.
- `--json` output includes `route_decision` block as inline extension (command count stable at 88; no product-contract change required by Phase 53).
- Stage commands byte-identical when invoked directly (R1 regression guarantee).
- Router runtime unavailability falls back to local-only recommendation with explicit warning; does not crash.
</constraints>
