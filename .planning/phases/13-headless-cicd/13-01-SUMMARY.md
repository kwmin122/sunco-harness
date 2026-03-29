---
phase: 13-headless-cicd
plan: 01
subsystem: cli
tags: [headless, ci-cd, query, deterministic, silent-adapter, exit-codes]

requires:
  - phase: 10-debugging
    provides: skill architecture patterns (defineSkill, SkillContext, SilentUiAdapter)
  - phase: 03-standalone-ts-skills
    provides: state-reader and roadmap-parser shared utilities

provides:
  - headless subcommand in CLI: JSON stdout + structured exit codes 0/1/2 + --timeout
  - query.skill.ts: deterministic instant state snapshot without LLM
  - SilentUiAdapter wired into CLI execution path via headless command

affects:
  - 14-anything-using-ci-cd
  - scripts/pipelines using sunco headless

tech-stack:
  added: []
  patterns:
    - "Headless execution: boot lifecycle normally, override uiAdapter with SilentUiAdapter per-invocation"
    - "Exit code semantics: 0=success, 2=blocked, 1=error/unknown"
    - "Deterministic state query: readFile + parseStateMd + parseRoadmap, zero LLM"

key-files:
  created:
    - packages/skills-workflow/src/query.skill.ts
    - packages/skills-workflow/src/__tests__/query.test.ts
  modified:
    - packages/cli/src/cli.ts
    - packages/skills-workflow/src/index.ts
    - packages/skills-workflow/tsup.config.ts

key-decisions:
  - "Headless uses lifecycle.boot normally then builds a per-invocation SilentUiAdapter context — avoids second boot, reuses all services"
  - "services! non-null assertion inside headless action is safe — action only runs after boot succeeds"
  - "query skill reads phase from STATE.md body (Phase: NN pattern) not frontmatter progress block"

patterns-established:
  - "headless pattern: register after registerSkills(), boot services, getByCommand(), createSkillContext with SilentUiAdapter"
  - "deterministic skill pattern: kind='deterministic', zero ctx.agent use, readFile + parse utilities"

requirements-completed: [HLS-01, HLS-02, HLS-03, HLS-04]

duration: 8min
completed: 2026-03-29
---

# Phase 13 Plan 01: Headless CI/CD + Query Skill Summary

**Commander.js headless subcommand with JSON stdout + exit codes 0/1/2 + --timeout, plus deterministic query skill returning phase/progress/costs snapshot in <100ms**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-29T06:00:00Z
- **Completed:** 2026-03-29T06:08:52Z
- **Tasks:** 3 (all in single commit)
- **Files modified:** 5

## Accomplishments

- `sunco headless <command>` runs any registered skill with SilentUiAdapter, emits JSON to stdout, sets exit code 0/1/2, respects --timeout
- `sunco query` returns instant snapshot (phase, progress, costs, nextAction, timestamp) without LLM call
- 11 new query skill tests; all 839 total tests pass; all 5 packages build successfully

## Task Commits

All three tasks were implemented atomically in a single commit:

1. **Task 1: Add headless subcommand** - `2ecbef9` (feat)
2. **Task 2: Create query skill + tests** - `2ecbef9` (feat)
3. **Task 3: Register query skill + build config** - `2ecbef9` (feat)

## Files Created/Modified

- `packages/cli/src/cli.ts` - Added headless subcommand; imported SilentUiAdapter, createSkillUi, createSkillContext, querySkill
- `packages/skills-workflow/src/query.skill.ts` - Deterministic query skill: reads STATE.md + ROADMAP.md, returns phase/progress/costs/nextAction JSON
- `packages/skills-workflow/src/__tests__/query.test.ts` - 11 tests covering all branches
- `packages/skills-workflow/src/index.ts` - Barrel export for querySkill
- `packages/skills-workflow/tsup.config.ts` - Added query.skill.ts to entry array

## Decisions Made

- Headless command calls `lifecycle.boot()` normally then builds a separate `createSkillContext` with `new SilentUiAdapter()` — this reuses the fully booted registry/state/agent services without a second boot cycle
- The `services!` non-null assertion inside the headless action handler is safe: the command is registered only after `lifecycle.boot()` succeeds, so services is always defined when the action fires
- query skill reads `state.phase` from the STATE.md body `Phase: NN` pattern (not the frontmatter progress block), consistent with how parseStateMd works

## Deviations from Plan

None — plan executed exactly as written. The implementation approach matched the plan's described pattern precisely, using `registry.getByCommand()` and `createSkillContext` directly.

## Issues Encountered

None. Build succeeded on first attempt, all 839 tests passed.

## Known Stubs

None — query skill reads real files from disk and returns actual state data.

## Next Phase Readiness

- `sunco headless query` is ready for CI/CD pipelines
- `sunco headless status` and other skills work via headless mode
- Exit codes (0/1/2) are stable and documented
- --timeout guard prevents runaway CI steps

---
*Phase: 13-headless-cicd*
*Completed: 2026-03-29*
