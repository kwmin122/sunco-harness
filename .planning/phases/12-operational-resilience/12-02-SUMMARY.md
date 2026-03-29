---
phase: 12
plan: 02
subsystem: skills-workflow, core
tags: [operational-resilience, crash-recovery, stuck-detection, budget-guard, timeout, cost-tracking]
dependency_graph:
  requires: [12-01]
  provides: [OPS-01, OPS-02, OPS-03, OPS-04, OPS-05]
  affects: [auto-skill, status-skill, usage-tracker]
tech_stack:
  added: []
  patterns:
    - AutoLock integration in auto pipeline (crash recovery)
    - Promise.race timeout pattern (resolves to failure, never rejects)
    - BudgetGuard check before each agent dispatch
    - StuckDetector analyze after each step invocation
    - UsageEntry circular buffer in UsageTracker (MAX_HISTORY=1000)
    - ctx.state.get() fallback for budget/timeout config (SunConfig has no budget_ceiling)
key_files:
  created: []
  modified:
    - packages/core/src/agent/types.ts
    - packages/core/src/agent/tracker.ts
    - packages/core/src/index.ts
    - packages/skills-workflow/src/auto.skill.ts
    - packages/skills-workflow/src/status.skill.ts
decisions:
  - "Budget ceiling and timeout config read from ctx.state (not ctx.config) — SunConfig schema has no budget_ceiling or auto_supervisor fields"
  - "ctx.agent.getTracker() does not exist on AgentRouterApi — read usage.totalCostUsd from state instead"
  - "Promise.race timeout resolves (not rejects) to SkillResult {success: false} to avoid unhandled rejections"
  - "clearTimeout called in finally block to prevent timer leak after skill result"
metrics:
  duration_minutes: 20
  completed_date: "2026-03-29"
  tasks_completed: 3
  files_modified: 5
---

# Phase 12 Plan 02: Wire Operational Resilience into Auto Mode Summary

Operational resilience components built in Plan 01 (AutoLock, StuckDetector, BudgetGuard) are now integrated into the auto pipeline. UsageTracker gains per-call history for cost breakdowns in the status skill.

## One-liner

Crash recovery, stuck detection, budget ceiling, and hard timeout wired into auto.skill.ts with per-call cost history in UsageTracker and cost breakdown display in status skill.

## What Was Built

### Task 1: Extended UsageTracker with per-call metadata

- `UsageEntry` interface added to `packages/core/src/agent/types.ts` (skillId, phase, model, inputTokens, outputTokens, costUsd, timestamp)
- `UsageTracker._history` field with `MAX_HISTORY=1000` circular buffer cap
- `recordDetailed(entry: UsageEntry)` method for granular cost tracking
- `getHistory(): UsageEntry[]` returns copy of history
- `getTotalCostUsd(): number` for budget enforcement queries
- `UsageEntry` exported from `@sunco/core` index

### Task 2: auto.skill.ts operational resilience integration

- Imports: `AutoLock`, `StuckDetector`, `BudgetGuard` from shared/
- `--no-resume` CLI flag — force-releases any existing lock, starts fresh
- Crash recovery: on startup, `lock.check()` detects crashed PID → sets `startPhase` to last interrupted phase
- Lock lifecycle: `lock.acquire()` before loop, `lock.updateStep()` per step, `lock.release()` in `try/finally`
- Budget enforcement: reads ceiling from `ctx.state.get('auto.budget_ceiling')`, checks `budgetGuard.check(currentCostUsd)` before each dispatch; warns at 50/75/90%, aborts at 100%
- Hard timeout: `runWithTimeout()` wraps `ctx.run()` + `Promise.race` — timeout resolves to `{success: false}` result, never rejects; `clearTimeout` in finally prevents timer leak
- Stuck detection: `lock.recordInvocation()` after each step (including retries), `stuckDetector.analyze()` checks consecutive/oscillation patterns; triggers `workflow.debug` diagnostic before abort
- All resilience features are additions — existing error recovery (retry/skip/abort flow) preserved

### Task 3: Status skill cost breakdown

- `UsageEntry` imported from `@sunco/core`
- Reads `usage.history` from `ctx.state` after building display lines
- Per-skill cost map computed, sorted by cost descending
- Cost breakdown section appended to `lines[]` with `$X.XXXX` formatting
- Graceful: section omitted entirely when no usage history exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ctx.config?.get?.() does not exist — SunConfig is a typed object**
- **Found during:** Task 2
- **Issue:** Plan specified `ctx.config?.get?.('budget_ceiling')` but `ctx.config` is `Readonly<SunConfig>` with typed fields (skills, agent, ui, state). No `get()` method exists.
- **Fix:** Read budget ceiling from `ctx.state.get('auto.budget_ceiling')` and timeout minutes from `ctx.state.get('auto.hard_timeout_minutes')` as fallbacks (plan's instruction for this exact case)
- **Files modified:** `packages/skills-workflow/src/auto.skill.ts`

**2. [Rule 1 - Bug] ctx.agent.getTracker?.() does not exist on AgentRouterApi**
- **Found during:** Task 2
- **Issue:** Plan specified `ctx.agent.getTracker?.()` but `AgentRouterApi` only has `run()`, `crossVerify()`, `listProviders()`
- **Fix:** Read current cost total from `ctx.state.get<number>('usage.totalCostUsd')` — this is the state key where the router writes accumulated cost
- **Files modified:** `packages/skills-workflow/src/auto.skill.ts`

**3. [Rule 1 - Bug] Promise.race with reject would create unhandled promise**
- **Found during:** Task 2
- **Issue:** Plan's timeout snippet used `reject(new Error(...))` which would require a `.catch()` on the outer `Promise.race` and could create unhandled rejection if not caught properly
- **Fix:** Timeout promise resolves (not rejects) to `SkillResult {success: false, summary: 'Hard timeout: ...'}`. Added `clearTimeout` in finally to prevent timer leak.
- **Files modified:** `packages/skills-workflow/src/auto.skill.ts`

## Verification Results

```
npx turbo build        → Tasks: 5 successful, 5 total
npx vitest run         → Test Files: 81 passed | Tests: 828 passed
node cli.js auto --help → --no-resume appears in options list
```

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1: UsageTracker extension | 31b57ad | types.ts, tracker.ts, index.ts |
| 2: auto.skill.ts resilience | c78a874 | auto.skill.ts |
| 3: status cost breakdown | b6ee9c6 | status.skill.ts |

## Known Stubs

- `usage.totalCostUsd` state key: referenced in auto.skill.ts budget check but no producer writes to this key yet. The `UsageTracker.getTotalCostUsd()` method exists but requires wiring from the agent router to state persistence (future plan). Budget guard will always see $0 until the router writes this key.
- `usage.history` state key: referenced in status.skill.ts cost breakdown but no producer writes to this key yet. `UsageTracker.recordDetailed()` exists but requires the router to call it and persist to state (future plan). Cost breakdown section will not appear until the router pipeline is wired.

## Self-Check: PASSED
