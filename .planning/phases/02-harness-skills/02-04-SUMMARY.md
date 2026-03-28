---
phase: 02-harness-skills
plan: 04
subsystem: harness
tags: [eslint, lint-formatter, lint-fixer, agent-readable-errors, fix-instruction, chalk, defineSkill]

# Dependency graph
requires:
  - phase: 02-harness-skills
    plan: 02
    provides: "Init detection modules, workspace initializer, sunco init skill"
  - phase: 02-harness-skills
    plan: 03
    provides: "Lint types, rule-store, config-generator, runner (ESLint programmatic API)"
provides:
  - "formatViolations: ESLint messages -> SunLintViolation[] with agent-readable fix_instruction"
  - "formatForTerminal: colored file:line:col output with dimmed fix instructions"
  - "formatForJson: JSON array output for agent consumption (--json)"
  - "runLintWithFix: --fix auto-correction coordination via ESLint fix mode"
  - "sunco lint skill: complete lint command reading init state, generating config, running ESLint"
affects: [02-harness-skills/05, 02-harness-skills/06, 02-harness-skills/07, 02-harness-skills/08]

# Tech tracking
tech-stack:
  added: [chalk@5]
  patterns: [layer-aware-fix-instruction-generation, eslint-message-enrichment, skill-state-integration]

key-files:
  created:
    - packages/skills-harness/src/lint/formatter.ts
    - packages/skills-harness/src/lint/fixer.ts
    - packages/skills-harness/src/lint.skill.ts
    - packages/skills-harness/src/lint/__tests__/formatter.test.ts
    - packages/skills-harness/src/lint/__tests__/fixer.test.ts
  modified:
    - packages/skills-harness/package.json

key-decisions:
  - "chalk@5 added as direct dependency for terminal color output in formatter"
  - "Violations enriched through formatter pipeline: runner provides basic messages, formatter adds layer-aware fix_instruction"
  - "lint.skill.ts stores lint.lastResult in state for recommender integration"

patterns-established:
  - "ESLint message enrichment: runner outputs basic violations, formatter enriches with layer-aware fix_instruction"
  - "Boundaries fix instruction template: source layer, target layer, allowed imports list"
  - "Skill state integration: ctx.state.get for input, ctx.state.set for downstream consumption"

requirements-completed: [HRN-07, HRN-08]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 02 Plan 04: Lint Formatter, Fixer, and Skill Entry Point Summary

**Lint formatter with layer-aware fix_instruction messages, --fix auto-correction, and complete `sunco lint` skill wired through init state detection**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T08:16:36Z
- **Completed:** 2026-03-28T08:21:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Formatter transforms ESLint messages into agent-readable SunLintViolation with fix_instruction per D-08 ("linter teaches while blocking")
- Boundaries violations get specific layer-aware instructions: source layer, target layer, allowed imports
- `sunco lint` skill reads init detection from state, generates ESLint config dynamically, supports --fix/--json/--files
- 15 new tests (12 formatter + 3 fixer), all 121 package tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Lint formatter with agent-readable fix instructions** (TDD)
   - `f7d813c` test: add failing tests for lint formatter (RED)
   - `ad63d5c` feat: implement lint formatter with agent-readable fix instructions (GREEN)
2. **Task 2: Fixer module + sunco lint skill entry point** - `d161205` (feat)

## Files Created/Modified
- `packages/skills-harness/src/lint/formatter.ts` - ESLint message -> SunLintViolation transformer with fix_instruction generation, terminal format, JSON format
- `packages/skills-harness/src/lint/fixer.ts` - --fix coordination: runs ESLint with fix=true, reports what was fixed
- `packages/skills-harness/src/lint.skill.ts` - sunco lint skill entry point (defineSkill with harness.lint)
- `packages/skills-harness/src/lint/__tests__/formatter.test.ts` - 12 tests: formatViolations, formatForTerminal, formatForJson
- `packages/skills-harness/src/lint/__tests__/fixer.test.ts` - 3 integration tests: fix mode, boundary violations, empty files
- `packages/skills-harness/package.json` - Added chalk@5 dependency

## Decisions Made
- Added chalk@5 as direct dependency for terminal coloring (was only transitive via eslint-plugin-boundaries@4)
- Violations enriched through formatter pipeline rather than inline in runner -- separation of concerns, runner stays simple
- lint.skill.ts stores lint.lastResult in state for recommender integration (errorCount, warningCount, filesLinted, timestamp)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added chalk as direct dependency**
- **Found during:** Task 1 (formatter implementation)
- **Issue:** chalk was only available as transitive dependency (v4 via eslint-plugin-boundaries), needed v5 ESM for formatter
- **Fix:** `npm install chalk@5 --workspace=packages/skills-harness`
- **Files modified:** packages/skills-harness/package.json, package-lock.json
- **Verification:** chalk ESM import works, formatter coloring confirmed
- **Committed in:** ad63d5c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for correct ESM chalk import. No scope creep.

## Issues Encountered
- Pre-existing TS6059 rootDir mismatch affects all files in skills-harness package during `tsc --noEmit`. Logged to deferred-items.md. Does not affect build (tsup uses esbuild) or tests (vitest).

## Known Stubs
None -- all functions are fully implemented with real logic.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Lint subsystem complete: types, rule-store, config-generator, runner, formatter, fixer, skill entry point
- Ready for guard skill (02-05) to use runLint for incremental single-file linting
- Ready for init skill to wire lint rule generation into workspace initialization

## Self-Check: PASSED

- All 5 created files exist on disk
- All 3 task commits (f7d813c, ad63d5c, d161205) found in git log
- 121/121 tests pass across 17 test files

---
*Phase: 02-harness-skills*
*Completed: 2026-03-28*
