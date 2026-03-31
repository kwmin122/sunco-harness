---
name: sunco:test-gen
description: Generate unit and E2E tests from BDD acceptance criteria in plan files. Run after a phase is complete to fill test coverage gaps.
argument-hint: "[phase] [--unit] [--e2e] [--coverage]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
---

<context>
**Arguments:**
- `[phase]` — Phase number to generate tests for. Default: current phase.

**Flags:**
- `--unit` — Generate unit tests only.
- `--e2e` — Generate E2E tests only.
- `--coverage` — Show coverage gaps without generating tests.
</context>

<objective>
Generate Vitest unit tests and E2E tests from BDD acceptance criteria in PLAN.md files. Tests are written to match the implementation and verify all done_when criteria.

**Creates:**
- `packages/[package]/__tests__/[module].test.ts` — unit tests
- `packages/[package]/__tests__/[module].e2e.test.ts` — E2E tests (if --e2e)
</objective>

<process>
## Step 1: Gather criteria

Read all PLAN.md files for the phase:
- Extract `acceptance_criteria` from each task
- Extract `done_when` from plan level
- Note which files were created/modified

Read the actual implementation files.

If `--coverage` in $ARGUMENTS: analyze coverage gaps and report without generating.

## Step 2: Check existing tests

```bash
find packages/ -name "*.test.ts" | head -30
```

Identify which modules already have tests vs which are missing coverage.

## Step 3: Generate unit tests

For each module/file that needs tests:

**Agent prompt:**
"Generate Vitest unit tests for [file].

Implementation to test:
[file contents]

Acceptance criteria to verify:
[criteria from PLAN.md]

Requirements:
1. Use Vitest (import from 'vitest')
2. Use vi.mock() for dependencies with vi.hoisted() pattern
3. Export parser/pure functions for testability
4. Test each exported function
5. Test error paths explicitly
6. Use describe blocks by function name
7. Use it() with descriptive names (should [behavior] when [condition])
8. No filesystem access in unit tests — mock it
9. TypeScript strict — no any types

Pattern from codebase:
[read an existing test file for reference patterns]"

## Step 4: Generate E2E tests (if --e2e)

For CLI commands and integration points:

"Generate E2E tests for [command/feature].

Use Vitest with execa to spawn the actual CLI process.
Test the full flow from CLI invocation to output.

Structure:
- describe('[command]', () => {
  - it('should [behavior] when [input]', async () => {
    - spawn sunco CLI
    - assert output / files created / exit code
  })
})"

## Step 5: Coverage report (if --coverage)

```markdown
# Test Coverage Report — Phase [N]

## Covered
- [file]: [N] tests, covers [criteria]

## Gaps
| File | Function | Missing Coverage | Effort |
|------|----------|-----------------|--------|

## Priority Gaps (most critical untested paths)
1. [...]
```

## Step 6: Write test files

Write each generated test file.

Run tests to verify they pass:
```bash
npx vitest run [test-file] --reporter=verbose
```

If tests fail: fix the tests (not the implementation) to correctly reflect expected behavior.

Report: "Generated [N] test files. [M] tests passing."
</process>
