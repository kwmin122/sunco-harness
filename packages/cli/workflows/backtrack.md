# Backtrack Workflow

Restore planning artifacts to a previous rollback point, invalidating downstream artifacts. Only `.planning/` files are affected — code files remain untouched. Used by `/sunco:backtrack`.

---

## Core Principle

Backtrack is a planning-level undo. Every state transition in SUNCO creates a rollback point (a snapshot of `.planning/` artifacts). Backtrack restores to one of those snapshots, then runs impact analysis to surface what is now inconsistent. The user sees exactly what was restored and what needs re-planning.

---

## Step 1: Load Context

Read current project state:

```bash
STATE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state load)
```

Extract:
- `current_phase.number`, `current_phase.name`, `current_phase.status`
- `project_name`
- `last_activity`

Read current artifact hashes for later comparison:

```bash
CURRENT_HASHES=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash compute)
```

**If `.planning/` does not exist:**
```
No SUNCO project found. Run /sunco:init first.
```
Stop.

**If STATE.md is missing:** Stop with: "STATE.md not found. Run `/sunco:resume` to reconstruct state."

---

## Step 2: List Rollback Points

Fetch all available rollback points:

```bash
ROLLBACK_POINTS=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point list)
```

This returns JSON:
```json
[
  {
    "label": "after-discuss-phase-3",
    "timestamp": "2026-03-31T14:22:00Z",
    "tag": "sunco/rollback/2026-03-31T142200-after-discuss-phase-3",
    "artifact_count": 12
  },
  {
    "label": "after-plan-phase-2",
    "timestamp": "2026-03-31T10:05:00Z",
    "tag": "sunco/rollback/2026-03-31T100500-after-plan-phase-2",
    "artifact_count": 10
  }
]
```

**If no rollback points exist:**
```
No rollback points found. Rollback points are created automatically at each state transition (discuss, plan, execute, verify, ship).

Nothing to backtrack to.
```
Stop.

---

## Step 3: Present Options and Ask User

Format rollback points as a numbered selection list, most recent first:

```
Available rollback points:

  1) after-discuss-phase-3    (2026-03-31 14:22)  12 artifacts
  2) after-plan-phase-2       (2026-03-31 10:05)  10 artifacts
  3) after-execute-phase-2    (2026-03-30 18:30)   9 artifacts
  4) after-discuss-phase-2    (2026-03-30 15:00)   8 artifacts
  5) after-plan-phase-1       (2026-03-29 11:00)   6 artifacts

Which rollback point to restore to?
```

Use AskUserQuestion to present the selection. Do not auto-proceed.

**Answer validation:** If the response is empty or whitespace-only:
1. Retry the question once with the same parameters
2. If still empty, present options as a plain-text numbered list and ask the user to type a number

**Text mode (`workflow.text_mode: true` in config or `--text` flag):**
Do not use AskUserQuestion. Present options as a plain-text numbered list.

Parse the user's selection into `SELECTED_LABEL`.

**If selection is invalid** (not matching any label): "Invalid selection. Please choose from the list above." Re-ask.

---

## Step 4: Confirm Before Restore

Show what will happen:

```
Restoring to: {SELECTED_LABEL}
  Created:   {timestamp}
  Artifacts: {artifact_count} files in .planning/

This will:
  - Overwrite current .planning/ artifacts with the snapshot
  - NOT touch any code files
  - Run impact analysis on restored state

Proceed? (yes / cancel)
```

Use AskUserQuestion for confirmation. If user cancels: "Backtrack cancelled. No changes made." Stop.

---

## Step 5: Restore Rollback Point

Execute the restore:

```bash
RESTORE_RESULT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point restore --label "${SELECTED_LABEL}")
```

This:
1. Reads the rollback manifest from `.planning/.rollback/{timestamp}.json`
2. For each artifact: `git checkout {tag} -- {artifact_path}`
3. Returns JSON with list of restored files

```json
{
  "restored": [
    ".planning/phases/02-state-engine/CONTEXT.md",
    ".planning/phases/02-state-engine/02-01-PLAN.md",
    ".planning/ROADMAP.md",
    ".planning/STATE.md"
  ],
  "label": "after-discuss-phase-2",
  "tag": "sunco/rollback/2026-03-30T150000-after-discuss-phase-2"
}
```

**If restore fails:** Report the error and stop. No partial restores — if `sunco-tools.cjs` fails, nothing is changed.

---

## Step 6: Impact Analysis

Run impact analysis on all restored files to identify what is now inconsistent:

```bash
IMPACT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" impact-analysis --changed "${RESTORED_FILES_COMMA_SEPARATED}")
```

Where `RESTORED_FILES_COMMA_SEPARATED` is the restored file paths joined by commas.

This returns:
```json
{
  "invalidated": [
    {
      "file": ".planning/phases/03-workflow/CONTEXT.md",
      "reason": "References decisions from phase 2 that were rolled back"
    },
    {
      "file": ".planning/phases/03-workflow/03-01-PLAN.md",
      "reason": "Based on invalidated CONTEXT.md"
    }
  ],
  "maybe_invalidated": [
    {
      "file": ".planning/REQUIREMENTS.md",
      "reason": "Phase 2 decisions may have influenced requirements REQ-05, REQ-06"
    }
  ],
  "warnings": [
    {
      "file": ".planning/phases/02-state-engine/02-01-SUMMARY.md",
      "reason": "Already executed — code exists but planning context was rolled back"
    }
  ]
}
```

Classify each finding:
- **INVALIDATED**: Must be re-generated. Plans/contexts downstream of the rollback point are stale.
- **MAYBE INVALIDATED**: Check content manually. May still be valid.
- **WARNING**: Already-executed work whose planning basis changed. Code still exists but rationale is gone.

---

## Step 7: Update STATE.md

Update state to reflect the rollback:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set \
  "current_phase.status" "backtracked" \
  "last_activity" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "session.backtrack_label" "${SELECTED_LABEL}" \
  "session.backtrack_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

If the rollback point belongs to an earlier phase than the current one, also update:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set \
  "current_phase.number" "${ROLLBACK_PHASE_NUMBER}" \
  "current_phase.name" "${ROLLBACK_PHASE_NAME}" \
  "current_phase.status" "backtracked"
```

---

## Step 8: Commit

Stage and commit the restored artifacts:

```bash
git add .planning/
git commit -m "revert(planning): backtrack to ${SELECTED_LABEL}

Restored .planning/ artifacts to rollback point: ${SELECTED_LABEL}
Code files untouched. Impact analysis identified:
- ${INVALIDATED_COUNT} invalidated artifact(s)
- ${MAYBE_COUNT} maybe-invalidated artifact(s)
- ${WARNING_COUNT} warning(s)"
```

If nothing changed (rollback point matches current state): skip commit, report "Already at this rollback point."

---

## Step 9: Summary

Present the full backtrack report:

```
Backtrack complete.

  Restored to: {SELECTED_LABEL}
  Timestamp:   {timestamp}
  Files restored: {N}

  Restored files:
    - .planning/phases/02-state-engine/CONTEXT.md
    - .planning/phases/02-state-engine/02-01-PLAN.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

  Impact analysis:
    INVALIDATED ({N}):
      - .planning/phases/03-workflow/CONTEXT.md
        (References decisions from phase 2 that were rolled back)
      - .planning/phases/03-workflow/03-01-PLAN.md
        (Based on invalidated CONTEXT.md)

    MAYBE INVALIDATED ({N}):
      - .planning/REQUIREMENTS.md
        (Phase 2 decisions may have influenced requirements REQ-05, REQ-06)

    WARNINGS ({N}):
      - .planning/phases/02-state-engine/02-01-SUMMARY.md
        (Already executed — code exists but planning context was rolled back)

  Next steps:
    1. Review MAYBE INVALIDATED artifacts — confirm or re-generate
    2. Re-generate INVALIDATED artifacts:
       /sunco:discuss {invalidated_phase}
       /sunco:plan {invalidated_phase}
    3. Check WARNING items — code may need revision to match restored plans
```

If no impact findings: "No downstream inconsistencies detected. All artifacts are consistent with the restored state."

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init` first." |
| STATE.md missing | "STATE.md not found. Run `/sunco:resume` to reconstruct state." |
| No rollback points | "No rollback points found. Nothing to backtrack to." |
| Invalid user selection | Re-ask with same options. |
| Restore command fails | "Restore failed: {error}. No changes were made." |
| Impact analysis fails | Proceed without impact data. Warn: "Impact analysis unavailable. Manually review downstream artifacts." |
| Git commit fails | Report error. Restored files are still on disk. |
| User cancels at confirm | "Backtrack cancelled. No changes made." |

---

## Route

After backtrack with INVALIDATED artifacts: "Downstream artifacts are stale. Re-discuss the affected phase: `/sunco:discuss {phase}`"

After backtrack with no issues: "Clean restore. Continue from: `/sunco:next`"

After backtrack to an earlier phase: "Phase rewound to {N}. Start with: `/sunco:discuss {N}`"
