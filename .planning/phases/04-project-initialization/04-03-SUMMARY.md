---
phase: 04-project-initialization
plan: 03
subsystem: workflow
tags: [agent-orchestration, research-agents, synthesis, planning-writer, askText, Promise.allSettled]

# Dependency graph
requires:
  - phase: 04-project-initialization
    provides: "askText(), writePlanningArtifact(), SkillUi interface, AgentRouterApi"
  - phase: 01-core-platform
    provides: "defineSkill(), SkillContext, AgentRequest/AgentResult types, PermissionSet"
provides:
  - "sunco new skill (workflow.new) -- agent-powered greenfield project bootstrap"
  - "Research prompt builder (buildResearchPrompt) for 5 parallel research topics"
  - "Synthesis prompt builder (buildSynthesisPrompt) with 3-document SEPARATOR output"
  - "Prompts barrel export (index.ts)"
affects: [05-context-plan, 10-cli-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-step agent orchestration, parallel research with Promise.allSettled, DOCUMENT_SEPARATOR parsing, adaptive conditional questions]

key-files:
  created:
    - packages/skills-workflow/src/new.skill.ts
    - packages/skills-workflow/src/prompts/research.ts
    - packages/skills-workflow/src/prompts/synthesis.ts
    - packages/skills-workflow/src/prompts/index.ts
    - packages/skills-workflow/src/__tests__/new.test.ts
  modified: []

key-decisions:
  - "Barrel index.ts only exports existing prompts (scan-*.ts deferred to plan 04-02)"
  - "Conditional questions use answer-based predicates for adaptive 5-8 question range"
  - "DOCUMENT_SEPARATOR fallback writes entire output as PROJECT.md when parsing fails"

patterns-established:
  - "Agent orchestration: parallel research via Promise.allSettled + single synthesis call"
  - "Adaptive question flow: conditional questions filtered by prior answers"
  - "Graceful degradation: partial research failure still proceeds to synthesis"

requirements-completed: [WF-01]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 04 Plan 03: Sunco New Skill Summary

**Agent-powered project bootstrap with 5-topic parallel research, adaptive questions, and 3-artifact synthesis via DOCUMENT_SEPARATOR parsing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T13:21:14Z
- **Completed:** 2026-03-28T13:25:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Implemented `sunco new` as the most complex orchestration skill: idea -> 5-8 questions -> parallel research -> synthesis -> .planning/ artifacts
- Created buildResearchPrompt() with 5 topic-specific instruction sets (tech-stack, competitors, architecture, challenges, ecosystem)
- Created buildSynthesisPrompt() producing PROJECT.md + REQUIREMENTS.md + ROADMAP.md via DOCUMENT_SEPARATOR protocol
- All 9 unit tests pass covering metadata, CLI/interactive input, no-provider fallback, question count, research dispatch, synthesis, artifact writing, and partial failure tolerance

## Task Commits

Each task was committed atomically:

1. **Task 1: Create research and synthesis prompt templates + barrel export** - `d77200e` (feat)
2. **Task 2: Implement new.skill.ts with multi-step orchestration and tests (TDD)**
   - `c99a72b` (test: add failing tests for sunco new skill)
   - `9db3bb0` (feat: implement sunco new skill with multi-step orchestration)

_Note: Task 2 used TDD with RED and GREEN commits._

## Files Created/Modified
- `packages/skills-workflow/src/prompts/research.ts` - buildResearchPrompt() with 5 topic-specific instructions
- `packages/skills-workflow/src/prompts/synthesis.ts` - buildSynthesisPrompt() with 3-document SEPARATOR output
- `packages/skills-workflow/src/prompts/index.ts` - Barrel export for all prompt builders
- `packages/skills-workflow/src/new.skill.ts` - sunco new skill with 5-step orchestration flow
- `packages/skills-workflow/src/__tests__/new.test.ts` - 9 tests covering all behaviors

## Decisions Made
- Barrel index.ts only exports prompt builders that exist now (research, synthesis, format-pre-scan). Scan prompt files will be added by plan 04-02 when it runs.
- Conditional questions use runtime predicate functions on accumulated answers for adaptive branching (e.g., frontend question only shown for webapp type).
- When DOCUMENT_SEPARATOR is not found in synthesis output, the entire output is written as PROJECT.md with a warning -- graceful degradation over hard failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Barrel index limited to existing prompt files**
- **Found during:** Task 1 (barrel export)
- **Issue:** Plan specified barrel export including scan-stack.ts, scan-architecture.ts, etc., but these files don't exist yet (created by parallel plan 04-02)
- **Fix:** Only exported existing files (research, synthesis, format-pre-scan). Plan 04-02 will extend the barrel when those files are created.
- **Files modified:** packages/skills-workflow/src/prompts/index.ts
- **Verification:** TypeScript compiles cleanly with no missing module errors
- **Committed in:** d77200e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal. Barrel export is extensible; plan 04-02 adds scan exports when ready. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all implementations are complete with no placeholder data.

## Next Phase Readiness
- sunco new skill ready for CLI wiring (will be integrated via skill loader in CLI entry point)
- Prompt builders available for reuse by any future agent-powered skill
- Barrel export at prompts/index.ts ready to be extended with scan prompts from plan 04-02

## Self-Check: PASSED

All 5 files verified present. All 3 commits verified in git log.

---
*Phase: 04-project-initialization*
*Completed: 2026-03-28*
