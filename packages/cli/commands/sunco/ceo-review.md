---
name: sunco:ceo-review
description: CEO/founder-mode plan review. Rethink the problem, find the 10-star product, challenge premises, expand or hold scope. Works in plan mode.
argument-hint: "[--expand] [--hold] [--selective]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - WebSearch
  - AskUserQuestion
---

<context>
**Modes:**
- `--expand` — SCOPE EXPANSION: Dream big. What would the 10-star version be?
- `--hold` — HOLD SCOPE: Lock current scope, find the 10-star version within it.
- `--selective` — SELECTIVE EXPANSION: Hold scope + cherry-pick expansions worth the cost.
- (no flag) — Auto-detect based on plan analysis.
</context>

<objective>
Review the plan from a CEO/founder perspective. Challenge premises, question whether we're solving the right problem, find the 10-star version, and make scope decisions that create a better product.

**After this command:** Run `/sunco:eng-review` for technical verification.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/ceo-review.md end-to-end.
</process>

<success_criteria>
- Current plan read and analyzed
- Design doc consulted (if exists)
- Premises challenged — at least 3 premises stated and verified
- 10-star version described
- Scope decision made (expand/hold/selective)
- Each recommendation presented with AskUserQuestion
- Review report appended to plan
</success_criteria>
