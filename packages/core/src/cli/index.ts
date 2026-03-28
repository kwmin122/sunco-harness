/**
 * @sunco/core - CLI Module Exports
 *
 * Re-exports the CLI engine components: program factory,
 * skill-to-subcommand router, and lifecycle management.
 */

export { createProgram, levenshtein, findClosestCommand } from './program.js';
export { registerSkills } from './skill-router.js';
export type { SkillExecuteHook } from './skill-router.js';
export { createLifecycle } from './lifecycle.js';
export type { LifecycleServices, Lifecycle, BootOptions } from './lifecycle.js';
