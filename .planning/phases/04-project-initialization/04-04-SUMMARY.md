---
phase: 04-project-initialization
plan: 04
subsystem: cli, workflow
tags: [barrel-export, tsup, cli-wiring, sunco-new, sunco-scan, preloadedSkills]

# Dependency graph
requires:
  - phase: 04-project-initialization
    plan: 02
    provides: "scan.skill.ts with parallel 7-agent codebase analysis"
  - phase: 04-project-initialization
    plan: 03
    provides: "new.skill.ts with multi-step agent orchestration"
provides:
  - "sunco new and sunco scan registered in CLI and visible in sunco --help"
  - "Full build pipeline: barrel export -> tsup entry -> package.json subpath -> CLI preloadedSkills"
  - "Prompts barrel extended with all 7 scan prompt builders"
affects: [05-context-plan, 10-cli-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [skill wiring pipeline barrel->tsup->package.json->cli]

key-files:
  created: []
  modified:
    - packages/skills-workflow/src/index.ts
    - packages/skills-workflow/tsup.config.ts
    - packages/skills-workflow/package.json
    - packages/skills-workflow/src/prompts/index.ts
    - packages/cli/src/cli.ts

key-decisions:
  - "Extended prompts barrel to include all 7 scan prompt builders (deferred from plan 04-02/03)"

patterns-established:
  - "Full skill wiring pipeline: barrel export -> tsup entry -> package.json subpath -> CLI preloadedSkills array"

requirements-completed: [WF-01, WF-02]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 04 Plan 04: CLI Wiring Summary

**Wire sunco new and sunco scan into CLI via barrel exports, tsup entries, package.json subpaths, and preloadedSkills array**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T13:28:00Z
- **Completed:** 2026-03-28T13:30:01Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Both `sunco new` and `sunco scan` appear in `sunco --help` with correct descriptions
- Full workspace builds cleanly with `npx turbo build` (5 packages, no errors)
- All 572 tests pass across 57 test files (no regressions)
- Extended prompts barrel to export all 7 scan prompt builders that were deferred from plans 02/03

## Task Commits

Each task was committed atomically:

1. **Task 1: Update barrel exports, tsup config, package.json exports, and CLI wiring** - `2a1eb46` (feat)
2. **Task 2: Verify sunco new and sunco scan in CLI** - auto-approved (checkpoint:human-verify in auto mode)

## Files Created/Modified
- `packages/skills-workflow/src/index.ts` - Added newSkill, scanSkill barrel exports and prompt builder re-exports
- `packages/skills-workflow/tsup.config.ts` - Added new.skill.ts and scan.skill.ts entry points
- `packages/skills-workflow/package.json` - Added ./new and ./scan subpath exports
- `packages/skills-workflow/src/prompts/index.ts` - Extended barrel with 7 scan prompt builders
- `packages/cli/src/cli.ts` - Added newSkill and scanSkill imports and preloadedSkills entries

## Decisions Made
- Extended prompts barrel to include all 7 scan prompt builders (buildScanStackPrompt, buildScanArchitecturePrompt, etc.) that were deferred from plan 04-03's deviation. This completes the wiring.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended prompts barrel with scan prompt builders**
- **Found during:** Task 1 (barrel export update)
- **Issue:** Plan 04-03 noted that prompts/index.ts only exported research/synthesis/format-pre-scan. The 7 scan-*.ts prompt files from plan 04-02 were never added to the barrel.
- **Fix:** Added all 7 scan prompt builder exports to prompts/index.ts
- **Files modified:** packages/skills-workflow/src/prompts/index.ts
- **Verification:** Build succeeds, all imports resolve correctly
- **Committed in:** 2a1eb46 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary completion of deferred barrel exports. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all implementations are complete with no placeholder data.

## Next Phase Readiness
- Phase 04 is complete: all 4 plans executed, both agent-powered skills (new, scan) fully integrated
- CLI has 21 registered skills across 3 skill packages
- Ready for Phase 05 (context and planning)

---
*Phase: 04-project-initialization*
*Completed: 2026-03-28*
