---
phase: 02-harness-skills
plan: 02
subsystem: harness
tags: [toml, smol-toml, eslint-plugin-boundaries, presets, workspace-init, config-generation]

# Dependency graph
requires:
  - phase: 02-harness-skills/01
    provides: "Ecosystem detector, layer detector, convention extractor modules and types"
provides:
  - "Project presets with ecosystem-weighted resolution"
  - "Workspace initializer creating config.toml + lint rule JSON + directory scaffold"
  - "sunco init skill entry point orchestrating detection -> workspace creation"
affects: [02-harness-skills/03, 02-harness-skills/04, 02-harness-skills/05]

# Tech tracking
tech-stack:
  added: [smol-toml]
  patterns: [ecosystem-weighted-preset-resolution, toml-config-generation, filestore-mock-pattern]

key-files:
  created:
    - packages/skills-harness/src/init/presets.ts
    - packages/skills-harness/src/init/workspace-initializer.ts
    - packages/skills-harness/src/init.skill.ts
    - packages/skills-harness/src/init/__tests__/presets.test.ts
    - packages/skills-harness/src/init/__tests__/workspace-initializer.test.ts
  modified:
    - packages/skills-harness/package.json

key-decisions:
  - "Completeness-weighted preset scoring: matchCount * 1000 + completeness_ratio * 100 prevents partial match overshadowing exact match"
  - "smol-toml added as direct dependency to skills-harness for config.toml generation"

patterns-established:
  - "In-memory FileStoreApi mock with Map<string, string> for testing workspace operations"
  - "Preset resolution by ecosystem overlap with completeness weighting"

requirements-completed: [HRN-04, HRN-05]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 02 Plan 02: Workspace Initialization Summary

**Project presets with completeness-weighted ecosystem resolution, config.toml generation via smol-toml, and arch-layers.json boundary lint rule generation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T08:01:40Z
- **Completed:** 2026-03-28T08:06:36Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 6 project presets (typescript-node, nodejs, rust, python, go, generic) with ecosystem-weighted resolution
- Workspace initializer generating config.toml (stack, layers, conventions sections) via smol-toml stringify
- Architecture layer boundary lint rule generation as JSON for eslint-plugin-boundaries
- sunco init skill wired with parallel detection, workspace creation, and state persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Presets + workspace initializer** - `997a725` (test: RED) + `6e51a4e` (feat: GREEN)
2. **Task 2: Wire sunco init skill entry point** - `7723476` (feat)

_Note: Task 1 followed TDD with separate RED/GREEN commits_

## Files Created/Modified
- `packages/skills-harness/src/init/presets.ts` - 6 project presets with completeness-weighted resolution
- `packages/skills-harness/src/init/workspace-initializer.ts` - .sun/ workspace creation with config.toml + lint rules + directory scaffold
- `packages/skills-harness/src/init.skill.ts` - sunco init skill entry point with parallel detection and state persistence
- `packages/skills-harness/src/init/__tests__/presets.test.ts` - 9 tests for preset resolution logic
- `packages/skills-harness/src/init/__tests__/workspace-initializer.test.ts` - 9 tests for workspace initialization with in-memory FileStore mock
- `packages/skills-harness/package.json` - Added smol-toml 1.6.1 dependency

## Decisions Made
- Completeness-weighted preset scoring: `matchCount * 1000 + completeness_ratio * 100` prevents partial-match presets (e.g., typescript-node matching only nodejs) from overshadowing exact-match presets (nodejs matching nodejs)
- smol-toml added as direct dependency to skills-harness rather than re-exporting from core, since workspace-initializer needs stringify for TOML generation
- FileStoreApi mock uses Map<"category/filename", content> with empty-string category mapping to root-level files (config.toml)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed preset resolution tiebreaking**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** When ecosystems=['nodejs'], typescript-node preset matched with score 1 (same as nodejs), winning due to array order
- **Fix:** Added completeness weighting so exact matches (all matchEcosystems present) score higher than partial matches
- **Files modified:** packages/skills-harness/src/init/presets.ts
- **Verification:** Test "resolves ['nodejs'] to nodejs preset (not typescript-node)" passes
- **Committed in:** 6e51a4e (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Scoring fix necessary for correct preset selection. No scope creep.

## Issues Encountered
None beyond the preset scoring fix noted above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- sunco init skill is complete: detection -> workspace creation -> state persistence
- .sun/rules/arch-layers.json output ready for consumption by sunco lint (Plan 03)
- init.result stored in StateApi for downstream skills (lint, health, guard)

## Self-Check: PASSED

All 6 created files exist on disk. All 3 task commits verified in git log.

---
*Phase: 02-harness-skills*
*Completed: 2026-03-28*
