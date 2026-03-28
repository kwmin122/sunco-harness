/**
 * @sunco/skills-harness - Lint Config Generator
 *
 * Converts DetectedLayer[] (from init detection) into eslint-plugin-boundaries
 * flat config. This is the bridge between project analysis and ESLint enforcement.
 *
 * The default policy is 'disallow' (per D-07): all cross-layer imports are
 * forbidden unless explicitly allowed by canImportFrom rules.
 *
 * Key insight: eslint-plugin-boundaries uses `mode: 'folder'` for directory-based
 * element matching. Dependency rules use `{ from: { type }, allow: { to: { type } } }`
 * format (not array-based).
 *
 * Decisions: D-06 (hybrid ESLint approach), D-07 (layers -> boundaries mapping)
 */

import { createRequire } from 'node:module';
import type { DetectedLayer } from '../init/types.js';
import type { BoundariesConfig, BoundariesDependencyRule, BoundariesElement } from './types.js';

// eslint-plugin-boundaries is CJS; use createRequire for reliable import in ESM
// (Same pattern as picomatch in Phase 1)
const require = createRequire(import.meta.url);

/**
 * Generate a BoundariesConfig from detected architectural layers.
 *
 * Maps each DetectedLayer to:
 * - A BoundariesElement with `mode: 'folder'` for directory matching
 * - A BoundariesDependencyRule in the plugin's native `from/allow` format
 *
 * @param layers - Detected layers from init detection
 * @returns BoundariesConfig ready for ESLint flat config generation
 */
export function generateBoundariesConfig(layers: DetectedLayer[]): BoundariesConfig {
  const elements: BoundariesElement[] = layers.map((layer) => ({
    type: layer.name,
    pattern: layer.pattern,
    mode: 'folder' as const,
  }));

  const dependencyRules: BoundariesDependencyRule[] = layers.map((layer) => ({
    from: { type: layer.name },
    allow: {
      to: {
        type: layer.canImportFrom.length > 0 ? layer.canImportFrom : [],
      },
    },
  }));

  return { elements, dependencyRules };
}

/**
 * Generate a complete ESLint flat config array from a BoundariesConfig.
 *
 * Produces a single config object with:
 * - `plugins.boundaries`: the eslint-plugin-boundaries plugin instance
 * - `settings['boundaries/elements']`: element type definitions
 * - `settings['boundaries/include']`: file patterns to analyze
 * - `rules['boundaries/dependencies']`: dependency direction enforcement
 *
 * The default policy is 'disallow' -- only explicitly allowed imports pass.
 *
 * @param config - BoundariesConfig from generateBoundariesConfig()
 * @returns Array of ESLint flat config objects ready for overrideConfig
 */
export function generateEslintFlatConfig(config: BoundariesConfig): object[] {
  // Load eslint-plugin-boundaries via createRequire (CJS module in ESM project)
  const boundariesPlugin = require('eslint-plugin-boundaries') as Record<string, unknown>;

  return [
    {
      plugins: { boundaries: boundariesPlugin },
      settings: {
        'boundaries/elements': config.elements,
        'boundaries/include': ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      },
      rules: {
        'boundaries/dependencies': [
          2,
          {
            default: 'disallow',
            rules: config.dependencyRules,
          },
        ],
      },
    },
  ];
}
