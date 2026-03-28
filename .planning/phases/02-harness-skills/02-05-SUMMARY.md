---
phase: 02-harness-skills
plan: 05
subsystem: harness
tags: [health-scoring, freshness, anti-patterns, conventions, trend-tracking]

requires:
  - phase: 02-harness-skills/01
    provides: "Init detection modules (convention extractor, ecosystem detector)"
  - phase: 01-core-platform
    provides: "StateApi, defineSkill, SkillContext, SkillResult types"
provides:
  - "checkFreshness() -- document staleness detection via mtime comparison"
  - "trackPatterns() + getPatternTrends() -- anti-pattern counting with trend computation"
  - "scoreConventions() -- convention drift detection against baseline"
  - "computeHealthScore() -- weighted composite 0-100 (30/40/30)"
  - "formatHealthReport() -- terminal table with trend arrows"
  - "sunco health skill (harness.health) -- orchestrates all checks"
affects: [02-harness-skills/06, 02-harness-skills/07, 02-harness-skills/08]

tech-stack:
  added: []
  patterns:
    - "mtime comparison for document freshness (7-day threshold)"
    - "Regex-based anti-pattern scanning with per-type penalty multipliers"
    - "StateApi snapshot storage with ISO timestamp keys for trend tracking"
    - "Weighted composite scoring (freshness 30%, patterns 40%, conventions 30%)"

key-files:
  created:
    - packages/skills-harness/src/health/types.ts
    - packages/skills-harness/src/health/freshness-checker.ts
    - packages/skills-harness/src/health/pattern-tracker.ts
    - packages/skills-harness/src/health/convention-scorer.ts
    - packages/skills-harness/src/health/reporter.ts
    - packages/skills-harness/src/health.skill.ts
    - packages/skills-harness/src/health/__tests__/freshness-checker.test.ts
    - packages/skills-harness/src/health/__tests__/pattern-tracker.test.ts
    - packages/skills-harness/src/health/__tests__/reporter.test.ts
  modified:
    - packages/skills-harness/src/index.ts

key-decisions:
  - "Related code mtime includes sibling directories (docs/ finds code in src/)"
  - "Trend threshold at 10% change for increasing/decreasing classification"
  - "Pattern penalties: any-type*2, eslint-disable*3, console-log*1, todo*0.5, assertion*0.5"

patterns-established:
  - "Health module structure: types.ts + checker.ts + tracker.ts + scorer.ts + reporter.ts + skill.ts"
  - "Mock StateApi pattern: Map-backed implementation for unit testing"
  - "Parallel checks with Promise.all in skill execute()"

requirements-completed: [HRN-09, HRN-10, HRN-11]

duration: 6min
completed: 2026-03-28
---

# Phase 02 Plan 05: Health Skill Summary

**Codebase health scoring with freshness detection, anti-pattern tracking (5 patterns with trend computation), convention drift detection, and weighted composite 0-100 report with terminal table output**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T08:02:26Z
- **Completed:** 2026-03-28T08:08:34Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Document freshness checker detects stale docs via mtime comparison (7-day threshold) with broken cross-reference scanning
- Anti-pattern tracker scans for 5 patterns (any-type, console-log, todo-comment, type-assertion, eslint-disable) and stores snapshots in state for trend computation
- Convention scorer re-runs extraction and compares against init baseline with 25-point penalty per mismatch
- Weighted composite scoring (freshness 30%, patterns 40%, conventions 30%) with terminal table and JSON output
- 21 passing tests across 3 test suites

## Task Commits

Each task was committed atomically:

1. **Task 1: Health types + freshness checker + pattern tracker** - `89c5de7` (feat) - TDD
2. **Task 2: Convention scorer + reporter + sunco health skill** - `43bb075` (feat)

## Files Created/Modified
- `packages/skills-harness/src/health/types.ts` - HealthSnapshot, HealthReport, FreshnessResult, PatternCount, PatternTrend types
- `packages/skills-harness/src/health/freshness-checker.ts` - checkFreshness() with mtime comparison and broken ref detection
- `packages/skills-harness/src/health/pattern-tracker.ts` - trackPatterns() + getPatternTrends() with StateApi snapshots
- `packages/skills-harness/src/health/convention-scorer.ts` - scoreConventions() comparing current vs expected baseline
- `packages/skills-harness/src/health/reporter.ts` - computeHealthScore(), computePatternScore(), formatHealthReport(), formatHealthJson()
- `packages/skills-harness/src/health.skill.ts` - defineSkill({ id: 'harness.health' }) with parallel checks and snapshot storage
- `packages/skills-harness/src/health/__tests__/freshness-checker.test.ts` - 4 tests: stale detection, broken refs, fresh docs, proportional scoring
- `packages/skills-harness/src/health/__tests__/pattern-tracker.test.ts` - 5 tests: any-type counting, snapshot storage, trends, first run
- `packages/skills-harness/src/health/__tests__/reporter.test.ts` - 12 tests: pattern score, health score weights, table formatting
- `packages/skills-harness/src/index.ts` - Added healthSkill export

## Decisions Made
- Related code mtime search includes sibling directories (e.g., docs/ finds code changes in src/) -- needed for correct freshness detection when docs and code are in separate directories
- Trend threshold set at 10% change to classify as increasing/decreasing, otherwise stable
- Pattern penalty multipliers: any-type=2, eslint-disable=3, console-log=1, todo-comment=0.5, type-assertion=0.5 with 100 cap and +10 trend penalty

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed related code mtime search to include sibling directories**
- **Found during:** Task 1 (freshness checker)
- **Issue:** checkFreshness could not find related code for docs in `docs/` because it only checked same/parent/child dirs, missing sibling `src/`
- **Fix:** Extended filter to include all children of parent directory (sibling matching)
- **Files modified:** packages/skills-harness/src/health/freshness-checker.ts
- **Verification:** Test "returns lower score proportional to stale doc count" passes
- **Committed in:** 89c5de7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correctness -- docs in `docs/` dir must detect related code in `src/`. No scope creep.

## Issues Encountered
- Pre-existing TS6059 (rootDir) config issue in skills-harness tsconfig prevents `tsc --noEmit` from passing cleanly, but this is unrelated to this plan's changes (all test files across the package are affected). Tests pass via vitest which handles TypeScript separately.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Health scoring infrastructure complete, ready for guard skill (02-06) to use health checks in watch mode
- HealthReport and HealthSnapshot types available for recommender integration
- Pattern trend data accumulates over runs, enabling time-series health analysis

---
*Phase: 02-harness-skills*
*Completed: 2026-03-28*
