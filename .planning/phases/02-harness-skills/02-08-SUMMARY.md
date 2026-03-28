---
phase: 02-harness-skills
plan: 08
subsystem: cli, harness
tags: [barrel-export, cli-wiring, tsup, eslint-external, integration]

requires:
  - phase: 02-harness-skills (plans 01-07)
    provides: All 7 skill implementations (settings, sample-prompt, init, lint, health, agents, guard)
  - phase: 01-core-platform
    provides: CLI entry point, skill registry, Commander.js program, lifecycle boot
provides:
  - All 7 harness skills exported from @sunco/skills-harness barrel
  - All 7 skills registered as CLI subcommands via preloaded array
  - Subpath exports for individual skill imports (./init, ./lint, etc.)
  - Type re-exports for cross-package consumption (InitResult, SunLintRule, HealthReport, etc.)
affects: [03-typescript-skills, 04-agent-init, cli-consumers]

tech-stack:
  added: []
  patterns:
    - "CJS runtime deps (eslint, chokidar) must be external in both skills-harness AND cli tsup configs"
    - "tsconfig types:[node] needed for DTS build resolution with multi-entry tsup"

key-files:
  created: []
  modified:
    - packages/skills-harness/src/index.ts
    - packages/skills-harness/tsup.config.ts
    - packages/skills-harness/package.json
    - packages/skills-harness/tsconfig.json
    - packages/cli/src/cli.ts
    - packages/cli/tsup.config.ts

key-decisions:
  - "types:[node] in skills-harness tsconfig.json for DTS build with multi-entry tsup"
  - "eslint/eslint-plugin-boundaries/typescript-eslint/chokidar added as CLI externals to prevent CJS require() crash in ESM bundle"

patterns-established:
  - "CJS-heavy dependencies must be external in both the library tsup config AND the consuming CLI tsup config"
  - "Multi-entry tsup builds require explicit types:[node] in tsconfig for DTS generation"

requirements-completed: [HRN-01, HRN-02, HRN-03, HRN-04, HRN-06, HRN-07, HRN-08, HRN-09, HRN-10, HRN-11, HRN-12, HRN-13, HRN-14, HRN-15, HRN-16]

duration: 4min
completed: 2026-03-28
---

# Phase 2 Plan 8: Integration Wiring Summary

**All 7 harness skills barrel-exported, CLI-wired with subpath exports, CJS externals fixed for ESM distribution**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T08:35:06Z
- **Completed:** 2026-03-28T08:39:36Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- All 7 skills (settings, sample-prompt, init, lint, health, agents, guard) exported from @sunco/skills-harness barrel
- Key types re-exported for cross-package consumption (InitResult, SunLintRule, HealthReport, AgentDocReport, GuardResult)
- Subpath exports added to package.json for individual skill imports
- CLI preloaded skills array updated with all 7 skills -- all appear in `sunco --help`
- Full build (5 packages) and test suite (429 tests) pass green

## Task Commits

Each task was committed atomically:

1. **Task 1: Barrel exports + CLI wiring + build verification** - `78ffb88` (feat)
   - Fix: CJS externals in CLI tsup config - `f0b689c` (fix)
2. **Task 2: Verify harness skills work from CLI** - auto-approved checkpoint (no commit)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `packages/skills-harness/src/index.ts` - Barrel export of all 7 skills + key type re-exports
- `packages/skills-harness/tsup.config.ts` - Added eslint/chokidar/typescript-eslint externals
- `packages/skills-harness/package.json` - Added subpath exports for init/lint/health/agents/guard
- `packages/skills-harness/tsconfig.json` - Added types:["node"] for DTS build resolution
- `packages/cli/src/cli.ts` - Imported and registered all 7 skills in preloaded array
- `packages/cli/tsup.config.ts` - Added eslint ecosystem + chokidar as externals

## Decisions Made
- **types:["node"] in skills-harness tsconfig.json:** The tsup DTS build worker could not resolve node: protocol imports without explicit type declarations. Adding types:["node"] to the package-level tsconfig fixed DTS generation for multi-entry builds.
- **CJS externals in CLI tsup config:** eslint and its plugins use CommonJS require() internally. When bundled into the ESM CLI binary via noExternal, they cause "Dynamic require of 'fs' is not supported" crashes. Externalizing them lets Node.js resolve them at runtime. This also reduced CLI binary from 3.72MB to 387KB.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added types:["node"] to skills-harness tsconfig.json**
- **Found during:** Task 1 (build verification)
- **Issue:** tsup DTS build failed with TS2591 "Cannot find name 'node:fs/promises'" -- the DTS worker could not resolve @types/node despite it being hoisted in node_modules
- **Fix:** Added `"types": ["node"]` to compilerOptions in packages/skills-harness/tsconfig.json
- **Files modified:** packages/skills-harness/tsconfig.json
- **Verification:** `npx tsup` DTS build succeeds, all .d.ts files generated
- **Committed in:** 78ffb88 (Task 1 commit)

**2. [Rule 3 - Blocking] Externalized CJS dependencies in CLI tsup config**
- **Found during:** Task 2 (CLI verification)
- **Issue:** `npx sunco --help` crashed with "Dynamic require of 'fs' is not supported" because eslint (CJS) was bundled into the ESM CLI binary
- **Fix:** Added eslint, eslint-plugin-boundaries, typescript-eslint, and chokidar to the CLI tsup external array
- **Files modified:** packages/cli/tsup.config.ts
- **Verification:** `npx sunco --help` shows all 7 skills, `npx sunco init --help` works correctly
- **Committed in:** f0b689c

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes essential for build/runtime correctness. No scope creep.

## Issues Encountered
- Scanner warnings about `.ts` files ("Unknown file extension .ts") are expected and benign -- the runtime scanner tries to import source files but fails; preloaded skills take priority per D-14.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (harness-skills) is complete: all 8 plans executed successfully
- All 5 harness skills (init, lint, health, agents, guard) plus 2 foundation skills (settings, sample-prompt) are operational from the CLI
- Ready to proceed to Phase 3 (typescript-skills)

## Self-Check: PASSED

All 7 files verified present. Both commits (78ffb88, f0b689c) verified in git log.

---
*Phase: 02-harness-skills*
*Completed: 2026-03-28*
