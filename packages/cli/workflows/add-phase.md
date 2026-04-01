# Add Phase Workflow

Append a new phase to the end of the project roadmap. Reads ROADMAP.md to determine the next phase number, creates the phase directory, scaffolds a CONTEXT.md stub, and updates ROADMAP.md atomically. Used by `/sunco:phase add`.

---

## Overview

Four steps:

1. **Parse intent** — read phase title (and optional description) from `$ARGUMENTS`
2. **Determine phase number** — scan ROADMAP.md for the last declared phase
3. **Create artifacts** — make the phase directory and stub files
4. **Update ROADMAP.md** — append the new phase entry and commit

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional string (quoted or unquoted) | `PHASE_TITLE` | — (required) |
| `--milestone <name>` | `MILESTONE` | current milestone from STATE.md |
| `--description <text>` | `DESCRIPTION` | empty |
| `--no-commit` | `NO_COMMIT` | false |

If `PHASE_TITLE` is absent, stop:
```
Usage: /sunco:phase add "<title>"
Example: /sunco:phase add "Plugin System"
```

Derive `PHASE_SLUG` from `PHASE_TITLE`: lowercase, spaces to hyphens, remove special characters.

Example: `"Plugin System"` → `plugin-system`

---

## Step 2: Determine Phase Number

Read ROADMAP.md to find the last existing phase:

```bash
ROADMAP_FILE="ROADMAP.md"
if [[ ! -f "$ROADMAP_FILE" ]]; then
  echo "ROADMAP.md not found. Run /sunco:init first."
  exit 1
fi
```

Scan for the highest phase number already declared. Phase entries in ROADMAP.md follow one of these patterns:

```
## Phase 1: Title
## Phase 01: Title
### Phase 3.1: Title  (decimal phases — skip, count only integer phases)
```

Extract all integer phase numbers:
```bash
LAST_PHASE=$(grep -E "^#{1,3} Phase [0-9]+:" ROADMAP.md \
  | grep -oE "Phase [0-9]+" \
  | grep -oE "[0-9]+" \
  | sort -n | tail -1)
```

If no phases found: `LAST_PHASE=0`

`NEXT_PHASE=$((LAST_PHASE + 1))`

Format with zero-padding for consistency:
```bash
PADDED=$(printf "%02d" "$NEXT_PHASE")
```

Report: `Next phase number: ${PADDED} (last was ${LAST_PHASE})`

---

## Step 3: Create Phase Artifacts

### Phase directory

```bash
PHASE_DIR=".planning/phases/${PADDED}-${PHASE_SLUG}"
mkdir -p "${PHASE_DIR}"
```

If directory already exists (edge case from a prior incomplete run):
```
Directory ${PHASE_DIR} already exists.
Options:
  overwrite — replace stub files (keeps any existing plans)
  abort     — stop here
```

Wait for user response.

### Scaffold CONTEXT.md stub

Write `.planning/phases/${PADDED}-${PHASE_SLUG}/${PADDED}-CONTEXT.md`:

```markdown
---
phase: {PADDED}
title: {PHASE_TITLE}
slug: {PHASE_SLUG}
milestone: {MILESTONE}
status: draft
created_at: {ISO timestamp}
---

# Phase {PADDED}: {PHASE_TITLE}

## Objective

{DESCRIPTION if provided, otherwise: "[Describe the objective of this phase. What gets built, enabled, or fixed?]"}

## Requirements

- REQ-{PADDED}-01: [Requirement]

## Key Decisions

_No decisions recorded yet. Run `/sunco:discuss {PADDED}` to surface decisions before planning._

## Out of Scope

_Define what this phase explicitly will NOT do._

## Acceptance Criteria

- [ ] [Criterion 1]
```

### Scaffold STATUS.md stub (optional, only if .planning/phases/ uses per-phase STATUS files)

Check if any sibling phase has a `STATUS.md`. If yes, create one:

```markdown
---
phase: {PADDED}
status: draft
---
Phase {PADDED}: {PHASE_TITLE} — draft
```

---

## Step 4: Update ROADMAP.md

Find the insertion point: the end of the existing roadmap phases section (before any `## Milestones`, `## Backlog`, or `---` footer section, whichever comes first).

Read the full ROADMAP.md. Locate the last `## Phase` heading. Insert AFTER the full block of that phase (find its last content line before the next `##` heading or end of file).

### New phase entry format

```markdown
## Phase {PADDED}: {PHASE_TITLE}

{DESCRIPTION if provided, otherwise: "TODO: Add phase description."}

**Status:** Draft
**Milestone:** {MILESTONE}
```

Append this block at the correct insertion point.

### Write updated ROADMAP.md

Do a surgical append — do not reformat existing content. Only add the new phase block.

Verify the file was written correctly:
```bash
grep "Phase ${PADDED}:" ROADMAP.md
```

If the grep returns no result: abort with "ROADMAP.md write verification failed. Check file manually."

---

## Step 5: Commit

If `--no-commit` is set: skip commit, show summary only.

Otherwise:

```bash
git add ROADMAP.md "${PHASE_DIR}/${PADDED}-CONTEXT.md"
git commit -m "chore(roadmap): add Phase ${PADDED} — ${PHASE_TITLE}"
```

---

## Step 6: Report

```
Phase added.

  Number:    {PADDED}
  Title:     {PHASE_TITLE}
  Slug:      {PHASE_SLUG}
  Directory: {PHASE_DIR}/
  Milestone: {MILESTONE}
  Commit:    {commit_hash} — chore(roadmap): add Phase {PADDED}

Next steps:
  /sunco:discuss {PADDED}    — surface decisions before planning
  /sunco:plan {PADDED}       — generate execution plans
```

---

## Error Handling

| Error | Response |
|-------|----------|
| ROADMAP.md not found | "Run /sunco:init first." |
| `PHASE_TITLE` missing | Print usage and stop |
| Phase directory already exists | Ask overwrite/abort |
| ROADMAP.md write verification fails | Abort with manual instructions |
| Git commit fails | Show error, skip commit, continue |
