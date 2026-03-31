# Quick Task Workflow

Fast-path execution for small, well-scoped tasks. Parses intent, optionally gathers context or researches, executes, and runs the mandatory lint-gate before committing. Used by `/sunco:quick`.

---

## Overview

Three modes based on flags:

| Mode | Flags | Use when |
|------|-------|----------|
| Direct execute | (none) | Intent is clear, scope is obvious |
| Discuss first | `--discuss` | Intent needs clarification before executing |
| Research first | `--research` | Unfamiliar territory, need ecosystem context |
| Full | `--full` | Both discuss + research before executing |

All modes end with:
1. Mandatory lint-gate
2. Atomic commit (if lint passes)

---

## Step 1: Parse Intent

Parse `$ARGUMENTS` to understand:

- **Action**: create, add, update, fix, remove, refactor, rename
- **Target**: file, function, class, config, test, type, export, command
- **Scope**: which package(s) or file(s) are involved
- **Confidence**: can the task be done without more context?

### Confidence assessment

**High confidence** (proceed directly):
- "add export for `parseConfig` to `packages/core/src/config.ts`"
- "fix TypeScript error in `packages/cli/src/index.ts` on line 42"
- "rename `healthCheck` to `runHealthCheck` in `packages/core/src/health.ts`"

**Medium confidence** (use `--discuss` if unsure):
- "add pagination to the list command" — how? which storage? what page size?
- "improve error messages" — which commands? what format?

**Low confidence** (use `--research` or `--discuss`):
- "switch from X to Y" — are they compatible? migration steps?
- "add caching" — which layer? in-memory or persistent? TTL?

If confidence is low and no flags specified, ask: "Should I research this first, or do you want to clarify the approach? [research/discuss/proceed]"

---

## Step 2A: Discuss (--discuss or --full)

Quick context gathering — not a full `/sunco:discuss` session. Target: 2-4 questions max.

Focus only on decisions that change the implementation:
- Which approach: A or B?
- Where does this live: X or Y?
- What should happen when Z fails?

Do not ask about things that can be inferred from existing code patterns.

Format questions with options (as in the discuss workflow):
```
[Question]
  A) [option] — [tradeoff] (Recommended)
  B) [option] — [tradeoff]
```

After answers, summarize intent in one sentence before proceeding.

---

## Step 2B: Research (--research or --full)

One research agent. Fast research, not comprehensive.

**Research agent prompt:**
```
Quick research for: [task description]

Answer only:
1. Best practice or standard approach for this in [stack]
2. Any known gotchas or pitfalls
3. Relevant existing patterns in this codebase (scan packages/)

Keep response under 200 words. Be specific.
```

Collect results. If agent fails, proceed without research — log warning.

---

## Step 3: Execute

Execute the task directly in the current agent context (no subagent for quick tasks).

### Execution principles

- **Minimal scope**: touch only the files needed for this specific task
- **No refactoring**: if you notice improvements, note them but do not apply them
- **Preserve style**: match existing code style, naming conventions, import patterns
- **No new dependencies**: unless the task specifically requires one

### Progress feedback

Show progress as the task runs:
```
  Reading packages/core/src/config.ts...
  Adding parseConfig export...
  Updating packages/core/src/index.ts barrel export...
  Done.
```

---

## Step 4: Mandatory Lint-Gate

After execution, run immediately:

```bash
npx eslint packages/ --max-warnings 0
npx tsc --noEmit
```

### On lint-gate PASS

Proceed to commit.

### On lint-gate FAIL

Show errors. Do not commit. Fix inline:

```
Lint errors after execution:

  packages/core/src/config.ts:24:5  error  Missing return type  @typescript-eslint/explicit-function-return-type

Fixing...
```

Apply fix. Re-run lint. If lint passes on retry, proceed to commit.

If lint fails twice: stop and surface the error to the user with instructions.

---

## Step 5: Atomic Commit

After lint-gate passes, create one atomic commit:

```bash
git add [changed files]
git commit -m "[type]([scope]): [description]"
```

### Commit message inference

Infer commit type from the action:
- create / add / implement → `feat`
- fix / repair / resolve → `fix`
- rename / move / restructure → `refactor`
- document / comment / jsdoc → `docs`
- test / spec → `test`
- config / dependency → `chore`

Scope = package name (e.g., `core`, `cli`, `skills-harness`).

Example: `feat(core): add export for parseConfig from config module`

### Skip commit flag

If `--no-commit` is in `$ARGUMENTS`, skip the commit step. Show what would have been committed.

---

## Step 6: Report

```
Quick task complete.
  Task: [task description]
  Files changed: [N]
  Lint gate: PASS
  Commit: [commit hash] — [commit message]
```

If task created something that warrants further work: suggest next action.
```
Note: This adds the export, but there are no tests for parseConfig yet.
  Run: /sunco:quick "add vitest unit tests for parseConfig"
```
