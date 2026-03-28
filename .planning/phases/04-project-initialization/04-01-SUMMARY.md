---
phase: 04-project-initialization
plan: 01
subsystem: ui, workflow
tags: [ink-text-input, askText, ecosystem-detection, pre-scan, planning-writer]

# Dependency graph
requires:
  - phase: 01-core-platform
    provides: "SkillUi/UiAdapter two-layer UI contract, InkUiAdapter, SilentUiAdapter"
  - phase: 02-harness-skills
    provides: "detectEcosystems() and EcosystemResult types"
provides:
  - "askText() method on SkillUi interface with AskTextInput/UiTextResult types"
  - "askText pattern kind in UiAdapter layer"
  - "InkUiAdapter askText rendering via ink-text-input"
  - "SilentUiAdapter askText non-interactive fallback"
  - "detectEcosystems barrel export from @sunco/skills-harness"
  - "buildPreScanContext() shared utility for sunco scan"
  - "writePlanningArtifact() shared utility for sunco new"
affects: [04-02-sunco-new, 04-03-sunco-scan, 05-context-plan]

# Tech tracking
tech-stack:
  added: [ink-text-input@6.0.0, glob@13.0.6 (skills-workflow)]
  patterns: [askText UiPattern kind extension, path traversal guard for file writes]

key-files:
  created:
    - packages/core/src/ui/__tests__/askText.test.ts
    - packages/skills-workflow/src/shared/pre-scan.ts
    - packages/skills-workflow/src/shared/planning-writer.ts
  modified:
    - packages/core/src/ui/adapters/SkillUi.ts
    - packages/core/src/ui/adapters/UiAdapter.ts
    - packages/core/src/ui/adapters/InkUiAdapter.ts
    - packages/core/src/ui/adapters/SilentUiAdapter.ts
    - packages/core/src/ui/adapters/index.ts
    - packages/skills-harness/src/index.ts
    - packages/skills-workflow/package.json

key-decisions:
  - "ink-text-input@6.0.0 for Ink-compatible freeform text input rendering"
  - "askText non-TTY fallback returns source 'default' (InkUiAdapter) vs 'noninteractive' (SilentUiAdapter) to distinguish adapter context"
  - "Pre-scan file tree capped at 500 entries with maxDepth 4 to limit token cost"
  - "Planning writer uses node:fs/promises directly (FileStore is .sun/-scoped only)"

patterns-established:
  - "UiPatternKind extension: add new kind string, handle in both adapters and bridge"
  - "Path traversal guard: resolve + relative boundary check before file write"

requirements-completed: [WF-01, WF-02]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 04 Plan 01: Shared Infrastructure Summary

**askText() UI pattern with ink-text-input, detectEcosystems barrel export, pre-scan context builder, and planning artifact writer for sunco new/scan**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T10:11:11Z
- **Completed:** 2026-03-28T10:16:09Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Extended SkillUi with askText() supporting freeform text input through the full adapter chain
- Exported detectEcosystems from @sunco/skills-harness barrel for direct import by downstream packages
- Created buildPreScanContext() utility gathering ecosystem, file tree, and key files for sunco scan
- Created writePlanningArtifact() utility with path traversal guard for safe .planning/ file writes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add askText() to SkillUi, UiAdapter, both adapters, and bridge (TDD)**
   - `841c6b4` (test: add failing tests for askText UI pattern)
   - `6da21a4` (feat: add askText() UI pattern to SkillUi, adapters, and bridge)
2. **Task 2: Export detectEcosystems + create pre-scan and planning-writer utilities** - `6e2f1d6` (feat)

_Note: Task 1 used TDD with RED and GREEN commits._

## Files Created/Modified
- `packages/core/src/ui/adapters/SkillUi.ts` - Added AskTextInput, UiTextResult types and askText() method
- `packages/core/src/ui/adapters/UiAdapter.ts` - Extended UiPatternKind with 'askText'
- `packages/core/src/ui/adapters/InkUiAdapter.ts` - Added renderAskText with ink-text-input TTY rendering + non-TTY fallback
- `packages/core/src/ui/adapters/SilentUiAdapter.ts` - Added askText case returning defaultValue with source 'noninteractive'
- `packages/core/src/ui/adapters/index.ts` - Added askText bridge delegation and AskTextInput/UiTextResult re-exports
- `packages/core/src/ui/__tests__/askText.test.ts` - 4 tests covering SilentUiAdapter, bridge, and InkUiAdapter non-TTY
- `packages/skills-harness/src/index.ts` - Added detectEcosystems value re-export
- `packages/skills-workflow/src/shared/pre-scan.ts` - buildPreScanContext() for sunco scan
- `packages/skills-workflow/src/shared/planning-writer.ts` - writePlanningArtifact() for sunco new
- `packages/skills-workflow/package.json` - Added @sunco/skills-harness and glob dependencies
- `packages/core/package.json` - Added ink-text-input@6.0.0
- `package-lock.json` - Updated lockfile

## Decisions Made
- Used ink-text-input@6.0.0 for Ink-compatible freeform text input rendering in TTY mode
- askText non-TTY fallback uses source 'default' in InkUiAdapter vs 'noninteractive' in SilentUiAdapter to distinguish adapter context
- Pre-scan file tree capped at 500 entries with maxDepth 4 to limit token cost when fed to agents
- Planning writer uses node:fs/promises directly since FileStore is .sun/-scoped only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all implementations are complete with no placeholder data.

## Next Phase Readiness
- askText() infrastructure ready for sunco new and sunco scan interactive prompts
- detectEcosystems importable from @sunco/skills-harness for pre-scan usage
- buildPreScanContext() and writePlanningArtifact() available in skills-workflow shared/
- Plans 02 (sunco new) and 03 (sunco scan) can build independently using this infrastructure

## Self-Check: PASSED

All 9 files verified present. All 3 commits verified in git log.

---
*Phase: 04-project-initialization*
*Completed: 2026-03-28*
