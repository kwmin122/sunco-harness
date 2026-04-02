# Execute Plan Workflow

Execute a single PLAN.md file inline. No subagent spawning. No phase-level aggregation. Reads the plan, runs all tasks, enforces the lint-gate, writes SUMMARY.md, and commits atomically. Designed for precision work on one plan at a time.

Used by `/sunco:execute <phase> --plan <name>` or direct invocation on a plan file.

---

## Core Principle

One plan. One agent. One commit. The executor owns the full context of the plan and executes every task sequentially. If a task fails, it retries in place before escalating. The lint-gate runs at the end — not per task. The commit is atomic: all changes or none.

Responsibility chain:

```
parse_args → load_plan → validate_plan → check_resumability
→ display_plan_header → execute_tasks → lint_gate
→ write_summary → atomic_commit → display_result
```

---

## Step 1: parse_args

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional | `PHASE_ARG` | — (required if no `--file`) |
| `--plan <name>` | `PLAN_NAME` | — (required if no `--file`) |
| `--file <path>` | `PLAN_FILE` | — (overrides PHASE + PLAN) |
| `--no-commit` | `NO_COMMIT` | false |
| `--no-lint` | `NO_LINT` | false (not recommended) |
| `--retry N` | `MAX_RETRY` | `2` |
| `--force` | `FORCE` | false |

Rules:
- Either (`PHASE_ARG` + `PLAN_NAME`) OR `--file <path>` is required
- `--no-lint` disables lint-gate (outputs a loud warning — lint gate is the core SUNCO guarantee)
- `--force` re-executes even if SUMMARY.md already exists (overwrite mode)
- `--retry N` sets max retries per failing task (default 2)

---

## Step 2: load_plan

Resolve the plan file path:

**If `--file` provided:**
```bash
PLAN_FILE="${FILE_ARG}"
[ -f "${PLAN_FILE}" ] || abort "Plan file not found: ${PLAN_FILE}"
```

**If phase + plan name provided:**
```bash
PHASE_STATE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" init phase-op "${PHASE_ARG}")
PHASE_DIR=$(echo "$PHASE_STATE" | node -e "... parse phase_dir")
# Find matching plan
PLAN_FILE=$(ls "${PHASE_DIR}/"*"${PLAN_NAME}"*-PLAN.md 2>/dev/null | head -1)
[ -n "${PLAN_FILE}" ] || abort "No plan matching '${PLAN_NAME}' in phase ${PHASE_ARG}."
```

Read the plan file:
```bash
PLAN_CONTENT=$(cat "${PLAN_FILE}")
```

Derive:
- `PLAN_TITLE` — from `# Plan:` header or filename
- `PLAN_SLUG` — filename without -PLAN.md suffix
- `SUMMARY_FILE` — same path, -SUMMARY.md suffix
- `PHASE_DIR` — parent directory

---

## Step 3: validate_plan

Parse the plan structure. A valid SUNCO plan has:

```markdown
# Plan: {title}

**Wave**: {N}
**Complexity**: {low|medium|high}
**Estimated tasks**: {N}

## Context
...

## Tasks
### Task 1: {title}
...

## Acceptance Criteria
...
```

Validation checks:
- `## Tasks` section exists and has at least one task
- `## Acceptance Criteria` section exists
- Each task has a clear description (not just a bullet with no content)

If validation fails → display the specific issue and abort:
```
Plan validation failed: {PLAN_FILE}
  Issue: Missing "## Acceptance Criteria" section
  Fix: Add acceptance criteria before executing
```

---

## Step 4: check_resumability

Check if SUMMARY.md already exists:

```bash
[ -f "${SUMMARY_FILE}" ] && ALREADY_DONE=true || ALREADY_DONE=false
```

**If `ALREADY_DONE=true` and `FORCE=false`:**

```
Plan already executed: {PLAN_SLUG}
  Summary: {SUMMARY_FILE}
  Written: {timestamp from summary}

Re-execute with --force to overwrite, or check the summary.
```

Exit cleanly.

**If `ALREADY_DONE=true` and `FORCE=true`:**
Display: `Overwrite mode — re-executing plan despite existing summary.`
Continue.

---

## Step 5: display_plan_header

Before executing, show the user what is about to happen:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► EXECUTE PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Plan    : {PLAN_TITLE}
 File    : {PLAN_FILE}
 Tasks   : {task_count}
 Lint    : {enabled|DISABLED (--no-lint)}
 Commit  : {enabled|disabled (--no-commit)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tasks:
  1. {task 1 title}
  2. {task 2 title}
  ...
```

---

## Step 6: execute_tasks

Execute each task sequentially. For each task:

**6a. display task header:**
```
[{N}/{total}] {task title}
```

**6b. execute the task:**
Read the full task description from the plan. Execute it.
This means: write code, create files, modify configuration — whatever the task specifies.

**6c. verify task completion:**
After executing, check the task's own verification signal (if any):
- TypeScript: `tsc --noEmit` for the affected files
- Tests: run only tests related to this task (`vitest run --reporter=verbose <pattern>`)
- File creation: verify the files exist and are non-empty

**6d. retry on failure:**
If verification fails and `TASK_RETRY < MAX_RETRY`:
Increment retry counter. Display:
```
Task {N} failed — retrying ({TASK_RETRY}/{MAX_RETRY})...
```
Re-attempt the task with additional context from the failure output.

If `TASK_RETRY >= MAX_RETRY`:
```
Task {N} failed after {MAX_RETRY} retries.
  Last error: {error summary}
  Manual intervention may be required.

Continue to next task? [y/N]
```
If user says no → abort and do not write summary or commit.
If user says yes → mark task as `partial` and continue.

**6e. record task result:**
For each task, track:
- `status`: `done` | `partial` | `skipped`
- `files_changed`: list of modified files
- `notes`: any important observations

---

## Step 7: lint_gate

After all tasks complete, run the mandatory lint-gate.

If `NO_LINT=true`:
```
WARNING: Lint gate is disabled (--no-lint).
SUNCO guarantee does not apply to this execution.
The lint gate exists to catch architecture violations before they propagate.
```
Skip to step 8.

Otherwise:
```
[lint] Running lint-gate...
```

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" lint check --files "${FILES_CHANGED}"
```

Where `FILES_CHANGED` is the union of all files modified across all tasks.

**If lint passes:**
```
[lint] Passed — {file_count} files, {error_count} errors, {warn_count} warnings
```

**If lint fails with errors:**
Display each error with file + line + rule name.

Attempt auto-fix:
```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" lint fix --files "${FILES_CHANGED}"
```

Re-run lint. If errors remain → abort:
```
Lint gate failed after auto-fix attempt.
  Errors: {error_count}
  {list errors}

Fix these before committing. The SUNCO guarantee requires a clean lint gate.
```

Do not write SUMMARY.md. Do not commit. Exit with failure.

---

## Step 8: write_summary

Write SUMMARY.md alongside the plan file:

```bash
cat > "${SUMMARY_FILE}" << 'EOF'
# Summary: {PLAN_TITLE}

**Executed**: {date}
**Status**: {complete | partial}
**Tasks**: {done_count}/{total_count} completed
**Lint gate**: {passed | failed — should never appear if writing summary}

## Tasks Completed

{for each task with status "done"}
### {N}. {task title}
Status: done
Files changed:
  - {file 1}
  - {file 2}
Notes: {any relevant observations}

{for each task with status "partial"}
### {N}. {task title} (PARTIAL)
Status: partial
Reason: {failure reason}
Completed steps: {what was done}
Remaining: {what was not done}

## Files Changed

{complete list of all files modified, created, or deleted}

## Acceptance Criteria

{paste acceptance criteria from plan}
{for each criterion, mark: PASSED | PARTIAL | NOT VERIFIED}

## Notes

{any implementation decisions made, deviations from the plan, or observations}
EOF
```

---

## Step 9: atomic_commit

If `NO_COMMIT=true` → skip this step. Display: `Commit skipped (--no-commit). Stage and commit manually when ready.`

Otherwise, stage exactly the files that changed:

```bash
# Stage changed source files
for f in ${FILES_CHANGED}; do
  git add "${f}"
done
# Stage the summary
git add "${SUMMARY_FILE}"
```

Commit:

```bash
git commit -m "feat(phase-${PHASE_NUM}): ${PLAN_TITLE}

Plan: ${PLAN_SLUG}
Tasks: ${DONE_COUNT}/${TOTAL_COUNT} complete
Lint gate: passed

Files: ${file_count} changed"
```

Capture the commit SHA for the summary display.

---

## Step 10: display_result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PLAN COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Plan    : {PLAN_TITLE}
 Tasks   : {done_count}/{total_count} complete
 Files   : {file_count} changed
 Lint    : passed
 Commit  : {commit_sha}

{if partial tasks}
 PARTIAL TASKS — require follow-up:
 {list partial task titles}
{/if}

 Next:
   /sunco:execute {PHASE_NUM}         — run remaining plans in phase
   /sunco:verify {PHASE_NUM}          — verify phase completion
```

---

## TDD Flow Per Task (when tests exist)

For phases that include tests in their acceptance criteria, execute-plan follows a TDD loop per task:

```
For each task:
  1. Read task description
  2. If task mentions "test" or acceptance criteria reference tests:
     a. Write failing test first
     b. Verify test fails (red)
     c. Implement the feature
     d. Run test (expect green)
     e. Refactor if needed
  3. Otherwise: implement directly, verify with tsc --noEmit
```

**Test execution command** (per-task, not the full suite):

```bash
npx vitest run --reporter=verbose --testNamePattern="${TASK_KEYWORD}"
```

Where `TASK_KEYWORD` is derived from the task title (lowercase, dashes instead of spaces).

If no matching test pattern is found: skip the per-task test run and rely on the lint-gate at Step 7.

---

## Checkpoint Per Task

After each completed task, write a lightweight checkpoint to avoid losing work:

```bash
cat >> "${SUMMARY_FILE}.partial" << EOF
## Task ${N}: ${TASK_TITLE} — ${STATUS}
Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Files: ${FILES_CHANGED_THIS_TASK}
EOF
```

The `.partial` file is removed when the full SUMMARY.md is written (Step 8).

If the plan execution is interrupted (crash, context limit):
- The `.partial` file preserves completed task records
- On resume (`--force` re-execution), read `.partial` first and skip already-done tasks
- Display: `Resuming from task [N] — [N] tasks already completed.`

---

## Lint-Gate Fix Loop

The lint-gate in Step 7 follows a structured fix loop before aborting:

```
Round 1: Run lint
  → If PASS: proceed to Step 8
  → If FAIL: run eslint --fix on changed files

Round 2: Run lint
  → If PASS: proceed to Step 8
  → If FAIL: attempt targeted tsc error resolution

Round 3: Run lint
  → If PASS: proceed to Step 8
  → If FAIL: abort with error report
```

The fix loop is deliberate — auto-fix often resolves formatting and simple type issues in Round 1. Round 2 catches remaining structural issues. Round 3 failure means manual intervention is required.

---

## SUMMARY.md Evidence Collection

The SUMMARY.md written in Step 8 is the primary evidence consumed by `/sunco:verify`. To ensure verification has enough information:

**Required evidence per task:**
- Files changed (exact list)
- Whether the task matches its acceptance criterion

**Optional but valuable:**
- Key implementation decisions made during execution
- Deviations from the plan (and why)
- Edge cases encountered
- Test coverage note (if tests were written)

SUMMARY.md format extension for evidence:

```markdown
## Evidence

### Files Changed
[Complete list of modified/created/deleted files]

### Acceptance Criteria Status
[For each criterion from the plan: PASSED | PARTIAL | NOT VERIFIED — with brief note]

### Implementation Notes
[Key decisions, deviations, or observations during execution]
```

This section feeds directly into `/sunco:verify` Layer 3 (BDD) and Layer 1 (multi-agent review).

---

## Commit Message Generation

The commit in Step 9 uses a structured format derived from the plan content:

```bash
git commit -m "[type](phase-[N]): [plan_title]

Plan: [PLAN_SLUG]
Tasks: [DONE_COUNT]/[TOTAL_COUNT] complete
Lint gate: passed

[top 3 changed files, one per line]"
```

**Type inference from plan title:**
- Contains "add", "create", "implement", "introduce" → `feat`
- Contains "fix", "repair", "resolve", "correct" → `fix`
- Contains "refactor", "reorganize", "move", "rename" → `refactor`
- Contains "test", "spec", "coverage" → `test`
- Contains "docs", "document", "comment" → `docs`
- Contains "config", "setup", "scaffold", "init" → `chore`
- Default → `feat`

**Scope:** Phase number is always included (e.g., `phase-03`).

---

## Differences from execute-phase

| Aspect | execute-plan | execute-phase |
|--------|-------------|--------------|
| Scope | One plan | All plans in a phase |
| Agents | Inline (no subagents) | One subagent per plan |
| Parallelism | None (sequential tasks) | Wave-based parallel |
| Verification | Lint-gate only | Full VERIFICATION.md |
| Transition | Never | Auto-advances to next phase |
| TDD flow | Per-task when tests specified | Phase-level test suite |
| Checkpoint | Per-task `.partial` file | Per-plan SUMMARY.md |
| Commit | One commit per plan | One commit per plan (inside subagent) |
| Use case | Precision work, debugging, re-execution | Normal phase execution |
