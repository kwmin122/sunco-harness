/**
 * @sunco/core - Skill Definition Factory
 *
 * defineSkill() validates skill metadata via Zod and returns a frozen SkillDefinition.
 * This is the only way to create a valid skill definition (D-05: source of truth).
 *
 * Decisions: D-05 (defineSkill = source of truth), D-06 (ID != command),
 * D-12 (minimum required fields)
 */

import { z } from 'zod';
import type { SkillDefinition, SkillDefinitionInput } from './types.js';

// ---------------------------------------------------------------------------
// Zod Schema for SkillDefinition Metadata
// ---------------------------------------------------------------------------

/**
 * Zod schema for skill option definition.
 */
const SkillOptionSchema = z.object({
  flags: z.string().min(1, 'flags must not be empty'),
  description: z.string(),
  defaultValue: z.unknown().optional(),
});

/**
 * Zod schema for SkillDefinition metadata.
 * Validates all required fields with precise error messages.
 */
export const SkillDefinitionSchema = z.object({
  id: z.string().min(1, 'id must not be empty'),
  command: z.string().min(1, 'command must not be empty'),
  description: z.string().min(1, 'description must not be empty'),
  kind: z.enum(['deterministic', 'prompt', 'hybrid']),
  stage: z.enum(['experimental', 'canary', 'stable', 'internal']),
  category: z.string().min(1, 'category must not be empty'),
  routing: z.enum(['routable', 'directExec']),
  options: z.array(SkillOptionSchema).optional(),
  complexity: z.enum(['simple', 'standard', 'complex']).optional(),
  execute: z.function().refine(
    (fn) => typeof fn === 'function',
    'execute must be a function',
  ),
});

// ---------------------------------------------------------------------------
// defineSkill Factory
// ---------------------------------------------------------------------------

/**
 * Create a validated, frozen SkillDefinition.
 *
 * @param input - Skill definition input with all required fields
 * @returns Frozen SkillDefinition
 * @throws ZodError with detailed field-level validation messages
 *
 * @example
 * ```ts
 * const mySkill = defineSkill({
 *   id: 'harness.init',
 *   command: 'init',
 *   kind: 'deterministic',
 *   stage: 'stable',
 *   category: 'harness',
 *   routing: 'directExec',
 *   description: 'Initialize project harness',
 *   execute: async (ctx) => ({ success: true }),
 * });
 * ```
 */
export function defineSkill(input: SkillDefinitionInput): SkillDefinition {
  // Validate with Zod -- throws ZodError listing all invalid/missing fields
  const validated = SkillDefinitionSchema.parse(input);

  // Freeze options array if present
  const options = validated.options
    ? Object.freeze(validated.options.map((opt) => Object.freeze(opt)))
    : undefined;

  // Return frozen skill definition
  const definition: SkillDefinition = Object.freeze({
    id: validated.id,
    command: validated.command,
    description: validated.description,
    kind: validated.kind,
    stage: validated.stage,
    category: validated.category,
    routing: validated.routing,
    options,
    complexity: validated.complexity,
    execute: validated.execute as SkillDefinition['execute'],
  });

  return definition;
}
