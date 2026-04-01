---
name: sunco:pivot
description: Detect scope changes, run impact analysis, and re-route affected phases. Use when project direction changes intentionally.
argument-hint: "[--dry-run]"
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
- `--dry-run` — Show impact analysis without making changes.
</context>

<objective>
Handle intentional scope changes. Detect what planning artifacts changed, compute the invalidation cascade, create a rollback point for safety, and re-route affected phases back to discuss/plan status.

Creates a rollback point, runs impact analysis, and updates STATE.md + ROADMAP.md with re-routed phase statuses.

After completion: run `/sunco:discuss [N]` on the first affected phase.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/pivot.md end-to-end.
</process>

<success_criteria>
- Rollback point created before any mutations
- Artifact changes detected and impact cascade computed
- User presented with options and confirmed action
- Affected phases re-routed to appropriate status (needs_discussion or needs_planning)
- STATE.md updated with pivot log entry
- Changes committed: `docs(sunco): pivot — re-route affected phases`
- User informed which phase to discuss/plan next
</success_criteria>
