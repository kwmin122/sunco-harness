/**
 * @sunco/core - Skill Preset Registry
 *
 * Predefined skill groupings that can be referenced in config.
 * expandPreset('harness') => list of harness skill IDs.
 *
 * Decisions: D-10 (system presets), D-09 (whitelist approach)
 */

// ---------------------------------------------------------------------------
// Preset Registry
// ---------------------------------------------------------------------------

/**
 * Predefined skill presets mapping preset name to skill IDs.
 * 'none' is the empty preset (no skills enabled by default).
 */
export const PRESET_REGISTRY: Readonly<Record<string, readonly string[]>> = {
  none: [],

  core: [
    'core.settings',
    'core.status',
    'core.next',
    'core.progress',
  ],

  harness: [
    'harness.init',
    'harness.lint',
    'harness.health',
    'harness.agents',
    'harness.guard',
  ],

  workflow: [
    'workflow.new',
    'workflow.scan',
    'workflow.discuss',
    'workflow.plan',
    'workflow.execute',
    'workflow.review',
    'workflow.verify',
    'workflow.ship',
  ],

  full: [
    // harness skills
    'harness.init',
    'harness.lint',
    'harness.health',
    'harness.agents',
    'harness.guard',
    // workflow skills
    'workflow.new',
    'workflow.scan',
    'workflow.discuss',
    'workflow.plan',
    'workflow.execute',
    'workflow.review',
    'workflow.verify',
    'workflow.ship',
    // core skills
    'core.settings',
    'core.status',
    'core.next',
    'core.progress',
  ],
} as const;

// ---------------------------------------------------------------------------
// Preset Expansion
// ---------------------------------------------------------------------------

/**
 * Expand a preset name to its constituent skill IDs.
 * Returns an empty array for unknown presets (no throw).
 *
 * @param name - Preset name (e.g., 'harness', 'workflow', 'full', 'none')
 * @returns Array of skill IDs in the preset
 */
export function expandPreset(name: string): readonly string[] {
  return PRESET_REGISTRY[name] ?? [];
}
