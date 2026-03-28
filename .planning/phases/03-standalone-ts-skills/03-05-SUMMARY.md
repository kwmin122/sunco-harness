---
phase: 03-standalone-ts-skills
plan: 05
subsystem: workflow
tags: [phase-management, roadmap, cli-skill, deterministic, defineSkill]

# Dependency graph
requires:
  - phase: 03-01
    provides: "shared roadmap-parser, roadmap-writer, and types modules"
provides:
  - "phase.skill.ts with add/insert/remove subcommands for ROADMAP.md mutation"
  - "phaseSkill export from @sunco/skills-workflow"
  - "phase.skill.ts entry point in tsup build"
affects: [cli-integration, workflow-skills, roadmap-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subcommand routing pattern via positional args (ctx.args._)"
    - "kebabCase helper for directory slug generation"
    - "Phase number padding (padPhaseNumber) for directory naming"
    - "Dual validation: parseRoadmap for safety checks + removePhase for mutation"

key-files:
  created:
    - packages/skills-workflow/src/phase.skill.ts
    - packages/skills-workflow/src/__tests__/phase.test.ts
  modified:
    - packages/skills-workflow/src/index.ts
    - packages/skills-workflow/tsup.config.ts

key-decisions:
  - "Subcommand routing via ctx.args._ positional array instead of Commander subcommands"
  - "Description defaults to name for add/insert (user can edit ROADMAP.md later)"
  - "Dual safety check for remove: parseRoadmap progress table + removePhase completed checkbox"

patterns-established:
  - "Subcommand routing: switch on args._[0] for skills with sub-operations"
  - "Directory creation: padded number + kebab-case slug for .planning/phases/ dirs"

requirements-completed: [PHZ-01, PHZ-02, PHZ-03]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 03 Plan 05: Phase Management Skill Summary

**Phase skill with add (next sequential integer), insert (decimal numbering without renumber), and remove (safety check + renumber) subcommands mutating ROADMAP.md via shared writer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T09:23:36Z
- **Completed:** 2026-03-28T09:27:33Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments
- Phase skill with 3 subcommands (add, insert, remove) using shared roadmap-parser and roadmap-writer
- TDD flow: 18 failing tests written first, then implementation making all pass
- Build verified: phase.skill.ts produces separate 6.5KB ESM bundle via tsup multi-entry
- Safety checks: remove refuses completed/in-progress phases, insert uses decimal numbering without renumbering

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for phase skill** - `e599f2b` (test)
2. **Task 1 (GREEN): Implement phase skill** - `dc865d9` (feat)

_TDD task with RED (failing tests) and GREEN (implementation) commits_

## Files Created/Modified
- `packages/skills-workflow/src/phase.skill.ts` - Phase management skill with add/insert/remove subcommands
- `packages/skills-workflow/src/__tests__/phase.test.ts` - 18 tests covering all subcommands and edge cases
- `packages/skills-workflow/src/index.ts` - Added phaseSkill export
- `packages/skills-workflow/tsup.config.ts` - Added phase.skill.ts entry point

## Decisions Made
- Subcommand routing via `ctx.args._` positional array (matches pattern used by other multi-operation skills)
- Description defaults to the phase name for simplicity (user edits ROADMAP.md for details)
- Dual safety for remove: progress table plansComplete check + checkbox completed check provide defense in depth
- kebabCase helper inline (no external dependency for simple slug generation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Phase skill ready for CLI integration
- All workflow skills (status, progress, todo, note, pause, resume, phase) now available
- Shared roadmap-parser and roadmap-writer proven stable across multiple skill consumers

## Self-Check: PASSED

- [x] packages/skills-workflow/src/phase.skill.ts exists
- [x] packages/skills-workflow/src/__tests__/phase.test.ts exists
- [x] .planning/phases/03-standalone-ts-skills/03-05-SUMMARY.md exists
- [x] Commit e599f2b (test RED) found
- [x] Commit dc865d9 (feat GREEN) found
- [x] All 18 tests pass
- [x] Build produces phase.skill.js (6.51 KB)
- [x] All 7 acceptance criteria pass

---
*Phase: 03-standalone-ts-skills*
*Completed: 2026-03-28*
