/**
 * @sunco/core - Skill-to-Subcommand Router
 *
 * Registers all skills from the SkillRegistry as Commander.js subcommands.
 * Each skill's command, description, and options are mapped to Commander.
 * The actual skill execution is deferred to an execute hook (lazy execution).
 *
 * Requirements: CLI-02 (skill auto-discovery as subcommands), CLI-03 (--help)
 */

import type { Command } from 'commander';
import type { SkillRegistry } from '../skill/registry.js';

// ---------------------------------------------------------------------------
// Execute Hook Type
// ---------------------------------------------------------------------------

/**
 * Hook called when a skill subcommand is invoked.
 * The CLI lifecycle provides this to wire skill execution with full context.
 */
export type SkillExecuteHook = (
  skillId: string,
  options: Record<string, unknown>,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Skill Registration
// ---------------------------------------------------------------------------

/**
 * Register all skills from the registry as Commander.js subcommands.
 *
 * For each skill:
 * - Creates a subcommand with the skill's command name
 * - Sets the skill description
 * - Adds each skill option (flags, description, default)
 * - Sets the action to call executeHook(skillId, options)
 *
 * This implements lazy execution: Commander parses args, but skill execute()
 * only runs when the command is actually invoked (startup latency optimization).
 *
 * @param program - Root Commander.js program
 * @param registry - Skill registry with all active skills
 * @param executeHook - Callback to invoke when a skill command is executed
 */
export function registerSkills(
  program: Command,
  registry: SkillRegistry,
  executeHook: SkillExecuteHook,
): void {
  for (const skill of registry.getAll()) {
    const sub = program
      .command(skill.command)
      .description(skill.description);

    // Add skill-specific options
    if (skill.options) {
      for (const opt of skill.options) {
        sub.option(
          opt.flags,
          opt.description,
          opt.defaultValue as string | boolean | string[] | undefined,
        );
      }
    }

    // Wire the action to the execute hook
    sub.action(async (options: Record<string, unknown>) => {
      await executeHook(skill.id, options);
    });
  }
}
