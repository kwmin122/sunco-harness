---
phase: 02-harness-skills
plan: 03
subsystem: harness
tags: [eslint, eslint-plugin-boundaries, lint-engine, rule-store, config-generator, typescript-eslint, tdd]

# Dependency graph
requires:
  - phase: 02-harness-skills
    plan: 01
    provides: "DetectedLayer type, COMMON_LAYER_PATTERNS, vitest test infra, eslint+boundaries deps"
  - phase: 01-core-platform
    provides: "FileStoreApi type for .sun/rules/ access"
provides:
  - "SunLintRule, SunLintViolation, LintResult, BoundariesConfig types"
  - "loadRules() / saveRule() for .sun/rules/ JSON management via FileStoreApi"
  - "generateBoundariesConfig() converting DetectedLayer[] to boundaries plugin format"
  - "generateEslintFlatConfig() producing full flat config with plugin, settings, rules"
  - "runLint() executing ESLint programmatically with boundary violation detection"
affects: [02-04-PLAN, 02-05-PLAN, 02-06-PLAN, 02-07-PLAN, 02-08-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [eslint-plugin-boundaries mode:folder element matching, boundaries native rule format, createRequire for CJS plugins in ESM, ESLint programmatic API with overrideConfigFile:true]

key-files:
  created:
    - packages/skills-harness/src/lint/types.ts
    - packages/skills-harness/src/lint/rule-store.ts
    - packages/skills-harness/src/lint/config-generator.ts
    - packages/skills-harness/src/lint/runner.ts
    - packages/skills-harness/src/lint/__tests__/rule-store.test.ts
    - packages/skills-harness/src/lint/__tests__/config-generator.test.ts
    - packages/skills-harness/src/lint/__tests__/runner.test.ts
  modified: []

key-decisions:
  - "eslint-plugin-boundaries requires mode:'folder' for directory-based element matching (glob patterns fail silently)"
  - "Boundaries dependency rule format: { from: { type }, allow: { to: { type: string[] } } } (not array-based)"
  - "boundaries/include setting required for TypeScript file filtering"
  - "Import paths with .ts extension needed for boundaries plugin to resolve cross-layer imports"
  - "createRequire pattern for loading CJS plugins (eslint-plugin-boundaries) in ESM project"

patterns-established:
  - "Boundaries element definition: { type: layerName, pattern: dirPath, mode: 'folder' }"
  - "ESLint programmatic runner: overrideConfigFile:true + overrideConfig array with flat config"
  - "FileStoreApi mock pattern: in-memory Map<string, Map<string, string>> for isolated testing"

requirements-completed: [HRN-05, HRN-06]

# Metrics
duration: 11min
completed: 2026-03-28
---

# Phase 2 Plan 3: Lint Engine Core Summary

**Lint types, rule store for .sun/rules/ JSON, config generator converting DetectedLayer[] to eslint-plugin-boundaries flat config, and ESLint programmatic runner detecting architecture boundary violations**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-28T08:01:52Z
- **Completed:** 2026-03-28T08:12:47Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Defined lint subsystem types: SunLintRule (D-10), SunLintViolation (D-08), LintResult, BoundariesConfig/Element/DependencyRule
- Built rule store that reads/writes .sun/rules/ JSON via FileStoreApi, filtering only .json files
- Built config generator that converts DetectedLayer[] to eslint-plugin-boundaries native format with mode:'folder' elements and disallow-by-default policy (D-07)
- Built ESLint programmatic runner using overrideConfigFile:true, typescript-eslint parser, and boundaries plugin injection -- detects boundary violations, supports fix mode, handles parse errors gracefully
- 14 tests passing across 3 test files (4 rule-store + 6 config-generator + 4 runner)

## Task Commits

Each task was committed atomically:

1. **Task 1: Lint types + rule store + config generator** - `c93e517` (feat)
2. **Task 2: ESLint programmatic runner with boundaries plugin** - `a23b939` (feat)

_TDD approach: RED (failing tests due to missing modules) -> GREEN (implementation passes all tests)_

## Files Created/Modified
- `packages/skills-harness/src/lint/types.ts` - SunLintRule, SunLintViolation, LintResult, BoundariesElement (mode:'folder'), BoundariesDependencyRule, BoundariesConfig
- `packages/skills-harness/src/lint/rule-store.ts` - loadRules() / saveRule() for .sun/rules/ JSON via FileStoreApi
- `packages/skills-harness/src/lint/config-generator.ts` - generateBoundariesConfig() + generateEslintFlatConfig() with boundaries plugin loading via createRequire
- `packages/skills-harness/src/lint/runner.ts` - runLint() with ESLint programmatic API, typescript-eslint parser, boundaries plugin, fix support
- `packages/skills-harness/src/lint/__tests__/rule-store.test.ts` - 4 tests: empty rules, JSON parsing, save roundtrip, non-JSON filtering
- `packages/skills-harness/src/lint/__tests__/config-generator.test.ts` - 6 tests: empty layers, 2-layer config, types empty allow, handler allow list, ui disallow list, flat config structure
- `packages/skills-harness/src/lint/__tests__/runner.test.ts` - 4 tests: empty files, boundary violation detection, filesLinted count, parse error handling

## Decisions Made
- eslint-plugin-boundaries 6.0.1 requires `mode: 'folder'` for directory-based element matching -- glob patterns like `src/ui/**` silently fail to match any files. Discovered through integration testing.
- Boundaries dependency rules use the plugin's native format `{ from: { type }, allow: { to: { type: string[] } } }` not the array-based format assumed in the plan. Updated types and config generator accordingly.
- `boundaries/include` setting is needed alongside `boundaries/elements` to tell the plugin which file types to analyze.
- TypeScript import paths must use `.ts` extension (not `.js`) for eslint-plugin-boundaries to resolve cross-layer imports. This is a limitation of the plugin's static import path analysis.
- Used `createRequire(import.meta.url)` for loading eslint-plugin-boundaries (CJS module) in ESM project, same pattern established for picomatch in Phase 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected eslint-plugin-boundaries element and rule format**
- **Found during:** Task 2 (runner integration testing)
- **Issue:** Plan assumed glob-based element patterns (`src/ui/**`) and array-based rule format (`from: [{ type }], allow: [{ type }]`). The actual eslint-plugin-boundaries 6.0.1 API requires `mode: 'folder'` for directory matching and uses `{ from: { type }, allow: { to: { type } } }` format. Tests passed silently with 0 violations because elements never matched any files.
- **Fix:** Updated BoundariesElement type to include `mode` field, changed BoundariesDependencyRule to use plugin-native format, added `boundaries/include` setting, updated config-generator to produce correct format.
- **Files modified:** types.ts, config-generator.ts, config-generator.test.ts, runner.test.ts
- **Verification:** Integration test now correctly detects ui->infra boundary violation
- **Committed in:** a23b939 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed @sunco/core deep import path**
- **Found during:** Task 2 (type checking)
- **Issue:** `import type { FileStoreApi } from '@sunco/core/src/state/types.js'` failed TypeScript resolution. Established pattern imports from `'@sunco/core'` barrel export.
- **Fix:** Changed to `import type { FileStoreApi } from '@sunco/core'`
- **Files modified:** rule-store.ts, rule-store.test.ts
- **Committed in:** a23b939 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes essential for correctness. The boundaries format correction was critical -- without it, the lint engine would silently pass all boundary violations. No scope creep.

## Issues Encountered
- Pre-existing tsconfig rootDir resolution issue (base config sets rootDir relative to monorepo root, not package). Workaround: `tsc --rootDir src`. Not introduced by this plan.

## Known Stubs
None -- all modules are fully functional with no placeholder data.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Lint types, rule store, config generator, and runner are ready for consumption by Plan 04 (lint skill wiring) and Plan 06/07 (guard skill)
- Runner correctly detects boundary violations using ESLint programmatic API
- Config generator produces valid eslint-plugin-boundaries flat config from init detection output
- All modules tested with 14 passing tests

## Self-Check: PASSED

All 7 created files verified. Both commit hashes (c93e517, a23b939) confirmed in git log.

---
*Phase: 02-harness-skills*
*Completed: 2026-03-28*
