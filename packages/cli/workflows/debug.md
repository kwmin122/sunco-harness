# Debug Workflow

Systematic hypothesis-driven debugging with persistent session state. Sessions survive context resets. Used by `/sunco:debug`.

---

## Overview

Five steps, each building on the previous:

1. **Reproduce** — establish a reliable reproduction case
2. **Hypothesize** — generate 3 ranked hypotheses
3. **Investigate** — test each hypothesis with targeted checks
4. **Fix** — apply minimal fix and verify
5. **Prevent** — add a regression test for this failure mode

State is persisted to `.sun/debug/[session-id]/` after each step. If context resets mid-session, the next invocation can resume from where it left off.

---

## Session Management

### Check for existing sessions

```bash
ls .sun/debug/ 2>/dev/null
```

If sessions exist, show them:
```
Existing debug sessions:
  2026-03-31-14-22  "TypeError in config parser"  (investigating)
  2026-03-30-09-15  "tsc error on import"          (resolved)

Continue a session? [1/2/new]
```

### New session

Create `.sun/debug/[YYYY-MM-DD-HH-MM]/`:
- `session.md` — full session state
- `repro.sh` (optional) — minimal reproduction script
- `hypothesis-log.md` — running hypothesis test log

### Session file structure

```markdown
# Debug Session [ID]

## Issue
[description]

## Status
[new | reproducing | hypothesizing | investigating | fixing | resolved]

## Error Output
[exact error message and stack trace]

## Reproduction Steps
[commands or actions to trigger the bug]

## Environment
- Node.js: [version]
- OS: [platform]
- Recent changes: [git log summary]

## Hypotheses
[list — ranked by likelihood]

## Tests Run
[each test with result]

## Root Cause
[TBD until resolved]

## Fix Applied
[TBD until resolved]

## Prevention
[TBD until resolved]
```

---

## Step 1: Reproduce

Establish a reliable, minimal reproduction case.

### If `--test` flag

```bash
npx vitest run [test-name] --reporter=verbose 2>&1
```

Capture:
- Full output including stack trace
- Whether the test fails consistently or flakily
- Which assertion fails

### If `--file` flag

```bash
npx tsc --noEmit [file] 2>&1
node [file] 2>&1
```

### If neither flag

Ask: "How do I reproduce this? Provide the command to run, or describe the steps."

### Reproduction goal

The reproduction case must be:
- **Reliable** — fails every time (or documents if intermittent)
- **Minimal** — smallest input that triggers the bug
- **Isolated** — does not require the full system to be running

Record exact output. Note file paths and line numbers from stack traces.

### Environment context

```bash
node --version
npm list --depth=0 2>/dev/null | head -20
git log --oneline -5
git status
```

---

## Step 2: Hypothesize

Generate 3 hypotheses ranked by likelihood. Ranking criteria:
- **Recent changes** — something changed recently is most likely the cause
- **Complexity** — more complex = more likely to have edge cases
- **External deps** — third-party changes can cause unexpected failures
- **State** — stateful operations are harder to get right

### Hypothesis format

```
Hypothesis [N]: [descriptive title]
  Likelihood: high | medium | low
  Reasoning:  [why this is plausible given the evidence]
  Test:        [specific check that would confirm or deny this]
  Disproof:   [what would definitively rule this out]
```

### Common hypothesis categories

**Type/contract violations**
- Wrong type passed to function
- Optional field expected but undefined passed
- Import resolves to wrong module

**State/lifecycle issues**
- Object not initialized before use
- Async operation not awaited
- Resource closed before use completes

**Edge case gaps**
- Empty array/string not handled
- Null vs undefined distinction missed
- Unicode or special characters in path

**Dependency changes**
- Breaking change in a dependency
- Version mismatch between declaration and installed
- Missing peer dependency

**Configuration drift**
- Config file not found, falling back to wrong default
- Environment variable not set in test context
- tsconfig not aligned with runtime target

**Concurrency**
- Race condition between two async operations
- Shared state mutated by parallel agents
- File locked by another process

---

## Step 3: Investigate

Test each hypothesis in order of likelihood. Stop when one is confirmed.

### For each hypothesis

1. Design the minimal targeted check (not a full rerun)
2. Run the check
3. Interpret the result: confirmed / disproven / inconclusive
4. Update session file

### Investigation tools

**Git history for a file:**
```bash
git log --oneline -10 -- [file]
git diff HEAD~3 -- [file]
```

**Find callers of a function:**
```bash
grep -rn "functionName" packages/ --include="*.ts"
```

**Check import resolution:**
```bash
npx tsc --traceResolution 2>&1 | grep [module-name]
```

**Run single test verbosely:**
```bash
npx vitest run [test-file] --reporter=verbose 2>&1
```

**Check type of a value at runtime:**
```bash
# Add temporary console.log or use node --inspect
```

**Check dependency version:**
```bash
npm list [package-name]
cat node_modules/[package]/package.json | grep '"version"'
```

### Recording test results

After each check, append to session file:

```markdown
## Investigation Test [N]
Hypothesis tested: [N]
Check run: [exact command or action]
Result: confirmed / disproven / inconclusive
Evidence: [key output lines]
Next: [what to test now]
```

### If all 3 hypotheses are disproven

Generate a second round of hypotheses. Look at the problem from a different angle:
- Could it be a build artifact issue? (try `rm -rf dist/ && rebuild`)
- Could it be a cache issue? (try `npm ci`)
- Could it be environment-specific? (check Node.js version mismatch)

---

## Step 4: Fix

Once root cause is confirmed:

### Minimal fix principle

Change only the minimum necessary. Resist the temptation to refactor while fixing.

- If the fix is one line: change only that line
- If the fix requires a new function: add only that function
- If the fix requires a structural change: note it and apply only what's needed for the fix

### Fix verification

1. Apply the fix
2. Re-run the reproduction case — it must no longer trigger
3. Run the full test suite:
```bash
npx vitest run 2>&1 | tail -20
```
4. Run lint:
```bash
npx eslint packages/ --max-warnings 0
npx tsc --noEmit
```

If any tests break due to the fix, address them before marking resolved.

---

## Step 5: Prevent

Add a test that specifically covers the failure mode. This is non-optional.

### Test requirements

- Must fail before the fix is applied (verify this by reverting and running)
- Must pass after the fix
- Must be narrow: tests the specific input/state that caused the failure, not the general feature

### Test naming convention

```typescript
it('does not crash when [specific condition that caused the bug]', () => {
  // Arrange: setup the exact conditions that triggered the bug
  // Act: call the function with the problematic input
  // Assert: expected behavior (not the bug behavior)
})
```

Place the test in the existing test file for the affected module, or create `__tests__/[module].regression.test.ts`.

### Commit the fix

```bash
git add [changed files] [new test file]
git commit -m "fix([scope]): [description of bug]\n\nRoot cause: [1 sentence]\nPrevents: [what this test catches"
```

---

## Step 6: Close Session

Update session file:

```markdown
## Status
resolved

## Root Cause
[Clear, precise explanation — 2-4 sentences]

## Fix Applied
[What was changed, which files, key diff summary]

## Prevention
[Test added: path/to/test.ts — tests for: [description]]
```

### Report

```
Bug fixed.
  Root cause: [1-sentence summary]
  Fix: [files changed]
  Test added: [path]
  Session saved: .sun/debug/[session-id]/session.md
```

---

## Resume After Context Reset

If debug session is interrupted:

1. Run `/sunco:debug` with no arguments
2. Choose "continue session" from the list
3. Read the session file to restore context
4. Continue from the last recorded step

Session files are designed to be complete context documents — a fresh agent reading the session file can understand the full debugging history without needing the original conversation.
