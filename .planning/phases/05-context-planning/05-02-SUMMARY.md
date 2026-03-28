---
phase: 05-context-planning
plan: 02
subsystem: workflow
tags: [agent, assume, context, planning, interactive]

# Dependency graph
requires:
  - phase: 01-core-platform
    provides: defineSkill, SkillContext, AgentRouterApi, PermissionSet, SkillUi
  - phase: 04
    provides: prompt template pattern, planning-writer, pre-scan context
provides:
  - assume.skill.ts with single-agent approach preview
  - buildAssumePrompt for structured assumption extraction
  - CONTEXT.md append logic for user corrections as locked decisions
affects: [05-context-planning, research, plan, execution]

# Tech tracking
tech-stack:
  added: []
  patterns: [structured assumption format, read-modify-write CONTEXT.md append, single-agent planning dispatch]

key-files:
  created:
    - packages/skills-workflow/src/assume.skill.ts
    - packages/skills-workflow/src/prompts/assume.ts
    - packages/skills-workflow/src/__tests__/assume.test.ts
  modified:
    - packages/skills-workflow/src/prompts/index.ts

key-decisions:
  - "Inline phase-reader helpers (resolvePhaseDir, readPhaseArtifact, writePhaseArtifact) since plan 05-01 may not have run yet"
  - "Correction insertion before Claude's Discretion heading when present, else before </decisions> tag"
  - "Decision numbering auto-increments from highest existing D-{N} in CONTEXT.md"

patterns-established:
  - "Structured ---ASSUMPTION--- format: ID, AREA, ASSUMPTION, CONFIDENCE, RATIONALE, ALTERNATIVE"
  - "Read-modify-write pattern for CONTEXT.md append (never overwrite)"
  - "Single planning agent with read-only permissions for approach preview"

requirements-completed: [WF-10]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 05 Plan 02: Assume Skill Summary

**Agent-powered approach preview skill with structured assumptions, interactive correction, and CONTEXT.md append for locked decisions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T13:56:37Z
- **Completed:** 2026-03-28T14:00:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Assume prompt template with structured ---ASSUMPTION--- delimited format covering file organization, naming, dependencies, API patterns, error handling, and test strategy
- Assume skill with single planning agent dispatch, interactive user review, and CONTEXT.md correction append
- 9 unit tests covering metadata, no-provider, missing CONTEXT.md, all-approved flow, correction flow, agent failure, malformed output fallback, and phase option

## Task Commits

Each task was committed atomically:

1. **Task 1: Create assume prompt template** - `ad379c6` (feat)
2. **Task 2: RED - failing tests** - `eca08c8` (test)
3. **Task 2: GREEN - assume.skill.ts implementation** - `626a419` (feat)

_Note: TDD task had RED + GREEN commits (no REFACTOR needed)_

## Files Created/Modified
- `packages/skills-workflow/src/prompts/assume.ts` - buildAssumePrompt() for structured assumption extraction prompt
- `packages/skills-workflow/src/assume.skill.ts` - Assume skill: agent dispatch, assumption parsing, interactive review, CONTEXT.md append
- `packages/skills-workflow/src/__tests__/assume.test.ts` - 9 unit tests for all assume skill paths
- `packages/skills-workflow/src/prompts/index.ts` - Barrel export updated with buildAssumePrompt

## Decisions Made
- Inline phase-reader helpers instead of importing from shared/phase-reader.ts (not yet created by plan 05-01; can be refactored in wiring plan 05-05)
- Corrections insert before "### Claude's Discretion" heading when present, otherwise before </decisions> closing tag
- Decision numbers auto-increment from highest existing D-{N} in CONTEXT.md using regex scan
- SkillOption uses Commander.js flags format: `-p, --phase <number>` consistent with other skills

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- assume skill complete, ready for research skill (plan 05-03) and plan skill (plan 05-04)
- CONTEXT.md append pattern established for reuse by other skills
- Prompt template pattern consistent with existing scan-*.ts templates

## Self-Check: PASSED

All files verified present. All commit hashes found in git log.

---
*Phase: 05-context-planning*
*Completed: 2026-03-28*
