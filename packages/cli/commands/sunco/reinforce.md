---
name: sunco:reinforce
description: Add requirements to the current milestone. Inserts new phases if needed and updates REQUIREMENTS.md + ROADMAP.md.
argument-hint: "[--no-commit]"
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
- `--no-commit` — Make changes without committing (for chaining with other commands).
</context>

<objective>
Add new requirements or features to the current milestone. Gathers requirements from the user, determines if they fit into existing phases or need new ones, updates REQUIREMENTS.md with new REQ-IDs, and modifies ROADMAP.md if new phases are needed.

Creates rollback point before modifications for safety.

After completion: run `/sunco:discuss [N]` on the first affected phase.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/reinforce.md end-to-end.
</process>

<success_criteria>
- Rollback point created before any modifications
- New requirements gathered from user with clear descriptions
- Each requirement classified: fits existing phase vs. needs new phase
- REQUIREMENTS.md updated with new REQ-IDs (sequential numbering)
- ROADMAP.md updated with new phases if needed (decimal numbering for insertions)
- Impact analysis run on modified artifacts
- STATE.md updated with reinforce entry
- Changes committed: `docs(sunco): reinforce — add N requirements`
- User informed of affected phases and next steps
</success_criteria>
