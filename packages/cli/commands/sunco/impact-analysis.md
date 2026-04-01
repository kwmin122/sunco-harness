---
name: sunco:impact-analysis
description: Compute invalidation cascade from planning artifact changes. Shows which artifacts need re-generation, review, or are unaffected.
argument-hint: "[--changed <file1> <file2>]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<context>
**Flags:**
- `--changed <files>` — Specify changed files manually. If omitted, auto-detects via artifact-hash comparison.
</context>

<objective>
Detect which planning artifacts have changed and compute the downstream invalidation cascade. Classifies impacts as INVALID (must re-generate), MAYBE INVALID (needs review), or WARN (already executed, flag for attention).

Presents results grouped by severity and phase, then offers three options:
1. Run impact analysis and re-route (recommended)
2. Ignore and continue
3. Revert changes

This is also called automatically by other workflows (pivot, rethink) when artifact changes are detected.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/impact-analysis.md end-to-end.
</process>

<success_criteria>
- Artifact changes detected (auto or manual)
- Invalidation cascade computed with correct dependency graph
- Results presented grouped by severity (INVALID → MAYBE INVALID → WARN)
- User presented with action options
- If re-route chosen: affected phase statuses updated
- If ignore chosen: hashes updated to current state
- If revert chosen: rollback system invoked
</success_criteria>
