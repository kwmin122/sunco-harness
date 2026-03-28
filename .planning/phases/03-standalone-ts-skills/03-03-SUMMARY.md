---
phase: 03-standalone-ts-skills
plan: 03
subsystem: workflow
tags: [skill, crud, state-api, file-store, todo, seed, backlog, note]

# Dependency graph
requires:
  - phase: 03-standalone-ts-skills
    provides: "skills-workflow package scaffold, shared types (TodoItem, SeedItem, BacklogItem)"
  - phase: 01-core-platform
    provides: "StateApi, FileStoreApi, defineSkill, SkillContext"
provides:
  - "note skill (workflow.note) -- timestamped markdown capture to notes/tribal"
  - "todo skill (workflow.todo) -- add/list/done CRUD with auto-incrementing IDs"
  - "seed skill (workflow.seed) -- idea capture with trigger conditions"
  - "backlog skill (workflow.backlog) -- parking lot CRUD with promote"
affects: [04-agent-init, 05-context-plan, recommender]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Positional args via ctx.args._ array for subcommand routing"
    - "Auto-increment ID pattern: state.get(namespace.nextId) ?? 1"
    - "CRUD skills: switch on first positional arg for subcommand dispatch"

key-files:
  created:
    - packages/skills-workflow/src/note.skill.ts
    - packages/skills-workflow/src/todo.skill.ts
    - packages/skills-workflow/src/seed.skill.ts
    - packages/skills-workflow/src/backlog.skill.ts
    - packages/skills-workflow/src/__tests__/todo.test.ts
    - packages/skills-workflow/src/__tests__/seed.test.ts
    - packages/skills-workflow/src/__tests__/backlog.test.ts
  modified:
    - packages/skills-workflow/src/index.ts
    - packages/skills-workflow/tsup.config.ts

key-decisions:
  - "Positional args via ctx.args._ for subcommand routing (add/list/done/promote)"
  - "Auto-increment ID with namespace.nextId counter pattern for all CRUD skills"
  - "Seed list detection: --list flag, 'list' subcommand, or empty positional args"

patterns-established:
  - "CRUD skill pattern: subcommand dispatch via positional args switch"
  - "Auto-increment ID pattern: get nextId from state, push item, set nextId+1"
  - "Consistent error handling: return { success: false, summary: 'message' } + ui.result"

requirements-completed: [IDX-01, IDX-02, IDX-03, IDX-04]

# Metrics
duration: 9min
completed: 2026-03-28
---

# Phase 03 Plan 03: Idea Capture Skills Summary

**4 CRUD skills (note, todo, seed, backlog) with 22 tests, all using StateApi/FileStore backends with auto-incrementing IDs**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-28T09:22:59Z
- **Completed:** 2026-03-28T09:32:11Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- note.skill writes timestamped markdown to .sun/notes/ or .sun/tribal/ via FileStore
- todo.skill provides add/list/done CRUD with auto-incrementing IDs via StateApi
- seed.skill captures ideas with trigger conditions for future recommender surfacing
- backlog.skill provides parking lot with promote workflow for idea graduation
- 22 new tests (8 todo + 6 seed + 8 backlog) all passing
- Build produces individual .js + .d.ts for each skill

## Task Commits

Each task was committed atomically:

1. **Task 1: note + todo skills with TDD** - `5c0e19e` (test), `77c6f52` (feat)
2. **Task 2: seed + backlog skills with TDD** - `ec50f30` (test), `c6b7732` (feat)

_TDD tasks have two commits: RED (failing tests) then GREEN (implementation)._

## Files Created/Modified
- `packages/skills-workflow/src/note.skill.ts` - Quick note capture to notes/ or tribal/
- `packages/skills-workflow/src/todo.skill.ts` - Task list with add/list/done and auto-increment IDs
- `packages/skills-workflow/src/seed.skill.ts` - Idea seeding with trigger conditions
- `packages/skills-workflow/src/backlog.skill.ts` - Parking lot CRUD with promote
- `packages/skills-workflow/src/__tests__/todo.test.ts` - 8 tests for todo CRUD
- `packages/skills-workflow/src/__tests__/seed.test.ts` - 6 tests for seed operations
- `packages/skills-workflow/src/__tests__/backlog.test.ts` - 8 tests for backlog CRUD
- `packages/skills-workflow/src/index.ts` - Barrel exports for all 4 skills
- `packages/skills-workflow/tsup.config.ts` - Build entries for individual skill bundling

## Decisions Made
- Positional args via ctx.args._ for subcommand routing (consistent with how Commander.js passes extra arguments through the skill system)
- Auto-increment ID with namespace.nextId counter pattern: simple, reliable, no collision risk for single-user CLI
- Seed list detection uses triple check (--list flag, 'list' subcommand, empty args) for maximum usability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- index.ts was being modified by parallel agents (other plans in wave 2). Each edit required re-reading the file to pick up concurrent changes. No data loss occurred.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 4 idea capture skills are production-ready with tests
- Skills use StateApi/FileStore backends consistently
- Trigger conditions on seeds ready for recommender integration (future phase)
- Backlog promote suggests adding as todo/phase -- actual integration deferred to agent-init phase

## Self-Check: PASSED

All 7 created files verified on disk. All 4 commit hashes confirmed in git log.

---
*Phase: 03-standalone-ts-skills*
*Completed: 2026-03-28*
