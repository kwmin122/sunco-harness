---
phase: 01-core-platform
plan: 01b
type: execute
wave: 1
depends_on: ["01-01"]
files_modified:
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
  - packages/core/src/index.ts
autonomous: true
requirements:
  - CLI-01

must_haves:
  truths:
    - "All Phase 1 type contracts are exported from @sunco/core"
    - "turbo build compiles all packages including type definitions without TypeScript errors"
    - "Downstream plans can import SkillDefinition, SunConfig, AgentProvider, etc. from @sunco/core"
  artifacts:
    - path: "packages/core/src/config/types.ts"
      provides: "SunConfig Zod schema and types"
      exports: ["SunConfigSchema", "SunConfig", "SkillPolicySchema", "SkillPolicyConfig"]
    - path: "packages/core/src/skill/types.ts"
      provides: "Skill system types"
      exports: ["SkillDefinition", "SkillContext", "SkillResult", "SkillKind", "SkillStage", "SkillRouting"]
    - path: "packages/core/src/state/types.ts"
      provides: "State engine types"
      exports: ["StateApi", "FileStoreApi", "StateEngine", "SUN_DIR_STRUCTURE"]
    - path: "packages/core/src/agent/types.ts"
      provides: "Agent system types"
      exports: ["AgentProvider", "AgentResult", "AgentRequest", "PermissionSet", "AgentRouterApi"]
    - path: "packages/core/src/agent/errors.ts"
      provides: "Agent error hierarchy (4 error types per D-27)"
      exports: ["ProviderUnavailableError", "PermissionDeniedError", "ExecutionTimeoutError", "ProviderExecutionError"]
    - path: "packages/core/src/recommend/types.ts"
      provides: "Recommendation types"
      exports: ["Recommendation", "RecommendationRule", "RecommendationState", "RecommenderApi"]
    - path: "packages/core/src/ui/adapters/SkillUi.ts"
      provides: "Skill-facing UI contract (D-38)"
      exports: ["SkillUi", "SkillEntryInput", "AskInput", "UiChoiceResult", "ProgressHandle", "ResultInput"]
    - path: "packages/core/src/ui/adapters/UiAdapter.ts"
      provides: "Renderer-facing UI adapter contract (D-38)"
      exports: ["UiAdapter", "UiPattern", "UiOutcome", "UiPatch"]
    - path: "packages/core/src/ui/theme/tokens.ts"
      provides: "Theme tokens (colors, symbols, spacing) per D-40"
      exports: ["theme", "Theme"]
    - path: "packages/core/src/errors/index.ts"
      provides: "Base error hierarchy"
      exports: ["SunError", "ConfigError", "SkillNotFoundError", "CircularSkillInvocationError", "DuplicateSkillError"]
    - path: "packages/core/src/index.ts"
      provides: "Barrel re-export of all type modules"
  key_links:
    - from: "packages/core/src/skill/types.ts"
      to: "packages/core/src/config/types.ts"
      via: "SkillContext.config references SunConfig"
      pattern: "import.*SunConfig"
    - from: "packages/core/src/skill/types.ts"
      to: "packages/core/src/agent/types.ts"
      via: "SkillContext.agent references AgentRouterApi"
      pattern: "import.*AgentRouterApi"
    - from: "packages/core/src/index.ts"
      to: "packages/core/src/*/types.ts"
      via: "barrel re-export"
      pattern: "export.*from"
---

<objective>
Define ALL shared TypeScript type contracts for Phase 1 subsystems: Config, Skill, State, Agent, Recommender, UX, and Error types.

Purpose: Type contracts defined here prevent the "scavenger hunt" anti-pattern -- downstream executors (Plans 02-10) receive concrete interfaces to implement against, not ambiguity. No implementation logic -- only types, interfaces, and Zod schemas.

Output: All TypeScript interfaces exported from @sunco/core for every Phase 1 subsystem.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-core-platform/01-CONTEXT.md
@.planning/phases/01-core-platform/01-RESEARCH.md
@.planning/phases/01-core-platform/01-01-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Define type contracts for Config, Skill, State, and Error subsystems</name>
  <files>
    packages/core/src/config/types.ts,
    packages/core/src/skill/types.ts,
    packages/core/src/state/types.ts,
    packages/core/src/errors/index.ts,
    packages/core/src/types.ts
  </files>
  <read_first>
    .planning/phases/01-core-platform/01-CONTEXT.md (decisions D-05, D-06, D-07, D-08, D-12, D-14),
    .planning/phases/01-core-platform/01-RESEARCH.md (Pattern 1-3 code examples),
    packages/core/package.json
  </read_first>
  <action>
    Create type definition files with no implementation logic -- only types, interfaces, and Zod schemas.

    **packages/core/src/config/types.ts** (per D-01, CFG-01~03):
    ```typescript
    import { z } from 'zod';

    export const SkillPolicySchema = z.object({
      preset: z.string().default('none'),
      add: z.array(z.string()).default([]),
      remove: z.array(z.string()).default([]),
    });

    export const AgentConfigSchema = z.object({
      defaultProvider: z.string().default('claude-code-cli'),
      timeout: z.number().default(120_000),
      maxRetries: z.number().default(1),
    });

    export const SunConfigSchema = z.object({
      skills: SkillPolicySchema.default({}),
      agent: AgentConfigSchema.default({}),
      ui: z.object({
        theme: z.string().default('default'),
        silent: z.boolean().default(false),
        json: z.boolean().default(false),
      }).default({}),
      state: z.object({
        dbPath: z.string().default('.sun/state.db'),
      }).default({}),
    });

    export type SunConfig = z.infer<typeof SunConfigSchema>;
    export type SkillPolicyConfig = z.infer<typeof SkillPolicySchema>;
    ```

    **packages/core/src/skill/types.ts** (per D-05, D-06, D-07, D-08, D-12):
    Full SkillDefinition, SkillContext, SkillResult, SkillLogger interfaces with proper forward references via import type.

    **packages/core/src/state/types.ts** (per STE-01~05):
    StateApi, FileStoreApi, StateEngine interfaces and SUN_DIR_STRUCTURE const.

    **packages/core/src/errors/index.ts:**
    SunError base class + ConfigError, SkillNotFoundError, CircularSkillInvocationError, DuplicateSkillError.

    See Plan 01 original Task 2 action for exact type definitions of each file.
  </action>
  <verify>
    <automated>cd /Users/min-kyungwook/SUN && npx turbo build --filter=@sunco/core 2>&1 | tail -10</automated>
  </verify>
  <done>Config, Skill, State, and Error type contracts compile without TypeScript errors.</done>
</task>

<task type="auto">
  <name>Task 2: Define type contracts for Agent, Recommender, and UX subsystems</name>
  <files>
    packages/core/src/agent/types.ts,
    packages/core/src/agent/errors.ts,
    packages/core/src/recommend/types.ts,
    packages/core/src/ui/adapters/SkillUi.ts,
    packages/core/src/ui/adapters/UiAdapter.ts,
    packages/core/src/ui/theme/tokens.ts,
    packages/core/src/index.ts
  </files>
  <read_first>
    .planning/phases/01-core-platform/01-CONTEXT.md (decisions D-15~D-29, D-30~D-40),
    .planning/phases/01-core-platform/01-RESEARCH.md (Pattern 4-5 code examples),
    packages/core/src/config/types.ts (just created in Task 1),
    packages/core/src/skill/types.ts (just created in Task 1)
  </read_first>
  <action>
    **packages/core/src/agent/types.ts** (per D-15~D-29):
    AgentRole, AgentFamily, AgentTransport types. PermissionSet, Artifact, AgentUsage, AgentResult, AgentRequest, AgentExecutionContext, AgentProvider, AgentRouterApi interfaces.

    **packages/core/src/agent/errors.ts** (per D-27):
    AgentError base class + ProviderUnavailableError, PermissionDeniedError, ExecutionTimeoutError, ProviderExecutionError (4 error types).

    **packages/core/src/recommend/types.ts** (per REC-01~04):
    Recommendation, RecommendationRule, RecommendationState, RecommenderApi interfaces.

    **packages/core/src/ui/adapters/SkillUi.ts** (per D-33, D-34, D-35, D-36, D-38):
    SkillEntryInput, AskOption, AskInput, UiChoiceResult, ProgressInput, ProgressHandle, ResultInput, SkillUi interfaces.

    **packages/core/src/ui/adapters/UiAdapter.ts** (per D-38, D-39):
    UiPatternKind, UiPattern, UiOutcome, UiPatch, UiAdapter interfaces.

    **packages/core/src/ui/theme/tokens.ts** (per D-40):
    theme const with colors (primary, success, warning, error, muted, text, dim), symbols (checkmark, cross, warning triangle, info, arrow, bullet, spinner frames), spacing (xs, sm, md, lg). Theme type.

    **packages/core/src/index.ts:**
    Barrel re-export all types from config/types, skill/types, state/types, agent/types, agent/errors, recommend/types, ui/adapters/SkillUi, ui/adapters/UiAdapter, ui/theme/tokens, errors/index.

    See Plan 01 original Task 2 action for exact type definitions of each file.

    Ensure `npx turbo build` succeeds after all type files are created.
  </action>
  <verify>
    <automated>cd /Users/min-kyungwook/SUN && npx turbo build --force 2>&1 | tail -10 && node -e "import('@sunco/core').then(m => { console.log(Object.keys(m).length > 0 ? 'EXPORTS OK' : 'NO EXPORTS') }).catch(e => console.log('IMPORT FAIL:', e.message))"</automated>
  </verify>
  <done>All TypeScript type contracts are defined and exported from @sunco/core. Every downstream plan has concrete interfaces to implement against.</done>
</task>

</tasks>

<verification>
- `npx turbo build --force` exits 0 across all packages
- `packages/core/dist/index.js` exists and exports all type modules
- All type files contain their expected exports (SkillDefinition, SunConfig, AgentProvider, etc.)
</verification>

<success_criteria>
1. All Phase 1 type contracts (SkillDefinition, SkillContext, SunConfig, AgentProvider, AgentResult, PermissionSet, SkillUi, Recommendation) are exported from @sunco/core
2. Turborepo build succeeds with all type definitions compiled
3. No implementation logic in any type file -- only types, interfaces, Zod schemas, and constants
</success_criteria>

<output>
After completion, create `.planning/phases/01-core-platform/01-01b-SUMMARY.md`
</output>
