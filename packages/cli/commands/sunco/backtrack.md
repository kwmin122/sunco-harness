---
name: sunco:backtrack
description: Restore planning artifacts to a previous rollback point. Code files are untouched — only .planning/ artifacts are restored.
argument-hint: "[--label <label>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<context>
**Flags:**
- `--label <label>` — Restore to a specific rollback point by label. If omitted, lists available points for interactive selection.
</context>

<objective>
Restore .planning/ artifacts to a known-good state. Lists available rollback points, lets the user choose, restores artifacts via git, and runs impact analysis on restored files.

Only `.planning/` artifacts are affected — code files are never touched.

After completion: run `/sunco:where-am-i` to see current state, then `/sunco:discuss [N]` or `/sunco:plan [N]` as needed.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/backtrack.md end-to-end.
</process>

<success_criteria>
- Available rollback points listed with labels and timestamps
- User selected or confirmed a rollback point
- Artifacts restored from git tag to .planning/ directory
- Impact analysis run on all restored files
- STATE.md updated with backtrack entry and correct phase/status
- Changes committed: `docs(sunco): backtrack to "{label}"`
- User informed of restored state and recommended next steps
</success_criteria>
