/**
 * @sunco/core - Skill System
 *
 * Public API for the skill system: defineSkill(), scanner, registry,
 * resolver, context factory, and presets.
 */

// ---------------------------------------------------------------------------
// Types (re-exported from types.ts)
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
} from './types.js';

// ---------------------------------------------------------------------------
// defineSkill Factory
// ---------------------------------------------------------------------------
export { defineSkill, SkillDefinitionSchema } from './define.js';

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------
export { scanSkillFiles } from './scanner.js';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export { SkillRegistry, createRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// Resolver (D-13 pipeline)
// ---------------------------------------------------------------------------
export { resolveActiveSkills } from './resolver.js';

// ---------------------------------------------------------------------------
// Context Factory
// ---------------------------------------------------------------------------
export {
  createSkillContext,
  createBlockedAgentProxy,
} from './context.js';
export type { CreateSkillContextParams } from './context.js';

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
export { expandPreset, PRESET_REGISTRY } from './preset.js';
