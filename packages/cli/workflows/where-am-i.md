# Where Am I Workflow

Complete orientation dashboard: current phase, all decisions made, recent artifact changes, blockers, rollback points, and decision history timeline. A "you are here" command for context recovery. Used by `/sunco:context`.

---

## Core Principle

**Read-only.** This workflow never writes files, creates commits, or mutates state. It reads every available signal from the planning directory and git history, then renders a single comprehensive orientation summary. The goal: after reading the output, you know exactly where you are, what was decided, what changed, what is blocked, and where you can safely roll back to.

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--phase <N>` | `PHASE_FILTER` | unset (show current) |
| `--json` | `JSON_OUTPUT` | false |
| `--decisions-only` | `DECISIONS_ONLY` | false |
| `--no-git` | `NO_GIT` | false |

---

## Step 2: Load State

```bash
STATE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state load)
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

If STATE.md is missing: fall back to ROADMAP.md to infer current phase (first phase without `[x]` marker).

---

## Step 3: Load All Phases

```bash
ROADMAP_FILE=$(ls .planning/ROADMAP.md 2>/dev/null || ls ROADMAP.md 2>/dev/null)
```

Parse ROADMAP.md to extract:
- Phase number, name, status marker (`[x]`, `[ ]`, `[>]`, `[-]`)
- Milestone group (if present)

Count:
- `total_phases`
- `completed_phases` (marker `[x]`)
- `in_progress_phases` (marker `[>]` or `[-]`)
- `planned_phases` (marker `[ ]`)

Compute `completion_pct = completed_phases / total_phases * 100`.

---

## Step 4: Collect All Decisions

Scan every CONTEXT.md across all phase directories:

```bash
ls -d .planning/phases/*/ 2>/dev/null | sort | while read phase_dir; do
  PHASE_NUM=$(basename "$phase_dir" | cut -d'-' -f1)
  CONTEXT_FILE="${phase_dir}CONTEXT.md"
  if [[ -f "$CONTEXT_FILE" ]]; then
    # Extract decision entries: lines matching "D-NN:" or "**D-NN**" or "### D-NN"
    grep -E "(^###?\s*D-[0-9]+|^\*\*D-[0-9]+\*\*|^- D-[0-9]+:)" "$CONTEXT_FILE"
  fi
done
```

For each decision found, extract:
- Decision ID (e.g. `D-01`)
- Phase number it belongs to
- Decision summary (rest of the line or next non-empty line)
- Whether it is marked as `LOCKED`, `OPEN`, or `REVISITED`

Build a flat list: `all_decisions[]` with `{phase, id, summary, status}`.

If `PHASE_FILTER` is set: only collect from that phase.

---

## Step 5: Check Artifact Changes

```bash
HASH_CHECK=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash check 2>/dev/null)
```

Parse the JSON output:
- `changed`: boolean
- `artifacts[]`: list of `{file, old_hash, new_hash}`

If `artifact-hash check` is not available or returns error: skip this section. Set `HAS_HASH_CHECK=false`.

If `changed` is true: list each changed artifact with its filename.

Additionally, check recent git changes to planning artifacts (unless `--no-git`):

```bash
git log --oneline --since="3 days ago" -- ".planning/" 2>/dev/null | head -15
```

---

## Step 6: Collect Blockers and Warnings

### From VERIFICATION.md files

```bash
ls .planning/phases/*/VERIFICATION.md 2>/dev/null | while read vfile; do
  PHASE_NUM=$(basename "$(dirname "$vfile")" | cut -d'-' -f1)
  # Extract FAIL lines or warning lines
  grep -E "(FAIL|WARNING|BLOCKED|❌)" "$vfile" 2>/dev/null
done
```

### From STATE.md blockers field

If STATE.md has a `blockers` or `warnings` section, extract those entries.

### From CONTEXT.md open questions

```bash
ls -d .planning/phases/*/ 2>/dev/null | sort | while read phase_dir; do
  CONTEXT_FILE="${phase_dir}CONTEXT.md"
  if [[ -f "$CONTEXT_FILE" ]]; then
    # Extract open questions: lines with "OPEN", "TBD", "TODO", "?"
    grep -iE "(OPEN|TBD|TODO|\?$)" "$CONTEXT_FILE" 2>/dev/null | head -5
  fi
done
```

Build a flat list: `blockers[]` with `{phase, type, description}`.

---

## Step 7: Collect Rollback Points

```bash
ROLLBACKS=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point list 2>/dev/null)
```

If rollback-point list is not available: fall back to git tags:

```bash
git tag -l "sunco/rollback/*" --sort=-version:refname 2>/dev/null | head -10
```

For each rollback point, extract:
- Label (e.g. `after-discuss-phase-2`)
- Timestamp
- Phase it corresponds to

Build: `rollback_points[]` with `{label, timestamp, phase}`.

---

## Step 8: Format Output

If `--decisions-only`: skip to the Decisions section only, render it, and exit.

### Full orientation dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {project_name} — Where Am I
  {current_date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Current Position

  Phase:      {current_phase.number} — {current_phase.name}
  Status:     {current_phase.status}
  Milestone:  {milestone}
  Progress:   {plans_completed}/{plans_total} plans executed
  Last activity: {last_activity}

## Phase Overview

  {completed_phases}/{total_phases} phases complete  ({completion_pct}%)

  {progress_bar: ████████░░░░░░░░  50%}

  | # | Phase | Status |
  |---|-------|--------|
  | 01 | {name} | ✓ completed |
  | 02 | {name} | ✓ completed |
  | 03 | {name} | ▶ in-progress |
  | 04 | {name} | ○ planned |

## All Decisions

  {total_decisions} decisions across {phases_with_decisions} phases

  Phase 01 — {phase_name}
    D-01: {summary}  [LOCKED]
    D-02: {summary}  [LOCKED]

  Phase 02 — {phase_name}
    D-01: {summary}  [LOCKED]
    D-02: {summary}  [OPEN]

  Phase 03 — {phase_name}
    D-01: {summary}  [LOCKED]

  {If no decisions found:}
  No decisions recorded yet. Run `/sunco:discuss` to begin.

## Artifact Changes

  {If HAS_HASH_CHECK and changed:}
  ⚠ Artifacts changed since last operation:
    {file_1} — hash mismatch
    {file_2} — hash mismatch

  Run `/sunco:next` to trigger impact analysis.

  {If HAS_HASH_CHECK and not changed:}
  All artifacts match stored hashes. No drift detected.

  {If not HAS_HASH_CHECK:}
  Artifact hash tracking not available. Run any /sunco command to initialize.

  Recent planning changes (last 3 days):
    {sha} {message} ({date})
    {sha} {message} ({date})

## Blockers & Warnings

  {If blockers exist:}
  {count} item(s) need attention:

    [Phase {N}] {type}: {description}
    [Phase {N}] {type}: {description}

  {If no blockers:}
  No blockers or warnings found.

## Rollback Points

  {If rollback_points exist:}
  {count} rollback point(s) available:

    {timestamp}  {label}  (Phase {N})
    {timestamp}  {label}  (Phase {N})
    {timestamp}  {label}  (Phase {N})

  Restore: /sunco:backtrack --label "{label}"

  {If no rollback points:}
  No rollback points recorded yet. They are created automatically on state transitions.

## Decision Timeline

  {Chronological view of all decisions across phases}

  {date}  Phase 01  D-01  {summary}
  {date}  Phase 01  D-02  {summary}
  {date}  Phase 02  D-01  {summary}
  {date}  Phase 03  D-01  {summary}
          ▲
          └── You are here

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Decision timeline construction

For each decision, approximate the date from the git log of its CONTEXT.md:

```bash
git log -1 --format="%ad" --date=short -- "${phase_dir}CONTEXT.md" 2>/dev/null
```

If git history is unavailable: omit dates, show decisions in phase order only.

---

## Step 9: JSON Output (--json)

If `--json`:

```json
{
  "project": "{project_name}",
  "timestamp": "{ISO}",
  "current_phase": {
    "number": "{N}",
    "name": "{name}",
    "status": "{status}",
    "plans_completed": 2,
    "plans_total": 5
  },
  "milestone": "{milestone}",
  "phases": {
    "total": 8,
    "completed": 2,
    "in_progress": 1,
    "planned": 5,
    "completion_pct": 25
  },
  "decisions": [
    {"phase": "01", "id": "D-01", "summary": "...", "status": "LOCKED", "date": "2026-03-28"},
    {"phase": "01", "id": "D-02", "summary": "...", "status": "LOCKED", "date": "2026-03-28"},
    {"phase": "02", "id": "D-01", "summary": "...", "status": "OPEN", "date": "2026-03-30"}
  ],
  "artifact_changes": {
    "changed": false,
    "artifacts": []
  },
  "blockers": [
    {"phase": "03", "type": "FAIL", "description": "lint gate failed on plan 03-02"}
  ],
  "rollback_points": [
    {"label": "after-discuss-phase-2", "timestamp": "2026-03-29T14:30:00Z", "phase": "02"},
    {"label": "after-plan-phase-3", "timestamp": "2026-03-30T09:15:00Z", "phase": "03"}
  ]
}
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init` to initialize." |
| STATE.md missing | Infer current phase from ROADMAP.md. Show warning: "STATE.md not found — inferring from ROADMAP.md." |
| ROADMAP.md missing | Skip phase overview. Show decisions and git sections only. |
| No CONTEXT.md files found | Show empty decisions section with guidance to run `/sunco:discuss`. |
| No git repository | Skip timeline dates, artifact git log, and recent changes. Set `NO_GIT=true`. |
| Phase filter not found | "Phase {PHASE_FILTER} not found in `.planning/phases/`." |
| `sunco-tools.cjs` not found | Fall back to direct file reads for STATE.md. Skip artifact-hash and rollback-point features. |

---

## Route

Where Am I is read-only. After rendering, no files are modified.

Suggested next actions based on state:

| Condition | Suggestion |
|-----------|------------|
| Artifact changes detected | `/sunco:next` — triggers impact analysis |
| Current phase has open decisions | `/sunco:discuss {N}` — resolve open questions |
| Current phase has no plans yet | `/sunco:plan {N}` — create execution plans |
| Blockers exist | Address blockers before proceeding |
| No decisions recorded | `/sunco:discuss` — begin the discussion phase |
| Everything clean, phase in progress | `/sunco:execute {N}` — continue execution |
