# Stats Workflow

Project statistics dashboard. Reports phase counts, plan completion rates, requirements coverage, git activity metrics, and time-per-phase estimates. Used by `/sunco:stats`.

---

## Overview

Stats is a read-only analytics view. It does not modify any files. It aggregates data from:

1. Phase directories (plan counts, summary counts, verification status)
2. ROADMAP.md (milestone groupings, phase names)
3. REQUIREMENTS.md (total count, covered count)
4. Git log (commit counts, file churn, date range)
5. CONTEXT.md files (decisions count per phase)
6. SUMMARY.md frontmatter (execution timestamps for duration calculation)

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--phase <N>` | `PHASE_FILTER` | unset (all phases) |
| `--json` | `JSON_OUTPUT` | false |
| `--since <date>` | `SINCE_DATE` | 30 days ago |
| `--no-git` | `NO_GIT` | false |
| `--verbose` | `VERBOSE` | false |

---

## Step 2: Load All Data

### Phase statistics

Scan `.planning/phases/`:

```bash
ls -d .planning/phases/*/ 2>/dev/null | sort | while read phase_dir; do
  PHASE_NUM=$(basename "$phase_dir" | cut -d'-' -f1)
  PHASE_NAME=$(basename "$phase_dir" | cut -d'-' -f2-)

  PLAN_COUNT=$(ls "${phase_dir}"*"-PLAN.md" 2>/dev/null | wc -l | tr -d ' ')
  SUMMARY_COUNT=$(ls "${phase_dir}"*"-SUMMARY.md" 2>/dev/null | wc -l | tr -d ' ')
  VERIFICATION=$(test -f "${phase_dir}${PHASE_NUM}-VERIFICATION.md" && echo "yes" || echo "no")
  CONTEXT=$(test -f "${phase_dir}CONTEXT.md" && echo "yes" || echo "no")

  echo "${PHASE_NUM}|${PHASE_NAME}|${PLAN_COUNT}|${SUMMARY_COUNT}|${VERIFICATION}|${CONTEXT}"
done
```

### Plan success rate

For each SUMMARY.md, read frontmatter:
- `status: completed` → success
- `status: partial` → partial
- `status: failed` → failure
- `lint_status: PASS` → lint pass
- `lint_status: FAIL` → lint fail

Calculate:
- `success_rate = completed / (completed + partial + failed) * 100`
- `lint_pass_rate = lint_pass / total_summaries * 100`

### Requirements coverage

```bash
REQ_FILE=".planning/REQUIREMENTS.md"
if [[ -f "$REQ_FILE" ]]; then
  TOTAL_REQS=$(grep -c "^- REQ-\|^[0-9]\+\. \|^- \[" "$REQ_FILE" 2>/dev/null || echo "0")
  COVERED_REQS=$(grep -c "\[x\]\|DONE\|covered\|✓" "$REQ_FILE" 2>/dev/null || echo "0")
fi
```

### Git statistics

```bash
# Total commits since project start
FIRST_COMMIT=$(git log --oneline --reverse | head -1 | cut -d' ' -f1)
FIRST_DATE=$(git log -1 --format="%ai" "$FIRST_COMMIT" 2>/dev/null)
TOTAL_COMMITS=$(git log --oneline | wc -l | tr -d ' ')

# Commits in window
WINDOW_COMMITS=$(git log --oneline --since="${SINCE_DATE}" | wc -l | tr -d ' ')

# Files changed
FILES_CHANGED=$(git diff --stat "${FIRST_COMMIT}" HEAD 2>/dev/null | tail -1 | grep -o "[0-9]* file" | grep -o "[0-9]*")

# Lines added/removed
LINES_STATS=$(git diff --shortstat "${FIRST_COMMIT}" HEAD 2>/dev/null | tail -1)
LINES_ADDED=$(echo "$LINES_STATS" | grep -o "[0-9]* insertion" | grep -o "[0-9]*")
LINES_REMOVED=$(echo "$LINES_STATS" | grep -o "[0-9]* deletion" | grep -o "[0-9]*")

# File churn leaders
FILE_CHURN=$(git log --name-only --format="" --since="${SINCE_DATE}" 2>/dev/null | \
  grep -v "^$" | sort | uniq -c | sort -rn | head -10)

# Commits per phase (by matching commit messages to phase numbers)
for PHASE_NUM in $(ls -d .planning/phases/*/ | sed 's|.*/||' | cut -d'-' -f1); do
  COUNT=$(git log --oneline --grep="(phase-${PHASE_NUM})\|feat(${PHASE_NUM}" | wc -l | tr -d ' ')
  echo "phase_${PHASE_NUM}_commits=${COUNT}"
done
```

### Time per phase

For each phase, compute duration from first to last commit in that phase:

```bash
PADDED=$(printf "%02d" "$PHASE_NUM")

# First commit touching phase files
FIRST=$(git log --oneline --format="%ai" -- ".planning/phases/${PADDED}-*" \
  $(ls ".planning/phases/${PADDED}-"*/*.ts ".planning/phases/${PADDED}-"*/src/ 2>/dev/null) \
  2>/dev/null | tail -1)

# Last commit
LAST=$(git log --oneline --format="%ai" -- ".planning/phases/${PADDED}-*" \
  2>/dev/null | head -1)

# Duration in days
DURATION=$(( ($(date -d "$LAST" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$LAST" +%s 2>/dev/null) \
  - $(date -d "$FIRST" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$FIRST" +%s 2>/dev/null)) / 86400 ))
```

---

## Step 3: Compute Derived Metrics

### Phase overview

- `total_phases` — phases with a directory
- `completed_phases` — phases with VERIFICATION.md containing "PASS"
- `in_progress_phases` — phases with at least one SUMMARY.md but not verified
- `planned_phases` — phases with at least one PLAN.md but no SUMMARY.md
- `completion_rate` — `completed / total * 100`

### Plan overview

- `total_plans` — PLAN.md count across all phases
- `executed_plans` — SUMMARY.md count
- `execution_rate` — `executed / total * 100`

### Quality metrics

- `lint_pass_rate` — across all executed plans with lint_status
- `success_rate` — `completed / executed * 100` (where completed means `status: completed`)

### Velocity

- `avg_commits_per_day` — `window_commits / window_days`
- `avg_days_per_phase` — mean duration per completed phase

---

## Step 4: Render Stats Dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {project_name} — Statistics
  {current_date} · Period: last {window_days} days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Phases

  Total:       {total_phases}
  Completed:   {completed_phases}  ({completion_rate}%)
  In progress: {in_progress_phases}
  Planned:     {planned_phases}

  | # | Phase | Plans | Done | Lint% | Duration |
  |---|-------|-------|------|-------|----------|
  | 01 | {name} | 4 | 4 | 100% | 3 days |
  | 02 | {name} | 3 | 3 |  67% | 5 days |
  | 03 | {name} | 5 | 2 |  50% | ongoing |
  | 04 | {name} | 4 | 0 |   —  | — |

## Plans

  Total:         {total_plans}
  Executed:      {executed_plans}  ({execution_rate}%)
  Success rate:  {success_rate}%
  Lint pass rate: {lint_pass_rate}%

  Breakdown:
    Completed:  {completed_count}
    Partial:    {partial_count}
    Failed:     {failed_count}

## Requirements

  {If HAS_REQUIREMENTS:}
  Total:    {total_reqs}
  Covered:  {covered_reqs}  ({coverage_pct}%)
  Gap:      {total_reqs - covered_reqs} uncovered

  {If not HAS_REQUIREMENTS:}
  No REQUIREMENTS.md found.

## Git Activity

  Project started: {FIRST_DATE}
  Total commits:   {total_commits}
  Files changed:   {files_changed}
  Lines added:     +{lines_added}
  Lines removed:   -{lines_removed}

  Last {window_days} days:
    Commits:         {window_commits}
    Avg per day:     {avg_commits_per_day:.1f}

  Most changed files (last {window_days} days):
    {N}x  {file_1}
    {N}x  {file_2}
    {N}x  {file_3}

## Time per Phase

  Avg per completed phase: {avg_days:.1f} days

  | Phase | Start | End | Days |
  |-------|-------|-----|------|
  | 01 | {date} | {date} | {N} |
  | 02 | {date} | {date} | {N} |
  | 03 | {date} | ongoing | — |

## Quality

  Lint pass rate:  {lint_pass_rate}%
  Plan success:    {success_rate}%
  Verification:    {verified_phases}/{completed_phases} verified phases

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Phase filter (--phase N)

If `PHASE_FILTER` is set, show detailed stats for only that phase:

```
Phase {N}: {phase_name}

  Plans:     {plan_count}
  Executed:  {summary_count}/{plan_count}
  Verified:  {yes/no}

  Plan breakdown:
    {plan_id}  {title}  Wave {W}  {status}  Lint:{status}
    ...

  Commits:    {commits for this phase}
  Duration:   {N days}
  Files touched: {N unique files}
```

---

## Step 5: JSON Output (--json)

If `--json`:

```json
{
  "project": "{name}",
  "generated": "{ISO}",
  "phases": {
    "total": 8,
    "completed": 2,
    "in_progress": 1,
    "planned": 5,
    "completion_rate": 25
  },
  "plans": {
    "total": 28,
    "executed": 9,
    "execution_rate": 32,
    "success_rate": 89,
    "lint_pass_rate": 78,
    "breakdown": {
      "completed": 8,
      "partial": 1,
      "failed": 0
    }
  },
  "requirements": {
    "total": 20,
    "covered": 8,
    "coverage_pct": 40
  },
  "git": {
    "first_commit_date": "{date}",
    "total_commits": 42,
    "window_days": 30,
    "window_commits": 28,
    "avg_per_day": 0.9,
    "files_changed": 87,
    "lines_added": 4200,
    "lines_removed": 380
  },
  "time": {
    "avg_days_per_phase": 4.0,
    "phases": [
      {"number": "01", "name": "{name}", "days": 3},
      {"number": "02", "name": "{name}", "days": 5}
    ]
  }
}
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found." |
| No phase directories | "No phases found. Run `/sunco:init` and `/sunco:plan` first." |
| No git repository | Skip all git sections. Set `NO_GIT=true` automatically. |
| No REQUIREMENTS.md | Show note in requirements section. Skip coverage metrics. |
| SUMMARY.md without frontmatter | Skip that plan in quality metrics. Count as "no lint data". |

---

## Route

Stats is read-only. After rendering: no routing suggestion — the dashboard speaks for itself.

If lint pass rate is below 70%: "Lint pass rate is low ({pct}%). Run `/sunco:verify` on in-progress phases."

If success rate is below 80%: "Plan success rate is {pct}%. Consider breaking plans into smaller tasks."
