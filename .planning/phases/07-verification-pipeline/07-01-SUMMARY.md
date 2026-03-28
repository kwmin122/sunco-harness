---
phase: 07-verification-pipeline
plan: 01
subsystem: verification
tags: [verify, coverage, prompts, expert-agents, tdd, digital-twin]

# Dependency graph
requires:
  - phase: 06-execution-review
    provides: review prompt builder pattern, review.ts as template
provides:
  - VerifyFinding, VerifyReport, LayerResult, VerifyVerdict types for verify skill
  - CoverageMetric, FileCoverage, CoverageReport types for validate skill
  - parseCoverageSummary for Istanbul json-summary parsing
  - 7 verify expert prompt builders (security, performance, architecture, correctness, coordinator, adversarial, intent)
  - 2 test-gen prompt builders (unit test generation, Digital Twin mock server)
affects: [07-02 verify skill, 07-03 validate skill, 07-04 test-gen skill]

# Tech tracking
tech-stack:
  added: []
  patterns: [expert-prompt-builder, coordinator-synthesis, adversarial-verification, intent-reconstruction]

key-files:
  created:
    - packages/skills-workflow/src/shared/verify-types.ts
    - packages/skills-workflow/src/shared/coverage-parser.ts
    - packages/skills-workflow/src/shared/__tests__/coverage-parser.test.ts
    - packages/skills-workflow/src/prompts/verify-security.ts
    - packages/skills-workflow/src/prompts/verify-performance.ts
    - packages/skills-workflow/src/prompts/verify-architecture.ts
    - packages/skills-workflow/src/prompts/verify-correctness.ts
    - packages/skills-workflow/src/prompts/verify-coordinator.ts
    - packages/skills-workflow/src/prompts/verify-adversarial.ts
    - packages/skills-workflow/src/prompts/verify-intent.ts
    - packages/skills-workflow/src/prompts/test-gen.ts
    - packages/skills-workflow/src/prompts/test-gen-mock.ts
  modified:
    - packages/skills-workflow/src/prompts/index.ts

key-decisions:
  - "verify-types.ts as single shared contract for all verification skills"
  - "Istanbul json-summary as coverage input format (Vitest compatible)"
  - "50,000 char diff truncation across all prompt builders"
  - "Coordinator uses PASS/WARN/FAIL verdict rules: critical=FAIL, 3+ high=FAIL, high=WARN, 5+ medium=WARN"

patterns-established:
  - "Expert prompt builder: pure function, diff truncation, JSON output instruction, severity guide"
  - "Coverage delta: current.pct - previous.pct for trend tracking"
  - "Adversarial verification: intent-first analysis, not code quality"

requirements-completed: [VRF-06, VRF-10]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 07 Plan 01: Verification Foundation Summary

**Verification types, 9 expert prompt builders, and Istanbul coverage parser with TDD -- shared foundation for verify/validate/test-gen skills**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T15:43:19Z
- **Completed:** 2026-03-28T15:48:50Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Shared type system (VerifyFinding, VerifyReport, LayerResult, VerifyVerdict, Coverage types) exported for all downstream skills
- Coverage parser with delta computation for trend tracking across snapshots
- 7 verification expert prompts covering all 5 layers of Swiss cheese verification model
- 2 test-gen prompts for unit test and Digital Twin mock server generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Verification types and coverage parser (TDD)**
   - `d4dc147` (test) -- RED: failing tests for coverage parser + verify types
   - `92579c7` (feat) -- GREEN: implement coverage parser, all 4 tests pass
2. **Task 2: Expert prompt builders (7 verify + 2 test-gen)** - `026095c` (feat)

## Files Created/Modified

- `packages/skills-workflow/src/shared/verify-types.ts` -- VerifyFinding, VerifyReport, LayerResult, VerifyVerdict, CoverageMetric, FileCoverage, CoverageReport types
- `packages/skills-workflow/src/shared/coverage-parser.ts` -- parseCoverageSummary for Istanbul json-summary format
- `packages/skills-workflow/src/shared/__tests__/coverage-parser.test.ts` -- 4 tests (full parse, uncovered detection, delta, minimal)
- `packages/skills-workflow/src/prompts/verify-security.ts` -- Security expert prompt (injection, auth, data exposure)
- `packages/skills-workflow/src/prompts/verify-performance.ts` -- Performance expert prompt (O(n^2), memory leaks, N+1)
- `packages/skills-workflow/src/prompts/verify-architecture.ts` -- Architecture expert prompt (coupling, layer breaches)
- `packages/skills-workflow/src/prompts/verify-correctness.ts` -- Correctness expert prompt (logic errors, edge cases)
- `packages/skills-workflow/src/prompts/verify-coordinator.ts` -- Coordinator synthesis prompt (dedup, verdict)
- `packages/skills-workflow/src/prompts/verify-adversarial.ts` -- Adversarial prompt (intent alignment)
- `packages/skills-workflow/src/prompts/verify-intent.ts` -- Intent reconstruction prompt (must-have checking)
- `packages/skills-workflow/src/prompts/test-gen.ts` -- Unit test generation prompt
- `packages/skills-workflow/src/prompts/test-gen-mock.ts` -- Digital Twin mock server prompt
- `packages/skills-workflow/src/prompts/index.ts` -- Barrel updated with 9 new exports

## Decisions Made

- verify-types.ts as single shared contract for all verification skills (not separate types per skill)
- Istanbul json-summary as coverage input format (Vitest compatible via --reporter=json-summary)
- 50,000 char diff truncation consistent with review.ts pattern
- Coordinator PASS/WARN/FAIL verdict rules: any critical or 3+ high = FAIL, any high or 5+ medium = WARN, else PASS

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- All types and prompt builders ready for verify skill (07-02), validate skill (07-03), and test-gen skill (07-04)
- No blockers or concerns

## Self-Check: PASSED

- All 13 files FOUND
- All 3 commits FOUND (d4dc147, 92579c7, 026095c)

---
*Phase: 07-verification-pipeline*
*Completed: 2026-03-28*
