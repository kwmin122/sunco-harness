/**
 * @sunco/core - SUNCO Workspace OS Core
 *
 * Infrastructure module providing config, state, skill system,
 * agent router, and shared types for the SUNCO platform.
 */

export const VERSION = '0.0.1';

// ---------------------------------------------------------------------------
// Shared Base Types
// ---------------------------------------------------------------------------
export type { SkillId, CommandName, Branded } from './types.js';

// ---------------------------------------------------------------------------
// Config System
// ---------------------------------------------------------------------------
export { loadConfig } from './config/loader.js';
export type { LoadConfigOptions } from './config/loader.js';
export { deepMerge } from './config/merger.js';
export { validateConfig } from './config/schema.js';
export {
  SunConfigSchema,
  SkillPolicySchema,
  AgentConfigSchema,
  UiConfigSchema,
  StateConfigSchema,
} from './config/types.js';
export type {
  SunConfig,
  SkillPolicyConfig,
  AgentConfig,
  UiConfig,
  StateConfig,
} from './config/types.js';

// ---------------------------------------------------------------------------
// Skill System Types
// ---------------------------------------------------------------------------
export type {
  SkillDefinition,
  SkillDefinitionInput,
  SkillContext,
  SkillResult,
  SkillKind,
  SkillStage,
  SkillRouting,
  SkillCategory,
  SkillComplexity,
  SkillOption,
  SkillLogger,
} from './skill/types.js';

// ---------------------------------------------------------------------------
// Skill System Implementation
// ---------------------------------------------------------------------------
export { defineSkill, SkillDefinitionSchema } from './skill/define.js';
export { scanSkillFiles } from './skill/scanner.js';
export { SkillRegistry, createRegistry } from './skill/registry.js';
export { resolveActiveSkills } from './skill/resolver.js';
export {
  createSkillContext,
  createBlockedAgentProxy,
} from './skill/context.js';
export type { CreateSkillContextParams } from './skill/context.js';
export { expandPreset, PRESET_REGISTRY } from './skill/preset.js';

// ---------------------------------------------------------------------------
// State Engine
// ---------------------------------------------------------------------------
export { SUN_DIR_STRUCTURE } from './state/types.js';
export type {
  StateApi,
  FileStoreApi,
  StateEngine,
  SunDirKey,
} from './state/types.js';
export { createStateEngine } from './state/api.js';
export { initSunDirectory, ensureSunDir } from './state/directory.js';
export { createDatabase, StateDatabase } from './state/database.js';
export { FileStore } from './state/file-store.js';

// Active-work dashboard artifact (Phase 27)
export {
  readActiveWork,
  writeActiveWork,
  appendBackgroundWork,
  appendRoutingMiss,
  ACTIVE_WORK_PATH,
  DEFAULT_ACTIVE_WORK,
} from './state/active-work.js';
export type {
  Category,
  ActivePhase,
  BackgroundWorkItem,
  BlockedOn,
  NextRecommendedAction,
  RecentSkillCall,
  RoutingMiss,
  ActiveWork,
  ActiveWorkPatch,
} from './state/active-work.types.js';
export { ActiveWorkSchema, CATEGORIES, ACTIVE_WORK_VERSION } from './state/active-work.types.js';

// ---------------------------------------------------------------------------
// Agent System Types
// ---------------------------------------------------------------------------
export type {
  AgentProvider,
  AgentResult,
  AgentRequest,
  AgentExecutionContext,
  AgentRouterApi,
  AgentFamily,
  AgentTransport,
  AgentRole,
  PermissionSet,
  Artifact,
  AgentUsage,
  UsageEntry,
} from './agent/types.js';

// ---------------------------------------------------------------------------
// Agent Router + Providers
// ---------------------------------------------------------------------------
export { createAgentRouter } from './agent/router.js';
export type { AgentRouterConfig } from './agent/router.js';
export { ROLE_PERMISSIONS, enforcePermissions } from './agent/permission.js';
export { ClaudeCliProvider } from './agent/providers/claude-cli.js';
export { ClaudeSdkProvider } from './agent/providers/claude-sdk.js';
export { normalizeResult } from './agent/result.js';
export type { RawProviderResult } from './agent/result.js';
export { UsageTracker } from './agent/tracker.js';

// ---------------------------------------------------------------------------
// Agent Errors
// ---------------------------------------------------------------------------
export {
  AgentError,
  ProviderUnavailableError,
  PermissionDeniedError,
  ExecutionTimeoutError,
  ProviderExecutionError,
} from './agent/errors.js';

// ---------------------------------------------------------------------------
// Recommendation Types
// ---------------------------------------------------------------------------
export type {
  Recommendation,
  RecommendationRule,
  RecommendationState,
  RecommenderApi,
  RecommendationPriority,
} from './recommend/types.js';

// ---------------------------------------------------------------------------
// UI Adapters (Skill-facing)
// ---------------------------------------------------------------------------
export type {
  SkillUi,
  SkillEntryInput,
  AskOption,
  AskInput,
  UiChoiceResult,
  ProgressInput,
  ProgressHandle,
  ResultInput,
} from './ui/adapters/SkillUi.js';

// ---------------------------------------------------------------------------
// UI Adapters (Renderer-facing)
// ---------------------------------------------------------------------------
export type {
  UiAdapter,
  UiPatternKind,
  UiPattern,
  UiOutcome,
  UiPatch,
} from './ui/adapters/UiAdapter.js';

// ---------------------------------------------------------------------------
// UI Adapter Implementations + Factories
// ---------------------------------------------------------------------------
export { SilentUiAdapter } from './ui/adapters/SilentUiAdapter.js';
export { InkUiAdapter } from './ui/adapters/InkUiAdapter.js';
export { createSkillUi, createUiAdapter } from './ui/adapters/index.js';
export type { CreateUiAdapterFlags } from './ui/adapters/index.js';

// ---------------------------------------------------------------------------
// UI Theme
// ---------------------------------------------------------------------------
export { theme } from './ui/theme/tokens.js';
export type { Theme, ThemeColors, ThemeSymbols, ThemeSpacing } from './ui/theme/tokens.js';

// ---------------------------------------------------------------------------
// UI Primitives (Layer 1)
// ---------------------------------------------------------------------------
export { SunBox } from './ui/primitives/Box.js';
export type { SunBoxProps } from './ui/primitives/Box.js';

export { SunText } from './ui/primitives/Text.js';
export type { SunTextProps } from './ui/primitives/Text.js';

export { Badge } from './ui/primitives/Badge.js';
export type { BadgeProps } from './ui/primitives/Badge.js';

// ---------------------------------------------------------------------------
// UI Components (Layer 2)
// ---------------------------------------------------------------------------
export { StatusSymbol } from './ui/components/StatusSymbol.js';
export type { StatusType, StatusSymbolProps } from './ui/components/StatusSymbol.js';

export { ErrorBox } from './ui/components/ErrorBox.js';
export type { ErrorBoxProps } from './ui/components/ErrorBox.js';

export { RecommendationCard } from './ui/components/RecommendationCard.js';
export type { RecommendationCardProps } from './ui/components/RecommendationCard.js';

// ---------------------------------------------------------------------------
// UI Interaction Patterns (Layer 3)
// ---------------------------------------------------------------------------
export { SkillEntry } from './ui/patterns/SkillEntry.js';
export type { SkillEntryProps } from './ui/patterns/SkillEntry.js';

export { InteractiveChoice } from './ui/patterns/InteractiveChoice.js';
export type { InteractiveChoiceProps } from './ui/patterns/InteractiveChoice.js';

export { SkillProgress } from './ui/patterns/SkillProgress.js';
export type { SkillProgressProps } from './ui/patterns/SkillProgress.js';

export { SkillResult as SkillResultPattern } from './ui/patterns/SkillResult.js';
export type { SkillResultProps } from './ui/patterns/SkillResult.js';

// ---------------------------------------------------------------------------
// UI Hooks
// ---------------------------------------------------------------------------
export { useSelection, useKeymap } from './ui/hooks/index.js';
export type { UseSelectionOptions, UseSelectionResult } from './ui/hooks/index.js';

// ---------------------------------------------------------------------------
// UI Session
// ---------------------------------------------------------------------------
export { StatusBar } from './ui/session/StatusBar.js';
export type { StatusBarProps } from './ui/session/StatusBar.js';

// ---------------------------------------------------------------------------
// CLI Engine
// ---------------------------------------------------------------------------
export { createProgram, levenshtein, findClosestCommand, isRootHelpRequest, ROOT_HELP_MESSAGE } from './cli/program.js';
export { registerSkills } from './cli/skill-router.js';
export type { SkillExecuteHook } from './cli/skill-router.js';
export { createLifecycle, createNoopRecommender } from './cli/lifecycle.js';
export type { LifecycleServices, Lifecycle } from './cli/lifecycle.js';

// ---------------------------------------------------------------------------
// Recommendation Engine
// ---------------------------------------------------------------------------
export { createRecommender, RecommenderEngine } from './recommend/engine.js';

// ---------------------------------------------------------------------------
// Base Errors
// ---------------------------------------------------------------------------
export {
  SunError,
  ConfigError,
  SkillNotFoundError,
  CircularSkillInvocationError,
  DuplicateSkillError,
} from './errors/index.js';
