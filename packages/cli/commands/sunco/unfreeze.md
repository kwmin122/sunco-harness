---
name: sunco:unfreeze
description: Clear the freeze boundary set by /sunco:freeze, allowing edits to all directories again.
argument-hint: ""
allowed-tools:
  - Bash
  - Read
---

<context>
No arguments. Removes the active freeze boundary.
</context>

<objective>
Remove the directory restriction set by `/sunco:freeze`. All directories become editable again.

**After this command:** Edit any file freely.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/unfreeze.md end-to-end.
</process>

<success_criteria>
- Freeze boundary removed
- All directories editable again
- User informed of removal
</success_criteria>
