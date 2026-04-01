---
name: sunco:quick
description: Execute an ad-hoc task with SUNCO guarantees (atomic commits, lint-gate, state tracking) but skip optional planning overhead. Flags are composable for the right level of rigor.
argument-hint: "<task description> [--discuss] [--research] [--full] [--no-commit]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<task description>` — What to do. Required.

**Flags (composable):**
- `--discuss` — Lightweight discussion first. Ask 2-3 key questions before executing.
- `--research` — Investigate approaches before planning. Spawns one research agent.
- `--full` — Full plan-checking + verification. Same rigor as the main workflow but for a single task.
- `--no-commit` — Execute and lint-gate but skip the git commit step.

**Default (no flags):** Execute directly with lint-gate and atomic commit.

**Flag combinations:**
- `--discuss --research` — Clarify intent, then research best approach, then execute.
- `--research --full` — Research first, create a mini-plan, execute with subagent, verify.
- `--discuss --full` — Full context gathering + plan + verification for non-trivial tasks.
</context>

<objective>
Execute a single task with the right level of rigor. Guarantees: atomic git commit, lint-gate before commit, state tracking in STATE.md. Skip the full discuss→plan→execute pipeline for small tasks.

**After this command:** Task complete with clean commit, or a clear error with actionable message.
</objective>

<process>
## Step 1: Parse intent

Parse `$ARGUMENTS`:
- Extract all `--flag` tokens and remove them from the text
- Remaining text = task description

If task description is empty after flag extraction:
- Ask: "What do you want to do?"

### Confidence assessment

Before proceeding, assess confidence in the task:

**High confidence** (proceed directly):
- "add export for `parseConfig` to `packages/core/src/config.ts`"
- "fix TypeScript error in `packages/cli/src/index.ts` on line 42"
- "rename `healthCheck` to `runHealthCheck` in `packages/core/src/health.ts`"
- Task has an explicit file path, function name, or line number

**Medium confidence** (suggest `--discuss` if not already set):
- "add pagination to the list command" — how? which storage? what page size?
- "improve error messages" — which commands? what format?
- Task implies multiple approaches are possible

**Low confidence** (suggest `--research` or `--discuss` if not already set):
- "switch from X to Y" — are they compatible? migration steps?
- "add caching" — which layer? in-memory or persistent? TTL?
- Task involves technology choices or unfamiliar territory

If confidence is low and neither `--discuss` nor `--research` is set, ask:
```
This task has multiple viable approaches. Should I:
  A) Research the best approach first (--research)
  B) Ask you 2-3 clarifying questions (--discuss)
  C) Proceed with my best judgment
```

---

## Step 2A: Discuss (if --discuss or --full)

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

After answers, summarize intent in one sentence before proceeding:
```
Got it. I'll [summarized intent in one sentence].
```

---

## Step 2B: Research (if --research or --full)

One research agent. Fast research, not comprehensive.

**Agent name:** `sunco-quick-research` — description: `Quick research: [task]`

**Research agent prompt:**
```
Quick research for: [task description]

Context: [answers from discuss if applicable]
Stack: TypeScript, Node.js 24, [relevant packages from CLAUDE.md]

Answer only:
1. Best practice or standard approach for this in our stack
2. Any known gotchas or pitfalls
3. Relevant existing patterns in this codebase (scan packages/)

Keep response under 200 words. Be specific. No preamble.
```

Collect results. If agent fails, proceed without research — log warning:
```
Warning: Research agent failed. Proceeding with best judgment.
```

---

## Step 3: Apply --full (if flag present)

Create a mini-plan in `.planning/quick/`:

```bash
mkdir -p .planning/quick
```

Write `.planning/quick/QUICK-[slug].md`:
```markdown
# Quick Task: [task description]

**Created**: [timestamp]
**Flags**: [flags used]

## Tasks
[2-5 concrete tasks]

## Acceptance Criteria
- [criterion 1]
- [criterion 2]

## Done When
- [done condition]
```

Run plan verification: scan acceptance criteria against the task scope (quick check, not the full plan-checker loop).

If `--full` but task has only one obvious step: skip mini-plan creation and execute inline.

---

## Step 4: Execute

### If --full: spawn a subagent with the mini plan

```
Agent name: sunco-quick-executor
Description: Execute: [task]

Execute the plan at .planning/quick/QUICK-[slug].md.
Follow SUNCO conventions from CLAUDE.md.
Do not refactor unrelated code.
```

### Otherwise: execute inline

Execute the task directly in the current agent context.

### Execution principles

- **Minimal scope**: touch only the files needed for this specific task
- **No refactoring**: if you notice improvements, note them but do not apply them
- **Preserve style**: match existing code style, naming conventions, import patterns
- **No new dependencies**: unless the task specifically requires one (use dynamic imports)
- **ESM imports**: `.js` extensions required even for `.ts` files

### Progress feedback

Show progress as the task runs:
```
  Reading packages/core/src/config.ts...
  Adding parseConfig export...
  Updating packages/core/src/index.ts barrel export...
  Done.
```

---

## Step 5: Lint-gate (MANDATORY)

After execution, run immediately:

```bash
npx eslint packages/ --max-warnings 0
npx tsc --noEmit
```

### On lint-gate PASS

Proceed to commit.

### On lint-gate FAIL (first attempt)

Show errors. Do not commit. Fix inline:

```
Lint errors after execution:

  packages/core/src/config.ts:24:5  error  Missing return type  @typescript-eslint/explicit-function-return-type

Fixing...
```

Apply fix. Re-run lint.

### On lint-gate FAIL (second attempt)

If lint fails again after fix attempt:

```
Lint gate failed after auto-fix attempt.
  Errors: [N]

  [list each error with file:line rule]

Fix these manually before committing:
  npx eslint packages/ --fix
  npx tsc --noEmit
```

Stop here. Do not commit.

---

## Step 6: Atomic commit

After lint-gate passes:

```bash
git add [specific changed files only]
git commit -m "[type]([scope]): [description]"
```

### Commit type inference

Infer from action:
- create / add / implement → `feat`
- fix / repair / resolve → `fix`
- rename / move / restructure → `refactor`
- document / comment / jsdoc → `docs`
- test / spec → `test`
- config / dependency → `chore`

Scope = package name (e.g., `core`, `cli`, `skills-harness`).

Example: `feat(core): add export for parseConfig from config module`

### If --no-commit

Skip commit. Show what would have been committed:
```
Skipping commit (--no-commit).
  Would have committed: [N files]
  Type: [type(scope): description]
  Files: [list]
```

---

## Step 7: Apply --full verification (if flag present)

Run quick verify:
- **Layer 2 (guardrails)**: lint-gate already passed — confirmed
- **Layer 3 (BDD)**: check each acceptance_criteria from mini-plan

For each acceptance criterion:
```
  ✓ [criterion 1] — [how verified]
  ✓ [criterion 2] — [how verified]
  ✗ [criterion 3] — [why not met, what to do]
```

If any criterion fails: note it in the report but do not un-commit.

---

## Step 8: Update STATE.md quick log

Append to `.planning/STATE.md` under `## Quick Tasks` section (create section if absent):

```markdown
## Quick Tasks

- [timestamp] [task description] — commit [sha] ([status])
```

This enables `/sunco:progress` to show quick task history alongside phase work.

---

## Step 9: Report

```
Quick task complete.
  Task:          [description]
  Flags:         [flags used or "none"]
  Files changed: [N]
  Lint gate:     PASS
  Commit:        [hash] — [message]
```

If task created something that warrants follow-up:
```
Note: [observation about what this opens up]
  Suggested next: /sunco:quick "[follow-up task]"
```

If `--full` and any acceptance criteria failed:
```
Note: [N] acceptance criteria not fully verified.
  Review: .planning/quick/QUICK-[slug].md
```

---

## .planning/quick/ Directory

Quick tasks with `--full` flag store a mini-plan in `.planning/quick/`. This directory:
- Is gitignored by default (`.sun/.gitignore`)
- Accumulates quick task records for `/sunco:progress` history
- Can be reviewed with `/sunco:stats`

Directory structure:
```
.planning/quick/
  QUICK-add-parseconfig-export.md      (mini-plan, kept after execution)
  QUICK-fix-lint-error-config.md
```

Mini-plan file format:
```markdown
# Quick Task: [description]

**Created**: [ISO timestamp]
**Completed**: [ISO timestamp or "pending"]
**Flags**: [flags used]
**Commit**: [sha or "uncommitted"]
**Status**: [complete | partial | lint-failed]

## Tasks
1. [task description]
2. [task description]

## Acceptance Criteria
- [criterion]

## Result
[Brief note on what was done]
```

---

## Composable Flag Behaviors

Flags compose predictably:

### `--discuss` only
Sequence: ask 2-4 questions → execute inline → lint-gate → commit

Best for: tasks where implementation approach is unclear but scope is small.

### `--research` only
Sequence: spawn research agent → execute inline → lint-gate → commit

Best for: tasks in unfamiliar tech territory (e.g., "use picomatch for glob matching").

### `--full` only
Sequence: create mini-plan → execute with subagent → lint-gate → verify acceptance criteria → commit

Best for: tasks that touch multiple files or have explicit "done when" conditions.

### `--discuss --research`
Sequence: ask questions → research with context from answers → execute → lint-gate → commit

Best for: tasks that are both scope-unclear and technically unfamiliar.

### `--research --full`
Sequence: research → create informed mini-plan → execute with subagent → lint-gate → full verify → commit

Best for: non-trivial one-off improvements in unfamiliar code areas.

### `--discuss --full`
Sequence: ask questions → create mini-plan with answers → execute with subagent → lint-gate → verify → commit

Best for: short refactors that need explicit acceptance criteria before starting.

---

## When to Use quick vs other commands

| Situation | Use |
|-----------|-----|
| Fix a specific TypeScript error | `/sunco:quick` (no flags) |
| Add a small feature with obvious scope | `/sunco:quick` (no flags) |
| Add a feature with unclear implementation | `/sunco:quick --discuss` |
| Explore a new library or approach | `/sunco:quick --research` |
| A task with explicit "done when" criteria | `/sunco:quick --full` |
| More than ~5 files changed | `/sunco:execute [N]` instead |
| Multiple related tasks in a sequence | `/sunco:execute [N]` instead |
| Pure text — no file changes | `/sunco:fast` instead |
| Not sure what to run | `/sunco:do [description]` |

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Lint gate fails twice | Auto-fix could not resolve errors | Fix manually, then re-run |
| Research agent fails | Network or context issue | Proceed without research (`--research` becomes no-op) |
| Task description empty | No text in `$ARGUMENTS` after flags | Re-run with explicit description |
| No files changed after execution | Task may have already been done | Check git status |
| Commit fails | Git index issue | Stage manually: `git add [files] && git commit` |
| `.planning/quick/` missing | Directory not created yet | Created automatically on first `--full` run |

---

## Execution Principles (Detailed)

### Minimal scope

Before writing any code, identify the minimal set of files to touch:
- Does this change require a new file? If the function can live in an existing file, prefer that.
- Does this change require updating barrel exports (`index.ts`)? Only if the export is needed immediately.
- Does this change need tests? Only if the task description or `--full` acceptance criteria mention tests.

### Preserve conventions

Read at least one existing file in the affected area before writing. Match:
- Import style (`.js` extensions for ESM, relative paths)
- Function signature style (arrow functions vs named functions)
- Error handling pattern (throw vs Result type)
- Naming conventions (camelCase, `is`/`has` prefixes for booleans)

### No side-quest refactoring

If you notice an unrelated improvement while executing: add a note to the report but do not apply it:
```
Note: Noticed inconsistent error handling in config.ts:L45. Did not refactor (out of scope).
  Track with: /sunco:note "refactor error handling in config.ts"
```

### Progress is visible

Show what you're doing as you do it. Never go silent for more than a few seconds. Visibility:
- "Reading [file]..." before reading
- "Writing [file]..." before writing
- "Running tsc..." before type-check
- "Done." when each step completes

---

## Relationship to Other Commands

| Command | Relationship |
|---------|-------------|
| `/sunco:fast` | Subset of quick — no lint-gate, no commit, no flags |
| `/sunco:execute N` | Superset — multi-plan, parallel agents, full VERIFICATION.md |
| `/sunco:do` | Router — routes to quick when task is small and well-scoped |
| `/sunco:plan N` | Used by quick `--full` to write a mini-plan |
| `/sunco:verify N` | Used by quick `--full` to verify acceptance criteria |
| `/sunco:lint` | Used by quick lint-gate step |
| `/sunco:note` | Captures deferred improvements spotted during quick execution |

---

## Guarantees Summary

Every `/sunco:quick` execution (regardless of flags) provides:

1. **Lint gate** — ESLint + tsc before any commit. Architecture violations cannot sneak in.
2. **Atomic commit** — All changes in one commit. No partial state.
3. **Scope control** — Only the files relevant to the task are staged.
4. **State tracking** — Quick log entry in STATE.md for progress history.
5. **Progress feedback** — Real-time visibility into what is happening.

Optional with flags:
6. **Intent clarity** (`--discuss`) — Questions answered before work begins.
7. **Research backing** (`--research`) — Best-practice verification before implementing.
8. **Acceptance verification** (`--full`) — Explicit "done when" criteria checked after execution.

---

## Research Agent Detail

When `--research` is used, the research agent runs in a sandboxed context:

**Agent permissions:**
- Read: `packages/`, `CLAUDE.md`, `.planning/` (for context)
- Write: none (read-only research)
- Network: allowed (for npm registry lookups if needed)
- Bash: allowed for `ls`, `grep`, `cat` (codebase exploration)

**Research agent output format (expected):**
```
1. Recommended approach: [specific approach with rationale]
2. Gotchas: [list of known pitfalls]
3. Existing patterns: [relevant file paths and patterns found]
```

If the research agent output doesn't match this format, extract the most useful content anyway. Never fail the quick task because research output was unstructured.

**Research agent token budget:** ~2000 tokens. If the research problem is complex enough to need more, the task should be promoted to a full `/sunco:execute` with `/sunco:research` first.

---

## Discuss Mode Questions (Detail)

The 2-4 questions in `--discuss` mode are selected based on task content:

**For "add X" tasks:** Focus on location and interface:
- Where should X live? (package, file path)
- What interface should X have?

**For "fix X" tasks:** Focus on root cause and side effects:
- What is the correct behavior?
- Are there other callers affected by this fix?

**For "refactor X" tasks:** Focus on scope and compatibility:
- Is this a breaking change?
- Which files need to be updated in sync?

**For "change X to Y" tasks:** Focus on migration:
- Are there incompatibilities between X and Y?
- Should old usages be migrated now or left for a follow-up?

The third or fourth question is always task-specific, derived by reading the task description carefully.

---

## Integration with STATE.md

The quick log in STATE.md creates a lightweight history that other commands can use:

- `/sunco:progress` includes quick tasks in the activity feed
- `/sunco:session-report` includes quick tasks in the "what was built" section
- `/sunco:stats` counts quick tasks separately from phase plan executions

Quick tasks do NOT advance the current phase. They are orthogonal to the phase workflow.
If a quick task turns out to be larger than expected, promote it:
```
This task has grown beyond quick scope.
Consider: /sunco:phase insert "quick-[task-slug]" → then execute as a proper phase
```

---

## Config Keys

| Key | Default | Effect |
|-----|---------|--------|
| `quick.default_flags` | `""` | Flags always applied to quick tasks (e.g., `"--discuss"`) |
| `quick.lint_on_change` | `true` | Whether to run lint-gate (always true in practice) |
| `quick.track_state` | `true` | Append to STATE.md quick log |
| `quick.research_budget` | `2000` | Max tokens for research agent |
| `quick.discuss_max_questions` | `4` | Cap on discuss questions |

---

## Worked Examples

### Example 1: Fix a TypeScript error (no flags)

```
/sunco:quick "fix TypeScript error in packages/core/src/config.ts line 42"
```

1. Parse intent: fix, `packages/core/src/config.ts`, line 42 — high confidence
2. Read `packages/core/src/config.ts`, inspect line 42
3. Apply fix
4. Run `npx tsc --noEmit` — passes
5. Run `npx eslint packages/ --max-warnings 0` — passes
6. `git add packages/core/src/config.ts`
7. `git commit -m "fix(core): resolve TypeScript error in config.ts line 42"`
8. Report: 1 file, lint PASS, commit [sha]

### Example 2: Add an export (no flags)

```
/sunco:quick "add export for parseConfig function from packages/core/src/config.ts"
```

1. Parse intent: add export, `packages/core/src/config.ts` — high confidence
2. Read `packages/core/src/config.ts` to find parseConfig
3. Read `packages/core/src/index.ts` to check current exports
4. Add `export { parseConfig }` to config.ts exports
5. Update `packages/core/src/index.ts` barrel export
6. Lint-gate passes
7. `git add packages/core/src/config.ts packages/core/src/index.ts`
8. `git commit -m "feat(core): add export for parseConfig from config module"`
9. Note: "No tests for parseConfig yet. `/sunco:quick 'add vitest unit tests for parseConfig'`"

### Example 3: Switch library with research

```
/sunco:quick --research "switch from chalk to picocolors for color output"
```

1. Parse intent: switch chalk → picocolors, medium confidence → research recommended
2. Spawn research agent: "Quick research: switching from chalk to picocolors in TypeScript Node.js"
3. Research output:
   - Recommended: picocolors is ESM-native, ~14x smaller, API-compatible for basic colors
   - Gotchas: no chalk.hex() equivalent in picocolors (only named colors)
   - Existing pattern: chalk used in 4 files in packages/cli/src/
4. Execute: replace chalk imports with picocolors in 4 files
5. Check for chalk.hex() usage — 0 found
6. Lint-gate passes
7. `git commit -m "chore(cli): switch from chalk to picocolors for lighter color output"`

### Example 4: Small refactor with discussion

```
/sunco:quick --discuss "add caching to the config loader"
```

1. Parse intent: add caching to config loader, low confidence → discuss triggered
2. Ask questions:
   - "Which type of cache? A) In-memory Map (default) B) LRU with TTL"
   - "When should cache be invalidated? A) Never during session B) On file change (watch)"
3. User answers: A, A
4. Execute: add `private _cache: Map<string, Config> = new Map()` to ConfigLoader
5. Lint-gate passes
6. `git commit -m "feat(core): add in-memory caching to config loader"`

### Example 5: Mini-plan with --full

```
/sunco:quick --full "add Zod schema validation to the settings loader"
```

1. Parse intent: add Zod validation, medium confidence — `--full` requested
2. Create mini-plan in `.planning/quick/QUICK-add-zod-settings-validation.md`:
   ```
   Tasks:
     1. Define Zod schema for settings shape
     2. Wrap loadSettings() with schema.parse()
     3. Add user-friendly error message on parse failure
   Acceptance Criteria:
     - loadSettings() throws ZodError with readable message on invalid input
     - loadSettings() returns typed object matching schema on valid input
   ```
3. Spawn subagent with mini-plan
4. Lint-gate passes
5. Verification:
   - ✓ ZodError thrown on invalid input (tested with tsc + type inference)
   - ✓ Returns typed Config object on valid input
6. `git commit -m "feat(core): add Zod schema validation to settings loader"`

---

## What Happens When Lint Fails: Step by Step

1. Task executes and modifies 3 files
2. `npx eslint packages/ --max-warnings 0` → 2 errors
3. Display:
   ```
   Lint gate FAILED (2 errors):

     packages/core/src/config.ts:24:5
       error  Missing return type on function  @typescript-eslint/explicit-function-return-type

     packages/core/src/index.ts:8:1
       error  Missing semicolon  prettier/prettier
   ```
4. Auto-fix: `npx eslint packages/ --fix` + manual return type addition
5. Re-run: `npx eslint packages/ --max-warnings 0` → 0 errors
6. Re-run: `npx tsc --noEmit` → 0 errors
7. Proceed to commit

The lint-gate is the final quality gate. If it cannot be fixed after two attempts, the task is surfaced to the user with the exact errors and no commit is made. The working tree changes remain — the user can fix and re-commit manually or re-run `/sunco:quick` with the same task description.

---

## Summary

`/sunco:quick` is the right tool for any clearly scoped task that:
- Can be done in a single focused session
- Does not require planning artifacts (CONTEXT.md, PLAN.md)
- Benefits from lint-gate + atomic commit guarantees

It bridges the gap between "trivially small" (`/sunco:fast`) and "phase-level work" (`/sunco:execute`). The three flags — `--discuss`, `--research`, `--full` — are composable escalation levers that add exactly as much overhead as the task needs, and nothing more.
</process>
