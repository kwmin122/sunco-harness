---
name: sunco:design-review
description: Designer's eye plan review. Rates each design dimension 0-10, explains what would make it a 10, then fixes the plan. Interactive.
argument-hint: "[--lite]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - AskUserQuestion
---

<context>
**Flags:**
- `--lite` — Code-level design check only (skip visual/UX audit).
- (no flag) — Full design review with dimensional scoring.
</context>

<objective>
Review the plan from a designer's perspective. Score each design dimension 0-10, explain what would make it a 10, and propose specific fixes. Interactive — each dimension reviewed with the user.

**After this command:** Plan updated with design improvements. Ready for implementation.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/design-review.md end-to-end.
</process>

<success_criteria>
- Each design dimension scored 0-10
- Gap to 10 explained for each dimension
- Specific fixes proposed for low-scoring dimensions
- Each fix presented via AskUserQuestion
- Plan updated with accepted fixes
- Final score summary produced
</success_criteria>
