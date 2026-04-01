# Add Tests Workflow

Generate tests for a completed phase. Reads PLAN.md acceptance criteria and the generated source code, produces unit + integration tests, runs them to verify they pass, and commits the test files. For phases that were executed without test generation during execution.

Used by `/sunco:test-gen`.

---

## Core Principle

Tests generated after the fact should be as good as tests written alongside the code. The approach: read the acceptance criteria (what was promised), read the implementation (what was built), generate tests that verify the promise is kept. Tests must pass without modifying source code — if they don't, the implementation has a gap.

Responsibility chain:

```
parse_args → load_phase → read_plans → read_implementation
→ plan_test_strategy → generate_unit_tests
→ generate_integration_tests → run_tests
→ fix_failures → commit_tests → display_summary
```

---

## Step 1: parse_args

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional | `PHASE_ARG` | — (required) |
| `--plan <name>` | `PLAN_FILTER` | unset (all plans) |
| `--unit-only` | `UNIT_ONLY` | false |
| `--integration-only` | `INTEGRATION_ONLY` | false |
| `--no-commit` | `NO_COMMIT` | false |
| `--overwrite` | `OVERWRITE` | false |

Rules:
- `--plan <name>` — only generate tests for a specific plan
- `--unit-only` + `--integration-only` are mutually exclusive
- `--overwrite` — regenerate tests even if test files already exist

---

## Step 2: load_phase

```bash
PHASE_STATE=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" init phase-op "${PHASE_ARG}")
```

Parse: `phase_dir`, `phase_number`, `phase_name`, `plans`.

Check phase readiness:
- No SUMMARY.md files → error: "Phase ${PHASE_NUM} has no completed execution. Run `/sunco:execute ${PHASE_NUM}` first."
- VALIDATION.md already exists and `--overwrite` is false → display:

```
VALIDATION.md already exists for phase {N}.
  {N} tests generated previously.
  Use --overwrite to regenerate, or check /sunco:validate {N}.
```

---

## Step 3: read_plans

Load plans filtered by `PLAN_FILTER` (or all plans):

```bash
for PLAN in "${PLANS[@]}"; do
  node "$(npm root -g)/sunco/bin/sunco-tools.cjs" plan parse "${PLAN}"
done
```

For each plan, extract:
- `acceptance_criteria`: structured list of criteria with their type
- `tasks`: list of tasks that were executed
- `files_created`: from corresponding SUMMARY.md

Load summaries for context on what was actually built:

```bash
for SUMMARY in "${SUMMARIES[@]}"; do
  cat "${SUMMARY}"
done
```

From summaries, extract:
- `files_changed`: exact list of modified/created files
- `implementation_notes`: any deviations from the plan

---

## Step 4: read_implementation

For each file listed in the summaries, read the implementation:

```bash
for FILE in "${FILES_CHANGED[@]}"; do
  [ -f "${FILE}" ] && cat "${FILE}"
done
```

Focus on:
- **Exported functions and their signatures** — these are the unit test entry points
- **Class methods and their contracts** — what they promise to return
- **Error paths** — what errors are thrown or returned
- **Side effects** — file writes, state mutations, network calls

Build an implementation map:

```
{package}/{file}:
  exports: [functionA, functionB, ClassC]
  functionA(args) → ReturnType: {description}
  functionA error paths: [throws ConfigError if X, returns null if Y]
  functionB(args) → ReturnType: {description}
```

---

## Step 5: plan_test_strategy

For each acceptance criterion, plan the test approach:

```
Criterion: "returns an empty array when no plans exist in the phase directory"
Type: unit
Function to test: getPhases(dir: string) → Phase[]
Test strategy:
  - Setup: create a temp directory with no plan files
  - Action: call getPhases(tempDir)
  - Assert: result is an empty array
  - Edge cases: dir doesn't exist, dir has non-plan files

Criterion: "writes STATE.md atomically (no partial writes on crash)"
Type: integration
Strategy:
  - Setup: mock fs.writeFile to throw on first call
  - Action: call saveState(data)
  - Assert: STATE.md either fully updated or unchanged (no partial state)
```

Group by:
- **Unit tests** (>70% of criteria): pure function behavior, isolated, fast
- **Integration tests** (<30% of criteria): file I/O, cross-module, state persistence

---

## Step 6: generate_unit_tests

For each unit test criterion, generate a Vitest test.

**File placement rule:**
- If the source file is `packages/core/src/config.ts`:
  - Prefer in-source colocation: add to `packages/core/src/config.ts` inside `if (import.meta.vitest)` block
  - Alternative: create `packages/core/src/__tests__/config.test.ts`
  - Check which pattern the package already uses; follow the existing convention

**Test structure:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { functionUnderTest } from '../{source-file}.js'

describe('{function or component name}', () => {
  // Happy path tests first
  it('{criterion text as it() description}', () => {
    // Arrange
    const {input} = {setup}

    // Act
    const result = functionUnderTest({input})

    // Assert
    expect(result).{matcher}({expected})
  })

  // Edge cases
  it('returns {fallback} when {edge case}', () => {
    // ...
  })

  // Error paths
  it('throws {ErrorType} when {invalid input}', () => {
    expect(() => functionUnderTest({invalid})).toThrow({ErrorType})
  })
})
```

**Mock strategy:**
- Use `vi.mock()` for external dependencies (file system, network, database)
- Use `vi.hoisted()` for mock variables in factory functions
- Keep mocks minimal: mock only what is needed for the specific test

---

## Step 7: generate_integration_tests

For each integration test criterion, generate a test with real I/O (or near-real):

**File placement:** Always `packages/{package}/src/__tests__/{feature}.integration.test.ts`

**Integration test structure:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('{feature} integration', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-test-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('{criterion text}', async () => {
    // Arrange: real filesystem, real configs
    // Act: call the actual implementation
    // Assert: verify real side effects
  })
})
```

**Integration test rules:**
- Always clean up temp files in `afterAll`
- Never use production directories
- Do not hit real networks — use local mocks or vitest's `server` module
- Mark with `.integration.test.ts` suffix so they can be run separately

---

## Step 8: run_tests

Run generated tests:

```bash
vitest run --reporter=verbose "${GENERATED_TEST_FILES[@]}" 2>&1
```

Capture:
- `PASSING`: count of passing tests
- `FAILING`: count of failing tests
- `FAILING_TESTS`: list of failing test names + errors

---

## Step 9: fix_failures

For each failing test, analyze the failure:

**Case A: Test is wrong (assertion is incorrect):**
The implementation is correct but the test's assertion is wrong. Fix the assertion. Common causes:
- Expected a string but function returns an object with string field
- Off-by-one in counts
- Wrong property name

**Case B: Implementation has a gap (test is correct, code is wrong):**
The acceptance criterion says X should happen, test correctly asserts X, but the implementation doesn't do X. This is a real bug. Do NOT change the test. Fix the implementation.

Display:
```
Failing test: {test name}
Analysis: {Case A | Case B}
Action: {Fixed assertion | Fixed implementation — {what changed}}
```

**Case C: Test is untestable without major refactoring:**
The function is not injectable / has hard dependencies. Do not refactor now. Mark test as `test.todo()` with a comment explaining why. These become tech debt visible in VALIDATION.md.

Re-run tests after fixes. Maximum 2 fix iterations.

If tests still failing after 2 iterations:
```
{N} test(s) still failing after fix attempts.
  {list tests}
These will be written as test.todo() and flagged as gaps in VALIDATION.md.
```

---

## Step 10: commit_tests

Stage generated and fixed test files:

```bash
# Stage all new test files
for f in "${GENERATED_TEST_FILES[@]}"; do
  git add "${f}"
done
# Stage any implementation fixes
for f in "${FIXED_IMPL_FILES[@]}"; do
  git add "${f}"
done
```

Commit:

```bash
git commit -m "test(phase-${PHASE_NUM}): add acceptance criteria tests

Phase ${PHASE_NUM}: ${PHASE_NAME}
  Unit tests: ${UNIT_COUNT}
  Integration tests: ${INTEGRATION_COUNT}
  Passing: ${PASSING_COUNT}/${TOTAL_TESTS}
  Implementation fixes: ${FIX_COUNT}
  Pending (test.todo): ${TODO_COUNT}"
```

---

## Step 11: display_summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ADD TESTS COMPLETE — Phase {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Tests generated   : {total_generated}
   Unit            : {unit_count}
   Integration     : {integration_count}
 Passing           : {passing_count}
 Pending (todo)    : {todo_count}
 Impl fixes        : {fix_count} (see commit)

{if todo_count > 0}
 Pending tests (require attention):
   {list test names marked as todo}
{/if}

 Committed: {commit_sha}

 Next:
   /sunco:validate {PHASE_NUM}    — run full coverage audit
   /sunco:verify {PHASE_NUM}      — run 6-layer verification
```

---

## Coverage Targets

| Test type | Target per acceptance criterion | Tool |
|-----------|--------------------------------|------|
| Unit | 1 happy path + 1 error path | Vitest |
| Integration | 1 real I/O scenario | Vitest |
| Edge cases | Minimum 1 boundary value test | Vitest |

The goal is not 100% line coverage — it is 100% acceptance criteria coverage with at least one passing test per criterion.
