---
name: sunco:fast
description: Execute a trivial task inline with no planning overhead. For one-liner fixes, typo corrections, and obvious changes that don't need discussion.
argument-hint: "<task description>"
allowed-tools:
  - Read
  - Bash
  - Write
---

<context>
**Arguments:**
- `<task description>` — What to do. Required.
</context>

<objective>
Execute a trivial task with minimum friction. No subagents, no discussion, no planning. Just: read → change → lint-check → commit.

Use for: typo fixes, renaming, adding a missing export, updating a constant, fixing a comment.
Do NOT use for: anything requiring design decisions, multi-file refactoring, or new features.

**After this command:** Change committed.
</objective>

<process>
## Step 1: Execute inline

Read the relevant file(s).
Make the change directly.
Verify the change looks correct.

## Step 2: Quick sanity check

```bash
npx tsc --noEmit 2>&1 | head -10
```

If TypeScript errors: fix them.

## Step 3: Commit

```bash
git add [specific files only]
git commit -m "fix: [brief description]"
```

## Done

Show: "Done. [commit hash]"
</process>
