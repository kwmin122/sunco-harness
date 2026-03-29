---
phase: 09-composition-skills
plan: 01
subsystem: workflow
tags: [auto-pipeline, nl-routing, skill-composition, ctx-run, agent-dispatch]

# Dependency graph
requires:
  - phase: 06-execution-review
    provides: execute.skill.ts, discuss.skill.ts, plan-parser, worktree-manager
  - phase: 05-context-planning
    provides: phase-reader, roadmap-parser, state-reader
provides:
  - "workflow.auto skill -- full autonomous pipeline orchestrator"
  - "workflow.do skill -- NL intent router with agent dispatch"
  - "do-route.ts prompt builder with 33-skill catalog"
affects: [09-composition-skills, 10-debugging]

# Tech tracking
tech-stack:
  added: []
  patterns: [pipeline-step-array, nl-routing-agent-dispatch, json-response-parsing]

key-files:
  created:
    - packages/skills-workflow/src/auto.skill.ts
    - packages/skills-workflow/src/do.skill.ts
    - packages/skills-workflow/src/prompts/do-route.ts
  modified: []

key-decisions:
  - "Pipeline steps as typed array with skip-check callbacks for extensibility"
  - "Literal skill IDs in pipeline steps instead of template literals for traceability"
  - "Read-only planning permissions for NL routing agent"
  - "Quick fallback when no skill matches NL input or no provider available"

patterns-established:
  - "Pipeline composition: array of {name, skillId, skipCheck} for orchestrating multi-skill workflows"
  - "NL routing: agent dispatch with skill catalog -> JSON parsing -> ctx.run()"

requirements-completed: [WF-15, WF-18]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 09 Plan 01: Auto + Do Skills Summary

**Autonomous pipeline orchestrator (sunco auto) and NL skill router (sunco do) with 33-skill catalog prompt builder**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T00:43:36Z
- **Completed:** 2026-03-29T00:47:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- auto.skill.ts: full pipeline orchestrator that reads ROADMAP.md + STATE.md, loops phases, chains discuss->plan->execute->verify via ctx.run(), with retry/skip/abort error recovery
- do.skill.ts: NL router that dispatches a planning agent with skill catalog, parses JSON response, invokes matched skill or falls back to workflow.quick
- do-route.ts: prompt builder with comprehensive 33-skill catalog table for agent context

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sunco auto skill** - `a9497ff` (feat)
2. **Task 2: Create sunco do skill + prompt builder** - `ef2e00a` (feat)

## Files Created/Modified
- `packages/skills-workflow/src/auto.skill.ts` - Full autonomous pipeline orchestrator (discuss->plan->execute->verify loop)
- `packages/skills-workflow/src/do.skill.ts` - NL intent router with agent dispatch and quick fallback
- `packages/skills-workflow/src/prompts/do-route.ts` - Prompt builder with 33-skill catalog and routing instructions

## Decisions Made
- Pipeline steps defined as typed array with optional skipCheck callbacks -- more extensible than hardcoded if-chains
- Used literal skill IDs ('workflow.discuss', 'workflow.plan', etc.) in PIPELINE_STEPS array for grep-traceability
- Read-only permissions (planning role) for NL routing agent -- routing should never write files
- Direct fallback to workflow.quick when no AI provider is available (avoids agent dispatch failure)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- auto and do skills ready for integration with full skill registry
- Remaining 09-composition-skills plans (quick, fast) can build on these patterns
- Pipeline composition pattern established for reuse

## Self-Check: PASSED

- [x] auto.skill.ts exists
- [x] do.skill.ts exists
- [x] do-route.ts exists
- [x] SUMMARY.md exists
- [x] Commit a9497ff found
- [x] Commit ef2e00a found
- [x] TypeScript compiles with 0 type errors (excluding pre-existing TS6059 rootDir)

---
*Phase: 09-composition-skills*
*Completed: 2026-03-29*
