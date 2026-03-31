---
name: sunco:debug
description: Systematic debugging with persistent state across context resets. Use when a bug is hard to isolate or spans multiple files. State persists in .sun/debug/ so you can resume after context window resets.
argument-hint: "[issue description] [--file <path>] [--test <test-name>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - AskUserQuestion
---

<context>
**Arguments:**
- `[issue description]` — Describe the bug. Can be a test name, error message, or behavior description.

**Flags:**
- `--file <path>` — Focus debug on a specific file.
- `--test <test-name>` — Run a specific test and debug failures.
</context>

<objective>
Systematic debugging with state that persists across context resets. Follows hypothesis-driven debugging: observe → hypothesize → test → confirm.

**Creates:**
- `.sun/debug/[timestamp]-debug.md` — debug session state (survives context reset)

**After this command:** Issue is fixed with root cause documented, or debug session is saved for later resume.
</objective>

<process>
## Step 1: Initialize debug session

Create `.sun/debug/` if it doesn't exist.

Check for existing debug sessions:
```bash
ls .sun/debug/ 2>/dev/null
```

If sessions exist: ask "Continue previous debug session? [list sessions]"

Create new session file `.sun/debug/[YYYY-MM-DD-HH-MM]-debug.md`:
```markdown
# Debug Session [timestamp]

## Issue
[description from $ARGUMENTS or user input]

## Status
investigating

## Observations
[]

## Hypotheses
[]

## Tests Run
[]

## Root Cause
TBD

## Fix Applied
TBD
```

## Step 2: Reproduce the issue

Try to reproduce:

If `--test` in $ARGUMENTS:
```bash
npx vitest run [test-name] --reporter=verbose 2>&1
```

If `--file` in $ARGUMENTS:
```bash
npx tsc --noEmit [file] 2>&1
node [file] 2>&1
```

Otherwise: ask user "How do I reproduce this? (command to run, or describe steps)"

Record reproduction steps and output in session file.

## Step 3: Gather context

1. Read error output carefully — look for file paths, line numbers, stack traces.
2. Read the failing file(s).
3. Read recent git changes to those files:
   ```bash
   git log --oneline -10 -- [file]
   git diff HEAD~3 -- [file]
   ```
4. Search for related patterns:
   ```bash
   # Find similar usage patterns
   ```

## Step 4: Hypothesis generation

Generate 3 hypotheses ranked by likelihood. For each:
- What could cause this behavior?
- What evidence supports this hypothesis?
- What evidence would disprove it?

Record in session file.

## Step 5: Test hypotheses

For each hypothesis (highest likelihood first):
1. Design a minimal test to confirm or deny
2. Run the test
3. Record result in session file
4. If disproven: move to next hypothesis

Update session file after each test:
```markdown
## Test [N]
Hypothesis: [...]
Test: [what was run]
Result: [confirmed/disproven]
Evidence: [output]
```

## Step 6: Apply fix

When root cause confirmed:
1. Document root cause in session file
2. Apply minimal fix (change only what's needed)
3. Re-run reproduction test to confirm fix
4. Run full test suite:
   ```bash
   npx vitest run 2>&1 | tail -20
   ```
5. Run lint:
   ```bash
   npx eslint packages/ --max-warnings 0
   ```

## Step 7: Close session

Update session file:
```markdown
## Status
resolved

## Root Cause
[clear explanation]

## Fix Applied
[what was changed and why]

## Prevention
[how to prevent this class of bug in the future]
```

Report: "Bug fixed. Root cause: [summary]. Session saved at .sun/debug/[timestamp]-debug.md"
</process>
