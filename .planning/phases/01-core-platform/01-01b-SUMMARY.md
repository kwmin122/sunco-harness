---
phase: 01-core-platform
plan: 01b
subsystem: types
tags: [typescript, zod, type-contracts, interfaces, agent-router, skill-system, config, state-engine, ui-adapter]

# Dependency graph
requires:
  - phase: 01-core-platform/01
    provides: "Monorepo scaffold with 5 workspace packages, Turborepo build pipeline, tsup bundling"
provides:
  - "All Phase 1 TypeScript type contracts exported from @sunco/core"
  - "SunConfig Zod schema with skill policy, agent, UI, state sections"
  - "SkillDefinition, SkillContext, SkillResult interfaces for skill system"
  - "AgentProvider, AgentResult, AgentRequest, PermissionSet for agent router"
  - "Agent error hierarchy (4 typed errors per D-27)"
  - "SkillUi intent-based pattern API (entry/ask/progress/result)"
  - "UiAdapter renderer contract (mountPattern/update/dispose)"
  - "Recommendation engine types (Recommendation, Rule, State, Api)"
  - "StateApi, FileStoreApi, StateEngine interfaces with SUN_DIR_STRUCTURE"
  - "Theme tokens (colors, symbols, spacing)"
  - "SunError base + ConfigError, SkillNotFoundError, CircularSkillInvocationError, DuplicateSkillError"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [zod-schema-with-defaults, type-only-modules, barrel-reexport, two-layer-ui-contract, agent-error-hierarchy]

key-files:
  created:
    - packages/core/src/types.ts
    - packages/core/src/config/types.ts
    - packages/core/src/skill/types.ts
    - packages/core/src/state/types.ts
    - packages/core/src/agent/types.ts
    - packages/core/src/agent/errors.ts
    - packages/core/src/recommend/types.ts
    - packages/core/src/ui/adapters/SkillUi.ts
    - packages/core/src/ui/adapters/UiAdapter.ts
    - packages/core/src/ui/theme/tokens.ts
    - packages/core/src/errors/index.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "Used Zod 3.24.4 (installed by Plan 01) instead of Zod 4.x -- matching actual installed version, API compatible"
  - "RecommenderApi methods are synchronous (not Promise-based) -- recommendation rules are pure functions, sub-ms, no async needed"
  - "AgentRequest.expectedSchema typed as z.ZodType for forward compatibility with any Zod schema"
  - "SkillContext.recommend uses synchronous API while state/agent use async -- reflects deterministic vs IO-bound nature"

patterns-established:
  - "Type-only modules: types.ts files contain only types, interfaces, Zod schemas, and constants -- zero implementation logic"
  - "Barrel re-export: packages/core/src/index.ts re-exports all type modules for single-import consumer experience"
  - "Two-layer UI contract: SkillUi (skill-facing intent API) + UiAdapter (renderer-facing pattern API)"
  - "Agent error hierarchy: AgentError base -> 4 specific typed errors for structured error handling"
  - "Zod schema with .default(): All config fields have defaults, enabling partial TOML configs"

requirements-completed: [CLI-01]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 01 Plan 01b: Type Contracts Summary

**All Phase 1 TypeScript type contracts for Config, Skill, State, Agent, Recommender, UX, and Error subsystems exported from @sunco/core with Zod validation schemas**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T03:28:42Z
- **Completed:** 2026-03-28T03:35:32Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Defined 18 runtime exports and 50+ type exports from @sunco/core covering all Phase 1 subsystems
- Created Zod schemas for SunConfig with hierarchical defaults (SkillPolicy, Agent, UI, State sections)
- Established complete SkillDefinition/SkillContext contracts that downstream plans implement against
- Built agent provider abstraction with AgentProvider, AgentRequest, AgentResult, PermissionSet interfaces
- Created two-layer UI contract: SkillUi (intent API) + UiAdapter (renderer API) per D-38
- Defined 9 error classes (SunError base + 4 skill errors + AgentError base + 4 agent errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define type contracts for Config, Skill, State, and Error subsystems** - `db974bc` (feat)
2. **Task 2: Define type contracts for Agent, Recommender, and UX subsystems** - `97cc505` (feat)

**Plan metadata:** [pending final commit]

## Files Created/Modified
- `packages/core/src/types.ts` - Shared base types (SkillId, CommandName, Branded)
- `packages/core/src/config/types.ts` - SunConfig Zod schema with skill policy, agent, UI, state sections
- `packages/core/src/skill/types.ts` - SkillDefinition, SkillContext, SkillResult, SkillKind/Stage/Routing
- `packages/core/src/state/types.ts` - StateApi, FileStoreApi, StateEngine, SUN_DIR_STRUCTURE const
- `packages/core/src/errors/index.ts` - SunError + ConfigError, SkillNotFoundError, CircularSkillInvocationError, DuplicateSkillError
- `packages/core/src/agent/types.ts` - AgentProvider, AgentResult, AgentRequest, PermissionSet, AgentRouterApi, Artifact, AgentUsage
- `packages/core/src/agent/errors.ts` - AgentError + ProviderUnavailableError, PermissionDeniedError, ExecutionTimeoutError, ProviderExecutionError
- `packages/core/src/recommend/types.ts` - Recommendation, RecommendationRule, RecommendationState, RecommenderApi
- `packages/core/src/ui/adapters/SkillUi.ts` - SkillUi intent API with SkillEntryInput, AskInput, UiChoiceResult, ProgressHandle, ResultInput
- `packages/core/src/ui/adapters/UiAdapter.ts` - UiAdapter renderer contract with UiPattern, UiOutcome, UiPatch
- `packages/core/src/ui/theme/tokens.ts` - Theme tokens (colors, symbols, spacing) with default theme
- `packages/core/src/index.ts` - Barrel re-export of all type modules (18 runtime + 50+ type exports)

## Decisions Made
- **Zod 3.24.4 instead of 4.x:** Plan referenced Zod 4.x API but the actual installed version from Plan 01 is 3.24.4. The z.object/.default()/.infer API is compatible between versions.
- **Synchronous RecommenderApi:** Recommendation rules are pure functions (sub-ms per REC-04). Made getRecommendations() synchronous instead of Promise-based to signal this is deterministic, not IO-bound.
- **Forward-declaration stubs in Task 1:** Created minimal stubs for agent/types, recommend/types, and ui/adapters/SkillUi to satisfy skill/types.ts imports. Task 2 replaced these with full definitions.
- **Additional exported types beyond plan minimum:** Added AgentConfig, UiConfig, StateConfig, AskOption, ProgressInput, ThemeColors, ThemeSymbols, ThemeSpacing, RecommendationPriority, SkillDefinitionInput for completeness.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- tsconfig base rootDir inheritance causes tsc --noEmit to fail in packages/core (rootDir resolves to monorepo src/ instead of package src/). This is a pre-existing issue from Plan 01 and does not affect tsup builds which handle their own tsconfig. Not in scope to fix here.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All type contracts are defined and exported; downstream plans (02-10) can import concrete interfaces
- Plan 02 (TOML Config System) can implement SunConfig loading against SunConfigSchema
- Plan 03 (Skill System) can implement defineSkill() factory and scanner against SkillDefinition/SkillContext
- Plan 04 (State Engine) can implement StateApi/FileStoreApi against defined interfaces
- Plan 05 (Agent Router) can implement AgentProvider/AgentRouterApi with typed errors
- No blockers identified

## Self-Check: PASSED

All 12 created/modified files verified present. Commits db974bc and 97cc505 verified in git log.

---
*Phase: 01-core-platform*
*Completed: 2026-03-28*
