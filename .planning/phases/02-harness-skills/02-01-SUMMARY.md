---
phase: 02-harness-skills
plan: 01
subsystem: harness
tags: [ecosystem-detection, layer-detection, convention-extraction, vitest, eslint, chokidar, typescript-eslint]

# Dependency graph
requires:
  - phase: 01-core-platform
    provides: "SkillContext, FileStoreApi, StateApi types for skill development"
provides:
  - "Shared init types: EcosystemMarker, DetectedLayer, ConventionResult, InitResult"
  - "detectEcosystems() — 19 marker files covering 15+ ecosystems"
  - "detectLayers() — directory heuristic matching against 7 layer patterns"
  - "extractConventions() — AST-free regex naming/import/export/test analysis"
  - "Vitest test infrastructure for skills-harness package"
  - "Phase 2 dependencies: eslint 10.1.0, eslint-plugin-boundaries 6.0.1, typescript-eslint 8.57.2, chokidar 5.0.0"
affects: [02-02-PLAN, 02-03-PLAN, 02-04-PLAN, 02-05-PLAN, 02-06-PLAN, 02-07-PLAN, 02-08-PLAN]

# Tech tracking
tech-stack:
  added: [eslint@10.1.0, eslint-plugin-boundaries@6.0.1, typescript-eslint@8.57.2, chokidar@5.0.0, vitest@3.1.2]
  patterns: [TDD red-green, temp-dir fixture testing, regex-based AST-free analysis]

key-files:
  created:
    - packages/skills-harness/src/init/types.ts
    - packages/skills-harness/src/init/ecosystem-detector.ts
    - packages/skills-harness/src/init/layer-detector.ts
    - packages/skills-harness/src/init/convention-extractor.ts
    - packages/skills-harness/src/init/__tests__/types.test.ts
    - packages/skills-harness/src/init/__tests__/ecosystem-detector.test.ts
    - packages/skills-harness/src/init/__tests__/layer-detector.test.ts
    - packages/skills-harness/src/init/__tests__/convention-extractor.test.ts
    - packages/skills-harness/vitest.config.ts
  modified:
    - packages/skills-harness/package.json
    - packages/skills-harness/tsup.config.ts
    - package.json
    - .npmrc

key-decisions:
  - "legacy-peer-deps for typescript-eslint TS 6.0 peer dep conflict (npm overrides alone insufficient)"
  - "19 ecosystem markers covering 15 distinct ecosystems with glob support for .csproj/.sln"
  - "Regex-based convention extraction (no AST) per D-03 — samples up to 50 files"

patterns-established:
  - "TDD with temp directory fixtures: mkdtemp + writeFile + afterEach cleanup"
  - "Init module pattern: pure async functions with {cwd} opts, no SkillContext dependency"
  - "Layer dependency direction: types -> config -> utils -> domain -> handler/ui/infra"

requirements-completed: [HRN-01, HRN-02, HRN-03]

# Metrics
duration: 7min
completed: 2026-03-28
---

# Phase 2 Plan 1: Init Detection Modules Summary

**Three init detection modules (ecosystem/layer/convention) with 19 ecosystem markers, 7 layer patterns, AST-free regex convention analysis, and full vitest infrastructure**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-28T07:51:18Z
- **Completed:** 2026-03-28T07:58:35Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Installed all Phase 2 dependencies (eslint 10.1.0, eslint-plugin-boundaries 6.0.1, typescript-eslint 8.57.2, chokidar 5.0.0, vitest 3.1.2)
- Created shared init types with 19 ecosystem markers and 7 common layer patterns with dependency direction rules
- Implemented ecosystem detector scanning for 15+ ecosystems with glob pattern support (*.csproj, *.sln)
- Implemented layer detector mapping directory names to architectural layers with import rules
- Implemented convention extractor analyzing naming, import, export, and test organization via regex
- 29 tests passing across 4 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, test infra, and shared init types** - `dff0d29` (feat)
2. **Task 2: Ecosystem detector + layer detector + convention extractor** - `d4ffe78` (feat)

_TDD approach: RED (failing tests) -> GREEN (implementation) for both tasks_

## Files Created/Modified
- `packages/skills-harness/src/init/types.ts` - Shared types: EcosystemMarker, DetectedLayer, ConventionResult, InitResult + ECOSYSTEM_MARKERS (19) + COMMON_LAYER_PATTERNS (7)
- `packages/skills-harness/src/init/ecosystem-detector.ts` - detectEcosystems() scanning marker files with glob support
- `packages/skills-harness/src/init/layer-detector.ts` - detectLayers() mapping directories to architectural layers
- `packages/skills-harness/src/init/convention-extractor.ts` - extractConventions() regex-based analysis of 4 convention dimensions
- `packages/skills-harness/src/init/__tests__/types.test.ts` - 10 tests for type shapes and constants
- `packages/skills-harness/src/init/__tests__/ecosystem-detector.test.ts` - 6 tests for ecosystem detection
- `packages/skills-harness/src/init/__tests__/layer-detector.test.ts` - 6 tests for layer detection
- `packages/skills-harness/src/init/__tests__/convention-extractor.test.ts` - 7 tests for convention extraction
- `packages/skills-harness/vitest.config.ts` - Vitest config matching core package pattern
- `packages/skills-harness/package.json` - Dependencies + test script
- `packages/skills-harness/tsup.config.ts` - Phase 2 skill entry points
- `package.json` - npm overrides for typescript-eslint TS 6.0 peer dep
- `.npmrc` - legacy-peer-deps setting

## Decisions Made
- Used `--legacy-peer-deps` (persisted in .npmrc) because npm overrides alone cannot resolve typescript-eslint peer dep requiring TS <6.0.0 -- ERESOLVE happens before overrides are applied
- Ecosystem markers include 19 entries (plan specified 18+) covering 15 distinct ecosystems including glob patterns for .NET projects
- Convention extractor uses majority voting with >50% threshold for declaring dominant convention, falling back to 'mixed'
- Init detection modules are pure async functions with `{cwd}` opts -- no coupling to SkillContext, making them testable in isolation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added legacy-peer-deps to .npmrc**
- **Found during:** Task 1 (dependency installation)
- **Issue:** npm overrides for typescript-eslint did not resolve ERESOLVE -- typescript-eslint@8.57.2 requires typescript <6.0.0 but project uses 6.0.2. npm ERESOLVE happens before overrides are applied.
- **Fix:** Added `legacy-peer-deps=true` to .npmrc so all future npm installs bypass strict peer dep resolution
- **Files modified:** .npmrc
- **Verification:** npm install succeeds, all dependencies resolve
- **Committed in:** dff0d29 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for installing typescript-eslint with TS 6.0. No scope creep.

## Issues Encountered
- Pre-existing tsconfig rootDir resolution issue: base config sets `rootDir: "src"` which resolves relative to root, not package. Type checking works with explicit `--rootDir src` flag. Not introduced by this plan.

## Known Stubs
None -- all modules are fully functional with no placeholder data.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Init detection modules ready for consumption by Plan 02 (init skill wiring) and downstream plans
- Test infrastructure operational for all future skills-harness tests
- All Phase 2 dependencies installed and verified

## Self-Check: PASSED

All 10 created files verified. Both commit hashes (dff0d29, d4ffe78) confirmed in git log.

---
*Phase: 02-harness-skills*
*Completed: 2026-03-28*
