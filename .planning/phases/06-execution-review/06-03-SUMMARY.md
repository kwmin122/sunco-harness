---
phase: 06-execution-review
plan: 03
subsystem: workflow
tags: [cross-review, multi-provider, crossVerify, review-dimensions, synthesis, REVIEWS.md, simple-git]

# Dependency graph
requires:
  - phase: 01-core-platform
    provides: AgentRouterApi.crossVerify(), AgentResult, PermissionSet, defineSkill
  - phase: 05-context-planning
    provides: prompt builder patterns (research-domain.ts, research-synthesize.ts)
provides:
  - review.skill.ts: multi-provider cross-review skill (workflow.review)
  - buildReviewPrompt(): per-dimension analysis prompt with diff + truncation
  - buildReviewSynthesizePrompt(): multi-provider review synthesis into REVIEWS.md
  - REVIEW_DIMENSIONS constant: 7 standard review dimensions per D-12
  - ReviewFinding interface for structured review output
affects: [06-execution-review, 07-verification-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [crossVerify multi-provider dispatch, review dimension analysis, synthesis agent merge, diff truncation safety]

key-files:
  created:
    - packages/skills-workflow/src/review.skill.ts
    - packages/skills-workflow/src/prompts/review.ts
    - packages/skills-workflow/src/prompts/review-synthesize.ts
    - packages/skills-workflow/src/__tests__/review.test.ts
  modified: []

key-decisions:
  - "crossVerify for multi-provider dispatch instead of manual Promise.allSettled (reuse existing AgentRouterApi)"
  - "Provider flag to family mapping in skill layer: claude->claude, codex->openai, gemini->google per D-09"
  - "50K char diff truncation with warning per RESEARCH Pitfall 6"
  - "Dual output paths: .planning/REVIEWS.md (default) or phase dir REVIEWS.md (--phase mode)"

patterns-established:
  - "crossVerify dispatch pattern: build prompt once, dispatch to multiple providers, synthesize results"
  - "Review dimension constant: typed readonly array of review focus areas"
  - "Synthesis prompt pattern: merge independent reviews with common findings, disagreements, severity weighting"
  - "Provider family filtering: flag-to-family map with string prefix matching on provider IDs"

requirements-completed: [WF-13]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 6 Plan 03: Cross-Review Skill Summary

**Multi-provider cross-review skill dispatching diffs to independent AI providers via crossVerify with 7-dimension analysis and unified REVIEWS.md synthesis**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T15:02:41Z
- **Completed:** 2026-03-28T15:06:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Review prompt builder with 7 dimensions (SQL safety, trust boundaries, conditional side effects, architecture, test coverage, security, performance) per D-12
- Review synthesis prompt merging independent provider reviews into unified REVIEWS.md with Common Findings, Disagreements, and severity-weighted priority sections per D-11
- review.skill.ts supporting default mode (staged+unstaged diff) and --phase N mode with provider flag filtering (--claude, --codex, --gemini) per D-09, D-13
- 11 tests covering metadata, no-provider, empty diff, default/phase modes, provider filtering, crossVerify dispatch, synthesis, output paths, and diff truncation

## Task Commits

Each task was committed atomically:

1. **Task 1: Review prompt builders (review + synthesis)** - `447e3f9` (feat)
2. **Task 2: Review skill with multi-provider dispatch and synthesis** - `bbb15e4` (feat)

_Note: TDD task -- test RED (fail: module not found) then GREEN (11/11 pass)._

## Files Created/Modified
- `packages/skills-workflow/src/prompts/review.ts` - REVIEW_DIMENSIONS constant, ReviewFinding interface, buildReviewPrompt() with diff truncation
- `packages/skills-workflow/src/prompts/review-synthesize.ts` - buildReviewSynthesizePrompt() merging multi-provider reviews into REVIEWS.md format
- `packages/skills-workflow/src/review.skill.ts` - Multi-provider cross-review skill with crossVerify dispatch, two modes, provider flag filtering, synthesis
- `packages/skills-workflow/src/__tests__/review.test.ts` - 11 tests with mocked simple-git and ctx: metadata, failure modes, dispatch, synthesis, output

## Decisions Made
- Used crossVerify for multi-provider dispatch (already handles Promise.allSettled internally) instead of manual parallel dispatch
- Provider flag to family mapping in the skill layer (claude->claude, codex->openai, gemini->google) with prefix matching on provider IDs per D-09
- Diff truncation at 50,000 characters with warning per RESEARCH Pitfall 6
- Dual output paths: .planning/REVIEWS.md for default mode, phase directory REVIEWS.md for --phase mode per D-13
- Separate synthesis agent call via ctx.agent.run() with planning permissions (not verification) per D-11

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- review.skill.ts ready for CLI wiring (barrel export + subpath export)
- Prompt builders available for import by any skill needing review capabilities
- REVIEW_DIMENSIONS exportable for custom review configurations
- All 7 review dimensions implemented per D-12, ready for verification pipeline integration

## Self-Check: PASSED

All 4 created files verified on disk. Both commit hashes (447e3f9, bbb15e4) confirmed in git log.

---
*Phase: 06-execution-review*
*Completed: 2026-03-28*
