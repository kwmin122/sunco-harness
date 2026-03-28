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
// Config System Types
// ---------------------------------------------------------------------------
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
  SkillOption,
  SkillLogger,
} from './skill/types.js';

// ---------------------------------------------------------------------------
// State Engine Types
// ---------------------------------------------------------------------------
export { SUN_DIR_STRUCTURE } from './state/types.js';
export type {
  StateApi,
  FileStoreApi,
  StateEngine,
  SunDirKey,
} from './state/types.js';

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
} from './agent/types.js';

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
// UI Theme
// ---------------------------------------------------------------------------
export { theme } from './ui/theme/tokens.js';
export type { Theme, ThemeColors, ThemeSymbols, ThemeSpacing } from './ui/theme/tokens.js';

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
