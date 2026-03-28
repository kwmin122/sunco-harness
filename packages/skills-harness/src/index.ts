/**
 * @sunco/skills-harness - Harness engineering skills
 *
 * Linting, validation, and enforcement skills that ensure
 * agents make fewer mistakes.
 *
 * Skills:
 *   - core.settings: View and manage TOML configuration (CFG-04)
 *   - sample.prompt: Sample skill demonstrating agent dispatch (SKL-05)
 *   - harness.init: Project detection and workspace initialization (HRN-01, HRN-02, HRN-03, HRN-04)
 *   - harness.lint: Architecture-aware ESLint with layer enforcement (HRN-06, HRN-07, HRN-08)
 *   - harness.health: Codebase health score (HRN-09, HRN-10, HRN-11)
 *   - harness.agents: Analyze agent instruction files (HRN-12, HRN-13)
 *   - harness.guard: Anti-pattern detection, lint rule promotion, watch mode (HRN-14, HRN-15, HRN-16)
 */

// --- Skill exports ---
// Note: settingsSkill moved to @sunco/skills-workflow (enhanced with write-back)
export { default as samplePromptSkill } from './sample-prompt.skill.js';
export { default as initSkill } from './init.skill.js';
export { default as lintSkill } from './lint.skill.js';
export { default as healthSkill } from './health.skill.js';
export { default as agentsSkill } from './agents.skill.js';
export { default as guardSkill } from './guard.skill.js';

// --- Type re-exports ---
export type {
  InitResult,
  EcosystemResult,
  LayerResult,
  ConventionResult,
  DetectedLayer,
} from './init/types.js';

export type {
  SunLintRule,
  SunLintViolation,
  LintResult,
} from './lint/types.js';

export type {
  HealthReport,
  HealthSnapshot,
} from './health/types.js';

export type {
  AgentDocReport,
  AgentDocMetrics,
} from './agents/types.js';

export type {
  GuardResult,
  PromotionSuggestion,
} from './guard/types.js';
