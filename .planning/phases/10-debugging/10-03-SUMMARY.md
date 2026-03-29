---
phase: 10-debugging
plan: 03
subsystem: cli
tags: [debugging, recommender, barrel-exports, tsup, cli-wiring]

# Dependency graph
requires:
  - phase: 10-debugging
    provides: "debug.skill.ts, diagnose.skill.ts, forensics.skill.ts, debug-types.ts, debug-analyze.ts, forensics-postmortem.ts"
  - phase: 09-composition-skills
    provides: "compositionRules pattern in rules.ts, CLI preloadedSkills array pattern"
provides:
  - "All 3 debugging skills importable from @sunco/skills-workflow barrel"
  - "All 3 debugging skills registered in CLI and accessible via sunco debug/diagnose/forensics"
  - "5 new recommender rules for diagnose->debug->forensics transitions"
  - "Phase 10 shared types exported from barrel (FailureType, DiagnoseError, etc.)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Debugging escalation chain: diagnose (deterministic) -> debug (AI) -> forensics (deep analysis)"
    - "Recommender rules for debugging state transitions with project state introspection"

key-files:
  created: []
  modified:
    - "packages/skills-workflow/src/index.ts"
    - "packages/skills-workflow/src/prompts/index.ts"
    - "packages/skills-workflow/tsup.config.ts"
    - "packages/cli/src/cli.ts"
    - "packages/core/src/recommend/rules.ts"
    - "packages/skills-workflow/src/forensics.skill.ts"

key-decisions:
  - "debuggingRules placed between compositionRules and fallbackRules for specificity ordering"
  - "Fixed readonly array .reverse() DTS error in forensics.skill.ts via spread operator"

patterns-established:
  - "Debugging recommender escalation: diagnose -> debug -> forensics with bidirectional fallback"

requirements-completed: [DBG-01, DBG-02, DBG-03]

# Metrics
duration: 3min
completed: 2026-03-29
---

# Phase 10 Plan 03: Integration Wiring Summary

**Wire debugging skills (debug/diagnose/forensics) into CLI barrel exports, tsup build, and 5-rule recommender escalation chain**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T01:21:13Z
- **Completed:** 2026-03-29T01:24:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- All 3 debugging skills (debug, diagnose, forensics) exported from @sunco/skills-workflow barrel with shared types
- CLI registers all 3 skills at boot; `sunco debug`, `sunco diagnose`, `sunco forensics` appear in --help
- 5 new recommender rules handle diagnose->debug->forensics escalation and fallback transitions
- Full build chain (core -> skills-workflow -> cli) passes with all 37 tsup entry points

## Task Commits

Each task was committed atomically:

1. **Task 1: Barrel exports, tsup config, and prompts index** - `292b51f` (feat)
2. **Task 2: CLI wiring, recommender rules, and build verification** - `ff1c138` (feat)

## Files Created/Modified
- `packages/skills-workflow/src/index.ts` - Added Phase 10 debugging skill and type exports
- `packages/skills-workflow/src/prompts/index.ts` - Added debug-analyze and forensics-postmortem prompt builder exports
- `packages/skills-workflow/tsup.config.ts` - Added 3 new skill entry points
- `packages/cli/src/cli.ts` - Imported and registered 3 debugging skills in preloadedSkills
- `packages/core/src/recommend/rules.ts` - Added 5 debuggingRules for escalation chain
- `packages/skills-workflow/src/forensics.skill.ts` - Fixed readonly array DTS error

## Decisions Made
- debuggingRules placed between compositionRules and fallbackRules in RECOMMENDATION_RULES array for specificity ordering (matching Phase 9's compositionRules placement pattern)
- Fixed forensics.skill.ts DTS build error by spreading readonly log.all array before .reverse() with explicit type annotation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed readonly array .reverse() DTS error in forensics.skill.ts**
- **Found during:** Task 2 (Build verification)
- **Issue:** `log.all` from simple-git returns `ReadonlyArray`, so `.reverse()` is not available on it. DTS build failed with TS2339 and TS7006.
- **Fix:** Changed `log.all.reverse()` to `[...log.all].reverse()` with explicit type annotation on map callback
- **Files modified:** packages/skills-workflow/src/forensics.skill.ts
- **Verification:** Full turbo build passes
- **Committed in:** ff1c138 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for DTS build correctness. No scope creep.

## Issues Encountered
- Pre-existing TS6059 errors for test files (rootDir configuration) are unrelated to this plan's changes and were not addressed (out of scope)

## Known Stubs

None -- all wiring is complete with real implementations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 10 (debugging) is complete: all 3 plans executed
- All 53 plans across 10 phases are complete
- Project ready for milestone audit and release

## Self-Check: PASSED

- All 7 files verified as existing on disk
- Both task commits (292b51f, ff1c138) verified in git history
- All 5 plan verification checks pass (build, imports, rules, tsup entries, CLI help)

---
*Phase: 10-debugging*
*Completed: 2026-03-29*
