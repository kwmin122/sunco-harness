---
name: sunco:eng-review
description: Engineering manager-mode plan review. Architecture, data flow, edge cases, test coverage, performance. Interactive with opinionated recommendations.
argument-hint: ""
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
No arguments. Reviews the current plan in `.planning/` or the active plan in conversation.
</context>

<objective>
Lock in the execution plan. Review architecture, data flow, test coverage, performance, and edge cases. Interactive — one issue at a time with opinionated recommendations.

**After this command:** Implementation is ready. Run `/sunco:execute` or fix issues found.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/eng-review.md end-to-end.
</process>

<success_criteria>
- Scope challenge completed (Step 0)
- Architecture reviewed with component boundaries, coupling, scaling
- Code quality reviewed (DRY, error handling, edge cases)
- Test coverage diagram produced (ASCII code path coverage)
- Missing tests added to plan
- Performance reviewed (N+1, memory, caching, complexity)
- Each issue presented individually via AskUserQuestion
- Completion summary with issue counts
- NOT-in-scope section written
- Failure modes documented
</success_criteria>
