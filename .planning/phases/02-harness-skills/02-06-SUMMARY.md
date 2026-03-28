---
phase: 02-harness-skills
plan: 06
subsystem: harness
tags: [agent-docs, static-analysis, efficiency-scoring, claude-md, vitest]

requires:
  - phase: 02-harness-skills-01
    provides: "Init detection modules, skills-harness package structure, vitest test infra"
provides:
  - "analyzeAgentDoc() -- static text analysis of CLAUDE.md/agents.md/AGENTS.md"
  - "computeEfficiencyScore() -- 0-100 score from brevity/clarity/coverage/contradictions"
  - "generateSuggestions() -- specific actionable suggestions with line numbers"
  - "harness.agents skill entry point -- defineSkill with deterministic kind"
affects: [02-harness-skills-07, 02-harness-skills-08]

tech-stack:
  added: []
  patterns:
    - "Directive extraction with positive/negative verb classification for contradiction detection"
    - "4-component weighted scoring: brevity 30%, clarity 25%, coverage 25%, contradiction-free 20%"
    - "ETH Zurich brevity tiers: <=30=100, <=60=80, <=100=50, <=200=25, >200=10"

key-files:
  created:
    - packages/skills-harness/src/agents/types.ts
    - packages/skills-harness/src/agents/doc-analyzer.ts
    - packages/skills-harness/src/agents/efficiency-scorer.ts
    - packages/skills-harness/src/agents/suggestion-engine.ts
    - packages/skills-harness/src/agents.skill.ts
    - packages/skills-harness/src/agents/__tests__/doc-analyzer.test.ts
    - packages/skills-harness/src/agents/__tests__/efficiency-scorer.test.ts
    - packages/skills-harness/src/agents/__tests__/suggestion-engine.test.ts
  modified:
    - packages/skills-harness/src/index.ts

key-decisions:
  - "Directive extraction uses positive/negative verb pairs (always/never, use/avoid, must/don't) with word-overlap similarity for contradiction detection"
  - "Vague phrase detection in efficiency scorer counts phrases in section titles as proxy (full-content analysis deferred to file-level pass)"
  - "Suggestion messages use imperative language ('Consolidate sections', 'Pick one directive') per D-19, never vague starters"

patterns-established:
  - "Agent doc TDD pattern: types first, then tests, then implementation"
  - "Contradiction detection via directive pairing: extract verb polarity + subject, compare with word overlap"
  - "Suggestion engine pattern: return empty array for perfect input, severity-sorted suggestions with line ranges"

requirements-completed: [HRN-12, HRN-13]

duration: 5min
completed: 2026-03-28
---

# Phase 02 Plan 06: Agent Doc Analyzer Summary

**Static analysis of CLAUDE.md/agents.md with 4-component efficiency scoring (brevity/clarity/coverage/contradictions), contradiction detection via directive pairing, and specific actionable suggestions with line numbers**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T08:02:17Z
- **Completed:** 2026-03-28T08:07:38Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Agent doc analyzer extracts line count, sections, instruction density, key section detection, contradiction detection, and 60-line warning flag
- Efficiency scorer computes 0-100 score from four weighted components: brevity (30%), clarity (25%), coverage (25%), contradiction-free (20%)
- Suggestion engine generates specific, actionable suggestions with line numbers -- never vague language per D-19
- Complete `sunco agents` skill entry point: auto-detects CLAUDE.md/agents.md/AGENTS.md, --json and --file options, read-only per D-18

## Task Commits

Each task was committed atomically (TDD: RED + GREEN):

1. **Task 1: Agent doc analyzer + efficiency scorer**
   - `b185145` (test: RED -- failing tests for doc-analyzer and efficiency-scorer)
   - `07cf363` (feat: GREEN -- implement doc analyzer and efficiency scorer)
2. **Task 2: Suggestion engine + sunco agents skill entry point**
   - `bbeeeaa` (test: RED -- failing tests for suggestion engine)
   - `5e05ead` (feat: GREEN -- implement suggestion engine and agents skill)

## Files Created/Modified
- `packages/skills-harness/src/agents/types.ts` - AgentDocMetrics, Contradiction, AgentDocSuggestion, AgentDocReport types
- `packages/skills-harness/src/agents/doc-analyzer.ts` - analyzeAgentDoc(): section parsing, instruction density, contradiction detection
- `packages/skills-harness/src/agents/efficiency-scorer.ts` - computeEfficiencyScore(): 4-component weighted formula, brevityScore() exported
- `packages/skills-harness/src/agents/suggestion-engine.ts` - generateSuggestions(): specific suggestions with line ranges per D-19
- `packages/skills-harness/src/agents.skill.ts` - defineSkill({ id: 'harness.agents', kind: 'deterministic' }) entry point
- `packages/skills-harness/src/agents/__tests__/doc-analyzer.test.ts` - 9 tests for doc analysis
- `packages/skills-harness/src/agents/__tests__/efficiency-scorer.test.ts` - 9 tests for scoring
- `packages/skills-harness/src/agents/__tests__/suggestion-engine.test.ts` - 6 tests for suggestions
- `packages/skills-harness/src/index.ts` - Added agentsSkill export

## Decisions Made
- Directive extraction uses positive/negative verb pairs (always/never, use/avoid, must/don't) with word-overlap similarity for contradiction detection -- simple heuristic, no LLM needed
- Vague phrase detection counts from section titles as a lightweight proxy; full-content phrase scanning can be added later
- All suggestion messages use imperative language ("Consolidate sections", "Pick one directive") per D-19, never vague starters ("consider", "ensure")

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- Agent doc analysis, scoring, and suggestions complete and tested (24 passing tests)
- harness.agents skill registered in index.ts, ready for CLI integration
- Types exported for downstream consumption by guard skill (02-07) and integration testing (02-08)

## Self-Check: PASSED

- All 9 created/modified files verified on disk
- All 4 commits (b185145, 07cf363, bbeeeaa, 5e05ead) verified in git log
- 24/24 tests passing

---
*Phase: 02-harness-skills*
*Completed: 2026-03-28*
