---
name: sunco:freeze
description: Restrict file edits to a specific directory for the session. Blocks Edit and Write outside the allowed path.
argument-hint: "[<directory>]"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<context>
**Arguments:**
- `<directory>` — Optional. Path to restrict edits to. If omitted, will prompt.
</context>

<objective>
Lock file edits to a specific directory. Any Edit or Write operation targeting a file outside the allowed path will be blocked. Prevents accidentally modifying unrelated code during debugging or focused work.

**After this command:** Work normally — only files within the frozen directory can be edited. Run `/sunco:unfreeze` to remove the restriction.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/freeze.md end-to-end.
</process>

<success_criteria>
- Freeze boundary set to specified directory
- Edit and Write tools blocked outside boundary
- Read, Bash, Glob, Grep unaffected
- User informed of active boundary
- Boundary persists for session duration
</success_criteria>
