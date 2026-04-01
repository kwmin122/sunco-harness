# Progress Workflow

Show a full project progress dashboard: phase completion, requirements coverage, recent git activity, and a suggested next action. Used by `/sunco:progress`.

---

## Overview

Five data sources, one dashboard:

1. **STATE.md** — current phase, status, last activity
2. **ROADMAP.md** — all phases, milestones, completion markers
3. **REQUIREMENTS.md** — requirement list and coverage markers
4. **Git log** — recent commits, file churn
5. **Plan files** — completed vs total plans per phase

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--phase <N>` | `PHASE_FILTER` | unset (show all) |
| `--json` | `JSON_OUTPUT` | false |
| `--compact` | `COMPACT` | false |
| `--no-git` | `NO_GIT` | false |

If `--json`: render all output as a JSON object (machine-readable for CI pipelines). Skip all formatting.

---

## Step 2: Load Context

### Load STATE.md

```bash
STATE=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state load)
```

Extract:
- `current_phase.number`
- `current_phase.name`
- `current_phase.status`
- `plans_completed`
- `plans_total`
- `last_activity`
- `project_name`
- `milestone`

### Load ROADMAP.md

```bash
ROADMAP_FILE=$(ls .planning/ROADMAP.md 2>/dev/null || ls ROADMAP.md 2>/dev/null)
```

Parse ROADMAP.md to extract each phase:
- Phase number
- Phase name
- Status marker (e.g. `[x]` for complete, `[ ]` for pending, `[>]` or `[-]` for in-progress)
- Milestone group (if present)

### Load REQUIREMENTS.md (if present)

```bash
REQ_FILE=$(ls .planning/REQUIREMENTS.md 2>/dev/null || ls REQUIREMENTS.md 2>/dev/null)
```

If not found: skip requirements section. Set `HAS_REQUIREMENTS=false`.

Parse:
- Total requirement count
- Requirements marked as covered (containing `[x]`, `DONE`, `covered`, or `✓`)
- Requirements with no plan covering them

### Load plan files

For each phase directory in `.planning/phases/`:

```bash
ls .planning/phases/ | while read phase_dir; do
  TOTAL=$(ls ".planning/phases/${phase_dir}/"*"-PLAN.md" 2>/dev/null | wc -l)
  DONE=$(ls ".planning/phases/${phase_dir}/"*"-SUMMARY.md" 2>/dev/null | wc -l)
  echo "${phase_dir}: ${DONE}/${TOTAL}"
done
```

### Load git activity (unless --no-git)

```bash
# Recent commits
git log --oneline --since="7 days ago" 2>/dev/null | head -20

# Files changed in last 7 days
git log --name-only --since="7 days ago" --format="" 2>/dev/null | sort | uniq -c | sort -rn | head -10

# Commit count by day
git log --since="7 days ago" --format="%ad" --date=short 2>/dev/null | sort | uniq -c
```

---

## Step 3: Compute Metrics

### Phase completion

Count phases per status category:
- `completed`: marker is `[x]` or status is `verified`/`shipped`
- `in-progress`: marker is `[>]`, `[-]`, or status is `executed`/`planned`/`discussed`
- `planned`: marker is `[ ]` and no plans started
- `total`: all phases

Phase completion percentage: `completed / total * 100`

### Requirements coverage

If `HAS_REQUIREMENTS`:
- `covered`: requirements with coverage marker
- `total`: all requirements
- Coverage percentage: `covered / total * 100`
- `uncovered`: list of requirement IDs with no plan yet

### Plan execution rate

Across all phases with plan files:
- `plans_done`: total SUMMARY.md files found
- `plans_total`: total PLAN.md files found
- Plan execution rate: `plans_done / plans_total * 100`

### Git velocity

- Commits in last 7 days
- Commits in last 30 days
- Most changed files (file churn leaders)
- Average commits per day (7-day period)

---

## Step 4: Render Dashboard

If `--compact`: render a condensed single-table view instead of full dashboard.

### Full dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {project_name} — Progress
  {current_date} · Last activity: {last_activity}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Current State

  Phase:   {current_phase.number} — {current_phase.name}
  Status:  {current_phase.status}
  Milestone: {milestone}

## Phase Completion

  {completed}/{total} phases complete  ({pct}%)

  {progress_bar: ████████░░░░░░░░  50%}

  | # | Phase | Plans | Status |
  |---|-------|-------|--------|
  | 01 | {name} | 4/4 | ✓ completed |
  | 02 | {name} | 3/3 | ✓ completed |
  | 03 | {name} | 2/5 | ▶ in-progress |
  | 04 | {name} | 0/4 | ○ planned |
  | 05 | {name} | 0/0 | ○ planned |

  {If PHASE_FILTER set: show only the filtered phase in detail}

## Requirements Coverage

  {If HAS_REQUIREMENTS:}
  {covered}/{total} requirements covered  ({pct}%)

  {progress_bar}

  {If uncovered requirements exist:}
  Not yet covered:
    REQ-04: {requirement description}
    REQ-07: {requirement description}

  {If not HAS_REQUIREMENTS:}
  No REQUIREMENTS.md found. Create one:
    /sunco:quick "create .planning/REQUIREMENTS.md with project requirements"

## Plan Execution

  {plans_done}/{plans_total} plans executed  ({pct}%)

## Git Activity (last 7 days)

  Commits: {count}
  Files touched: {count}
  Avg per day: {avg}

  Most changed files:
    {N}x  packages/core/src/config.ts
    {N}x  packages/cli/src/index.ts
    {N}x  .planning/phases/03-*/03-03-PLAN.md

  Recent commits:
    {sha}  {message}  ({date})
    {sha}  {message}  ({date})
    {sha}  {message}  ({date})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Suggested Next Action

  {See Step 5}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Compact dashboard (--compact)

```
{project_name} · Phase {N}/{total} · {pct_phases}% phases · {pct_reqs}% reqs · {N} commits/7d

{Phase table: abbreviated, one line per phase}

Next: {next_action}
```

---

## Step 5: Suggest Next Action

Based on the loaded state, determine the most appropriate next action.

### Decision logic (in priority order)

| Condition | Next action |
|-----------|-------------|
| Current phase has 0 plans and status is `"discussed"` | `/sunco:plan {N}` — create execution plans |
| Current phase has plans but plans_done < plans_total and status is `"planned"` | `/sunco:execute {N}` — execute remaining plans |
| Current phase status is `"executed"` and no VERIFICATION.md | `/sunco:verify {N}` — run 6-layer verification |
| Current phase status is `"verified"` and no PR exists | `/sunco:ship {N}` — create PR |
| Current phase status is `"shipped"` | `/sunco:next` — advance to next phase |
| Current phase status is `"new"` or `"pending"` | `/sunco:discuss {N}` — gather decisions |
| All phases complete and milestone not closed | `/sunco:milestone` — close milestone |
| Requirements coverage < 80% | `/sunco:plan-milestone-gaps` — plan uncovered requirements |
| No phases in progress | `/sunco:status` — review project state |

Present the suggestion:

```
Suggested next action:
  {command}

  Why: {one-sentence explanation from the condition above}
```

---

## Step 6: JSON Output (--json)

If `--json` was set, skip the formatted dashboard and output:

```json
{
  "project": "{project_name}",
  "timestamp": "{ISO timestamp}",
  "current_phase": {
    "number": "{N}",
    "name": "{name}",
    "status": "{status}"
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
    "coverage_pct": 60,
    "uncovered": ["REQ-04", "REQ-07"]
  },
  "plans": {
    "total": 24,
    "executed": 10,
    "execution_pct": 42
  },
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

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init` to initialize." |
| STATE.md missing | Read ROADMAP.md only. Skip current phase section. |
| ROADMAP.md missing | Skip phase table. Show plans and git sections only. |
| No git repository | Skip git activity section. Set `NO_GIT=true` automatically. |
| Phase filter not found | "Phase ${PHASE_FILTER} not found. Run `/sunco:status` to list available phases." |

---

## Route

Progress is read-only — it does not modify any files.

After rendering: the dashboard is complete. User can follow the suggested next action or run any `/sunco:*` command directly.

If called from `/sunco:manager`: output the dashboard inline without the border/header decoration.
