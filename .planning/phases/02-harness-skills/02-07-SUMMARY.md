---
phase: 02-harness-skills
plan: 07
subsystem: harness
tags: [guard, chokidar, eslint, anti-pattern, promotion, tribal-knowledge, watch-mode]

# Dependency graph
requires:
  - phase: 02-harness-skills/04
    provides: ESLint runner, boundaries config generator, formatter, lint types
provides:
  - Guard types (GuardResult, PromotionSuggestion, TribalPattern, WatchEvent, GuardConfig)
  - Anti-pattern analyzer with per-line regex scanning
  - Pattern frequency tracking with lint rule promotion suggestions
  - Incremental single-file ESLint lintText for watch mode hot path
  - Tribal knowledge loader from .sun/tribal/ files
  - chokidar file watcher with debounce and clean shutdown
  - sunco guard skill with single-run and --watch modes
affects: [02-harness-skills/08, integration-tests, CLI-entry-point]

# Tech tracking
tech-stack:
  added: [chokidar@5.0.0]
  patterns: [chokidar-watch-with-awaitWriteFinish, ESLint-lintText-incremental, tribal-knowledge-pattern-format, promotion-suggest-only]

key-files:
  created:
    - packages/skills-harness/src/guard/types.ts
    - packages/skills-harness/src/guard/analyzer.ts
    - packages/skills-harness/src/guard/promoter.ts
    - packages/skills-harness/src/guard/incremental-linter.ts
    - packages/skills-harness/src/guard/tribal-loader.ts
    - packages/skills-harness/src/guard/watcher.ts
    - packages/skills-harness/src/guard.skill.ts
    - packages/skills-harness/src/guard/__tests__/promoter.test.ts
    - packages/skills-harness/src/guard/__tests__/incremental-linter.test.ts
    - packages/skills-harness/src/guard/__tests__/analyzer.test.ts
    - packages/skills-harness/src/guard/__tests__/watcher.test.ts
  modified:
    - packages/skills-harness/src/index.ts

key-decisions:
  - "Promotion is suggest-only per D-21: guard tracks pattern frequency via StateApi but never auto-adds rules to .sun/rules/"
  - "Incremental linter uses ESLint lintText() (not lintFiles()) for watch mode hot path performance"
  - "Anti-pattern scanning reuses same regex patterns as health/pattern-tracker but with per-line matching for line-level reporting"
  - "Tribal knowledge files parsed with simple # Pattern / pattern: / message: format for human readability"
  - "chokidar 5.0.0 with awaitWriteFinish stabilityThreshold=300ms to debounce rapid file saves"

patterns-established:
  - "chokidar watch pattern: ignoreInitial:true + awaitWriteFinish:300ms + cleanup via AbortSignal"
  - "ESLint lintText for single-file incremental linting (guard hot path)"
  - "Tribal knowledge format: # Pattern: id / pattern: regex / message: text in .sun/tribal/"
  - "Promotion suggestion with pre-built SunLintRule JSON for user confirmation"

requirements-completed: [HRN-14, HRN-15, HRN-16]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 02 Plan 07: Guard Skill Summary

**Guard skill with anti-pattern detection, lint rule promotion suggestions, chokidar watch mode, incremental ESLint lintText, and tribal knowledge integration**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T08:25:09Z
- **Completed:** 2026-03-28T08:31:40Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Guard types defining GuardResult, PromotionSuggestion, TribalPattern, WatchEvent, and GuardConfig
- Analyzer combining lint results + anti-pattern regex scanning + tribal knowledge matching per file and project
- Promoter tracking pattern frequency via StateApi with threshold-based promotion suggestions (suggest-only per D-21)
- Incremental linter using ESLint lintText() for fast single-file linting in watch mode
- Tribal knowledge loader parsing .sun/tribal/ files into compiled RegExp matchers
- chokidar 5.0.0 file watcher with awaitWriteFinish debounce and clean shutdown via AbortSignal
- sunco guard skill entry point with single-run scan and --watch continuous modes
- 15 tests across 4 test files all passing

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Guard core test scaffolding** - `0e537e3` (test)
2. **Task 1 GREEN: Guard core modules implementation** - `2be6c94` (feat)
3. **Task 2: Chokidar watcher + guard skill entry point** - `99f9803` (feat)

_Note: Task 1 followed TDD with RED (failing tests) then GREEN (implementation) commits_

## Files Created/Modified
- `packages/skills-harness/src/guard/types.ts` - Guard types: GuardResult, PromotionSuggestion, TribalPattern, WatchEvent, GuardConfig
- `packages/skills-harness/src/guard/analyzer.ts` - Shared analysis engine: analyzeFile (per-file) + analyzeProject (full scan)
- `packages/skills-harness/src/guard/promoter.ts` - Anti-pattern frequency tracking with lint rule promotion suggestions
- `packages/skills-harness/src/guard/incremental-linter.ts` - Single-file ESLint lintText() for incremental linting
- `packages/skills-harness/src/guard/tribal-loader.ts` - Load .sun/tribal/ pattern files into TribalPattern[]
- `packages/skills-harness/src/guard/watcher.ts` - chokidar file watcher with debounce and clean shutdown
- `packages/skills-harness/src/guard.skill.ts` - sunco guard skill with --watch and --json options
- `packages/skills-harness/src/guard/__tests__/promoter.test.ts` - 5 tests for promoter
- `packages/skills-harness/src/guard/__tests__/incremental-linter.test.ts` - 3 tests for incremental linter
- `packages/skills-harness/src/guard/__tests__/analyzer.test.ts` - 3 tests for analyzer
- `packages/skills-harness/src/guard/__tests__/watcher.test.ts` - 4 tests for watcher
- `packages/skills-harness/src/index.ts` - Added guardSkill export

## Decisions Made
- Promotion is suggest-only per D-21: guard generates a pre-built SunLintRule JSON that the user can confirm, but never auto-writes to .sun/rules/
- Incremental linter uses ESLint lintText() (not lintFiles()) for watch mode hot path -- avoids filesystem reads since content is already available from chokidar or direct read
- Anti-pattern scanning reuses same regex patterns as health/pattern-tracker (any-type, console-log, todo-comment, type-assertion, eslint-disable) but with per-line matching for precise line-level reporting
- Tribal knowledge files use a simple human-readable format: `# Pattern: id`, `pattern: regex`, `message: text`
- chokidar 5.0.0 configured with awaitWriteFinish (stabilityThreshold=300ms, pollInterval=100ms) to debounce rapid saves in watch mode
- Clean shutdown registered via ctx.signal AbortSignal + process SIGINT/SIGTERM handlers per pitfall #4

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all modules are fully implemented with real logic.

## Next Phase Readiness
- Guard skill ready for integration with CLI entry point
- Plan 08 (end-to-end integration) can wire guard into the preloaded skills list
- Pattern frequency data persists across runs via StateApi for trend analysis

---
*Phase: 02-harness-skills*
*Completed: 2026-03-28*
