# TDD Guide for AI-Assisted Development

Test-Driven Development adapted for agent-executed code. Red-green-refactor with agents. Applied by `/sunco:test-gen`, `/sunco:plan`, and any skill phase tagged `type: tdd`.

---

## Overview

TDD is about design quality, not coverage metrics. The red-green-refactor cycle forces you to think about behavior before implementation, producing cleaner interfaces and more testable code.

**Principle:** If you can describe the behavior as `expect(fn(input)).toBe(output)` before writing `fn`, TDD improves the result.

**Key insight for agent-assisted development:** TDD phases require 2-3 execution cycles (RED → GREEN → REFACTOR), each with file reads, test runs, and potential debugging. Agent context windows can fill before refactor. Plan TDD phases with explicit handoffs between cycles.

---

## When TDD Helps vs. Hurts

### TDD candidates — create a `type: tdd` plan

- Business logic with defined inputs and outputs
- Parser functions (TOML, CLI args, phase numbers)
- Data transformations and normalizations
- Validation rules and schema checks
- State machine transitions
- Utility functions with clear specifications
- API endpoints with request/response contracts
- Config resolution logic (hierarchy merging, defaults)

### Skip TDD — use standard plan, add tests after if needed

- UI components and styling
- Configuration file changes
- Glue code connecting two existing components
- One-off migrations and scripts
- Simple pass-through adapters
- Exploratory prototyping where requirements are unclear

**Heuristic:**
- Can you write `expect(fn(input)).toBe(output)` now? → TDD plan
- Would writing the test first feel like guessing? → Standard plan, test after

---

## Red-Green-Refactor with Agents

### RED phase — Write failing test

The agent writes the test file before any implementation exists.

**Agent instructions for RED:**
```
Write a failing test for [feature].
The test file goes at [path].
Do NOT create any implementation file yet.
The test MUST fail when run — confirm this by running `npm test`.
If the test passes, it means either the feature already exists or the test is wrong. Investigate.
Commit: test(phase-plan): add failing test for [feature name]
```

**RED phase complete when:**
- Test file exists with meaningful test cases
- `npm test` run confirms: test fails (not errors, not skips — fails)
- Commit is present: `test(N-M): add failing test for X`

**Common RED mistakes:**
- Test passes because the code already existed → wrong starting point, investigate
- Test errors instead of failing → implementation file missing but test can't find type → acceptable, confirm with type stub
- Test is too broad → narrowing is fine, focus each test on one behavior

---

### GREEN phase — Make the test pass

The agent writes the minimal implementation to pass the failing test. No extra features.

**Agent instructions for GREEN:**
```
Write the minimal implementation to make the failing test pass.
Do not add features not covered by the test.
Run `npm test` and confirm ALL tests pass including pre-existing ones.
Fix any regressions before committing.
Commit: feat(phase-plan): implement [feature name]
```

**GREEN phase complete when:**
- Implementation file exists at expected path
- `npm test` run shows: test passes, no regressions
- Commit is present: `feat(N-M): implement X`

**Common GREEN mistakes:**
- Implementing more than needed (gold-plating) → the test passes but excess code adds risk
- Breaking existing tests → regression, must fix before committing GREEN
- TypeScript errors elsewhere due to interface changes → fix all tsc errors before GREEN commit

---

### REFACTOR phase — Clean up without changing behavior

The agent improves the implementation without changing what it does. All tests must still pass after every refactor step.

**Agent instructions for REFACTOR:**
```
Refactor the implementation for clarity and correctness.
Rules:
1. Do not change observable behavior
2. Run `npm test` after every significant change — tests must stay green
3. If tests break during refactor, revert that change
4. Commit when done: refactor(phase-plan): clean up [feature name]
```

**When refactor is optional:**
- Simple utility function → GREEN commit is the final commit, no refactor needed
- Small implementation (< 30 lines) → if GREEN is clean, skip REFACTOR
- Under time pressure → note "refactor deferred" in SUMMARY.md

**REFACTOR phase complete when:**
- All tests still pass
- Code is readable (names are clear, logic is linear)
- No dead code
- Commit is present: `refactor(N-M): clean up X`

---

## TDD Plan Format

```markdown
---
phase: 03-skill-registry
plan: 02
type: tdd
---

<objective>
Implement SkillRegistry with register(), get(), and list() methods.
Purpose: TDD produces a clean public API that's easy to mock in dependent tests.
Output: Working, tested SkillRegistry class with 3 commits (RED, GREEN, REFACTOR).
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@packages/core/src/types/skill-types.ts
</context>

<feature>
  <name>SkillRegistry</name>
  <files>
    source: packages/core/src/registry/skill-registry.ts
    test: packages/core/src/__tests__/skill-registry.test.ts
  </files>
  <behavior>
    register(skill) stores the skill by id
    get(id) returns the registered skill or undefined
    list() returns all registered skills
    register() with duplicate id throws SkillConflictError
    get() with unknown id returns undefined (not throws)
    list() on empty registry returns []
  </behavior>
  <implementation>
    Class with a Map<string, Skill> internal store.
    register() validates id is non-empty before storing.
    All methods are synchronous.
  </implementation>
</feature>

<verification>
npm test -- --run packages/core/src/__tests__/skill-registry.test.ts
</verification>

<success_criteria>
- Failing test written and committed (RED)
- Implementation passes test, no regressions (GREEN)
- Refactor complete with clean code (REFACTOR)
- All 3 commits present in git log
</success_criteria>
```

---

## Integration with SUNCO Verify Pipeline

TDD plans produce a specific commit signature that `/sunco:verify` recognizes.

### Expected commit pattern for TDD plans

```
test(03-02): add failing test for SkillRegistry      ← RED
feat(03-02): implement SkillRegistry                 ← GREEN
refactor(03-02): clean up SkillRegistry              ← REFACTOR (optional)
```

Layer 3 (BDD criteria) in `/sunco:verify` checks that TDD plans have at least RED and GREEN commits. Missing GREEN after RED is a failed verification.

### TDD coverage expectations

Plans tagged `type: tdd` are held to higher coverage standards by `/sunco:validate`:

| Metric | Standard plan | TDD plan |
|--------|---------------|----------|
| Line coverage | 60% | 85% |
| Branch coverage | 50% | 75% |
| Function coverage | 70% | 90% |

This is intentional — TDD plans write tests first, so coverage should be high by construction.

---

## Test-First Patterns by Feature Type

### Parser functions

```typescript
// Write test first:
it('parses phase number from "03-skill-registry"', () => {
  expect(parsePhaseNumber('03-skill-registry')).toBe(3)
})
it('parses decimal phase from "03.1-hotfix"', () => {
  expect(parsePhaseNumber('03.1-hotfix')).toBe(3.1)
})
it('returns null for non-phase strings', () => {
  expect(parsePhaseNumber('not-a-phase')).toBeNull()
})
```

### State machines

```typescript
// Write test first, enumerate all valid transitions:
it('transitions from idle to running on execute()', () => {
  const sm = new ExecutionStateMachine()
  sm.execute()
  expect(sm.state).toBe('running')
})
it('throws on execute() when already running', () => {
  const sm = new ExecutionStateMachine()
  sm.execute()
  expect(() => sm.execute()).toThrow(InvalidStateError)
})
```

### Config validation

```typescript
// Write test first, cover valid, invalid, and edge cases:
it('accepts valid config with all required fields', () => {
  expect(() => parseConfig({ mode: 'yolo', granularity: 'plan' })).not.toThrow()
})
it('throws ConfigError on unknown mode value', () => {
  expect(() => parseConfig({ mode: 'invalid' })).toThrow(ConfigError)
})
it('uses defaults for missing optional fields', () => {
  const config = parseConfig({ mode: 'yolo' })
  expect(config.granularity).toBe('plan')  // default value
})
```

---

## Anti-Patterns

### Writing tests after implementation

This defeats the purpose of TDD. Tests written after implementation tend to:
- Test what the code does rather than what it should do
- Achieve high coverage but low confidence
- Miss the cases that weren't implemented (because there are no tests asking for them)

If you are not in a TDD plan, tests after implementation are fine. But do not label a plan `type: tdd` and then write tests after.

### Tests that never fail

A test that cannot fail is not a test — it's a comment. Before GREEN, confirm the RED test actually fails:

```bash
npm test -- --run skill-registry.test.ts
# Expected output: FAIL (1 failing test)
# If output is: PASS — something is wrong
```

### Testing implementation details

```typescript
// Bad: testing internal state
expect(registry._map.size).toBe(1)

// Good: testing observable behavior
expect(registry.get('skill-id')).toBeDefined()
```

TDD tests should be black-box tests of the public API. If you need to test internal state to confirm behavior, the API is missing an observable method.

### Over-mocking

Mocking the unit under test defeats testing. Mock dependencies, not the feature you're testing:

```typescript
// Bad: mocking SkillRegistry in a SkillRegistry test
vi.mock('./skill-registry')

// Good: mocking SkillRegistry's dependencies
vi.mock('./skill-store')  // SkillRegistry depends on SkillStore
```
