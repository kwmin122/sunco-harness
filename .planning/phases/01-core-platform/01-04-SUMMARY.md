---
phase: 01-core-platform
plan: 04
subsystem: ui
tags: [ink, react, jsx, tsx, ui-adapter, silent-adapter, theme-tokens]

# Dependency graph
requires:
  - phase: 01-core-platform/01-01b
    provides: "SkillUi, UiAdapter, UiPattern, UiOutcome interfaces and theme tokens"
provides:
  - "SunBox, SunText, Badge primitives (Layer 1 Ink wrappers)"
  - "StatusSymbol, ErrorBox, RecommendationCard components (Layer 2)"
  - "SilentUiAdapter for CI/test/--json mode"
  - "InkUiAdapter scaffold for interactive terminal"
  - "createSkillUi(adapter) bridge function"
  - "createUiAdapter(flags) factory function"
affects: [01-07, ui-patterns, skill-execution, cli-rendering]

# Tech tracking
tech-stack:
  added: [ink@6.8.0, react@19.1.0, "@types/react@19.1.2"]
  patterns: [react-jsx-transform, esbuild-jsx-automatic, theme-token-wrapper, adapter-pattern]

key-files:
  created:
    - packages/core/src/ui/primitives/Box.tsx
    - packages/core/src/ui/primitives/Text.tsx
    - packages/core/src/ui/primitives/Badge.tsx
    - packages/core/src/ui/primitives/index.ts
    - packages/core/src/ui/components/StatusSymbol.tsx
    - packages/core/src/ui/components/ErrorBox.tsx
    - packages/core/src/ui/components/RecommendationCard.tsx
    - packages/core/src/ui/components/index.ts
    - packages/core/src/ui/index.ts
    - packages/core/src/ui/adapters/SilentUiAdapter.ts
    - packages/core/src/ui/adapters/InkUiAdapter.ts
    - packages/core/src/ui/adapters/index.ts
    - packages/core/src/ui/__tests__/SilentUiAdapter.test.ts
  modified:
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/tsup.config.ts
    - packages/core/src/index.ts

key-decisions:
  - "Used Omit<InkBoxProps, 'padding' | 'gap'> to resolve type conflict between Ink's number props and theme token keys"
  - "Adapted RecommendationCard to use actual Recommendation type fields (skillId, isDefault) instead of plan's placeholder fields (command, recommended)"
  - "InkUiAdapter uses console.log scaffold -- full Ink rendering deferred to Plan 07 Layer 3"
  - "Configured esbuild jsx: 'automatic' in tsup for react-jsx transform support"

patterns-established:
  - "Layer 1 pattern: Ink primitive wrapper with theme token resolution (e.g., spacing='sm' -> 2)"
  - "Layer 2 pattern: Shared component using theme tokens directly (not via Layer 1 wrappers)"
  - "Adapter factory pattern: createUiAdapter(flags) selects implementation based on runtime flags"
  - "SkillUi bridge pattern: createSkillUi(adapter) wraps UiAdapter with unique handleId generation"

requirements-completed: [UX-03]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 01 Plan 04: UI Foundation Summary

**Ink primitive wrappers (SunBox/SunText/Badge), status/error/recommendation components, and SilentUiAdapter + InkUiAdapter scaffold with createSkillUi bridge and createUiAdapter factory**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T03:39:09Z
- **Completed:** 2026-03-28T03:44:52Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- Built Layer 1 UI primitives (SunBox, SunText, Badge) wrapping Ink with SUN theme tokens for consistent spacing and color
- Built Layer 2 shared components (StatusSymbol, ErrorBox, RecommendationCard) providing visual feedback patterns
- Implemented SilentUiAdapter for CI/test/--json mode that auto-selects default or first option for choices
- Implemented InkUiAdapter scaffold with console.log fallbacks (full Ink rendering in Plan 07)
- Created createSkillUi(adapter) bridge from UiAdapter to SkillUi intent API
- Created createUiAdapter(flags) factory with json/silent flag support
- All 15 unit tests pass, tsup build succeeds with JSX support

## Task Commits

Each task was committed atomically:

1. **Task 1: Create UI primitives and shared components** - `861775d` (feat) -- NOTE: committed alongside agent-02 due to parallel shared working directory
2. **Task 2: Implement adapters (TDD RED)** - `2644e33` (test)
3. **Task 2: Implement adapters (TDD GREEN)** - `7bb12c7` (feat)

## Files Created/Modified

- `packages/core/src/ui/primitives/Box.tsx` - SunBox: Ink Box wrapper with theme spacing tokens
- `packages/core/src/ui/primitives/Text.tsx` - SunText: Ink Text wrapper with theme color tokens
- `packages/core/src/ui/primitives/Badge.tsx` - Badge: inline label component for tags like "(Recommended)"
- `packages/core/src/ui/primitives/index.ts` - Barrel export for Layer 1 primitives
- `packages/core/src/ui/components/StatusSymbol.tsx` - Colored status icons (checkmark, cross, warning, info)
- `packages/core/src/ui/components/ErrorBox.tsx` - Bordered error display box with title/message
- `packages/core/src/ui/components/RecommendationCard.tsx` - Next-step recommendation list with badges
- `packages/core/src/ui/components/index.ts` - Barrel export for Layer 2 components
- `packages/core/src/ui/index.ts` - UI module barrel re-exporting all layers
- `packages/core/src/ui/adapters/SilentUiAdapter.ts` - No-op adapter for CI/test/--json
- `packages/core/src/ui/adapters/InkUiAdapter.ts` - Interactive adapter scaffold (console.log fallbacks)
- `packages/core/src/ui/adapters/index.ts` - createSkillUi bridge + createUiAdapter factory
- `packages/core/src/ui/__tests__/SilentUiAdapter.test.ts` - 15 tests for adapters and factories
- `packages/core/package.json` - Added ink@6.8.0, react@19.1.0, @types/react@19.1.2
- `packages/core/tsconfig.json` - Added jsx: react-jsx for TSX support
- `packages/core/tsup.config.ts` - Added esbuild jsx: automatic for JSX transform
- `packages/core/src/index.ts` - Added exports for primitives, components, adapters, factories

## Decisions Made

- **Omit pattern for type conflicts**: Used `Omit<InkBoxProps, 'padding' | 'gap'>` because Ink's BoxProps types `gap` as `number` while we need `keyof ThemeSpacing` (string token keys). The wrapper resolves tokens to numbers before passing to Ink.
- **Adapted Recommendation field names**: Plan referenced `rec.command` and `rec.recommended` but actual `Recommendation` type uses `rec.skillId` and `rec.isDefault`. Adapted to match the real types from Plan 01b.
- **esbuild jsx: automatic**: Chose `jsx: 'automatic'` in tsup esbuild options alongside `jsx: 'react-jsx'` in tsconfig for consistent React 19 JSX transform.
- **InkUiAdapter as scaffold**: Full Ink rendering deferred to Plan 07 (Layer 3 patterns). Current implementation uses console.log to verify the adapter interface contract works end-to-end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SunBoxProps type conflict with InkBoxProps**
- **Found during:** Task 1 (UI primitives)
- **Issue:** `extends InkBoxProps` with overridden `padding`/`gap` typed as `keyof ThemeSpacing` conflicted with Ink's `number` type
- **Fix:** Changed to `extends Omit<InkBoxProps, 'padding' | 'gap'>` so SUN's token-based types don't clash
- **Files modified:** packages/core/src/ui/primitives/Box.tsx
- **Verification:** tsup build succeeds with DTS generation
- **Committed in:** 861775d (Task 1 commit)

**2. [Rule 1 - Bug] Adapted RecommendationCard to actual Recommendation type**
- **Found during:** Task 1 (shared components)
- **Issue:** Plan used `rec.command` and `rec.recommended` but actual type has `rec.skillId` and `rec.isDefault`
- **Fix:** Used correct field names from the Recommendation interface defined in Plan 01b
- **Files modified:** packages/core/src/ui/components/RecommendationCard.tsx
- **Verification:** Build succeeds, type-checking passes
- **Committed in:** 861775d (Task 1 commit)

**3. [Rule 3 - Blocking] Task 1 files committed by parallel agent**
- **Found during:** Task 1 commit
- **Issue:** Parallel agent (01-02) picked up Task 1 files via `git add` race condition in shared working directory
- **Fix:** Verified committed content matches intended code exactly; proceeded without re-committing
- **Files modified:** none (already committed)
- **Verification:** `git show 861775d:packages/core/src/ui/primitives/Box.tsx` matches intended code
- **Committed in:** 861775d (shared with 01-02 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- Parallel execution race condition: another agent's `git add` inadvertently staged Task 1 files. This did not cause data loss since the working directory content was correct. For future runs, parallel agents on the same working directory should be aware of staging conflicts.

## Known Stubs

- `InkUiAdapter` uses `console.log` fallbacks instead of real Ink rendering -- intentional scaffold, wired in Plan 07 (Layer 3 interaction patterns)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UI Layers 1-2 complete with all primitives and components building and exporting
- SilentUiAdapter enables all future skill tests to run without terminal rendering
- InkUiAdapter scaffold ready for Plan 07 to connect real Ink components
- createSkillUi + createUiAdapter factories ready for skill context wiring

## Self-Check: PASSED

All 13 created files verified present. All 3 commit hashes (861775d, 2644e33, 7bb12c7) confirmed in git log.

---
*Phase: 01-core-platform*
*Completed: 2026-03-28*
