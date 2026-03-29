---
phase: 08-shipping-milestones
plan: 02
subsystem: workflow
tags: [ship, release, pr-creation, gh-cli, version-bump, changelog, git-tag, npm-publish]

# Dependency graph
requires:
  - phase: 08-shipping-milestones
    provides: version-bumper, changelog-writer, ship-pr-body prompt builder (plan 08-01)
  - phase: 07-verification-pipeline
    provides: verify-types.ts VerifyReport/VerifyVerdict for verify pre-check
provides:
  - ship.skill.ts: verify pre-check + gh CLI PR creation with fallback
  - release.skill.ts: deterministic version bump + changelog + tag + publish pipeline
affects: [08-03-milestone-skill, 08-04-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [vi.hoisted + vi.doMock for dynamic import mocking in TDD, Commander.js camelCase flag normalization]

key-files:
  created:
    - packages/skills-workflow/src/ship.skill.ts
    - packages/skills-workflow/src/release.skill.ts
    - packages/skills-workflow/src/__tests__/ship.test.ts
    - packages/skills-workflow/src/__tests__/release.test.ts
  modified: []

key-decisions:
  - "Ship skill kind=prompt (needs agent for verify pre-check via ctx.run)"
  - "Release skill kind=deterministic (no agent calls, pure pipeline)"
  - "Dynamic import for execa in both skills to handle missing dependency gracefully"
  - "Commander.js dual flag check (ctx.args['skip-verify'] || ctx.args.skipVerify) for camelCase normalization"

patterns-established:
  - "vi.hoisted + vi.doMock pattern for testing dynamic imports (execa in ship/release)"
  - "Graceful gh CLI fallback: check auth status first, return manual instructions on failure"

requirements-completed: [SHP-01, SHP-02]

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 08 Plan 02: Ship and Release Skills Summary

**Ship skill with verify pre-check and gh CLI PR creation, release skill with deterministic version bump, changelog, tagging, and npm publish pipeline**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T00:12:38Z
- **Completed:** 2026-03-29T00:18:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Ship skill with 5-layer verification pre-check that blocks on failure, gh CLI PR creation with auto-generated body, and graceful manual fallback
- Release skill with deterministic pipeline: dirty tree guard, semver bump across all workspace packages, CHANGELOG.md generation from git log, annotated git tag with conflict detection, optional npm publish
- 23 passing tests covering all behavior cases (9 ship + 14 release)
- Both skills follow established patterns: ctx.ui.entry/progress/result, defineSkill, proper options

## Task Commits

Each task was committed atomically:

1. **Task 1: Ship skill -- PR creation with verification pre-check and gh CLI fallback** - `2744ac5` (test) + `b2ab4aa` (feat)
2. **Task 2: Release skill -- version bump, changelog, git tag, npm publish** - `c6949ec` (test) + `870414c` (feat)

_Note: Both tasks followed TDD: RED commit (failing tests) then GREEN commit (implementation)_

## Files Created/Modified
- `packages/skills-workflow/src/ship.skill.ts` - Ship skill with verify gate, branch creation, push, gh CLI PR creation
- `packages/skills-workflow/src/release.skill.ts` - Release skill with dirty tree check, version bump, changelog, tag, publish
- `packages/skills-workflow/src/__tests__/ship.test.ts` - 9 tests covering verify pass/fail, skip-verify, gh fallback, draft, branch creation
- `packages/skills-workflow/src/__tests__/release.test.ts` - 14 tests covering bump types, dirty tree, dry-run, skip-publish, tag conflict

## Decisions Made
- Ship skill uses `kind: 'prompt'` because it calls `ctx.run('workflow.verify')` which needs agent access
- Release skill uses `kind: 'deterministic'` because it's a pure pipeline with no agent calls
- Dynamic `import('execa')` for both skills -- handles missing dependency gracefully
- Commander.js dual flag check pattern for camelCase normalization (`ctx.args['skip-verify'] || ctx.args.skipVerify`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ship and release skills ready for integration in plan 08-04
- Plan 08-03 (milestone skill) can import from shared utilities already available
- All 4 shipping skills infrastructure (version-bumper, changelog-writer, milestone-helpers, ship-pr-body) confirmed working via tests

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 08-shipping-milestones*
*Completed: 2026-03-29*
