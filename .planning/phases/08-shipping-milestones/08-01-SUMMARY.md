---
phase: 08-shipping-milestones
plan: 01
subsystem: workflow
tags: [semver, changelog, milestone, archive, prompt-builder, release-flow]

# Dependency graph
requires:
  - phase: 07-verification-pipeline
    provides: verify-types.ts VerifyVerdict contract for PR body builder
  - phase: 03-standalone-ts-skills
    provides: roadmap-writer addPhase for gap-phase generation
provides:
  - bumpVersion() and updateAllVersions() for release version management
  - generateChangelog(), parseGitLog(), prependChangelog() for CHANGELOG.md
  - archiveMilestone(), resetStateForNewMilestone(), parseMilestoneAudit(), buildGapPhases()
  - buildShipPrBody() for auto-generated ship PR bodies
  - buildMilestoneAuditPrompt() for agent-powered requirement audits
  - buildMilestoneSummaryPrompt() for milestone report generation
  - buildMilestoneNewPrompt() for new milestone planning synthesis
affects: [08-02-ship-skill, 08-03-milestone-skill, 08-04-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [vi.hoisted mock pattern for Vitest factory hoisting, copy-not-move archive pattern]

key-files:
  created:
    - packages/skills-workflow/src/shared/version-bumper.ts
    - packages/skills-workflow/src/shared/changelog-writer.ts
    - packages/skills-workflow/src/shared/milestone-helpers.ts
    - packages/skills-workflow/src/prompts/ship-pr-body.ts
    - packages/skills-workflow/src/prompts/milestone-audit.ts
    - packages/skills-workflow/src/prompts/milestone-summary.ts
    - packages/skills-workflow/src/prompts/milestone-new.ts
    - packages/skills-workflow/src/__tests__/version-bumper.test.ts
    - packages/skills-workflow/src/__tests__/changelog-writer.test.ts
  modified:
    - packages/skills-workflow/src/prompts/index.ts

key-decisions:
  - "vi.hoisted() for mock variable access in vi.mock factory (Vitest hoisting limitation)"
  - "No semver library -- simple split/increment for bumpVersion (zero-dep policy)"
  - "Copy-based archive with try/catch per artifact for missing file resilience"
  - "Requirement grouping by ID prefix for gap phase generation"

patterns-established:
  - "vi.hoisted pattern: use vi.hoisted(() => ({ mockFn: vi.fn() })) for mocks referenced in vi.mock factories"
  - "ChangelogEntry type: { type, description, hash } as standard changelog entry contract"

requirements-completed: [SHP-01, SHP-02, WF-03, WF-04, WF-05, WF-06, WF-07]

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 08 Plan 01: Shipping Milestones Infrastructure Summary

**Semver version bumper, conventional-commit changelog writer, milestone archive/audit helpers, and 4 prompt builders for ship/release/milestone skills**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T00:04:27Z
- **Completed:** 2026-03-29T00:09:59Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Version bumper with major/minor/patch increment and workspace-wide package.json updater
- Changelog writer with conventional commit parsing, type-grouped formatting, and CHANGELOG.md prepend
- Milestone helpers: archive without clobbering, state reset, audit parsing, gap-phase generation
- 4 prompt builders: ship PR body, milestone audit, milestone summary, milestone new
- 24 passing tests covering version-bumper and changelog-writer deterministic logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared utilities -- version-bumper, changelog-writer, milestone-helpers** - `9f63815` (test) + `66ba1bc` (feat)
2. **Task 2: Prompt builders for ship PR body, milestone audit, milestone summary, milestone new** - `8f5617a` (feat)

_Note: Task 1 followed TDD: RED commit (failing tests) then GREEN commit (implementation)_

## Files Created/Modified
- `packages/skills-workflow/src/shared/version-bumper.ts` - Semver bump + workspace version update via glob
- `packages/skills-workflow/src/shared/changelog-writer.ts` - Changelog generation, git log parsing, CHANGELOG.md prepend
- `packages/skills-workflow/src/shared/milestone-helpers.ts` - Archive, state reset, audit parse, gap-phase builder
- `packages/skills-workflow/src/prompts/ship-pr-body.ts` - Markdown PR body builder with verification status
- `packages/skills-workflow/src/prompts/milestone-audit.ts` - Agent prompt for requirement-vs-evidence audit
- `packages/skills-workflow/src/prompts/milestone-summary.ts` - Agent prompt for comprehensive milestone report
- `packages/skills-workflow/src/prompts/milestone-new.ts` - Agent prompt for new milestone planning synthesis
- `packages/skills-workflow/src/__tests__/version-bumper.test.ts` - 11 tests for bumpVersion + updateAllVersions
- `packages/skills-workflow/src/__tests__/changelog-writer.test.ts` - 13 tests for generateChangelog + parseGitLog + prependChangelog
- `packages/skills-workflow/src/prompts/index.ts` - Added 4 new prompt builder exports

## Decisions Made
- Used `vi.hoisted()` pattern for mock variables in vi.mock factories (Vitest 3.x hoisting limitation)
- No semver library dependency -- simple `split('.').map(Number)` increment for bumpVersion (zero-dep policy)
- Copy-based archive with per-artifact try/catch for resilience when optional files are missing
- Requirement ID prefix grouping (`AUTH-01` -> `AUTH` group) for logical gap-phase creation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock hoisting in version-bumper test**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** `vi.mock` factory referenced `mockReadFile`/`mockWriteFile` variables declared outside, but Vitest hoists `vi.mock` above variable declarations causing ReferenceError
- **Fix:** Switched to `vi.hoisted(() => ({ mockGlob, mockReadFile, mockWriteFile }))` pattern
- **Files modified:** `packages/skills-workflow/src/__tests__/version-bumper.test.ts`
- **Verification:** All 24 tests pass
- **Committed in:** 66ba1bc (part of GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor test infrastructure fix. No scope creep.

## Issues Encountered
None beyond the vi.mock hoisting issue handled above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared utilities and prompt builders ready for plans 02 (ship skill) and 03 (milestone skill)
- Plans 02/03 can directly import: bumpVersion, updateAllVersions, generateChangelog, parseGitLog, prependChangelog, archiveMilestone, resetStateForNewMilestone, parseMilestoneAudit, buildGapPhases
- All 4 prompt builders available via prompts barrel export

---
*Phase: 08-shipping-milestones*
*Completed: 2026-03-29*
