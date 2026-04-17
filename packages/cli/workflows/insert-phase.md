# Insert Phase Workflow

Insert an urgent or mid-milestone phase between two existing phases using decimal numbering (e.g. Phase 3.1 between Phase 3 and Phase 4). Calculates the decimal slot, creates the phase directory with full scaffolding, updates ROADMAP.md, and renumbers downstream references if needed. Used by `/sunco:phase insert`.

---

## Pre-Check: New Capability Requires Brainstorming

Decimal phases are almost always unplanned when they are inserted — that is their reason for existing. If the inserted phase introduces a new user-facing capability, subsystem, or architectural change, run brainstorming BEFORE this workflow:

```text
/sunco:brainstorming "<the new capability being squeezed in>"
```

Feed the approved spec to `/sunco:reinforce` (to add requirements to the current milestone) or directly supply it as context to `/sunco:discuss <phase>` after this insert completes. Only skip brainstorming when the inserted phase is a pure bugfix / hotfix whose scope fits in a single `/sunco:quick`.

---

## Overview

Five steps:

1. **Parse intent** — determine where to insert and what the phase is about
2. **Calculate phase number** — assign the decimal (e.g. `3.1`, `3.2`)
3. **Create artifacts** — scaffold directory and stub files
4. **Update ROADMAP.md** — inject the phase entry at the correct position
5. **Notify downstream** — warn if later phases have hard references to phase numbers

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional integer | `AFTER_PHASE` | — (required) |
| Second positional string | `PHASE_TITLE` | — (required) |
| `--description <text>` | `DESCRIPTION` | empty |
| `--milestone <name>` | `MILESTONE` | inherit from AFTER_PHASE |
| `--no-commit` | `NO_COMMIT` | false |

Example: `/sunco:phase insert 3 "Auth Middleware" --description "JWT validation layer"`

If `AFTER_PHASE` is absent:
```
Usage: /sunco:phase insert <after-phase-number> "<title>"
Example: /sunco:phase insert 3 "Auth Middleware"
```

If `PHASE_TITLE` is absent: same error.

Derive `PHASE_SLUG` from `PHASE_TITLE` (lowercase, spaces to hyphens).

---

## Step 2: Calculate Phase Number

### Find existing decimal slots

Scan ROADMAP.md for phases already at `AFTER_PHASE.N`:

```bash
EXISTING_DECIMALS=$(grep -oE "Phase ${AFTER_PHASE}\.[0-9]+" ROADMAP.md \
  | grep -oE "\.[0-9]+" | grep -oE "[0-9]+" | sort -n)
```

Find the next available decimal:
```bash
if [[ -z "$EXISTING_DECIMALS" ]]; then
  DECIMAL=1
else
  LAST_DECIMAL=$(echo "$EXISTING_DECIMALS" | tail -1)
  DECIMAL=$((LAST_DECIMAL + 1))
fi
PHASE_NUMBER="${AFTER_PHASE}.${DECIMAL}"
```

Examples:
- First insert after Phase 3 → `3.1`
- Second insert after Phase 3 (if `3.1` already exists) → `3.2`
- Insert after Phase 5 when `5.1` and `5.2` exist → `5.3`

Inform user: `Assigning phase number: ${PHASE_NUMBER}`

### Directory naming

Decimal phases use a zero-padded prefix derived from the parent integer phase, with the decimal appended:

```
PARENT_PADDED=$(printf "%02d" "$AFTER_PHASE")
DIR_NAME="${PARENT_PADDED}.${DECIMAL}-${PHASE_SLUG}"
PHASE_DIR=".planning/phases/${DIR_NAME}"
```

Example: Phase 3.1 → `.planning/phases/03.1-auth-middleware/`

---

## Step 3: Validate Insertion Context

Read the parent phase directory to inherit milestone context:

```bash
PARENT_DIR=$(ls -d ".planning/phases/$(printf "%02d" $AFTER_PHASE)-*" 2>/dev/null | head -1)
```

If parent phase directory exists:
- Read CONTEXT.md `milestone:` field for default milestone inheritance.
- Warn if parent phase has no VERIFICATION.md: "Parent phase ${AFTER_PHASE} has not been executed. Inserting a decimal phase before the parent is complete is unusual."

If parent phase does not exist in `.planning/`:
- Check ROADMAP.md to confirm the parent phase at least exists in the roadmap.
- If parent phase is not in ROADMAP.md: stop with "Phase ${AFTER_PHASE} not found in ROADMAP.md. Check the roadmap and try again."

---

## Step 4: Create Phase Artifacts

```bash
mkdir -p "${PHASE_DIR}"
```

Write `${PHASE_DIR}/${PARENT_PADDED}.${DECIMAL}-CONTEXT.md`:

```markdown
---
phase: "{PHASE_NUMBER}"
title: {PHASE_TITLE}
slug: {PHASE_SLUG}
milestone: {MILESTONE}
inserted_after: "{AFTER_PHASE}"
status: draft
created_at: {ISO timestamp}
---

# Phase {PHASE_NUMBER}: {PHASE_TITLE}

> Inserted between Phase {AFTER_PHASE} and Phase {NEXT_INTEGER_PHASE}.

## Objective

{DESCRIPTION if provided, otherwise: "[Describe why this phase was inserted and what it accomplishes before Phase {NEXT_INTEGER_PHASE} can proceed.]"}

## Why Inserted Here

_Explain the dependency or blocker that necessitated inserting this phase at this position in the roadmap._

## Requirements

- REQ-{PARENT_PADDED}.{DECIMAL}-01: [Requirement]

## Key Decisions

_No decisions recorded yet. Run `/sunco:discuss {PHASE_NUMBER}` to surface decisions._

## Out of Scope

_What this insertion phase explicitly will NOT do (to keep scope tight)._

## Acceptance Criteria

- [ ] [Criterion 1]
```

---

## Step 5: Update ROADMAP.md

Find the exact insertion point in ROADMAP.md: after the last content line of Phase `AFTER_PHASE`'s block, before Phase `AFTER_PHASE + 1`'s heading.

### Locate insertion point

```bash
# Find the line number of the next integer phase heading
NEXT_PHASE=$((AFTER_PHASE + 1))
NEXT_HEADING=$(grep -n "^#{1,3} Phase ${NEXT_PHASE}:" ROADMAP.md | head -1 | cut -d: -f1)
```

If `NEXT_HEADING` is found: insert BEFORE line `NEXT_HEADING`.
If no next integer phase exists: insert at end of file (same as `add-phase`).

### New phase entry to inject

```markdown
## Phase {PHASE_NUMBER}: {PHASE_TITLE}

{DESCRIPTION if provided, otherwise: "Inserted phase — see CONTEXT.md for details."}

**Status:** Draft
**Inserted after:** Phase {AFTER_PHASE}
**Milestone:** {MILESTONE}

```

Write the updated ROADMAP.md. Verify:
```bash
grep "Phase ${PHASE_NUMBER}:" ROADMAP.md
```

---

## Step 6: Check for Downstream Phase Number References

Scan `.planning/` for hard-coded references to phases that come AFTER the insertion point. These are NOT automatically renumbered (decimal phases leave integer phases unchanged), but the user should be aware of any cross-references.

```bash
grep -rn "phase ${NEXT_PHASE}" .planning/ 2>/dev/null | grep -v "archive/" | head -10
```

If references are found: report as informational (not a blocker):
```
Note: Found references to Phase {NEXT_PHASE} in {N} planning files.
These are not affected by the decimal insertion (integer phases are unchanged).
```

---

## Step 7: Commit

If `--no-commit`: skip.

```bash
git add ROADMAP.md "${PHASE_DIR}/"
git commit -m "chore(roadmap): insert Phase ${PHASE_NUMBER} — ${PHASE_TITLE} (after Phase ${AFTER_PHASE})"
```

---

## Step 8: Report

```
Phase inserted.

  Number:    {PHASE_NUMBER}
  Title:     {PHASE_TITLE}
  Position:  After Phase {AFTER_PHASE}, before Phase {NEXT_PHASE}
  Directory: {PHASE_DIR}/
  Milestone: {MILESTONE}
  Commit:    {hash}

Next steps:
  /sunco:discuss {PHASE_NUMBER}    — surface decisions
  /sunco:plan {PHASE_NUMBER}       — generate execution plans
```

---

## Error Handling

| Error | Response |
|-------|----------|
| `AFTER_PHASE` or `PHASE_TITLE` missing | Print usage and stop |
| Parent phase not in ROADMAP.md | Stop, ask user to verify roadmap |
| Decimal directory already exists | Ask "Overwrite stub files?" or abort |
| ROADMAP.md insertion verification fails | Print fallback manual instructions |
| Git commit fails | Log warning, continue |
