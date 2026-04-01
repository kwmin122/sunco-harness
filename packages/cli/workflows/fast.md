# Fast Workflow

Execute trivial inline tasks with no planning, no subagents, and no discussion. Parse the intent, execute directly in this context window, run the lint-gate, and commit. For tasks that can be described, understood, and completed in under five minutes. Used by `/sunco:fast`.

---

## Overview

Fast is opinionated:
- No subagents
- No planning files
- No research agents
- No interactive questions (unless truly ambiguous)
- Lint-gate is mandatory
- Atomic commit is mandatory

**Use fast when:**
- The task fits in one sentence
- The files to touch are obvious from the description
- No design decisions are needed

**Do not use fast when:**
- The task spans more than 3 files
- The correct approach is unclear
- The task requires a new dependency
- The task involves changing public API contracts

---

## Step 1: Parse Intent

Parse `$ARGUMENTS`. The entire argument string is the task description.

```
TASK_DESCRIPTION = $ARGUMENTS (stripped of known flags)
```

Flags:

| Flag | Variable | Default |
|------|----------|---------|
| `--no-commit` | `NO_COMMIT` | false |
| `--no-lint` | `NO_LINT` | false (use sparingly — lint is recommended) |

If `TASK_DESCRIPTION` is empty:
```
Usage: /sunco:fast "<task>"
Example: /sunco:fast "add isDev() helper to packages/core/src/utils.ts"
```

### Scope check

Estimate the scope from the description. Look for indicators of wide-scope work:
- More than 3 file references
- Words like "refactor", "migrate", "replace all", "redesign"
- References to multiple packages

If wide-scope indicators are found, warn:
```
This task may be too large for /sunco:fast.
For multi-file or multi-step work, use: /sunco:quick "{TASK_DESCRIPTION}"

Proceed with fast anyway? [y/n]
```

If user says `n`: suggest `/sunco:quick` and stop.
If user says `y`: proceed.

---

## Step 2: Locate Files

Identify which files need to be touched based on the task description.

Do NOT create new files unless the task explicitly asks to create something new.
Do NOT open files that are not relevant to the specific task.

For each file identified:
1. Read it completely first.
2. Understand the existing patterns and style.
3. Plan the exact edit before touching anything.

If a required file does not exist and the task requires creating it:
- Verify the target directory exists.
- Note the file will be created.

---

## Step 3: Execute

Apply the change directly. No intermediate state, no TODOs left in code.

### Execution principles

- **One concern**: change exactly one thing. If you notice other issues, note them but do not touch them.
- **Match existing style**: indent, naming, import style must match the surrounding code.
- **Complete the task**: do not leave `// TODO` markers or half-implemented stubs.
- **No new dependencies**: unless the task explicitly calls for one.
- **No type suppressions**: do not add `@ts-ignore` or `as any` to make a lint error go away.

Show progress:
```
  Reading packages/core/src/utils.ts...
  Adding isDev() helper...
  Updating barrel export in packages/core/src/index.ts...
  Done.
```

---

## Step 4: Lint-Gate

After execution, run immediately:

```bash
npx eslint packages/ --max-warnings 0 2>&1
npx tsc --noEmit 2>&1
```

If `--no-lint` was passed: skip lint, show warning:
```
Warning: lint skipped via --no-lint. Unverified changes in commit.
```

### On PASS

```
Lint: PASS
```

Proceed to commit.

### On FAIL

Show first 15 error lines. Fix inline — do not ask the user what to do:

```
Lint errors after execution:

  packages/core/src/utils.ts:42:3  error  Missing return type  @typescript-eslint/explicit-function-return-type

Fixing...
```

Apply fix. Re-run lint.

If lint fails a second time: stop. Do not commit. Surface the error:
```
Lint failed after two attempts. Changes are on disk but not committed.
Fix manually and commit:
  git add <files>
  git commit -m "..."
```

---

## Step 5: Commit

```bash
git add [exactly the files that were changed — list them explicitly]
git commit -m "[type]([scope]): [task description, condensed to one line]"
```

### Commit message derivation

Derive from the task description:
- `add` / `create` / `implement` → `feat`
- `fix` / `repair` / `correct` → `fix`
- `rename` / `move` / `restructure` → `refactor`
- `document` / `comment` / `jsdoc` → `docs`
- `test` / `spec` → `test`
- `update config` / `bump` → `chore`

Scope: the primary package affected (`core`, `cli`, `skills-harness`, `skills-workflow`).

Example: `feat(core): add isDev() helper to utils`

If `--no-commit`: show what would have been committed, skip commit.

---

## Step 6: Report

```
Done.
  Task:     {TASK_DESCRIPTION}
  Files:    {list of changed files, one per line}
  Lint:     PASS
  Commit:   {short_hash} — {commit_message}
```

If there are related follow-up tasks, suggest them:
```
Note: isDev() is not tested yet.
  Next: /sunco:fast "add vitest tests for isDev() in packages/core/src/__tests__/utils.test.ts"
```

---

## What Fast Is Not

Fast is not a shortcut past quality. The lint-gate and atomic commit are non-negotiable. The word "fast" refers to the planning overhead being zero — not to quality being lower. Every fast commit must be production-ready.
