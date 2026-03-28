---
phase: 01-core-platform
plan: 07
subsystem: ui
tags: [ink, react, interactive-choice, progress-bar, spinner, keyboard-nav, skill-lifecycle]

# Dependency graph
requires:
  - phase: 01-core-platform/04
    provides: "UI foundation -- theme tokens, primitives, components, adapter interfaces"
provides:
  - "4 lifecycle interaction patterns: SkillEntry, InteractiveChoice, SkillProgress, SkillResult"
  - "useSelection and useKeymap custom hooks for keyboard interaction"
  - "StatusBar session-level component for agent resource display"
  - "InkUiAdapter connected to pattern components via Ink render() API"
  - "16 behavioral tests for pattern contracts via SilentUiAdapter"
affects: [skill-execution, cli-runtime, agent-session]

# Tech tracking
tech-stack:
  added: [ink-select-input, ink-spinner]
  patterns: [layer-3-patterns, tty-fallback, dynamic-import-patterns, progress-handle-map]

key-files:
  created:
    - packages/core/src/ui/patterns/SkillEntry.tsx
    - packages/core/src/ui/patterns/InteractiveChoice.tsx
    - packages/core/src/ui/patterns/SkillProgress.tsx
    - packages/core/src/ui/patterns/SkillResult.tsx
    - packages/core/src/ui/patterns/index.ts
    - packages/core/src/ui/hooks/useSelection.ts
    - packages/core/src/ui/hooks/useKeymap.ts
    - packages/core/src/ui/hooks/index.ts
    - packages/core/src/ui/session/StatusBar.tsx
    - packages/core/src/ui/__tests__/patterns.test.ts
  modified:
    - packages/core/src/ui/adapters/InkUiAdapter.ts
    - packages/core/src/ui/index.ts
    - packages/core/src/index.ts
    - packages/core/package.json

key-decisions:
  - "Renamed SkillResult component export to SkillResultPattern in core index to avoid clash with SkillResult type from skill/types.ts"
  - "InkUiAdapter uses dynamic imports for pattern components to avoid circular dependency issues"
  - "TTY detection gates Ink rendering -- non-TTY falls back to console.log for CI/test environments"
  - "InkUiAdapter maintains activeProgress Map for progress handle update/dispose lifecycle"
  - "ink-select-input ItemProps only exposes isSelected+label, not value -- use label-to-option Map for badge rendering"

patterns-established:
  - "Layer 3 pattern: React components with onComplete/onSelect callbacks, mounted by adapter"
  - "TTY fallback: isTTY check before Ink render, console.log for non-interactive environments"
  - "Active progress Map: track rendered Ink instances by handleId for update/dispose"
  - "Dynamic imports in adapter: lazy-load pattern components to break import cycles"

requirements-completed: [UX-01, UX-02, UX-03]

# Metrics
duration: 10min
completed: 2026-03-28
---

# Phase 01 Plan 07: UI Interaction Patterns Summary

**4 Ink lifecycle patterns (entry/choice/progress/result) with keyboard hooks, connected to InkUiAdapter via Ink render() API, 16 behavioral tests passing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-28T03:48:10Z
- **Completed:** 2026-03-28T03:58:36Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Implemented all 4 lifecycle interaction patterns that map to skill state machine (idle -> entry -> choice? -> running -> result)
- InteractiveChoice renders options with Recommended badge via ink-select-input (UX-01)
- SkillProgress supports both determinate progress bar and indeterminate spinner via ink-spinner (UX-03)
- SkillResult displays recommendation cards when provided (UX-02)
- InkUiAdapter upgraded from console.log scaffold to full Ink render() with TTY fallback
- 16 behavioral tests verify the full pipeline: SkillUi -> createSkillUi bridge -> SilentUiAdapter
- StatusBar session component for agent resource monitoring (provider, tokens, context, cost)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement 4 lifecycle patterns, hooks, StatusBar** - `f7e9337` (feat)
2. **Task 2 (TDD RED): Add behavioral tests** - `6bb074d` (test)
3. **Task 2 (TDD GREEN): Connect InkUiAdapter to patterns** - `bc6cc4e` (feat)

_Note: Task 1 files were committed as part of f7e9337 by parallel agent execution. All files verified present and correct._

## Files Created/Modified
- `packages/core/src/ui/patterns/SkillEntry.tsx` - Entry banner at skill start, auto-completes
- `packages/core/src/ui/patterns/InteractiveChoice.tsx` - Multi-option selection with Recommended badge
- `packages/core/src/ui/patterns/SkillProgress.tsx` - Determinate bar + indeterminate spinner
- `packages/core/src/ui/patterns/SkillResult.tsx` - Result display with recommendation cards
- `packages/core/src/ui/patterns/index.ts` - Barrel exports for Layer 3 patterns
- `packages/core/src/ui/hooks/useSelection.ts` - Keyboard-driven list selection hook
- `packages/core/src/ui/hooks/useKeymap.ts` - Keyboard shortcut handler hook
- `packages/core/src/ui/hooks/index.ts` - Barrel exports for hooks
- `packages/core/src/ui/session/StatusBar.tsx` - Agent resource monitoring display
- `packages/core/src/ui/__tests__/patterns.test.ts` - 16 behavioral tests
- `packages/core/src/ui/adapters/InkUiAdapter.ts` - Full Ink render() integration
- `packages/core/src/ui/index.ts` - Added Layer 3, hooks, session exports
- `packages/core/src/index.ts` - Added pattern, hook, session exports to core barrel
- `packages/core/package.json` - Added ink-select-input, ink-spinner dependencies

## Decisions Made
- **SkillResultPattern rename:** Exported SkillResult component as `SkillResultPattern` from core index to avoid namespace collision with `SkillResult` type from skill/types.ts (both are foundational, but the type came first)
- **Dynamic imports in InkUiAdapter:** Pattern components are lazy-loaded via `await import()` to prevent circular dependency chains between adapter and pattern modules
- **TTY detection gating:** `process.stdout.isTTY` check before each Ink render call, with console.log fallback for non-interactive environments (CI, tests, piped output)
- **Label-to-option Map:** ink-select-input's ItemProps only exposes `isSelected` and `label` (not `value`), so InteractiveChoice uses a label-to-option Map for badge/description rendering in the custom itemComponent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing ink-select-input and ink-spinner dependencies**
- **Found during:** Task 1 (pattern implementation)
- **Issue:** ink-select-input and ink-spinner were listed in tech stack but not installed in packages/core
- **Fix:** `npm install --workspace=packages/core ink-select-input ink-spinner`
- **Files modified:** packages/core/package.json, package-lock.json
- **Verification:** Build succeeds, imports resolve
- **Committed in:** f7e9337

**2. [Rule 1 - Bug] Fixed SelectItem type import from ink-select-input**
- **Found during:** Task 1 (build verification)
- **Issue:** `Item` is exported as a value (component) from ink-select-input, not as a type. Using `type Item as SelectItem` caused DTS build error: "refers to a value, but is being used as a type"
- **Fix:** Defined local `SelectItem` interface matching ink-select-input's Item shape instead of importing the type
- **Files modified:** packages/core/src/ui/patterns/InteractiveChoice.tsx
- **Verification:** DTS build passes
- **Committed in:** f7e9337

**3. [Rule 1 - Bug] Fixed duplicate identifier SkillResult in core index**
- **Found during:** Task 1 (build after adding exports)
- **Issue:** `SkillResult` was already exported as a type from skill/types.ts; adding the React component export created TS2300 duplicate identifier
- **Fix:** Renamed UI component export to `SkillResultPattern` in core index.ts
- **Files modified:** packages/core/src/index.ts
- **Verification:** Build passes
- **Committed in:** 01ab1bb (via parallel agent)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for build correctness. No scope creep.

## Issues Encountered
- Parallel execution caused Task 1 files to be committed by the agent-06 commit (f7e9337) rather than in a separate 01-07 commit. All files verified present and correct in the repository.
- DTS build failed due to pre-existing issue in agent/providers/claude-sdk.ts (missing 'ai' and '@ai-sdk/anthropic' modules from agent-06). This is out of scope for Plan 07 -- ESM build and tests pass independently.

## Known Stubs
None. All patterns are fully implemented with real Ink rendering. InkUiAdapter connects to all 4 patterns with complete lifecycle management.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 lifecycle patterns ready for skills to use through ctx.ui (entry/ask/progress/result)
- Skills call ctx.ui methods which delegate through createSkillUi -> UiAdapter -> pattern components
- StatusBar ready for CLI runtime integration (not skill-accessible, managed by CLI layer)
- InkUiAdapter fully operational for interactive terminal sessions
- SilentUiAdapter verified for CI/test/batch mode

## Self-Check: PASSED

- All 11 created files exist on disk
- All 3 commit hashes (f7e9337, 6bb074d, bc6cc4e) found in git log
- 31 UI tests passing (16 new pattern tests + 15 existing adapter tests)

---
*Phase: 01-core-platform*
*Completed: 2026-03-28*
