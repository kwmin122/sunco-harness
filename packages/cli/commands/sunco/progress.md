---
name: sunco:progress
description: Show overall project progress, current phase status, requirements coverage, git velocity, phase dependency view, and route to next action.
argument-hint: "[--verbose] [--phase N] [--json] [--compact] [--no-git]"
allowed-tools:
  - Read
  - Bash
---

<context>
**Flags:**
- `--verbose` — Show full details for each phase including plan titles and acceptance criteria.
- `--phase N` — Show detailed progress for a specific phase only (task-level status).
- `--json` — Machine-readable JSON output for CI pipelines.
- `--compact` — Condensed single-screen view.
- `--no-git` — Skip git activity section (useful in environments without git).
</context>

<objective>
Show a comprehensive progress dashboard: completed phases, current phase status, requirements coverage table, phase dependency visualization, blocker tracking, recent git activity, and the recommended next action with routing logic. Read-only — does not modify any files.
</objective>

<process>
## Step 1: Parse arguments

| Token | Variable | Default |
|-------|----------|---------|
| `--phase <N>` | `PHASE_FILTER` | unset (show all) |
| `--json` | `JSON_OUTPUT` | false |
| `--compact` | `COMPACT` | false |
| `--no-git` | `NO_GIT` | false |
| `--verbose` | `VERBOSE` | false |

If `--json`: render output as a JSON object (machine-readable). Skip all formatting.

---

## Step 2: Read project state

Read:
1. `.planning/STATE.md` — current phase, status, last activity, milestone
2. `.planning/ROADMAP.md` — all phases with goals and completion markers
3. `.planning/REQUIREMENTS.md` — requirement list (optional; skip if absent)
4. `.planning/phases/*/` — all phase directories (CONTEXT.md, PLAN.md, SUMMARY.md, VERIFICATION.md)

**If `.planning/STATE.md` does not exist:**
Show "No SUNCO project found. Run `/sunco:init` to get started." and stop.

**If `.planning/ROADMAP.md` does not exist:**
Skip phase table. Show plans and git sections only.

---

## Step 3: Build phase status map

For each phase in ROADMAP.md:
- Check if CONTEXT.md exists → discussed
- Check if PLAN.md files exist (count) → planned
- Check if SUMMARY.md files exist (count) → executed
- Check if VERIFICATION.md exists (and result) → verified

**Status classification:**

| Status | Meaning |
|--------|---------|
| `NOT_STARTED` | No artifacts at all |
| `DISCUSSING` | CONTEXT.md exists, no plans |
| `PLANNED` | Plans exist, no summaries |
| `EXECUTING` | Some summaries exist, not all |
| `VERIFYING` | All summaries exist, no VERIFICATION.md |
| `COMPLETE` | VERIFICATION.md present and passed |
| `BLOCKED` | VERIFICATION.md present and failed |

---

## Step 4: Build requirements coverage table

Read REQUIREMENTS.md. For each requirement:
- Check if it appears in completed phase plans (search CONTEXT.md and PLAN.md files)
- Mark as `covered` if referenced in a verified phase, `planned` if referenced in a plan, `uncovered` otherwise

Calculate:
- `covered`: requirements with coverage in verified phases
- `planned`: requirements targeted in existing plans but not yet verified
- `uncovered`: requirements not referenced anywhere

Coverage percentage: `covered / total * 100`

---

## Step 5: Identify blockers

From STATE.md: extract any blockers or open decisions.
From phase status map: flag phases with `BLOCKED` status.
From git status: note if uncommitted changes exist.
From PLAN.md files: find any with `blocked: true` in frontmatter.

---

## Step 6: Git stats (unless --no-git)

```bash
git log --oneline --since="7 days ago" | wc -l
git log --oneline main..HEAD | wc -l
git log --name-only --since="7 days ago" --format="" | sort | uniq -c | sort -rn | head -10
git log --oneline -5
git log --since="7 days ago" --format="%ad" --date=short | sort | uniq -c
```

---

## Step 7: Display dashboard

If `--compact`: render condensed view. If `--phase N`: show phase drill-down only.

### Full dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [project_name] — Progress
  [current_date] · Last activity: [last_activity]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT STATE
  Phase:     [N] — [name]
  Status:    [status]
  Milestone: [milestone]

PHASE COMPLETION
  [completed]/[total] phases complete  ([pct]%)

  [████████░░░░░░░░]  50%

  | # | Phase | Plans | Status |
  |---|-------|-------|--------|
  | 01 | [name] | 4/4 | ✓ complete |
  | 02 | [name] | 3/3 | ✓ complete |
  | 03 | [name] | 2/5 | ▶ executing |
  | 04 | [name] | 0/4 | ○ planned |
  | 05 | [name] | 0/0 | ○ not started |

REQUIREMENTS COVERAGE
  [covered]/[total] requirements covered  ([pct]%)
  [planned] planned but not yet verified
  [uncovered] uncovered

  | Status | Count | % |
  |--------|-------|---|
  | Covered (verified) | [N] | [%] |
  | Planned (in-flight) | [N] | [%] |
  | Uncovered | [N] | [%] |

  Uncovered requirements:
    [If any: list req IDs and descriptions]

PLAN EXECUTION
  [plans_done]/[plans_total] plans executed  ([pct]%)

BLOCKERS
  [If any: list each blocker with phase and severity]
  [If none: "(none)"]

GIT ACTIVITY (last 7 days)
  Commits: [count]
  Files touched: [count]
  Avg per day: [avg]

  Most changed files:
    [N]x  packages/core/src/config.ts
    [N]x  packages/cli/src/index.ts

  Recent commits:
    [sha]  [message]  ([date])
    [sha]  [message]  ([date])
    [sha]  [message]  ([date])

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT ACTION
  [See Step 8]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If `--verbose`: expand each phase with plan titles and acceptance criteria summary.

If `--phase N`: show detailed breakdown of that phase only:
```
Phase [N]: [name]
  Status: [status]
  Plans:
    [plan_id]  [title]  Wave [W]  [status]
  Tasks (if executing):
    ✓ [task 1]
    ▶ [task 2] — in progress
    ○ [task 3]
  Acceptance criteria:
    ✓ [criterion 1]
    ✗ [criterion 2] — not yet verified
  Blockers:
    [If any]
```

### Compact dashboard (--compact)

```
[project] · Phase [N]/[total] · [pct_phases]% phases · [pct_reqs]% reqs · [N] commits/7d

[Phase table: one line per phase]

Next: [next_action]
```

---

## Step 8: Next action routing logic

Apply in priority order:

| Condition | Next action | Reason |
|-----------|-------------|--------|
| Any phase has `BLOCKED` status | `/sunco:verify [N]` | Resolve verification failure first |
| Uncommitted changes exist | `/sunco:quick "commit pending changes"` | Clean working tree |
| Current phase status is `VERIFYING` | `/sunco:verify [N]` | Verification not yet run |
| Current phase status is `EXECUTING` | `/sunco:execute [N]` | Incomplete plans remain |
| Current phase status is `PLANNED` | `/sunco:execute [N]` | Plans ready to execute |
| Current phase status is `DISCUSSING` | `/sunco:plan [N]` | Context exists, create plans |
| Current phase status is `NOT_STARTED` | `/sunco:discuss [N]` | Need context before planning |
| All phases `COMPLETE`, milestone open | `/sunco:milestone complete` | Archive milestone |
| Requirements coverage < 80% | `/sunco:plan` (gap filling) | Uncovered requirements remain |
| All phases `COMPLETE`, milestone closed | `/sunco:stats` | Final project summary |

Present:
```
NEXT ACTION
  [command]

  Why: [one-sentence explanation]
```

---

## Step 9: JSON output (--json)

```json
{
  "project": "[project_name]",
  "timestamp": "[ISO timestamp]",
  "current_phase": {
    "number": "[N]",
    "name": "[name]",
    "status": "[status]"
  },
  "phases": {
    "total": 8,
    "completed": 2,
    "in_progress": 1,
    "planned": 5,
    "completion_pct": 25
  },
  "requirements": {
    "total": 20,
    "covered": 12,
    "planned": 4,
    "uncovered": 4,
    "coverage_pct": 60,
    "uncovered_ids": ["REQ-04", "REQ-07"]
  },
  "plans": {
    "total": 24,
    "executed": 10,
    "execution_pct": 42
  },
  "blockers": [],
  "git": {
    "commits_7d": 14,
    "commits_30d": 38,
    "avg_per_day_7d": 2.0
  },
  "next_action": "/sunco:verify 3",
  "next_action_reason": "Phase 3 was executed but not yet verified."
}
```

---

## Phase Dependency Visualization

When `--verbose` is set, show a dependency chain between phases:

```
Phase Dependency Chain:

  [1] Config System          ✓ complete
       └── provides: config loader, TOML parser
  [2] Skill Loader           ✓ complete
       └── depends on: [1] config loader
       └── provides: skill scanner, registry
  [3] Agent Router           ▶ in-progress
       └── depends on: [2] skill registry
       └── provides: provider-agnostic agent call
  [4] Verify Pipeline        ○ planned
       └── depends on: [3] agent router
```

This visualization is derived from phase goals and deliverables in ROADMAP.md (parsed heuristically). If ROADMAP.md doesn't have explicit dependency declarations, show phases in order with a note: "(dependency order estimated from ROADMAP phase sequence)".

---

## Recent Activity from Git Log

Parse recent git commits to surface what actually changed, not just what is planned:

```bash
git log --oneline --since="7 days ago" --format="%h %s (%ad)" --date=relative 2>/dev/null | head -10
```

Display as recent activity feed:
```
RECENT ACTIVITY
  [2h ago]   feat(core): add parseConfig export — [sha]
  [5h ago]   fix(cli): resolve TypeScript error in index.ts — [sha]
  [1d ago]   transition: phase 2 complete → phase 3 initialized — [sha]
  [2d ago]   feat(phase-2): implement skill loader registry — [sha]
```

If commit messages follow conventional commits format (feat/fix/docs/etc): parse and group by type.

---

## Blocker Tracking Section

When blockers exist, add a dedicated section to the dashboard:

```
BLOCKERS
--------
  [CRITICAL] Phase 3 — Agent Router
    └── Vercel AI SDK streaming types incompatible with current setup
    └── Detected: 2026-03-30 · Source: CONTEXT.md
    └── Action: /sunco:research "Vercel AI SDK streaming TypeScript types"

  [INFO] Phase 4 — Verify Pipeline
    └── Adversarial test layer requires external API access
    └── Detected: PLAN.md blocker flag
    └── Action: /sunco:discuss 4 — decide skip vs mock strategy
```

Blockers are sourced from:
1. STATE.md `## Blockers` entries
2. CONTEXT.md `## Blockers` sections for each phase
3. PLAN.md files with `blocked: true` frontmatter
4. VERIFICATION.md files with `status: partial` or `status: failed`

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init`." |
| STATE.md missing | Read ROADMAP.md only. Skip current phase section. |
| ROADMAP.md missing | Skip phase table. Show plans and git sections only. |
| No git repository | Skip git activity section automatically. |
| Phase filter not found | "Phase [N] not found. Run `/sunco:status` to list phases." |
| REQUIREMENTS.md absent | Skip requirements section. Show "No REQUIREMENTS.md" note. |

---

## Relationship to Other Commands

| Command | Relationship |
|---------|-------------|
| `/sunco:status` | Lighter — only shows current phase, not full history |
| `/sunco:manager` | Broader — includes todos, seeds, git activity, and navigation |
| `/sunco:stats` | Deeper — full project metrics, git stats, all milestones |
| `/sunco:query` | Instant — JSON snapshot, no analysis, no LLM cost |
| `/sunco:next` | Action-only — routes immediately to next step without dashboard |

Progress is the right command when you want the full picture before deciding what to work on next. Use `/sunco:status` for a quick check, `/sunco:query` for CI, and `/sunco:manager` when you want an interactive command center.

---

## Progress as a Starting Point

After rendering the dashboard, progress should leave the user with a clear action. The recommended next action section (Step 8) is the most important output — everything else is context that justifies it.

If no clear action can be determined (all phases in unexpected state):
```
NEXT ACTION
  /sunco:status

  Why: Phase state is unclear. Run status for a detailed diagnostic.
```

If requirements coverage is the only issue (all phases complete but coverage < 80%):
```
NEXT ACTION
  /sunco:plan [uncovered requirements context]

  Why: [N] requirements are not covered by any phase plan.
       Run /sunco:progress --verbose to see which ones.
```

---

## Config Keys

| Key | Default | Effect |
|-----|---------|--------|
| `progress.show_git` | `true` | Include git activity section |
| `progress.req_coverage_target` | `80` | Warning threshold for requirements coverage |
| `progress.show_blockers` | `true` | Include blocker section |

---

## Quick Ops from Progress

After reading the dashboard, the most common follow-on commands:

```bash
# Execute the recommended action
/sunco:next

# Drill into a specific phase
/sunco:manager --phase N

# See all available commands
/sunco:help

# Get machine-readable output for scripting
/sunco:progress --json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.next_action)"
```

---

## Verbose Phase Detail (--verbose)

When `--verbose` is passed, each phase row in the table expands to show:

```
| 03 | Config System | 2/5 | ▶ executing |
     Plans:
       03-01-config-loader        Wave 1  ✓ done
       03-02-toml-parser          Wave 1  ✓ done
       03-03-schema-validation    Wave 2  ▶ executing
       03-04-error-messages       Wave 2  ○ pending
       03-05-config-hierarchy     Wave 3  ○ pending
     Acceptance criteria:
       ✓ Config loads from .sun/config.toml
       ✗ Config hierarchy (global → project → directory) — not yet verified
```

Use `--phase N` for even more detail including decisions from CONTEXT.md and blocker details.

---

## Integration with sunco:stats

`/sunco:progress` shows the current milestone view. `/sunco:stats` shows the all-time view across milestones:

| Scope | Command |
|-------|---------|
| Current milestone phases | `/sunco:progress` |
| All milestones + full history | `/sunco:stats` |
| Single phase detail | `/sunco:progress --phase N` |
| Current phase only | `/sunco:status` |
| Machine-readable snapshot | `/sunco:query` |
</process>
