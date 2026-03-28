/**
 * @sunco/core - Config System Barrel Export
 *
 * Re-exports the config loading, merging, validation, and type APIs.
 */

// Loader
export { loadConfig } from './loader.js';
export type { LoadConfigOptions } from './loader.js';

// Merger
export { deepMerge } from './merger.js';

// Schema validation
export { validateConfig, SunConfigSchema } from './schema.js';

// Types (re-exported from types.ts for convenience)
export type { SunConfig, SkillPolicyConfig, AgentConfig, UiConfig, StateConfig } from './types.js';
export {
  SkillPolicySchema,
  AgentConfigSchema,
  UiConfigSchema,
  StateConfigSchema,
} from './types.js';
