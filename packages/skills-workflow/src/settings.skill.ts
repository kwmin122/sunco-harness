/**
 * @sunco/skills-workflow - Enhanced Settings Skill
 *
 * View and manage SUNCO's TOML-based configuration with write-back.
 * Replaces the Phase 1 harness settings with read-write support.
 *
 * Commands:
 *   sunco settings                         -- show full merged config
 *   sunco settings --show-resolved         -- show all config with source layers
 *   sunco settings --key agent.timeout     -- show specific config value
 *   sunco settings --set agent.timeout=60000        -- write to project config
 *   sunco settings --set agent.timeout=60000 --global  -- write to global config
 *
 * Requirement: SET-01 (settings interactive UI), CFG-04 (config viewing/editing)
 * Decisions: D-14 (enhanced settings), D-15 (--set mutation), D-16 (layer write-back)
 */

import { defineSkill } from '@sunco/core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

// ---------------------------------------------------------------------------
// Helper functions (module-private, exported for testing with _ prefix)
// ---------------------------------------------------------------------------

/**
 * Auto-detect value type from raw string input.
 * "true"/"false" -> boolean, numeric strings -> number, else string.
 */
export function _parseValueType(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Try numeric conversion (only for non-empty strings)
  if (raw !== '' && !isNaN(Number(raw))) {
    return Number(raw);
  }

  return raw;
}

/**
 * Set a nested key using dot-path notation.
 * Creates intermediate objects as needed.
 */
export function _setNestedKey(
  obj: Record<string, unknown>,
  keyPath: string,
  value: unknown,
): void {
  const parts = keyPath.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (
      current[part] === undefined ||
      current[part] === null ||
      typeof current[part] !== 'object'
    ) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.settings',
  command: 'settings',
  kind: 'deterministic',
  stage: 'stable',
  category: 'core',
  routing: 'directExec',
  description: 'View and manage TOML configuration',
  options: [
    { flags: '--show-resolved', description: 'Show final merged config with source layers' },
    { flags: '--key <path>', description: 'Show specific config key (dot notation)' },
    { flags: '--set <kv>', description: 'Set config value (key=value)' },
    { flags: '--global', description: 'Write to global config (~/.sun/config.toml)' },
  ],

  async execute(ctx) {
    await ctx.ui.entry({ title: 'Settings', description: 'TOML configuration manager' });

    const config = ctx.config;
    const key = ctx.args.key as string | undefined;
    const setKv = ctx.args.set as string | undefined;
    const showResolved = ctx.args.showResolved as boolean | undefined;
    const useGlobal = ctx.args.global as boolean | undefined;

    // --set flag: write config value to TOML file
    if (setKv) {
      const eqIndex = setKv.indexOf('=');
      if (eqIndex === -1) {
        await ctx.ui.result({
          success: false,
          title: 'Settings',
          summary: 'Invalid format. Use key=value (e.g., --set agent.timeout=60000)',
        });
        return { success: false, summary: 'Invalid format. Use key=value' };
      }

      const configKey = setKv.slice(0, eqIndex);
      const rawValue = setKv.slice(eqIndex + 1);
      const typedValue = _parseValueType(rawValue);

      // Determine config file path
      const layer = useGlobal ? 'global' : 'project';
      const configPath = useGlobal
        ? join(homedir(), '.sun', 'config.toml')
        : join(ctx.cwd, '.sun', 'config.toml');

      // Read existing TOML or start with empty object
      let existing: Record<string, unknown> = {};
      try {
        const content = await readFile(configPath, 'utf-8');
        existing = parseToml(content) as Record<string, unknown>;
      } catch {
        // File doesn't exist or can't be read -- start fresh
      }

      // Set the nested key
      _setNestedKey(existing, configKey, typedValue);

      // Write back as valid TOML
      const tomlOutput = stringifyToml(existing);
      const configDir = join(configPath, '..');
      await mkdir(configDir, { recursive: true });
      await writeFile(configPath, tomlOutput, 'utf-8');

      await ctx.ui.result({
        success: true,
        title: 'Settings',
        summary: `Set ${configKey} = ${JSON.stringify(typedValue)} in ${layer} config`,
      });
      return { success: true, summary: `Set ${configKey} = ${JSON.stringify(typedValue)} in ${layer} config` };
    }

    // --key flag: show specific value
    if (key) {
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

    // Default: show full config (or resolved with sources)
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
