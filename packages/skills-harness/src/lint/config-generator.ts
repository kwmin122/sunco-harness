/**
 * @sunco/skills-harness - Lint Config Generator
 *
 * Converts DetectedLayer[] (from init detection) into eslint-plugin-boundaries
 * flat config. This is the bridge between project analysis and ESLint enforcement.
 *
 * The default policy is 'disallow' (per D-07): all cross-layer imports are
 * forbidden unless explicitly allowed by canImportFrom rules.
 *
 * Decisions: D-06 (hybrid ESLint approach), D-07 (layers -> boundaries mapping)
 */

import { createRequire } from 'node:module';
import type { DetectedLayer } from '../init/types.js';
import type { BoundariesConfig, BoundariesDependencyRule, BoundariesElement } from './types.js';

// eslint-plugin-boundaries is CJS; use createRequire for reliable import in ESM
// (Same pattern as picomatch in Phase 1 -- D-92 decision)
const require = createRequire(import.meta.url);

/**
 * Generate a BoundariesConfig from detected architectural layers.
 *
 * Maps each DetectedLayer to:
 * - A BoundariesElement (type + pattern for file matching)
 * - A BoundariesDependencyRule (from this layer, allow imports to canImportFrom layers)
 *
 * @param layers - Detected layers from init detection
 * @returns BoundariesConfig ready for ESLint flat config generation
 */
export function generateBoundariesConfig(layers: DetectedLayer[]): BoundariesConfig {
  const elements: BoundariesElement[] = layers.map((layer) => ({
    type: layer.name,
    pattern: layer.pattern,
  }));

  const dependencyRules: BoundariesDependencyRule[] = layers.map((layer) => ({
    from: [{ type: layer.name }],
    allow: layer.canImportFrom.map((dep) => ({ type: dep })),
  }));

  return { elements, dependencyRules };
}

/**
 * Generate a complete ESLint flat config array from a BoundariesConfig.
 *
 * Produces a single config object with:
 * - `plugins.boundaries`: the eslint-plugin-boundaries plugin instance
 * - `settings['boundaries/elements']`: element type definitions
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
