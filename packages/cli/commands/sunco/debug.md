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

## Failure Type
TBD (Type 1: Context Gap / Type 2: Direction Error / Type 3: Structural Conflict)

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

## Step 3: Classify Failure Type

Before generating hypotheses, classify the failure into one of three types based on the reproduction output and error details:

**Type 1: Context Gap** — Agent/code is missing information
- Symptoms: `undefined variable`, wrong file path, missing import, API contract mismatch, "is not a function", "Cannot read properties of undefined"
- Fix approach: Add the missing context (file, docs, types, API contract)
- Example: "The function expects a User object but receives a raw JSON"

**Type 2: Direction Error** — Requirements misunderstood
- Symptoms: Feature works but does the wrong thing, UI looks different from spec, output format is wrong, behavior diverges from acceptance criteria
- Fix approach: Redefine requirements more clearly, provide concrete examples and expected vs actual
- Example: "Search returns alphabetical results but user expects relevance order"

**Type 3: Structural Conflict** — Code architecture causes the bug
- Symptoms: Fix A breaks B, circular dependencies, state corruption, same symbol means different things in different contexts
- Fix approach: Isolate the problem, establish "Must NOT Have" boundaries, restructure the affected component
- Example: "`includeToday=true` means different things in different functions"

**30-minute rule**: If no progress after 30 minutes on a single approach, reclassify and try a different type's fix approach. Record the reclassification in the session file.

After classifying, record in session file and report:
```
Failure classified as **Type [N]: [Name]**. Applying [fix approach].
```

## Step 4: Gather context

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

## Step 5: Hypothesis generation

Generate 3 hypotheses ranked by likelihood. For each:
- What could cause this behavior?
- What evidence supports this hypothesis?
- What evidence would disprove it?

Record in session file.

## Step 6: Test hypotheses

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

## Step 7: Apply fix

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

## Step 8: Close session

Update session file:
```markdown
## Status
resolved

## Failure Type
[Type N: Name — confirmed classification]

## Root Cause
[clear explanation]

## Fix Applied
[what was changed and why]

## Prevention
[how to prevent this class of bug in the future]
```

Report: "Bug fixed. Root cause: [summary]. Session saved at .sun/debug/[timestamp]-debug.md"
</process>
