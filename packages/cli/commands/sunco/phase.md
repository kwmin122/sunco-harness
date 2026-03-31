---
name: sunco:phase
description: Add, insert, or remove phases in ROADMAP.md. Manages the roadmap structure without breaking existing phase numbering and planning artifacts.
argument-hint: "[--add] [--insert <after-N>] [--remove <N>] [--rename <N>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Flags:**
- `--add` — Add a new phase to the end of the active milestone.
- `--insert <after-N>` — Insert an urgent phase after phase N, using decimal numbering (e.g., 2.1).
- `--remove <N>` — Remove a future phase and renumber subsequent phases.
- `--rename <N>` — Rename phase N.
- `--list` — Show all phases with numbers and status.
</context>

<objective>
Manage the phase structure in ROADMAP.md. Preserves existing phase artifacts and planning state when inserting or removing.
</objective>

<process>
## If --list

Read ROADMAP.md.
Display all phases with:
- Number
- Title
- Status (from STATE.md and planning artifacts)
- Phase directory (if it exists)

## If --add

Ask: "Phase title?"
Ask: "Phase goal (one sentence)?"
Ask: "Which milestone does this belong to?"

Find the last phase in the milestone.
Append new phase to ROADMAP.md with next sequential number.

Show: "Added Phase [N]: [title]"

## If --insert <after-N>

Ask: "Phase title?"
Ask: "Phase goal?"

Read ROADMAP.md, find Phase after-N.

Insert with decimal number: Phase [after-N].1
(e.g., inserting after Phase 2 → Phase 2.1)

If Phase after-N.1 already exists: use after-N.2.

Note: Do NOT renumber existing phases. Decimal numbering keeps artifacts intact.

Update ROADMAP.md with the inserted phase.

Show: "Inserted Phase [after-N].1: [title] (between Phase [after-N] and Phase [after-N+1])"

## If --remove <N>

Read ROADMAP.md and find Phase N.

**Safety check:**
```bash
ls .planning/phases/[N]-*/ 2>/dev/null
```

If phase directory exists (has plans/summaries): warn:
"Phase [N] has existing planning artifacts. Removing from ROADMAP.md but artifacts will remain in .planning/phases/[N]-*/"

Ask: "Remove Phase [N]: [title]? This cannot be undone. [yes/no]"

If yes: remove from ROADMAP.md. Renumber subsequent phases if they are sequential integers.

Update STATE.md current phase if needed.

## If --rename <N>

Read current phase title.
Ask: "New title for Phase [N]? (current: [title])"

Update ROADMAP.md with new title.
Show: "Phase [N] renamed to: [new title]"
</process>
