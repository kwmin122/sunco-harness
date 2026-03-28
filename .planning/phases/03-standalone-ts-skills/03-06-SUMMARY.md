---
phase: 03-standalone-ts-skills
plan: 06
subsystem: config, cli
tags: [toml, smol-toml, settings, write-back, cli-integration, skill-wiring]

# Dependency graph
requires:
  - phase: 01-core-platform
    provides: "defineSkill, loadConfig, TOML config loader, SkillContext"
  - phase: 02-harness-skills
    provides: "Phase 2 harness skills (init, lint, health, agents, guard, sample-prompt)"
  - phase: 03-standalone-ts-skills (plans 01-05)
    provides: "11 workflow skills (status, progress, next, context, note, todo, seed, backlog, pause, resume, phase)"
provides:
  - "Enhanced settings skill with --set and --global TOML write-back"
  - "All Phase 3 skills wired into CLI entry point (18 total skills)"
  - "Per-skill export entries in skills-workflow package.json"
affects: [04-agent-init, cli-packaging, settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "smol-toml parse+stringify for round-trip TOML write-back"
    - "parseValueType auto-detection (boolean/number/string) for CLI config mutation"
    - "setNestedKey dot-path navigation for nested config writes"
    - "Workflow skill alias pattern (workflowSettingsSkill replaces harness settingsSkill)"

key-files:
  created:
    - "packages/skills-workflow/src/settings.skill.ts"
    - "packages/skills-workflow/src/__tests__/settings-writer.test.ts"
  modified:
    - "packages/skills-workflow/src/index.ts"
    - "packages/skills-workflow/tsup.config.ts"
    - "packages/skills-workflow/package.json"
    - "packages/cli/src/cli.ts"
    - "packages/cli/package.json"
    - "packages/cli/tsup.config.ts"
    - "packages/skills-harness/src/index.ts"

key-decisions:
  - "Enhanced settings in skills-workflow replaces harness version (same id core.settings)"
  - "Helper functions exported with _ prefix for testability (_parseValueType, _setNestedKey)"
  - "smol-toml for round-trip TOML safety (parse existing, modify, stringify back)"
  - "Phase skill was missing from index.ts/tsup -- added as Rule 3 auto-fix"

patterns-established:
  - "Skill replacement pattern: same id in new package, remove export from old package"
  - "Config write-back pattern: readFile -> parseToml -> modify -> stringifyToml -> writeFile"

requirements-completed: [SET-01]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 03 Plan 06: Settings Write-Back and Full Phase 3 CLI Integration Summary

**Enhanced settings with TOML write-back (--set/--global) and all 18 skills (6 harness + 12 workflow) wired into the CLI entry point**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T09:35:41Z
- **Completed:** 2026-03-28T09:40:53Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Enhanced settings skill with `--set key=value` write-back via smol-toml parse/stringify round-trip
- `--global` flag for writing to `~/.sun/config.toml` vs project-level `.sun/config.toml`
- Auto-detection of value types: "true"->boolean, "60000"->number, "hello"->string
- All 12 Phase 3 workflow skills imported into CLI (replacing harness settings with enhanced version)
- Full monorepo build and test suite passing (259 tests)
- sunco --help lists all 18 registered commands

## Task Commits

Each task was committed atomically:

1. **Task 1a: Failing tests (TDD RED)** - `368fa4f` (test)
2. **Task 1b: Enhanced settings implementation (TDD GREEN)** - `c898a9b` (feat)
3. **Task 2: Wire all Phase 3 skills into CLI** - `002d749` (feat)

_Note: TDD task had separate test and feat commits_

## Files Created/Modified
- `packages/skills-workflow/src/settings.skill.ts` - Enhanced settings with --set/--global write-back
- `packages/skills-workflow/src/__tests__/settings-writer.test.ts` - 14 tests for write-back functionality
- `packages/skills-workflow/src/index.ts` - Added phaseSkill and settingsSkill exports
- `packages/skills-workflow/tsup.config.ts` - Added phase.skill.ts and settings.skill.ts entries
- `packages/skills-workflow/package.json` - Per-skill export entries for all 12 skills
- `packages/cli/src/cli.ts` - Import all 12 workflow skills, remove harness settings
- `packages/cli/package.json` - Added @sunco/skills-workflow dependency
- `packages/cli/tsup.config.ts` - Added @sunco/skills-workflow to noExternal, simple-git to external
- `packages/skills-harness/src/index.ts` - Removed settingsSkill export (moved to workflow)

## Decisions Made
- Enhanced settings in skills-workflow replaces harness version using same id `core.settings`, so the skill registry deduplicates correctly
- Helper functions (`_parseValueType`, `_setNestedKey`) exported with `_` prefix convention for testing while signaling they are module-private by convention
- smol-toml `parse()` + `stringify()` ensures round-trip TOML safety (preserves valid TOML structure after modification)
- `mkdir` with `recursive: true` before `writeFile` ensures `.sun/` directory exists for first-time writes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing phaseSkill to index.ts and tsup.config.ts**
- **Found during:** Task 2 (CLI wiring)
- **Issue:** phase.skill.ts existed but was not exported from index.ts or listed in tsup.config.ts entry array
- **Fix:** Added `export { default as phaseSkill } from './phase.skill.js'` to index.ts and `'src/phase.skill.ts'` to tsup entry
- **Files modified:** packages/skills-workflow/src/index.ts, packages/skills-workflow/tsup.config.ts
- **Verification:** Build passes, phaseSkill appears in CLI --help
- **Committed in:** 002d749 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for completeness -- phase skill would not have been accessible via CLI without this fix.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 3 skills complete and integrated into CLI
- 18 total skills registered (6 harness + 12 workflow)
- Full monorepo build and test suite green
- Ready for Phase 4 (agent-init) which builds on this skill foundation

## Self-Check: PASSED

All 9 files verified present. All 3 task commits verified in git log.

---
*Phase: 03-standalone-ts-skills*
*Completed: 2026-03-28*
