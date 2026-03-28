---
phase: 01-core-platform
plan: 11
subsystem: agent
tags: [claude-cli, claude-sdk, agent-router, provider-wiring, lifecycle]

# Dependency graph
requires:
  - phase: 01-core-platform (plans 06, 07)
    provides: AgentRouter, ClaudeCliProvider, ClaudeSdkProvider classes
provides:
  - Provider instantiation and registration in CLI boot sequence
  - Dynamic provider discovery (isAvailable checks) during lifecycle boot
  - Phase 1 Success Criterion 3 gap closure
affects: [skills that use ctx.agent.run(), sample-prompt, future agent-dependent skills]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Parallel async provider discovery via Promise.all in boot sequence"]

key-files:
  created: []
  modified:
    - packages/core/src/cli/lifecycle.ts
    - packages/core/src/cli/__tests__/lifecycle.test.ts

key-decisions:
  - "Parallel provider availability checks via Promise.all for minimal boot latency (~10ms total)"
  - "Conditional provider registration: only available providers passed to createAgentRouter"

patterns-established:
  - "Provider discovery pattern: instantiate -> isAvailable() -> conditionally register"

requirements-completed: [SKL-05, AGT-01, AGT-02]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 01 Plan 11: Agent Provider Wiring Summary

**Wire ClaudeCliProvider and ClaudeSdkProvider into CLI boot sequence with parallel availability detection, closing the last Phase 1 verification gap**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T07:01:49Z
- **Completed:** 2026-03-28T07:04:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced empty `providers: []` placeholder in lifecycle.ts with dynamic provider discovery
- Both ClaudeCliProvider (checks `which claude`) and ClaudeSdkProvider (checks ANTHROPIC_API_KEY + package imports) are instantiated and availability-checked in parallel during boot
- Only available providers are passed to createAgentRouter, enabling graceful degradation (zero providers = no crash)
- All 293 tests pass with zero regressions
- Full turbo build succeeds across all 5 packages
- Phase 1 Success Criterion 3 is now unblocked: prompt skills can dispatch to available providers via ctx.agent.run()

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing test for provider discovery** - `d1c966e` (test)
2. **Task 1 (GREEN): Wire providers in lifecycle.ts boot** - `0f392ee` (feat)
3. **Task 2: Verify end-to-end build and test** - verification only, no code changes

_TDD task: RED commit (failing test) followed by GREEN commit (implementation)_

## Files Created/Modified
- `packages/core/src/cli/lifecycle.ts` - Added ClaudeCliProvider/ClaudeSdkProvider imports, parallel isAvailable() checks, conditional provider registration in boot Step 7
- `packages/core/src/cli/__tests__/lifecycle.test.ts` - Added "Provider discovery" describe block with 2 tests verifying provider importability and lifecycle source wiring

## Decisions Made
- Parallel availability checks via Promise.all for minimal boot latency (CLI ~5ms, SDK ~10ms run concurrently)
- Conditional provider registration: only providers returning true from isAvailable() are passed to the router
- Type annotation via inline import() for AgentProvider[] to avoid adding another top-level import

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 12 plans in Phase 01 are complete
- Phase 1 core platform is fully wired: config, state, skills, agent router (with providers), UI adapter, recommender
- Ready for Phase 1 verification and subsequent phases

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 01-core-platform*
*Completed: 2026-03-28*
