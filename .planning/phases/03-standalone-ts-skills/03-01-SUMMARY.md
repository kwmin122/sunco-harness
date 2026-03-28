---
phase: 03-standalone-ts-skills
plan: 01
subsystem: workflow
tags: [roadmap-parser, state-reader, handoff, git-state, simple-git, zod, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-core-platform
    provides: "SkillContext, FileStoreApi, StateApi, config/state types"
provides:
  - "parseRoadmap() for ROADMAP.md structured parsing"
  - "addPhase/insertPhase/removePhase for roadmap mutation"
  - "parseStateMd() for STATE.md YAML frontmatter parsing"
  - "HandoffSchema + readHandoff/writeHandoff for session persistence"
  - "captureGitState() for branch/status capture"
  - "Shared types: ParsedPhase, ParsedProgress, ParsedState, GitState, TodoItem, SeedItem, BacklogItem"
affects: [03-02 status, 03-03 note/todo/seed, 03-04 pause/resume, 03-05 phase management, 03-06 settings/integration]

# Tech tracking
tech-stack:
  added: [simple-git@3.33.0, chalk@5.6.2, smol-toml@1.6.1, vitest@3.1.2]
  patterns: [regex-based markdown parsing, YAML frontmatter extraction without YAML library, Zod schema validation for file-based data, simple-git for git state capture with fallback]

key-files:
  created:
    - packages/skills-workflow/vitest.config.ts
    - packages/skills-workflow/src/shared/types.ts
    - packages/skills-workflow/src/shared/roadmap-parser.ts
    - packages/skills-workflow/src/shared/roadmap-writer.ts
    - packages/skills-workflow/src/shared/state-reader.ts
    - packages/skills-workflow/src/shared/handoff.ts
    - packages/skills-workflow/src/shared/git-state.ts
    - packages/skills-workflow/src/shared/__tests__/roadmap-parser.test.ts
    - packages/skills-workflow/src/shared/__tests__/roadmap-writer.test.ts
    - packages/skills-workflow/src/shared/__tests__/state-reader.test.ts
    - packages/skills-workflow/src/shared/__tests__/handoff.test.ts
  modified:
    - packages/skills-workflow/package.json
    - packages/skills-workflow/tsconfig.json
    - packages/skills-workflow/tsup.config.ts
    - packages/skills-workflow/src/index.ts

key-decisions:
  - "Regex-based ROADMAP.md parsing with separate phase list, detail sections, and progress table extractors"
  - "Manual YAML frontmatter parsing (simple key:value with one-level nesting) to avoid adding a YAML library dependency"
  - "Decimal phase numbers stored as string type (e.g. '2.1') while integer phases stored as number"
  - "Phase renumbering on remove covers phase list, detail headers, and progress table rows"
  - "HandoffSchema uses z.literal(1) for version field to enforce schema versioning"

patterns-established:
  - "TDD workflow: RED (failing tests) -> GREEN (implementation) -> verify in skills-workflow"
  - "Shared utility pattern: pure functions taking content strings, returning structured data"
  - "FileStoreApi mock pattern: createMockFileStore() with in-memory Record<string, string>"

requirements-completed: [SES-01, SES-03, SES-04, PHZ-01, PHZ-02, PHZ-03]

# Metrics
duration: 7min
completed: 2026-03-28
---

# Phase 03 Plan 01: Package Scaffold + Shared Utilities Summary

**Regex-based ROADMAP.md/STATE.md parsers, roadmap mutation (add/insert/remove with renumbering), HANDOFF.json Zod schema, and git-state capture -- 5 shared modules with 43 unit tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-28T09:12:53Z
- **Completed:** 2026-03-28T09:19:55Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- skills-workflow package scaffolded with build tooling (tsup ESM, vitest), dependencies (simple-git, chalk, smol-toml), and shared type definitions
- 5 shared utility modules implemented: roadmap-parser, roadmap-writer, state-reader, handoff, git-state
- 43 unit tests covering all shared modules via TDD (RED then GREEN)
- All types exported from barrel index.ts for downstream skill consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold skills-workflow package** - `d85ab61` (feat)
2. **Task 2: Implement shared utilities with TDD** - `81ddd64` (feat)

## Files Created/Modified
- `packages/skills-workflow/package.json` - Added simple-git, chalk, smol-toml, vitest deps
- `packages/skills-workflow/tsconfig.json` - Added types:["node"] for DTS compatibility
- `packages/skills-workflow/tsup.config.ts` - Added external deps (core, simple-git)
- `packages/skills-workflow/vitest.config.ts` - Test config matching skills-harness pattern
- `packages/skills-workflow/src/shared/types.ts` - ParsedPhase, ParsedProgress, ParsedState, GitState, TodoItem, SeedItem, BacklogItem
- `packages/skills-workflow/src/shared/roadmap-parser.ts` - parseRoadmap() extracts phases, details, progress from ROADMAP.md
- `packages/skills-workflow/src/shared/roadmap-writer.ts` - addPhase, insertPhase (decimal), removePhase with renumbering
- `packages/skills-workflow/src/shared/state-reader.ts` - parseStateMd() extracts YAML frontmatter without YAML library
- `packages/skills-workflow/src/shared/handoff.ts` - HandoffSchema Zod schema + readHandoff/writeHandoff via FileStoreApi
- `packages/skills-workflow/src/shared/git-state.ts` - captureGitState() via simple-git with fallback
- `packages/skills-workflow/src/index.ts` - Barrel exports for all types and utilities
- `packages/skills-workflow/src/shared/__tests__/roadmap-parser.test.ts` - 12 tests for phase/progress parsing
- `packages/skills-workflow/src/shared/__tests__/roadmap-writer.test.ts` - 13 tests for add/insert/remove
- `packages/skills-workflow/src/shared/__tests__/state-reader.test.ts` - 8 tests for STATE.md parsing
- `packages/skills-workflow/src/shared/__tests__/handoff.test.ts` - 10 tests for schema validation and read/write

## Decisions Made
- Regex-based ROADMAP.md parsing with separate extractors for phase list, detail sections, and progress table -- no markdown AST library needed for the structured format used
- Manual YAML frontmatter parsing (key:value with one-level nesting) instead of adding a YAML library -- STATE.md format is simple enough
- Decimal phase numbers stored as string type ('2.1') while integer phases stored as number -- preserves exact decimal representation
- Phase renumbering on remove covers all three locations: phase list (**Phase N:**), detail headers (### Phase N:), and progress table rows (| N. Name |)
- HandoffSchema version field uses z.literal(1) for strict schema versioning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed phase renumbering missing detail section headers**
- **Found during:** Task 2 (roadmap-writer implementation)
- **Issue:** renumberPhases() only matched `**Phase N:` but not `### Phase N:` headers in detail sections
- **Fix:** Added `### Phase N:` pattern to renumbering regex collection
- **Files modified:** packages/skills-workflow/src/shared/roadmap-writer.ts
- **Verification:** removePhase renumber test passes
- **Committed in:** 81ddd64 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 shared utility modules are tested and exported, ready for consumption by plans 03-02 through 03-06
- parseRoadmap and roadmap-writer ready for `sunco phase` management (03-05)
- parseStateMd and handoff ready for `sunco status/pause/resume` (03-02, 03-04)
- captureGitState ready for session state capture (03-04)
- Build produces dist/ with type declarations for downstream package imports

## Self-Check: PASSED

- All 11 created files verified present
- Commit d85ab61 (Task 1) verified in git log
- Commit 81ddd64 (Task 2) verified in git log

---
*Phase: 03-standalone-ts-skills*
*Completed: 2026-03-28*
