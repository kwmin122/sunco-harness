---
name: sunco:rethink
description: Revise specific decisions in a phase CONTEXT.md without a full pivot. Propagate changes to dependent artifacts.
argument-hint: "<phase> [--decision D-XX] [--no-commit]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number (e.g., `1`, `2`). Required.

**Flags:**
- `--decision D-XX` — Skip interactive selection, revise a specific decision directly.
- `--no-commit` — Make changes without committing (for chaining with other commands).
</context>

<objective>
Revise specific decisions for a phase without starting over. Extract decisions from CONTEXT.md, let the user pick which to reconsider, update them in-place, and run impact analysis to find downstream effects.

Updates `.planning/phases/[N]-[name]/[N]-CONTEXT.md` with revised decisions (originals preserved in collapsed blocks).

After completion: run `/sunco:plan [N]` to re-plan the affected phase.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/rethink.md end-to-end.
</process>

<success_criteria>
- Rollback point created before any modifications
- Selected decisions revised with new rationale
- Original decisions preserved in `<details>` blocks for audit trail
- Impact analysis run on modified CONTEXT.md
- Phase status set to `context_ready` (needs re-planning)
- STATE.md updated with rethink entry
- Changes committed: `docs(phase-[N]): rethink decisions [D-XX, D-YY]`
- User informed of invalidated artifacts and next step: `/sunco:plan [N]`
</success_criteria>
