---
phase: 01-core-platform
plan: 08
subsystem: cli
tags: [commander, cli-engine, lifecycle, levenshtein, skill-router, subcommand, noop-recommender]

# Dependency graph
requires:
  - phase: 01-core-platform/02
    provides: "loadConfig() three-layer TOML config loader"
  - phase: 01-core-platform/03
    provides: "createStateEngine() SQLite + file store"
  - phase: 01-core-platform/05
    provides: "SkillRegistry, defineSkill, scanSkillFiles, resolveActiveSkills, createSkillContext"
  - phase: 01-core-platform/06
    provides: "createAgentRouter with provider-agnostic dispatch"
  - phase: 01-core-platform/07
    provides: "createUiAdapter, createSkillUi, InkUiAdapter"
provides:
  - "createProgram() Commander.js root program with sunco metadata"
  - "registerSkills() maps SkillRegistry to Commander.js subcommands"
  - "createLifecycle() with boot/createExecuteHook/teardown full subsystem wiring"
  - "createNoopRecommender() fallback for graceful recommender degradation"
  - "levenshtein() and findClosestCommand() for unknown command suggestions"
  - "CLI entry point (packages/cli/src/cli.ts) that wires everything together"
affects: [skill-packages, sun-terminal, harness-skills, workflow-skills]

# Tech tracking
tech-stack:
  added: []
  patterns: [lifecycle-factory, boot-execute-teardown, noop-fallback, levenshtein-suggestion, lazy-skill-execution]

key-files:
  created:
    - packages/core/src/cli/program.ts
    - packages/core/src/cli/skill-router.ts
    - packages/core/src/cli/lifecycle.ts
    - packages/core/src/cli/index.ts
    - packages/core/src/cli/__tests__/skill-router.test.ts
    - packages/core/src/cli/__tests__/lifecycle.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/cli/src/cli.ts

key-decisions:
  - "Levenshtein distance inline (~15 lines) instead of external dependency for unknown command suggestions"
  - "createNoopRecommender() returns empty array -- lifecycle boots regardless of recommender availability"
  - "Shebang managed by tsup banner config, not in source file (avoids duplicate shebang in dist)"
  - "Recommendation display uses skillUi.result() with Recommendation[] type directly"
  - "Usage persistence and recommendation failures are non-fatal (try/catch swallowed)"

patterns-established:
  - "Lifecycle Factory: createLifecycle() returns { boot, createExecuteHook, teardown } for full CLI subsystem wiring"
  - "Noop Fallback: dynamic import with try/catch for optional subsystems (recommender)"
  - "Lazy Execution: Commander.js subcommand actions call executeHook, skill module only loads on invocation"
  - "Boot Sequence: config -> sunDir -> state -> scan -> resolve -> registry -> agent -> UI -> recommender"

requirements-completed: [CLI-01, CLI-02, CLI-03, CLI-04, SKL-05]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 01 Plan 08: CLI Engine Summary

**Commander.js CLI with skill-to-subcommand routing, full lifecycle boot (config/state/skills/agent/UI/recommender), and Levenshtein-based unknown command suggestions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T04:02:51Z
- **Completed:** 2026-03-28T04:07:55Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Commander.js program with `sunco` metadata, version, sorted help, and `showHelpAfterError`
- Skill-to-subcommand router that maps SkillRegistry to Commander.js subcommands with lazy execution
- Full lifecycle boot wiring all 7 subsystems: config, state, skills, agent router, UI adapter, skill UI, and recommender
- Unknown command handler with Levenshtein distance suggestion (CLI-04)
- Graceful recommender degradation via createNoopRecommender() (dynamic import fallback)
- 27 tests covering program setup, skill registration, Levenshtein, lifecycle execution, recommendations, and error resilience

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Commander.js program and skill-to-subcommand router** - `37609d2` (feat)
2. **Task 2: Implement CLI lifecycle and wire entry point** - `7059701` (feat)

## Files Created/Modified
- `packages/core/src/cli/program.ts` - Commander.js program factory with Levenshtein suggestion
- `packages/core/src/cli/skill-router.ts` - Skill-to-subcommand registration with lazy execute hook
- `packages/core/src/cli/lifecycle.ts` - Full boot/execute/teardown lifecycle with noop recommender fallback
- `packages/core/src/cli/index.ts` - CLI module barrel exports
- `packages/core/src/cli/__tests__/skill-router.test.ts` - 17 tests for program, router, Levenshtein
- `packages/core/src/cli/__tests__/lifecycle.test.ts` - 10 tests for lifecycle, execute hook, teardown
- `packages/core/src/index.ts` - Added CLI engine and recommendation engine exports
- `packages/cli/src/cli.ts` - Rewired entry point using createProgram + createLifecycle

## Decisions Made
- **Inline Levenshtein:** Implemented ~15-line Levenshtein distance function inline instead of adding an external dependency. Threshold is max(floor(input.length/2)+1, 3) for reasonable suggestions.
- **Noop Recommender Fallback:** `createNoopRecommender()` returns empty arrays, enabling the lifecycle to boot regardless of whether the recommender engine (Plan 09) has been built yet. Uses dynamic import with try/catch.
- **Shebang Management:** Removed shebang from `cli.ts` source since tsup's `banner` config already injects it, preventing duplicate shebangs in the dist output.
- **Non-fatal Side Effects:** Usage persistence to state and recommendation retrieval are wrapped in try/catch -- failures do not crash skill execution.
- **Recommendation Display:** Uses `skillUi.result()` with `Recommendation[]` type directly (matching the SkillUi ResultInput interface), not a custom display.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate shebang in CLI dist output**
- **Found during:** Task 2 (wire entry point)
- **Issue:** Both the source file `cli.ts` and tsup's `banner` config injected `#!/usr/bin/env node`, causing a SyntaxError when running `node packages/cli/dist/cli.js`
- **Fix:** Removed the shebang line from `cli.ts` source, relying on tsup banner config
- **Files modified:** `packages/cli/src/cli.ts`
- **Verification:** `node packages/cli/dist/cli.js --help` runs successfully
- **Committed in:** `7059701` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for CLI binary to run. No scope creep.

## Issues Encountered
- DTS build fails due to pre-existing `ai` / `@ai-sdk/anthropic` module resolution errors in `claude-sdk.ts` (from Plan 06). This is out of scope for Plan 08 -- ESM JS build succeeds, and the CLI binary works correctly. Logged as known pre-existing issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CLI engine complete and functional: `sunco --help`, `sunco --version`, unknown command suggestions all work
- Lifecycle boots all subsystems and gracefully degrades when recommender not yet available
- Ready for skill packages to be created -- they will auto-register as subcommands via the skill scanner
- Plan 09 (Recommender Rules) and Plan 10 (Integration) can proceed

---
*Phase: 01-core-platform*
*Completed: 2026-03-28*
