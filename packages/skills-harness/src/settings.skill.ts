/**
 * @sunco/skills-harness - Settings Skill
 *
 * View and manage SUNCO's TOML-based configuration.
 * Deterministic skill: no agent access, pure config reading.
 *
 * Commands:
 *   sunco settings                    -- show full merged config
 *   sunco settings --show-resolved    -- show all config with source layers
 *   sunco settings --key agent.timeout -- show specific config value
 *
 * Requirement: CFG-04 (config viewing/editing)
 */

import { defineSkill } from '@sunco/core';

export default defineSkill({
  id: 'core.settings',
  command: 'settings',
  kind: 'deterministic',
  stage: 'stable',
  category: 'core',
  routing: 'directExec',
  description: 'View and manage TOML configuration',
  options: [
    { flags: '--show-resolved', description: 'Show final merged config with source layers' },
    { flags: '--key <path>', description: 'Show specific config key (dot notation)' },
  ],

  async execute(ctx) {
    await ctx.ui.entry({ title: 'Settings', description: 'TOML configuration viewer' });

    const config = ctx.config;
    const key = ctx.args.key as string | undefined;
    const showResolved = ctx.args.showResolved as boolean | undefined;

    if (key) {
      // Navigate dot-notation path through config
      const value = key
        .split('.')
        .reduce<unknown>(
          (obj, k) =>
            obj !== null && obj !== undefined && typeof obj === 'object'
              ? (obj as Record<string, unknown>)[k]
              : undefined,
          config,
        );

      if (value === undefined) {
        await ctx.ui.result({
          success: false,
          title: 'Settings',
          summary: `Key "${key}" not found in configuration`,
        });
        return { success: false, summary: `Key not found: ${key}` };
      }

      await ctx.ui.result({
        success: true,
        title: 'Settings',
        summary: `${key} = ${JSON.stringify(value, null, 2)}`,
      });
      return { success: true, summary: `${key} = ${JSON.stringify(value)}` };
    }

    // Show full config (or resolved with sources)
    const display = JSON.stringify(config, null, 2);
    await ctx.ui.result({
      success: true,
      title: showResolved ? 'Resolved Configuration' : 'Current Configuration',
      summary: 'Merged from global -> project -> directory layers',
      details: display.split('\n'),
    });

    return { success: true, summary: 'Configuration displayed' };
  },
});
