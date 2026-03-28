---
phase: 05-context-planning
plan: 05
subsystem: cli
tags: [barrel-exports, tsup, subpath-exports, skill-wiring, commander]

# Dependency graph
requires:
  - phase: 05-01
    provides: discuss skill implementation + discuss prompts
  - phase: 05-02
    provides: assume skill implementation + assume prompt
  - phase: 05-03
    provides: research skill implementation + research prompts
  - phase: 05-04
    provides: plan skill implementation + plan prompts + phase-reader
provides:
  - 4 Phase 5 skills registered in CLI preloadedSkills (discuss, assume, research, plan)
  - Barrel exports for all Phase 5 skills and shared utilities
  - Package.json subpath exports for individual skill imports
  - Tsup entry points for individual skill bundling
  - All prompt builders accessible via prompts/index.ts barrel
affects: [06-agent-execution, cli, skills-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: [barrel-export-tsup-subpath-cli-pipeline]

key-files:
  created: []
  modified:
    - packages/skills-workflow/src/index.ts
    - packages/skills-workflow/src/prompts/index.ts
    - packages/skills-workflow/tsup.config.ts
    - packages/skills-workflow/package.json
    - packages/cli/src/cli.ts
    - packages/skills-workflow/src/assume.skill.ts

key-decisions:
  - "research-skill subpath (not ./research) to avoid confusion with existing research.ts prompt file"
  - "Fixed assume.skill.ts type error: recommended -> isRecommended (AskOption interface)"

patterns-established:
  - "Phase skill wiring pipeline: barrel export -> tsup entry -> package.json subpath -> CLI preloadedSkills"

requirements-completed: [WF-09, WF-10, WF-11, WF-12]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 05 Plan 05: CLI Wiring Summary

**Wired 4 Phase 5 skills (discuss, assume, research, plan) into CLI via barrel exports, tsup entries, subpath exports, and preloadedSkills registration with 621 tests passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T14:05:38Z
- **Completed:** 2026-03-28T14:08:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- All 4 Phase 5 skills (discuss, assume, research, plan) accessible via sunco CLI
- Barrel exports extended with 4 skills + 3 phase-reader utilities + 2 research prompt builders
- Full workspace build (5/5 packages) and all 621 tests pass with zero regressions
- Each skill individually importable via package.json subpath exports

## Task Commits

Each task was committed atomically:

1. **Task 1: Update barrel exports, tsup config, package.json exports, and CLI wiring** - `75753ef` (feat)
2. **Task 2: Verify full build, all tests, and skill registration** - verification only (no file changes)

## Files Created/Modified
- `packages/skills-workflow/src/index.ts` - Added 4 Phase 5 skill exports + 3 phase-reader utility exports
- `packages/skills-workflow/src/prompts/index.ts` - Added research-domain and research-synthesize prompt exports
- `packages/skills-workflow/tsup.config.ts` - Added 4 new entry points for individual skill bundling
- `packages/skills-workflow/package.json` - Added 4 subpath exports (./discuss, ./assume, ./research-skill, ./plan)
- `packages/cli/src/cli.ts` - Imported and registered 4 Phase 5 skills in preloadedSkills array
- `packages/skills-workflow/src/assume.skill.ts` - Fixed type error (recommended -> isRecommended)

## Decisions Made
- Used `./research-skill` subpath (not `./research`) to avoid confusion with existing research.ts prompt file
- Fixed assume.skill.ts AskOption property name from `recommended` to `isRecommended` (Rule 1 auto-fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AskOption property name in assume.skill.ts**
- **Found during:** Task 1 (build verification)
- **Issue:** `recommended` property does not exist on AskOption type; correct property is `isRecommended`
- **Fix:** Changed `recommended: true` to `isRecommended: true` at line 355
- **Files modified:** packages/skills-workflow/src/assume.skill.ts
- **Verification:** `npx turbo build --force` succeeds with no type errors
- **Committed in:** 75753ef (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential type fix for build success. No scope creep.

## Issues Encountered
None - build passed after the single type fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 5 skills are fully wired and available via CLI
- Phase 05 (context-planning) is now complete with all 5 plans executed
- Ready for Phase 06 (agent-execution) or subsequent phases

## Self-Check: PASSED

- All 6 modified files verified present on disk
- Commit 75753ef verified in git log

---
*Phase: 05-context-planning*
*Completed: 2026-03-28*
