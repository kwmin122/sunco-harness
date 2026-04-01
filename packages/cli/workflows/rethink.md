# Rethink Workflow

Revise specific decisions for a phase without a full pivot. Reads the phase's CONTEXT.md to extract locked decisions (D-01, D-02, etc.), lets the user pick which to reconsider, opens a focused discussion on the selected decisions, rewrites the affected CONTEXT.md sections, runs impact analysis to find downstream invalidation, and updates phase status back to `context_ready`. Used by `/sunco:rethink`.

---

## Core Principle

Surgical, not scorched-earth. A pivot replans everything. Rethink touches only the decisions the user selects. Every other locked decision stays intact. A rollback point is created before any changes so the user can undo cleanly.

---

## Overview

Nine steps:

1. **Parse arguments** — determine target phase
2. **Load context** — read CONTEXT.md and STATE.md
3. **Create rollback point** — snapshot before any mutation
4. **Extract decisions** — parse all D-XX decision entries
5. **Ask user** — present decisions, let user pick which to reconsider
6. **Revise decisions** — focused re-discussion on selected decisions only
7. **Impact analysis** — compute invalidation cascade from changed decisions
8. **Update state and commit** — set status to `context_ready`, commit atomically
9. **Report** — summary with next steps

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional token | `PHASE_ARG` | — (required) |
| `--decision <id>` | `DECISION_FILTER` | unset (interactive selection) |
| `--no-commit` | `NO_COMMIT` | false |

If `PHASE_ARG` is absent:
```
Usage: /sunco:rethink <phase-number>
Example: /sunco:rethink 3

Options:
  --decision D-02      Skip interactive selection, rethink a specific decision
  --no-commit          Make changes without committing
```

If `--decision` is provided, skip the interactive selection in Step 5 and rethink only that decision. Multiple `--decision` flags are allowed: `--decision D-02 --decision D-05`.

---

## Step 2: Load Context

Load phase context and state in one call:

```bash
TOOLS="node \"$HOME/.claude/sunco/bin/sunco-tools.cjs\""

INIT=$(eval $TOOLS init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON fields:

| Field | Type | Description |
|-------|------|-------------|
| `phase_found` | bool | Phase directory exists |
| `phase_dir` | string | Path: `.planning/phases/N-slug/` |
| `phase_number` | string | e.g. `"03"` |
| `phase_name` | string | Human name |
| `phase_slug` | string | Kebab slug |
| `state_exists` | bool | STATE.md present |

**Error conditions:**
- `phase_found: false` → error: "Phase `${PHASE_ARG}` not found. Run `/sunco:status` to list phases."
- No CONTEXT.md in phase directory → error: "No CONTEXT.md found for Phase ${PHASE_ARG}. Run `/sunco:discuss ${PHASE_ARG}` first."

### Locate CONTEXT.md

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
CONTEXT_FILE=$(ls "${PHASE_DIR}/"*"-CONTEXT.md" 2>/dev/null | head -1)

if [[ -z "$CONTEXT_FILE" ]]; then
  echo "No CONTEXT.md found for Phase ${PHASE_ARG}. Run /sunco:discuss ${PHASE_ARG} first."
  exit 1
fi
```

Read the full CONTEXT.md content for decision extraction.

### Load STATE.md

```bash
eval $TOOLS state load
```

Read current phase status. If the phase has already shipped (status = `shipped` or `archived`):
```
Phase ${PHASE_ARG} is already shipped. Rethinking shipped phases is not supported.
Use /sunco:reinforce to add new requirements to a future phase instead.
```

Stop.

---

## Step 3: Create Rollback Point

Before mutating any artifact, create a rollback point:

```bash
eval $TOOLS rollback-point create --label "before-rethink-phase-${PADDED}"
```

This snapshots all `.planning/` artifacts so the user can restore with:
```bash
/sunco:backtrack before-rethink-phase-${PADDED}
```

Report: `Rollback point created: before-rethink-phase-${PADDED}`

---

## Step 4: Extract Decisions

Parse CONTEXT.md for all locked decisions. Decisions follow these patterns:

```markdown
### D-01: Decision Title
Decision text...

### D-02: Another Decision
More text...
```

Or within a `## Key Decisions` section:

```markdown
## Key Decisions

- **D-01: Decision Title** — Decision text...
- **D-02: Another Decision** — More text...
```

### Extraction algorithm

1. Read the full CONTEXT.md content
2. Scan for all decision identifiers matching pattern `D-\d{2}` (e.g. D-01, D-02)
3. For each decision, extract:
   - `id`: The identifier (D-01, D-02, etc.)
   - `title`: The decision title text after the identifier
   - `body`: The full decision body text (everything until the next D-XX or next `##` heading)
   - `line_start`: Starting line number in CONTEXT.md
   - `line_end`: Ending line number

4. Store as an array of decision objects.

If no decisions found:
```
No decisions (D-01, D-02, ...) found in CONTEXT.md for Phase ${PHASE_ARG}.
Run /sunco:discuss ${PHASE_ARG} to surface decisions first.
```

Stop.

Report the inventory:
```
Found ${DECISION_COUNT} decisions in Phase ${PHASE_ARG} CONTEXT.md:

  D-01: ${title_01}
  D-02: ${title_02}
  D-03: ${title_03}
  ...
```

---

## Step 5: Ask User Which Decisions to Reconsider

If `--decision` flag was provided, skip this step. Use the pre-selected decision IDs and validate they exist in the extracted list. If any ID does not exist:
```
Decision ${ID} not found in Phase ${PHASE_ARG} CONTEXT.md.
Available decisions: D-01, D-02, D-03, ...
```

Stop.

### Interactive selection

Present all decisions with context and ask the user to choose:

```
Which decisions do you want to reconsider?

  D-01: ${title_01}
        "${first 80 chars of body}..."

  D-02: ${title_02}
        "${first 80 chars of body}..."

  D-03: ${title_03}
        "${first 80 chars of body}..."

Enter decision IDs (comma-separated), e.g.: D-01, D-03
Or type "all" to reconsider every decision.
```

Use `AskUserQuestion` to get the user's selection.

Parse the response:
- `"all"` → select every decision
- `"D-01, D-03"` → select those specific IDs
- `"D-01 D-03"` → also valid (space-separated)
- `"1, 3"` → also valid (bare numbers, prefix D- automatically)

Validate all selected IDs exist. If any invalid:
```
Unknown decision: ${ID}. Available: D-01, D-02, D-03, ...
```

Ask again.

Report: `Reconsidering ${N} decision(s): ${selected_ids}`

---

## Step 6: Revise Decisions

For each selected decision, open a focused re-discussion. The goal is to capture the user's revised thinking without losing the context of unchanged decisions.

### Build revision prompt

For each selected decision, present:

```
--- Rethinking D-${ID}: ${title} ---

Current decision:
  ${full body text}

This decision was made during /sunco:discuss for Phase ${PHASE_ARG}.

Why are you reconsidering this? What's changed?
```

Use `AskUserQuestion` for each selected decision to capture the user's revised intent.

### Revision rules

1. **One decision at a time.** Do not batch — each decision gets its own focused exchange.
2. **Preserve decision format.** The revised decision must use the same D-XX identifier and follow the same markdown structure.
3. **Mark as revised.** Append `(revised — ${ISO_DATE})` to the decision title.
4. **Keep original as history.** Add a collapsed details block below the revised decision:

```markdown
### D-02: Revised Title (revised — 2026-04-01)

New decision text based on user's revised intent.

<details>
<summary>Previous decision (before rethink)</summary>

Original decision text that was replaced.

</details>
```

5. **Claude's Discretion on framing.** Claude reformulates the user's input into a clear decision statement (same as discuss-phase pattern). The user provides intent; Claude writes the decision artifact.

### Write revised CONTEXT.md

After all selected decisions have been revised:

1. Read the current CONTEXT.md
2. For each revised decision: replace the old decision block (from `line_start` to `line_end`) with the revised block
3. Update the CONTEXT.md frontmatter `status:` to `context_revised`
4. Add a `revised_at:` timestamp to frontmatter
5. Add a `rethink_decisions:` list to frontmatter with the revised decision IDs

Write the updated CONTEXT.md.

Verify the write:
```bash
grep "revised — " "${CONTEXT_FILE}" | wc -l
```

The count should match the number of revised decisions. If not: warn "CONTEXT.md write may be incomplete — verify manually."

---

## Step 7: Impact Analysis

Revised decisions may invalidate downstream artifacts. Run impact analysis:

```bash
IMPACT=$(eval $TOOLS impact-analysis --changed "${CONTEXT_FILE}")
```

Parse the JSON response:

| Field | Type | Description |
|-------|------|-------------|
| `invalidated` | array | Artifacts that MUST be regenerated |
| `maybe_invalidated` | array | Artifacts that should be reviewed |
| `warnings` | array | Already-executed work that may be affected |

### Typical invalidation cascade for CONTEXT.md changes

```
CONTEXT.md (phase N) changed →
  ├── All PLAN.md in phase N → INVALID (must re-plan)
  ├── All RESEARCH.md in phase N → MAYBE INVALID (check if research covered revised decisions)
  └── All SUMMARY.md in phase N → WARN (already executed, may need revision)
```

### Report impact

```
Impact Analysis for Phase ${PHASE_ARG} decision revision:

  INVALIDATED (must regenerate):
    ${list of invalidated files, one per line}

  REVIEW NEEDED (may be affected):
    ${list of maybe_invalidated files}

  WARNINGS (already executed):
    ${list of warnings}
```

If `invalidated` contains any PLAN.md files:
```
Phase ${PHASE_ARG} plans are invalidated by the decision changes.
After committing, run /sunco:plan ${PHASE_ARG} to regenerate plans.
```

If `warnings` contains any SUMMARY.md files:
```
Warning: Phase ${PHASE_ARG} has already-executed plans whose assumptions
may have changed. Review the SUMMARY.md files listed above.
```

---

## Step 8: Update State and Commit

### Update STATE.md

Set the phase status back to `context_ready` to indicate re-planning is needed:

```bash
eval $TOOLS state set phase.${PADDED}.status context_ready
eval $TOOLS state set phase.${PADDED}.last_rethink "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
eval $TOOLS state set phase.${PADDED}.rethink_decisions "${SELECTED_IDS}"
```

### Compute new artifact hashes

```bash
eval $TOOLS artifact-hash compute
```

This updates `.planning/.hashes.json` so the next command does not trigger a false-positive change detection.

### Commit

If `--no-commit` is set: skip commit, show summary only.

Otherwise:

```bash
git add "${CONTEXT_FILE}" .planning/.hashes.json .planning/.rollback/
git commit -m "refactor(context): rethink Phase ${PADDED} decisions ${SELECTED_IDS}"
```

---

## Step 9: Report

```
Rethink complete.

  Phase:              ${PHASE_ARG} — ${phase_name}
  Decisions revised:  ${SELECTED_IDS}
  Status:             context_ready (needs re-planning)
  Rollback:           /sunco:backtrack before-rethink-phase-${PADDED}
  Commit:             ${commit_hash}

  Invalidated:        ${invalidated_count} artifact(s)
  Review needed:      ${maybe_invalidated_count} artifact(s)

Next steps:
  /sunco:plan ${PHASE_ARG}           — regenerate plans with revised decisions
  /sunco:backtrack ${rollback_label}  — undo this rethink if needed
  /sunco:context ${PHASE_ARG}        — review the updated CONTEXT.md
```

---

## Error Handling

| Error | Response |
|-------|----------|
| `PHASE_ARG` missing | Print usage and stop |
| Phase not found | "Run `/sunco:status` to list phases." |
| No CONTEXT.md | "Run `/sunco:discuss` first." |
| No decisions in CONTEXT.md | "Run `/sunco:discuss` to surface decisions." |
| Phase already shipped | "Use `/sunco:reinforce` instead." |
| Invalid decision ID in `--decision` | List available IDs and stop |
| CONTEXT.md write verification fails | Warn, do not commit, suggest manual check |
| Impact analysis fails | Warn, continue with commit (non-blocking) |
| Rollback point creation fails | Warn, ask user to continue without rollback safety |
| Git commit fails | Log warning, skip commit, continue |
