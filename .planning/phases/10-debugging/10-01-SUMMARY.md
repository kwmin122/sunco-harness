---
phase: 10-debugging
plan: 01
subsystem: workflow
tags: [debugging, diagnostics, vitest, tsc, eslint, prompt-builder]

# Dependency graph
requires:
  - phase: 07-verification-pipeline
    provides: verify-types.ts shared type contracts and prompt builder patterns
provides:
  - debug-types.ts shared types for all 3 debugging skills (diagnose/debug/forensics)
  - diagnose.skill.ts deterministic log parser (zero LLM cost)
  - debug-analyze.ts prompt builder for failure classification
  - forensics-postmortem.ts prompt builder for post-mortem analysis
affects: [10-debugging]

# Tech tracking
tech-stack:
  added: []
  patterns: [deterministic error parsing, vitest/tsc/eslint JSON parsing, failure classification taxonomy]

key-files:
  created:
    - packages/skills-workflow/src/shared/debug-types.ts
    - packages/skills-workflow/src/diagnose.skill.ts
    - packages/skills-workflow/src/prompts/debug-analyze.ts
    - packages/skills-workflow/src/prompts/forensics-postmortem.ts
    - packages/skills-workflow/src/__tests__/diagnose.skill.test.ts
  modified: []

key-decisions:
  - "Three-type failure classification: context_shortage, direction_error, structural_conflict"
  - "Diagnose skill as fully deterministic (kind: deterministic) with zero LLM cost"

patterns-established:
  - "Exported parser functions for testability: parseTestOutput, parseTypeErrors, parseLintErrors"
  - "Error capture from non-zero exit codes: execFile error object stdout/stderr extraction"
  - "MAX_CHARS = 50_000 truncation pattern reused from verify-security.ts"

requirements-completed: [DBG-02]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 10 Plan 01: Debugging Foundation Summary

**Shared debug types, deterministic vitest/tsc/eslint log parser, and debug+forensics prompt builders for agent-powered failure analysis**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T01:08:10Z
- **Completed:** 2026-03-29T01:13:01Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- debug-types.ts defines FailureType, DiagnoseError, DiagnoseResult, DebugAnalysis, ForensicsReport for all 3 debugging skills
- diagnose.skill.ts deterministically parses vitest JSON, tsc --pretty false, and eslint --format json into structured DiagnoseResult
- 8 unit tests covering all 3 parsers (positive and negative cases) plus skill metadata and integration
- Two prompt builders (debug-analyze.ts, forensics-postmortem.ts) following verify-security.ts pattern with MAX_CHARS truncation

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared debug types + diagnose skill with tests** - `0d505e5` (test), `ce40357` (feat) -- TDD: RED then GREEN
2. **Task 2: Debug and forensics prompt builders** - `70fbe28` (feat)

## Files Created/Modified
- `packages/skills-workflow/src/shared/debug-types.ts` - Shared types for diagnose/debug/forensics skills
- `packages/skills-workflow/src/diagnose.skill.ts` - Deterministic log analysis skill with 3 exported parsers
- `packages/skills-workflow/src/prompts/debug-analyze.ts` - Failure classification prompt builder for debug skill
- `packages/skills-workflow/src/prompts/forensics-postmortem.ts` - Post-mortem analysis prompt builder for forensics skill
- `packages/skills-workflow/src/__tests__/diagnose.skill.test.ts` - 8 tests for parsers and skill integration

## Decisions Made
- Three-type failure classification taxonomy: context_shortage (agent lacked info), direction_error (wrong approach), structural_conflict (architecture prevents change)
- diagnose.skill is fully deterministic (kind: 'deterministic') -- zero LLM cost, pure regex/JSON parsing
- Exported parser functions directly from skill module for unit testability (same pattern as coverage-parser.ts)
- Error capture pattern: non-zero exit codes from vitest/tsc/eslint caught via try/catch, stdout extracted from error object

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- debug-types.ts types are ready for Plan 02's agent-powered debug and forensics skills
- buildDebugAnalyzePrompt and buildForensicsPostmortemPrompt are ready for consumption by debug.skill.ts and forensics.skill.ts
- diagnose.skill.ts stores results via ctx.state.set('diagnose.lastResult') for cross-skill access

## Self-Check: PASSED

All 6 files verified present. All 3 commits verified in git log.

---
*Phase: 10-debugging*
*Completed: 2026-03-29*
