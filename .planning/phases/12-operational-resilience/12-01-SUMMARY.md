---
phase: 12-operational-resilience
plan: 01
subsystem: skills-workflow/shared
tags: [crash-recovery, stuck-detection, budget-guard, operational-resilience, unit-tests]
dependency_graph:
  requires: []
  provides: [AutoLock, StuckDetector, BudgetGuard]
  affects: [auto.skill.ts]
tech_stack:
  added: []
  patterns: [pure-utility-class, circular-buffer, signal-0-pid-check, pure-function-analyzer]
key_files:
  created:
    - packages/skills-workflow/src/shared/auto-lock.ts
    - packages/skills-workflow/src/shared/stuck-detector.ts
    - packages/skills-workflow/src/shared/budget-guard.ts
    - packages/skills-workflow/src/__tests__/auto-lock.test.ts
    - packages/skills-workflow/src/__tests__/stuck-detector.test.ts
    - packages/skills-workflow/src/__tests__/budget-guard.test.ts
  modified: []
decisions:
  - "AutoLock stores history in the same lock file (single source of truth) rather than a separate file"
  - "StuckDetector is stateless (pure function on history array) — state lives in AutoLock"
  - "BudgetGuard uses null ceilingUsd to represent no-ceiling (not 0 or Infinity) for clarity"
  - "StuckDetector.analyze() returns consecutiveFailures even when not stuck so callers can monitor progress"
metrics:
  duration: 12m
  completed: "2026-03-29T05:54:37Z"
  tasks: 3
  files_created: 6
  tests: 38
---

# Phase 12 Plan 01: Crash Recovery, Stuck Detection, and Budget Guard Summary

Three foundational operational-resilience modules implemented as pure utility classes with zero skill dependencies, all fully unit-tested.

## What Was Built

**AutoLock** — JSON lock file manager at `{sunDir}/auto.lock`. Provides acquire/release/check lifecycle with PID liveness detection via `process.kill(pid, 0)` (signal 0 = check exists, never kills). Maintains a skill invocation history capped at 20 entries (circular buffer) for StuckDetector consumption. All methods async with graceful ENOENT handling.

**StuckDetector** — Stateless analyzer for detecting two stuck patterns in invocation history: (1) same skill fails N consecutive times at the tail (default N=3), (2) two distinct skills alternate in failures four or more consecutive times (oscillation). Returns `consecutiveFailures` count even when not stuck so callers can track progression toward threshold.

**BudgetGuard** — Cost ceiling enforcer with five tiers: ok / warning_50 / warning_75 / warning_90 / exceeded. Handles null ceiling (no limit configured) by always returning ok. Static `fromConfig()` factory handles missing/zero/undefined budget_ceiling gracefully. All calculations are pure arithmetic — no state, no I/O.

## Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| AutoLock | 10 | All pass |
| StuckDetector | 11 | All pass |
| BudgetGuard | 17 | All pass |
| **Total** | **38** | **All pass** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StuckDetector consecutiveFailures not propagated on non-stuck path**

- **Found during:** Task 2 test run
- **Issue:** `analyze()` returned `consecutiveFailures: 0` for non-stuck results even when a partial streak existed, because the final fallthrough returned a hardcoded zero.
- **Fix:** Propagated `consecutiveResult.consecutiveFailures` in the final not-stuck return value so callers can monitor streak progress.
- **Files modified:** `packages/skills-workflow/src/shared/stuck-detector.ts`
- **Commit:** f6cfb9d (same commit as implementation)

## Known Stubs

None — all three modules are complete implementations with no placeholder data or TODO items.

## Self-Check: PASSED

- [x] `packages/skills-workflow/src/shared/auto-lock.ts` exists
- [x] `packages/skills-workflow/src/shared/stuck-detector.ts` exists
- [x] `packages/skills-workflow/src/shared/budget-guard.ts` exists
- [x] `packages/skills-workflow/src/__tests__/auto-lock.test.ts` exists
- [x] `packages/skills-workflow/src/__tests__/stuck-detector.test.ts` exists
- [x] `packages/skills-workflow/src/__tests__/budget-guard.test.ts` exists
- [x] Commit f6cfb9d exists
- [x] 38 tests pass, build succeeds
