/**
 * @sunco/core - Skill-facing UI Contract (stub)
 *
 * Forward declarations for skill/types.ts imports.
 * Full definitions added in Task 2.
 */

// Stub: SkillUi referenced by SkillContext
export interface SkillUi {
  // Full definition in Task 2
  entry(input: unknown): Promise<void>;
  ask(input: unknown): Promise<unknown>;
  progress(input: unknown): unknown;
  result(input: unknown): Promise<void>;
}
