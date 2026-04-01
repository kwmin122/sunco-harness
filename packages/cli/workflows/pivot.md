# Pivot Workflow

Intentional scope change handler. When the project direction shifts, `/sunco:pivot` detects what changed, runs impact analysis on affected artifacts, creates a rollback point before making any modifications, presents the invalidation cascade for user review, and re-routes affected phases back to discuss/plan status. Used by `/sunco:pivot`.

---

## Core Principle

Pivots are explicit. Builders call `/sunco:pivot` when they know the direction has changed. The workflow protects existing work by creating a rollback point BEFORE touching anything, then surgically invalidates only what the pivot actually affects. No silent overwrites, no lost decisions.

Pivot responsibility chain:

```
load_context → create_rollback_point → detect_changes
→ impact_analysis → present_options → re_route_phases
→ update_state → commit
```

---

## Step 1: load_context

Read all planning state before any mutation:

```bash
TOOLS="node \"$HOME/.claude/sunco/bin/sunco-tools.cjs\""

STATE=$(cat .planning/STATE.md 2>/dev/null || echo "")
PROJECT=$(cat .planning/PROJECT.md 2>/dev/null || echo "")
ROADMAP=$(cat .planning/ROADMAP.md 2>/dev/null || echo "")
REQUIREMENTS=$(cat .planning/REQUIREMENTS.md 2>/dev/null || echo "")
```

**Error conditions:**
- `.planning/` directory does not exist: "No planning harness found. Run `/sunco:init` first."
- `STATE.md` missing: "STATE.md not found. Run `/sunco:init` to restore harness state."
- `ROADMAP.md` missing: "ROADMAP.md not found. Cannot analyze impact without a roadmap."

Load current phase from STATE.md:

```bash
CURRENT_PHASE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state get current_phase 2>/dev/null)
```

Load config:

```bash
CONFIG=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" config-get-all 2>/dev/null || echo "{}")
```

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--scope <artifact>` | `SCOPE_FILTER` | unset (detect all) |
| `--dry-run` | `DRY_RUN` | false |
| `--no-rollback` | `SKIP_ROLLBACK` | false |

- `--scope` narrows detection to a specific artifact (e.g., `--scope REQUIREMENTS.md`).
- `--dry-run` runs detection and impact analysis without creating rollback points or modifying state.
- `--no-rollback` skips rollback point creation (for cases where the user already has their own backup strategy).

---

## Step 2: create_rollback_point

**Before detecting or modifying anything**, snapshot the current state so the user can undo the pivot if it goes wrong.

If `DRY_RUN` is true or `SKIP_ROLLBACK` is true: skip this step.

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point create \
  --label "before-pivot-$(date -u +%Y%m%dT%H%M%SZ)"
```

This:
1. Computes SHA256 hash of every `.planning/` artifact.
2. Creates git tag `sunco/rollback/{timestamp}-before-pivot`.
3. Stores rollback manifest in `.planning/.rollback/{timestamp}.json`.

Report:

```
Rollback point created: before-pivot-{timestamp}
  Artifacts snapshotted: {count}
  Restore with: /sunco:backtrack --label before-pivot-{timestamp}
```

If rollback creation fails (e.g., uncommitted changes in `.planning/`):

```
WARNING: Could not create rollback point.
  Reason: {error}

Options:
  1) Commit current changes first, then re-run /sunco:pivot
  2) Continue without rollback (--no-rollback)
  3) Abort
```

Use AskUserQuestion to present the options. Do not auto-proceed without a rollback point.

---

## Step 3: detect_changes

Run artifact-hash check to find what changed since the last state transition:

```bash
HASH_RESULT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash check)
```

Parse JSON response:

```json
{
  "changed": true,
  "artifacts": [
    {"file": ".planning/REQUIREMENTS.md", "old_hash": "abc...", "new_hash": "def..."},
    {"file": ".planning/PROJECT.md", "old_hash": "ghi...", "new_hash": "jkl..."}
  ]
}
```

### If `changed: false` (no hash differences detected)

The user called `/sunco:pivot` intentionally but no artifacts were modified yet. Ask what they want to change:

```
No artifact changes detected since last state transition.

What would you like to pivot on?
  1) Project goals or constraints (PROJECT.md)
  2) Requirements (REQUIREMENTS.md)
  3) Roadmap phases (ROADMAP.md)
  4) Current phase decisions (CONTEXT.md for phase {N})
  5) Describe the change in your own words
```

Use AskUserQuestion to get the user's selection.

**If option 1-4:** Open the relevant file for the user. After they edit it, re-run hash check:

```bash
HASH_RESULT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash check)
```

If still no changes: "No modifications detected. Pivot aborted."

**If option 5:** Collect the user's description. Use it to identify which artifacts SHOULD change:

```
You described: "{user_description}"

Based on this, the following artifacts are likely affected:
  - {artifact_1}: {reason}
  - {artifact_2}: {reason}

Would you like me to update these artifacts to reflect your pivot?
```

Use AskUserQuestion. If yes: apply the described changes to the relevant artifacts, then re-run hash check to capture the diff.

### If `SCOPE_FILTER` is set

Filter `artifacts` array to only include the specified file. If the specified file has no changes: "No changes detected in `{SCOPE_FILTER}`. Run without `--scope` to check all artifacts."

### Report detected changes

```
Detected changes in {count} artifact(s):

  {file_1}:  {summary of change — first 3 lines of diff}
  {file_2}:  {summary of change — first 3 lines of diff}
```

---

## Step 4: impact_analysis

For each changed artifact, compute the invalidation cascade.

```bash
IMPACT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" impact-analysis \
  --changed "{changed_file_1}" --changed "{changed_file_2}")
```

Parse JSON response:

```json
{
  "invalidated": [
    {"file": ".planning/phases/03-skill-system/CONTEXT.md", "reason": "References REQ-03 which was modified", "severity": "INVALID"},
    {"file": ".planning/phases/03-skill-system/03-01-PLAN.md", "reason": "Task 2 implements modified REQ-03", "severity": "INVALID"}
  ],
  "maybe_invalidated": [
    {"file": ".planning/ROADMAP.md", "reason": "Phase 3 success criteria reference modified constraint", "severity": "MAYBE_INVALID"}
  ],
  "warnings": [
    {"file": ".planning/phases/02-config-system/02-SUMMARY.md", "reason": "Already executed — may need revision", "severity": "WARN"}
  ]
}
```

### Severity classification

| Severity | Meaning | Default action |
|----------|---------|----------------|
| `INVALID` | Must be re-generated. The artifact's foundation has changed. | Re-route to discuss/plan |
| `MAYBE_INVALID` | Content may still be valid. Needs human review. | Flag for review |
| `WARN` | Already executed work. Cannot undo code, but decisions may need revisiting. | Inform only |

### If impact-analysis tool is unavailable

Fall back to manual cascade computation. Read each phase directory and grep for references to changed content:

```bash
for PHASE_DIR in .planning/phases/*/; do
  for ARTIFACT in CONTEXT.md *-PLAN.md *-SUMMARY.md; do
    [ -f "${PHASE_DIR}${ARTIFACT}" ] || continue
    # Check if this artifact references any changed requirement/decision IDs
    grep -l "REQ-\|D-\|CONSTRAINT-" "${PHASE_DIR}${ARTIFACT}" 2>/dev/null
  done
done
```

Cross-reference grep results with the specific IDs that were modified in the changed artifacts.

---

## Step 5: present_options

Display the full invalidation cascade to the user in a structured table:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PIVOT IMPACT ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Changed artifacts:     {count}
 Invalidated:           {invalid_count}
 Needs review:          {maybe_count}
 Warnings:              {warn_count}
 Rollback point:        {rollback_label}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Invalidated (must re-plan)

| # | Artifact | Phase | Reason |
|---|----------|-------|--------|
| 1 | CONTEXT.md | Phase 3 | References modified REQ-03 |
| 2 | 03-01-PLAN.md | Phase 3 | Task 2 implements modified REQ-03 |

## Needs Review (may still be valid)

| # | Artifact | Phase | Reason |
|---|----------|-------|--------|
| 1 | ROADMAP.md | — | Phase 3 criteria reference modified constraint |

## Warnings (already executed)

| # | Artifact | Phase | Reason |
|---|----------|-------|--------|
| 1 | 02-SUMMARY.md | Phase 2 | Already executed — code may need revision |
```

**If `DRY_RUN` is true:** Display the analysis and stop.

```
--dry-run: Impact analysis complete. No changes made.
Re-run without --dry-run to apply the pivot.
```

**Otherwise, present action options:**

```
How would you like to proceed?

  1) Apply full pivot — invalidate all INVALID artifacts, re-route affected phases to discuss/plan (Recommended)
  2) Selective pivot — choose which invalidated artifacts to re-route
  3) Review only — mark MAYBE_INVALID items for review, do not invalidate anything
  4) Abort — restore from rollback point, cancel the pivot
```

Use AskUserQuestion to get the user's selection.

**If option 1 (full pivot):** Proceed to `re_route_phases` with all INVALID items.

**If option 2 (selective pivot):** Present each invalidated artifact individually:

```
Select artifacts to invalidate:
```

Use AskUserQuestion (multiSelect: true) with the list of INVALID artifacts. Only selected items proceed to `re_route_phases`.

**If option 3 (review only):** Skip `re_route_phases`. Write a `PIVOT-REVIEW.md` to `.planning/` with the MAYBE_INVALID items flagged for manual review. Proceed to `update_state` with minimal changes.

**If option 4 (abort):**

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point restore \
  --label "before-pivot-{timestamp}"
```

Report: "Pivot aborted. Artifacts restored to pre-pivot state." STOP.

---

## Step 6: re_route_phases

For each invalidated artifact, determine which phase it belongs to and what status to set.

### Phase status re-routing rules

| Current status | Invalidated artifact | New status | Action needed |
|---------------|---------------------|------------|---------------|
| `discussed` | CONTEXT.md | `needs-discuss` | Re-run `/sunco:discuss` |
| `planned` | CONTEXT.md | `needs-discuss` | Re-run `/sunco:discuss` then `/sunco:plan` |
| `planned` | Any PLAN.md | `needs-plan` | Re-run `/sunco:plan` (CONTEXT still valid) |
| `executing` | CONTEXT.md | `needs-discuss` | STOP execution, re-discuss |
| `executing` | Any PLAN.md | `needs-plan` | STOP execution, re-plan |
| `executed` | Any artifact | `needs-review` | Flag for manual review (code already written) |
| `verified` | Any artifact | `needs-review` | Flag for manual review |
| `complete` | Any artifact | `needs-review` | Flag for manual review |

### Apply re-routing

For each affected phase:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set \
  "phases.${PHASE_NUM}.status" "${NEW_STATUS}"

node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set \
  "phases.${PHASE_NUM}.pivot_reason" "${REASON}"

node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set \
  "phases.${PHASE_NUM}.pivoted_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

### Delete invalidated artifacts

For artifacts marked INVALID that need regeneration:

```bash
# Archive before deleting (safety net beyond rollback)
PIVOT_ARCHIVE=".planning/.pivot-archive/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "${PIVOT_ARCHIVE}"

# Move invalidated files to archive
for INVALID_FILE in ${INVALIDATED_FILES}; do
  cp "${INVALID_FILE}" "${PIVOT_ARCHIVE}/"
  rm "${INVALID_FILE}"
done
```

Do NOT delete SUMMARY.md files (already-executed work). Only delete CONTEXT.md and PLAN.md files that need regeneration.

### Report re-routing

```
Phase re-routing applied:

| Phase | Old Status | New Status | Action Needed |
|-------|-----------|------------|---------------|
| Phase 3 | planned | needs-discuss | /sunco:discuss 3 |
| Phase 4 | discussed | needs-discuss | /sunco:discuss 4 |

Invalidated artifacts archived to: {PIVOT_ARCHIVE}
```

---

## Step 7: update_state

Update STATE.md to reflect the pivot:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set \
  "last_pivot" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set \
  "pivot_count" "$(( CURRENT_PIVOT_COUNT + 1 ))"
```

### Update ROADMAP.md

For each re-routed phase, update its status marker in ROADMAP.md:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" roadmap set-status \
  "${PHASE_NUM}" "${NEW_STATUS}"
```

If the tool is unavailable, manually find the phase entry in ROADMAP.md and update its status line.

### Append pivot log entry to STATE.md

```markdown
## Pivot Log

| Timestamp | Changed Artifacts | Phases Affected | Action |
|-----------|-------------------|-----------------|--------|
| {ISO} | REQUIREMENTS.md, PROJECT.md | Phase 3, Phase 4 | Re-routed to discuss |
```

If the table already exists, append a new row. If it does not exist, create it.

### Write PIVOT-REPORT.md

Write a structured report to `.planning/PIVOT-REPORT-{timestamp}.md`:

```markdown
# Pivot Report — {timestamp}

## Trigger

{What changed and why — from user description or artifact diff summary}

## Changed Artifacts

| Artifact | Change Summary |
|----------|---------------|
| {file} | {brief description of modification} |

## Impact Cascade

### Invalidated
{table of INVALID items}

### Flagged for Review
{table of MAYBE_INVALID items}

### Warnings
{table of WARN items}

## Phases Re-routed

| Phase | From | To | Next Command |
|-------|------|----|-------------|
| Phase 3 | planned | needs-discuss | /sunco:discuss 3 |

## Rollback

Restore pre-pivot state: `/sunco:backtrack --label {rollback_label}`

## Decision

User chose: {option selected in present_options — full/selective/review}
```

---

## Step 8: commit

Stage all modified planning files:

```bash
git add .planning/STATE.md
git add .planning/ROADMAP.md
git add .planning/PIVOT-REPORT-*.md 2>/dev/null || true
git add .planning/.pivot-archive/ 2>/dev/null || true
git add .planning/.rollback/ 2>/dev/null || true
```

Commit with structured message:

```bash
git commit -m "pivot: re-route phases after scope change

Changed: $(echo "${CHANGED_FILES}" | tr '\n' ', ')
Invalidated: ${INVALID_COUNT} artifact(s) across ${AFFECTED_PHASE_COUNT} phase(s)
Re-routed: $(echo "${REROUTED_PHASES}" | tr '\n' ', ')
Rollback: ${ROLLBACK_LABEL}"
```

---

## Step 9: display_summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PIVOT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Changed artifacts:    {count}
 Phases re-routed:     {rerouted_count}
 Phases flagged:       {review_count}
 Warnings:             {warn_count}
 Rollback point:       {rollback_label}
 Pivot report:         .planning/PIVOT-REPORT-{timestamp}.md

 {if rerouted_count > 0}
 Next action:
   First re-routed phase: /sunco:discuss {first_rerouted_phase}
 {/if}

 {if review_count > 0}
 Review needed:
   Flagged artifacts require manual review.
   Run: /sunco:context {phase} to see current decisions.
 {/if}

 {if warn_count > 0}
 Already-executed phases with warnings:
   These phases have completed code. Consider running
   /sunco:verify {phase} to check if the code still meets
   the updated requirements.
 {/if}

 Undo this pivot: /sunco:backtrack --label {rollback_label}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Failure Handling

| Failure mode | Detection | Response |
|---|---|---|
| Rollback point creation fails | Non-zero exit from `rollback-point create` | Block. Ask user to commit changes or use `--no-rollback`. |
| Artifact-hash check fails | Non-zero exit or malformed JSON | Fall back to manual diff: `git diff .planning/` |
| Impact analysis returns empty | `invalidated` + `maybe_invalidated` + `warnings` all empty | "No downstream impact detected. Your changes are isolated." |
| Phase directory missing | `ls .planning/phases/{N}-*/` fails | Skip that phase. Warn: "Phase {N} directory not found — skipping." |
| STATE.md update fails | Non-zero exit from `state set` | Manual fallback: edit STATE.md directly. |
| Git commit fails | Non-zero exit from `git commit` | Show error. Do not retry. User must fix (e.g., resolve conflicts). |
| User aborts mid-pivot | Option 4 selected or Ctrl+C | Restore from rollback point. |

---

## Resumption

If a pivot is interrupted (Ctrl+C, context timeout):

1. The rollback point from Step 2 is already saved.
2. Re-run `/sunco:pivot`. The hash check in Step 3 will re-detect the same changes.
3. If the rollback point exists from a prior run, skip creating a new one (check `.planning/.rollback/` for recent `before-pivot-*` entries).

A clean re-run after a completed pivot produces: "No artifact changes detected since last state transition." (because the pivot commit updated the stored hashes).

---

## Routing Summary

| Condition after pivot | Next suggested command |
|-----------------------|----------------------|
| Phases re-routed to `needs-discuss` | `/sunco:discuss {first_phase}` |
| Phases re-routed to `needs-plan` | `/sunco:plan {first_phase}` |
| Only `needs-review` flags (executed phases) | `/sunco:verify {phase}` |
| `--dry-run` used | Re-run without `--dry-run` to apply |
| User chose abort | No action needed (state restored) |

---

## Config Reference

| Key | Default | Effect |
|-----|---------|--------|
| `pivot.auto_rollback` | `true` | Create rollback point before pivot |
| `pivot.archive_invalidated` | `true` | Archive invalidated files before deletion |
| `pivot.require_confirmation` | `true` | Require user selection before applying |
| `git.commit_docs` | `true` | Commit planning artifact changes |

---

## Relationship to Other Workflows

| Workflow | Relationship |
|----------|-------------|
| `/sunco:backtrack` | Restores a rollback point. Pivot creates one; backtrack consumes it. |
| `/sunco:rethink` | Revises specific decisions within a phase. Pivot operates across phases. |
| `/sunco:discuss` | Re-entered after pivot re-routes a phase to `needs-discuss`. |
| `/sunco:plan` | Re-entered after pivot re-routes a phase to `needs-plan`. |
| `/sunco:verify` | Suggested for already-executed phases flagged with warnings. |
| `/sunco:forensics` | Can analyze a pivot's impact after the fact via pivot report and git log. |
