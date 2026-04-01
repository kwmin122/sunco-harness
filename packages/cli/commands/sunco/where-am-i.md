---
name: sunco:where-am-i
description: Complete orientation dashboard — current phase, all decisions, recent changes, blockers, rollback points, and decision timeline.
argument-hint: "[--phase N] [--json] [--decisions-only] [--no-git]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<context>
**Flags:**
- `--phase N` — Focus on a specific phase instead of showing all.
- `--json` — Output as JSON for machine consumption.
- `--decisions-only` — Show only the decisions table.
- `--no-git` — Skip git-related sections (recent commits, change detection).
</context>

<objective>
Provide a complete "you are here" status overview for orientation. This is a **read-only** command — it never writes files, commits, or changes state.

Shows: current phase, phase status, completion %, all decisions across phases, recent artifact changes, blockers/warnings, available rollback points, and a chronological decision timeline.

Use this after `/sunco:backtrack`, `/sunco:pivot`, or when returning to a project after a break.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/where-am-i.md end-to-end.
</process>

<success_criteria>
- Current phase and status displayed
- Phase overview table with completion percentages
- All decisions from CONTEXT.md files listed with LOCKED/OPEN status
- Recent artifact changes shown (if any)
- Blockers and warnings surfaced
- Available rollback points listed
- Decision timeline rendered with "you are here" marker
- No files written, no state changed, no commits made
</success_criteria>
