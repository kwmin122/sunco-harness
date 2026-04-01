# Session Report Workflow

Generate a session summary: commits made, files changed, phases worked on, decisions recorded, and estimated token usage. Writes a dated report to `.planning/` and displays a summary to the user. Used by `/sunco:session-report`.

---

## Overview

Session Report is a read-only retrospective. It does not change any state. It reads git history, planning artifacts, and the STATE.md to reconstruct what happened in the current session and writes a persistent record.

Use it at the end of a work session to capture what was done before pausing. It pairs with `/sunco:pause` — pause writes the forward-looking HANDOFF.md, session-report writes the backward-looking summary.

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--since <sha|date|"last-report">` | `SINCE` | "last-report" (auto-detect) |
| `--no-write` | `NO_WRITE` | false |
| `--json` | `JSON_OUTPUT` | false |
| `--verbose` | `VERBOSE` | false |
| `--commit` | `AUTO_COMMIT` | false |

If `SINCE` is `"last-report"` (default): auto-detect the start of the session by finding the most recent `SESSION-REPORT-*.md` file. If none exists, use the first commit in the git log.

If `--no-write`: display the report but do not write `SESSION-REPORT-*.md`.

If `--commit`: after writing the report file, commit it.

---

## Step 2: Determine Session Boundaries

### Find session start

```bash
# Most recent session report file
LAST_REPORT=$(ls -t .planning/SESSION-REPORT-*.md 2>/dev/null | head -1)

if [[ -n "$LAST_REPORT" ]]; then
  # Extract the timestamp from frontmatter
  SESSION_START=$(grep "^generated:" "$LAST_REPORT" | head -1 | sed 's/generated: //')
  SESSION_START_SHA=$(grep "^start_sha:" "$LAST_REPORT" | head -1 | sed 's/start_sha: //')
else
  # No prior report: use first commit
  SESSION_START_SHA=$(git log --oneline --reverse | head -1 | cut -d' ' -f1)
  SESSION_START=$(git log -1 --format="%ai" "$SESSION_START_SHA")
fi
```

If `--since` is provided:
- If it looks like a SHA (`[0-9a-f]{7,40}`): use as `SESSION_START_SHA`
- If it looks like a date: use as `SESSION_START` timestamp
- If it is `"last-report"`: use auto-detection above

### Determine session end (now)

```bash
SESSION_END_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
SESSION_END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPORT_DATE=$(date -u +%Y-%m-%d)
```

---

## Step 3: Gather Git Activity

### Commit list

```bash
if [[ -n "$SESSION_START_SHA" && "$SESSION_START_SHA" != "$SESSION_END_SHA" ]]; then
  COMMITS=$(git log --oneline "${SESSION_START_SHA}..HEAD" 2>/dev/null)
else
  COMMITS=$(git log --oneline --since="${SESSION_START}" 2>/dev/null)
fi

COMMIT_COUNT=$(echo "$COMMITS" | grep -c "." 2>/dev/null || echo "0")
```

### Files changed

```bash
if [[ -n "$SESSION_START_SHA" ]]; then
  FILES_CHANGED=$(git diff --name-only "${SESSION_START_SHA}" HEAD 2>/dev/null)
  FILE_COUNT=$(echo "$FILES_CHANGED" | grep -c "." 2>/dev/null || echo "0")
  DIFF_STAT=$(git diff --shortstat "${SESSION_START_SHA}" HEAD 2>/dev/null)
else
  FILES_CHANGED=$(git diff --name-only --since="${SESSION_START}" 2>/dev/null)
  FILE_COUNT=$(echo "$FILES_CHANGED" | grep -c "." 2>/dev/null || echo "0")
  DIFF_STAT=""
fi
```

Parse `DIFF_STAT` for:
- `LINES_ADDED` — number after "insertions"
- `LINES_REMOVED` — number after "deletions"

### Classify changed files

Categorize `FILES_CHANGED` into buckets:

```bash
PLANNING_FILES=$(echo "$FILES_CHANGED" | grep "^\.planning/" | grep -v "SESSION-REPORT")
SOURCE_FILES=$(echo "$FILES_CHANGED" | grep -v "^\.planning/" | grep -v "^\.sun/")
CONFIG_FILES=$(echo "$FILES_CHANGED" | grep -E "\.toml$|\.json$|\.yaml$|\.yml$|tsconfig|eslint")
TEST_FILES=$(echo "$FILES_CHANGED" | grep -E "\.test\.|\.spec\.|__tests__")
```

---

## Step 4: Identify Phases Worked On

```bash
# Phases mentioned in commits
PHASES_IN_COMMITS=$(echo "$COMMITS" | grep -oP "phase[-/]?\d+|feat\(\d+\)|fix\(\d+\)" | \
  grep -oP "\d+" | sort -u | tr '\n' ' ')

# Phases with modified planning files
PHASES_IN_PLANNING=$(echo "$PLANNING_FILES" | grep -oP "phases/\d+" | \
  grep -oP "\d+" | sort -u | tr '\n' ' ')

# Phases with modified SUMMARY.md (executed plans)
NEW_SUMMARIES=$(echo "$PLANNING_FILES" | grep "\-SUMMARY\.md$")
NEW_VERIFICATIONS=$(echo "$PLANNING_FILES" | grep "\-VERIFICATION\.md$")
NEW_PLANS=$(echo "$PLANNING_FILES" | grep "\-PLAN\.md$")

# Union of all phase numbers
ALL_PHASES=$(echo "$PHASES_IN_COMMITS $PHASES_IN_PLANNING" | tr ' ' '\n' | sort -u | tr '\n' ' ')
```

For each phase found, read its name from ROADMAP.md or the directory name:

```bash
for PHASE_NUM in $ALL_PHASES; do
  PADDED=$(printf "%02d" "$PHASE_NUM")
  PHASE_DIR=$(ls -d ".planning/phases/${PADDED}-"*/ 2>/dev/null | head -1)
  PHASE_NAME=$(basename "${PHASE_DIR:-${PADDED}-unknown}" | sed "s/${PADDED}-//")
  PHASE_STATUS=$(grep -A3 "Phase ${PADDED}" .planning/STATE.md 2>/dev/null | grep "status:" | head -1 | sed 's/.*status: //')
  echo "${PADDED}|${PHASE_NAME}|${PHASE_STATUS}"
done
```

---

## Step 5: Extract Decisions Made

Read CONTEXT.md files for phases worked on this session. Collect decisions that were added or modified since `SESSION_START`:

```bash
for PHASE_NUM in $ALL_PHASES; do
  PADDED=$(printf "%02d" "$PHASE_NUM")
  CONTEXT_FILE=$(ls ".planning/phases/${PADDED}-"*"/CONTEXT.md" 2>/dev/null | head -1)
  [[ -f "$CONTEXT_FILE" ]] || continue

  # Check if CONTEXT.md was modified this session
  MODIFIED=$(git log --oneline --since="${SESSION_START}" -- "$CONTEXT_FILE" 2>/dev/null | head -1)
  [[ -n "$MODIFIED" ]] || continue

  # Extract decisions section
  DECISIONS=$(awk '/^## Decisions/,/^## /' "$CONTEXT_FILE" 2>/dev/null | \
    grep "^- \|^\*\*" | head -10)
  echo "PHASE:${PADDED}|${DECISIONS}"
done
```

Collect all decisions into `SESSION_DECISIONS[]`.

---

## Step 6: Estimate Token Usage

Token usage estimation is approximate. It does not call any API.

Estimation formula:

```
BASE_TOKENS_PER_COMMIT = 4000
# Rough estimate: each commit involves ~4K tokens of back-and-forth

FILE_TOKENS_PER_FILE = 500
# Each file changed touched roughly 500 tokens of context

PLANNING_TOKENS_PER_DOC = 2000
# Planning docs (PLAN.md, SUMMARY.md, CONTEXT.md) are dense

ESTIMATED_TOKENS = (COMMIT_COUNT × 4000)
                 + (SOURCE_FILE_COUNT × 500)
                 + (PLANNING_DOC_COUNT × 2000)
```

```bash
PLANNING_DOC_COUNT=$(echo "$PLANNING_FILES" | grep -c "\.md$" 2>/dev/null || echo "0")
SOURCE_FILE_COUNT=$(echo "$SOURCE_FILES" | grep -c "." 2>/dev/null || echo "0")

ESTIMATED_TOKENS=$(( (COMMIT_COUNT * 4000) + (SOURCE_FILE_COUNT * 500) + (PLANNING_DOC_COUNT * 2000) ))
ESTIMATED_COST_USD=$(echo "scale=4; ${ESTIMATED_TOKENS} * 0.000015" | bc 2>/dev/null || echo "N/A")
```

The token estimate is labeled "rough estimate" in all output — it is not authoritative.

---

## Step 7: Read STATE.md for Current Context

```bash
cat .sun/STATE.md 2>/dev/null || cat .planning/STATE.md 2>/dev/null
```

Extract:
- `project_name`
- `current_phase.number`, `current_phase.name`, `current_phase.status`
- `current_milestone.name`
- `session.status`

---

## Step 8: Write SESSION-REPORT-{date}.md

Unless `--no-write`:

```bash
REPORT_FILE=".planning/SESSION-REPORT-${REPORT_DATE}.md"

# If file already exists for today, append a session number
if [[ -f "$REPORT_FILE" ]]; then
  SESSION_NUM=2
  while [[ -f ".planning/SESSION-REPORT-${REPORT_DATE}-${SESSION_NUM}.md" ]]; do
    SESSION_NUM=$((SESSION_NUM + 1))
  done
  REPORT_FILE=".planning/SESSION-REPORT-${REPORT_DATE}-${SESSION_NUM}.md"
fi
```

Write the report:

```markdown
---
generated: {SESSION_END}
start_sha: {SESSION_START_SHA}
end_sha: {SESSION_END_SHA}
session_date: {REPORT_DATE}
project: {project_name}
---

# Session Report — {REPORT_DATE}

**Project**: {project_name}
**Milestone**: {current_milestone.name}
**Session**: {SESSION_START} → {SESSION_END}

---

## Summary

{2-3 sentences describing what was accomplished this session. Generated from commits and phase names.}
Phases worked on: {comma-separated phase names}
Commits made: {COMMIT_COUNT}

---

## Commits ({COMMIT_COUNT})

{List of commit SHAs and messages from SESSION_START to HEAD:}
- `{sha}` {commit message}
- `{sha}` {commit message}
...

---

## Files Changed ({FILE_COUNT} files)

{DIFF_STAT line: e.g. "14 files changed, 892 insertions(+), 23 deletions(-)"}

### Source files ({SOURCE_FILE_COUNT})
{List of source files, one per line}

### Planning files ({PLANNING_DOC_COUNT})
{List of planning files}

### Tests ({TEST_FILE_COUNT})
{List of test files, or "(none)"}

### Config ({CONFIG_FILE_COUNT})
{List of config files, or "(none)"}

---

## Phases Worked On

| Phase | Name | Status | Plans Completed | New Docs |
|-------|------|--------|-----------------|----------|
| 01 | {name} | {status} | {new summaries count} | {new verifications} |
| 02 | {name} | {status} | 0 | 1 VERIFICATION.md |

---

## Decisions Made

{From CONTEXT.md files modified this session:}

**Phase {N} — {name}:**
- {decision}
- {decision}

{If no decisions were recorded:}
(No CONTEXT.md files were modified this session)

---

## Token Usage (Estimated)

| Category | Count | Est. Tokens |
|----------|-------|-------------|
| Commits | {COMMIT_COUNT} | {COMMIT_COUNT × 4000} |
| Source files | {SOURCE_FILE_COUNT} | {SOURCE_FILE_COUNT × 500} |
| Planning docs | {PLANNING_DOC_COUNT} | {PLANNING_DOC_COUNT × 2000} |
| **Total** | | **~{ESTIMATED_TOKENS}** |

Estimated cost: ~${ESTIMATED_COST_USD} (at $15/M tokens input — rough approximation)

Note: This is a rough estimate only. Actual usage depends on context window, tool calls, and model pricing.

---

## Next Steps

{Read pending plans from current phase and open todos:}
1. {next action — ideally a /sunco: command}
2. {second action}

---

*Generated by `/sunco:session-report` on {SESSION_END}*
```

---

## Step 9: Display Summary to User

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SESSION REPORT — {REPORT_DATE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Project  : {project_name}
  Milestone: {milestone_name}
  Session  : {START} → {END}

  Commits        : {COMMIT_COUNT}
  Files changed  : {FILE_COUNT}
  Lines added    : +{LINES_ADDED}
  Lines removed  : -{LINES_REMOVED}

  Phases worked on:
    Phase {N} — {name} ({status})
    Phase {N} — {name} ({status})

  Decisions recorded: {count}
  New SUMMARY.md files: {count}
  New VERIFICATION.md files: {count}

  Est. tokens: ~{ESTIMATED_TOKENS} (~${ESTIMATED_COST_USD})

  {If wrote file:}
  Report written: {REPORT_FILE}

  {If uncommitted changes:}
  Note: {count} uncommitted change(s) not included in this report.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 10: Commit (if --commit)

If `--commit`:

```bash
git add "${REPORT_FILE}"
git commit -m "docs(session): session report ${REPORT_DATE} — ${COMMIT_COUNT} commits, ${FILE_COUNT} files"
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No git repository | Skip all git sections. Set `COMMIT_COUNT=0`, `FILE_COUNT=0`. Show "No git history found." |
| No prior SESSION-REPORT | Use first git commit as session start. Note: "No prior session report found — reporting from first commit." |
| No commits since last report | "No commits since last session report. Nothing to report." |
| `.planning/` not writable | `--no-write` is forced automatically. Report displayed only. |
| bc not available | Skip `ESTIMATED_COST_USD`. Show tokens only. |
| CONTEXT.md not found for phase | Skip decisions for that phase. |

---

## Route

After displaying the report: no forced routing — session-report is a passive summary.

If there are uncommitted changes: "You have uncommitted changes. Consider committing before pausing."

If `COMMIT_COUNT = 0`: "Nothing to report for this session."

If milestone is near complete (all phases verified): "All phases verified. Consider running `/sunco:milestone complete`."
