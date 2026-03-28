---
phase: 01-core-platform
plan: 02
subsystem: config
tags: [toml, smol-toml, zod, deep-merge, config-loading]

requires:
  - phase: 01-core-platform/01
    provides: monorepo scaffold, package structure
  - phase: 01-core-platform/01b
    provides: SunConfigSchema, ConfigError type contracts
provides:
  - loadConfig(cwd) three-layer TOML config loader
  - deepMerge with array-replace semantics
  - validateConfig with Zod schema + ConfigError
  - config barrel exports wired into @sunco/core
affects: [skill-loader, state-engine, cli-kernel, agent-router]

tech-stack:
  added: [smol-toml (runtime usage)]
  patterns: [three-layer config hierarchy, array-replace merge, Zod validation with ConfigError wrapping]

key-files:
  created:
    - packages/core/src/config/loader.ts
    - packages/core/src/config/merger.ts
    - packages/core/src/config/schema.ts
    - packages/core/src/config/index.ts
    - packages/core/src/config/__tests__/loader.test.ts
    - packages/core/src/config/__tests__/merger.test.ts
    - packages/core/src/config/__tests__/schema.test.ts
    - packages/core/vitest.config.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "Used Zod 3.24.4 ZodError.issues for error formatting instead of z.prettifyError (v4-only)"
  - "findProjectRoot checks .sun/ directory first, then package.json as fallback"
  - "loadConfig accepts homeDir option for testability without mocking os.homedir()"

patterns-established:
  - "TDD red-green-refactor: write failing tests first, then implement"
  - "Config error wrapping: catch library errors (Zod, smol-toml) and re-throw as ConfigError"
  - "Three-layer config: global (~/.sun/config.toml) <- project (.sun/config.toml) <- directory (.sun.toml)"
  - "Array-replace semantics: arrays in higher-priority layer replace entirely, never concatenate"

requirements-completed: [CFG-01, CFG-02, CFG-03]

duration: 4min
completed: 2026-03-28
---

# Phase 01 Plan 02: TOML Config System Summary

**Three-layer TOML config loader with smol-toml parsing, array-replace deep merge, and Zod schema validation returning frozen SunConfig objects**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T03:39:31Z
- **Completed:** 2026-03-28T03:43:02Z
- **Tasks:** 7 (3 TDD RED + 3 TDD GREEN + 1 barrel/wiring)
- **Files modified:** 9

## Accomplishments
- deepMerge with array-replace semantics (D/CFG-02) -- objects recurse, arrays replace, scalars override
- validateConfig wrapping Zod parsing with user-friendly ConfigError messages containing field paths
- loadConfig(cwd) three-layer TOML loading with findProjectRoot walking up from cwd
- 31 tests covering all merge edge cases, schema validation, and three-layer loading

## Task Commits

Each task was committed atomically:

1. **RED: deepMerge tests** - `b01e20e` (test)
2. **GREEN: deepMerge implementation** - `0772a0c` (feat)
3. **RED: schema validation tests** - `0ad8938` (test)
4. **GREEN: validateConfig implementation** - `9322dcc` (feat)
5. **RED: loadConfig tests** - `861775d` (test)
6. **GREEN: loadConfig implementation** - `00886e9` (feat)
7. **Barrel exports + wiring** - `95bc9c3` (feat)

_TDD red-green cycle for each module._

## Files Created/Modified
- `packages/core/src/config/merger.ts` - Deep merge with array-replace semantics (~30 lines)
- `packages/core/src/config/schema.ts` - Zod validation wrapper with ConfigError formatting
- `packages/core/src/config/loader.ts` - Three-layer TOML loader with findProjectRoot
- `packages/core/src/config/index.ts` - Barrel re-exports for config subsystem
- `packages/core/src/config/__tests__/merger.test.ts` - 12 tests for deepMerge
- `packages/core/src/config/__tests__/schema.test.ts` - 8 tests for validateConfig
- `packages/core/src/config/__tests__/loader.test.ts` - 11 tests for loadConfig
- `packages/core/vitest.config.ts` - Vitest config for @sunco/core package
- `packages/core/src/index.ts` - Added loadConfig, deepMerge, validateConfig exports

## Decisions Made
- Used Zod 3.24.4 ZodError.issues iteration for error formatting instead of z.prettifyError() (Zod v4-only API). The format maps each issue's path and message into a readable ConfigError.
- findProjectRoot walks up from cwd checking for `.sun/` directory first, then `package.json` as a fallback project root marker. This means any directory with a `.sun/` folder is treated as a project root.
- loadConfig accepts an optional `homeDir` parameter for testing, avoiding the need to mock `os.homedir()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created vitest.config.ts for @sunco/core**
- **Found during:** Task 1 (deepMerge tests)
- **Issue:** No vitest config existed for the core package -- vitest workspace required it
- **Fix:** Created `packages/core/vitest.config.ts` with test include pattern
- **Files modified:** packages/core/vitest.config.ts
- **Verification:** All tests discovered and run correctly
- **Committed in:** b01e20e (Task 1 commit)

**2. [Rule 2 - Missing Critical] Adapted Zod error formatting for v3**
- **Found during:** Task 4 (validateConfig implementation)
- **Issue:** Plan referenced `z.prettifyError()` which is Zod v4-only; project uses Zod 3.24.4
- **Fix:** Implemented manual ZodError.issues mapping to produce field-path error messages
- **Files modified:** packages/core/src/config/schema.ts
- **Verification:** Error messages contain field paths (agent.timeout) as verified by tests
- **Committed in:** 9322dcc (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
- Parallel agent execution caused cross-contamination in one commit (861775d) where `git add` picked up UI files staged by another agent. This does not affect functionality -- the config files in that commit are correct.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all config functions are fully implemented and wired.

## Next Phase Readiness
- Config system is ready for consumption by skill loader (Plan 04), CLI kernel (Plan 05), and any skill that needs `ctx.config`
- loadConfig is the single entry point: `const config = await loadConfig(process.cwd())`
- All three config layers (global/project/directory) are functional with proper merge semantics

## Self-Check: PASSED

- All 8 created files verified on disk
- All 7 commit hashes verified in git log

---
*Phase: 01-core-platform*
*Completed: 2026-03-28*
