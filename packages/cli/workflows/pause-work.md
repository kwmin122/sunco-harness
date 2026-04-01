# Pause Work Workflow

Save session state for clean handoff. Writes a structured HANDOFF.md capturing what was done, decisions made, next steps, and blockers. Commits the document so it persists across sessions. Used by `/sunco:pause`.

---

## Overview

Pause is for intentional context closure — you're stepping away and want the next session (or the next agent) to be able to pick up cleanly.

The handoff document is designed to be read-first by a fresh agent. It contains enough context that no other files need to be read to understand what happened and what to do next.

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional text (optional session note) | `SESSION_NOTE` | empty |
| `--no-commit` | `NO_COMMIT` | false |
| `--full` | `FULL_MODE` | false |
| `--replace` | `REPLACE` | false |

If `--full`: include git diff summary and recent lint output in addition to standard sections.

If `--replace`: overwrite existing HANDOFF.md. Default appends a new dated section.

---

## Step 2: Gather Session Context

Collect all context needed for the handoff document.

### Read STATE.md

```bash
STATE=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state load)
```

Extract:
- `current_phase.number`, `current_phase.name`, `current_phase.status`
- `plans_completed` (in current phase)
- `plans_total` (in current phase)
- `last_activity`
- `project_name`

### Read current phase CONTEXT.md

```bash
PADDED=$(printf "%02d" "$CURRENT_PHASE")
CONTEXT_FILE=".planning/phases/${PADDED}-"*"/CONTEXT.md"
```

Extract:
- Key decisions made
- Declared blockers

### Read recent SUMMARY.md files (last 3)

```bash
SUMMARIES=$(ls -t ".planning/phases/${PADDED}-"*"/"*"-SUMMARY.md" 2>/dev/null | head -3)
```

For each: extract `## Objective Achieved` and `status:` from frontmatter.

### Read pending plans

Plans in the current phase with no SUMMARY.md:

```bash
PENDING_PLANS=$(ls ".planning/phases/${PADDED}-"*"/"*"-PLAN.md" 2>/dev/null | while read f; do
  PLAN_ID=$(basename "$f" -PLAN.md)
  SUMMARY="${f%-PLAN.md}-SUMMARY.md"
  if [[ ! -f "$SUMMARY" ]]; then
    echo "$f"
  fi
done)
```

### Read recent git log

```bash
git log --oneline -10 2>/dev/null
git status --short 2>/dev/null
```

### Read open todos

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" todos list 2>/dev/null | head -10
```

### Full mode: lint and diff

If `--full`:

```bash
# Lint state
npx eslint packages/ --max-warnings 0 2>&1 | tail -5

# Staged changes
git diff --stat HEAD 2>/dev/null | head -20

# Unstaged
git diff --name-only 2>/dev/null
```

---

## Step 3: Determine Handoff Path

```bash
HANDOFF_FILE=".planning/HANDOFF.md"
```

If `--replace` is NOT set and HANDOFF.md already exists: append a new section with a date header rather than overwriting.

If `--replace` is set: overwrite entirely.

---

## Step 4: Write HANDOFF.md

### If creating new or replacing

```markdown
# Handoff Document

Project: {project_name}
Last Updated: {ISO timestamp}
Session Note: {SESSION_NOTE or "(none)"}

---

## What Was Done This Session

{Enumerate completed plans by reading SUMMARY.md files:}
- Phase {N}, Plan {M}: {plan_title} — {objective_achieved one sentence}
- Phase {N}, Plan {M}: {plan_title} — {objective_achieved one sentence}

{If no plans completed this session:}
- {Describe what was worked on from git log or context, e.g.: "Discussed Phase 3 requirements", "Fixed lint errors in packages/core"}

Recent commits:
{git log --oneline -5}

## Decisions Made

{From CONTEXT.md decisions section — decisions added or confirmed this session:}
- **{decision}**: {rationale}

{If no new decisions, based on context:}
(No new decisions — see .planning/phases/{N}-*/CONTEXT.md for existing decisions)

## Current State

Phase: {N} — {phase_name}
Status: {status}
Plans done: {done}/{total}

{Lint status:}
- Lint: {PASS (0 errors) | FAIL (N errors)}
- Tests: {run or not run this session}

{Uncommitted changes:}
{If clean: "(no uncommitted changes)"}
{If changes: list changed files}

## Next Steps

{Ordered list of what needs to happen next:}
1. {First concrete action — ideally a specific /sunco: command}
2. {Second action}
3. {Third action}

{Derived from:}
- Pending plans in current phase
- Any partial plans with SUMMARY written but lint failed
- Open todos

## Blockers

{From CONTEXT.md blockers section:}
{If none: "(no blockers)"}
{If blockers:
- {blocker description} — {what's needed to unblock}
}

## Open Todos

{From todos list:}
{If none: "(no open todos)"}
{If todos:}
- {todo 1}
- {todo 2}

## Context to Load on Resume

{Files the next session should read first:}
1. .planning/HANDOFF.md (this file)
2. .planning/phases/{N}-*/CONTEXT.md
3. .planning/phases/{N}-*/[next-plan]-PLAN.md (if resuming execution)
4. .sun/STATE.md

{Suggested first command:}
/sunco:resume
```

### If appending to existing HANDOFF.md

Append a new section at the top (after the title):

```markdown
---

## Session: {YYYY-MM-DD HH:MM} — {SESSION_NOTE or current_phase}

### Done
{completions — same format as above but abbreviated}

### Next
{next steps — numbered, specific commands}

### Blockers
{blockers or "(none)"}

```

---

## Step 5: Update STATE.md

Mark the session as paused:

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state set \
  "session.status" "paused" \
  "session.paused_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "session.handoff_path" ".planning/HANDOFF.md"
```

---

## Step 6: Commit (unless --no-commit)

```bash
git add .planning/HANDOFF.md .sun/STATE.md

# If any .planning/phases/ files were modified this session:
git add .planning/phases/

git commit -m "docs(handoff): session pause — {current_phase} {status}"
```

If nothing to commit (all clean): skip silently.

---

## Step 7: Report

```
Session saved.

  Handoff: .planning/HANDOFF.md
  Phase:   {N} — {phase_name}
  Status:  {status}
  Plans:   {done}/{total} done

  {If uncommitted lint failures exist:}
  ⚠ Uncommitted lint errors — fix before next session starts.

  Resume with:
    /sunco:resume
```

---

## HANDOFF.md: Governing Rules

1. **HANDOFF.md is designed for a fresh agent** — assume no memory of prior sessions.
2. **Be specific** — cite file paths, plan IDs, and commands. Avoid vague summaries.
3. **Next steps must be commands** — not descriptions. "Run `/sunco:execute 3`" not "continue execution".
4. **Blockers must be actionable** — state what is needed to unblock, not just that it's blocked.
5. **Append, not overwrite** — history is preserved unless `--replace` is used.

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init` first." |
| STATE.md not writable | Write HANDOFF.md only. Report STATE.md write failure. |
| Git commit fails | Report error. HANDOFF.md is still written. |
| No recent SUMMARY.md files | "What was done this session?" section uses git log only. |
| No pending plans found | Omit "Next Steps" pending plan bullets. Use todos only. |

---

## Route

After pause: "Session state saved. Resume with `/sunco:resume`."

If blockers were detected: "There are active blockers. Address them before the next session to avoid getting stuck."

If uncommitted changes exist at pause time: "You have uncommitted changes. Consider committing them before pausing to avoid lost work."
