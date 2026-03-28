/**
 * @sunco/core - Shared base types
 *
 * Common types used across all subsystems.
 */

/** Unique skill identifier (e.g., 'harness.init', 'core.settings') */
export type SkillId = string;

/** CLI command name (e.g., 'init', 'settings') */
export type CommandName = string;

/** Branded type marker for documentation -- no runtime overhead */
export type Branded<T, Brand extends string> = T & { readonly __brand: Brand };
