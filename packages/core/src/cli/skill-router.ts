/**
 * @sunco/core - Skill-to-Subcommand Router
 *
 * Registers all skills from the SkillRegistry as Commander.js subcommands.
 * Each skill's command, description, and options are mapped to Commander.
 * The actual skill execution is deferred to an execute hook (lazy execution).
 *
 * Phase 32: A second pass registers alias commands. Alias invocations emit
 * a deprecation warning to stderr (suppressible via SUNCO_SUPPRESS_DEPRECATION=1)
 * and inject alias defaultArgs (user-provided args win on conflict).
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
// PostSkill Hook Runner (Phase 27)
// ---------------------------------------------------------------------------

/** Minimal duck type so core doesn't depend on skills-workflow's HookRunner */
export interface HookRunnerLike {
  emit(event: string, context: Record<string, unknown>): Promise<void>;
}

let _hookRunner: HookRunnerLike | null = null;

/**
 * Set the lifecycle hook runner. Called once during CLI boot from the
 * entry point that has access to both `@sunco/core` and `@sunco/skills-workflow`.
 */
export function setHookRunner(runner: HookRunnerLike): void {
  _hookRunner = runner;
}

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
 * PostSkill hooks fire after every skill execution (success or failure).
 * Hook errors are caught and never break the skill's own reporting.
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
  // --- Pass 1: register main skill commands (existing logic) ---
  for (const skill of registry.getAll()) {
    const sub = program
      .command(skill.command)
      .description(skill.description);

    if (skill.options) {
      for (const opt of skill.options) {
        sub.option(
          opt.flags,
          opt.description,
          opt.defaultValue as string | boolean | string[] | undefined,
        );
      }
    }

    sub.action(async (options: Record<string, unknown>) => {
      const startedAt = Date.now();
      let succeeded = true;
      try {
        await executeHook(skill.id, options);
      } catch (err) {
        succeeded = false;
        throw err;
      } finally {
        // PostSkill hook — errors MUST NOT break the CLI
        await _hookRunner?.emit('PostSkill', {
          skillId: skill.id,
          cwd: process.cwd(),
          outcome: succeeded ? 'success' : 'failure',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        }).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(`[sunco:hook] PostSkill handler failed: ${msg}\n`);
        });
      }
    });
  }

  // --- Pass 2: register alias commands (Phase 32) ---
  // Aliases are hidden deprecated commands that dispatch to the absorbing skill
  // with defaultArgs injected. User args always win on conflict (D-04).
  for (const skill of registry.getAll()) {
    if (!skill.aliases) continue;

    for (const alias of skill.aliases) {
      // Confirm registry has this alias registered (guards against collision)
      const resolution = registry.resolveCommand(alias.command);
      if (!resolution || !resolution.isAlias) continue;

      const aliasDescription = alias.replacedBy
        ? `${skill.description} (alias for ${alias.replacedBy})`
        : skill.description;

      const aliasSub = program
        .command(alias.command)
        .description(aliasDescription);

      // Inherit all options from the main skill so flags like --json still parse
      if (skill.options) {
        for (const opt of skill.options) {
          aliasSub.option(
            opt.flags,
            opt.description,
            opt.defaultValue as string | boolean | string[] | undefined,
          );
        }
      }

      // Capture alias in closure for the action handler
      const capturedAlias = alias;
      const capturedSkill = skill;

      aliasSub.action(async (options: Record<string, unknown>) => {
        // Emit deprecation warning to stderr (D-05), suppressible via env var
        if (!process.env.SUNCO_SUPPRESS_DEPRECATION) {
          process.stderr.write(
            `[deprecated] '${capturedAlias.command}' is an alias${capturedAlias.replacedBy ? ` for '${capturedAlias.replacedBy}'` : ''}\n`,
          );
        }

        // Merge: defaultArgs first, user options override (user wins on conflict, D-04)
        const mergedOptions: Record<string, unknown> = {
          ...capturedAlias.defaultArgs,
          ...options,
        };

        const startedAt = Date.now();
        let succeeded = true;
        try {
          await executeHook(capturedSkill.id, mergedOptions);
        } catch (err) {
          succeeded = false;
          throw err;
        } finally {
          // PostSkill hook — errors MUST NOT break the CLI
          await _hookRunner?.emit('PostSkill', {
            skillId: capturedSkill.id,
            cwd: process.cwd(),
            outcome: succeeded ? 'success' : 'failure',
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
          }).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[sunco:hook] PostSkill handler failed: ${msg}\n`);
          });
        }
      });
    }
  }
}
