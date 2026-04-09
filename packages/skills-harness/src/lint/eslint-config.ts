/**
 * @sunco/skills-harness - Shared ESLint Flat Config Factory
 *
 * Centralizes ESLint flat config construction for boundaries-only linting.
 * Used by both lint/runner.ts (full project) and guard/incremental-linter.ts
 * (single-file hot path).
 *
 * Key design choices:
 * - Standard ignore patterns (dist/, node_modules/, coverage/, .sun/) applied everywhere
 * - Boundaries plugin conditionally included only when elements are configured
 * - Extra ignores can be appended per-caller
 *
 * Contract: SUNCO lint uses boundaries-only ESLint. Standard style/type rules
 * are NOT enforced via ESLint. TypeScript compiler (tsc --noEmit) handles type errors.
 */

import { createRequire } from 'node:module';
import type { BoundariesConfig } from './types.js';

const require = createRequire(import.meta.url);
const boundariesPlugin = require('eslint-plugin-boundaries') as Record<string, unknown>;
const tseslint = require('typescript-eslint') as { parser: unknown };

/** Standard ignore patterns for all SUNCO ESLint runs */
export const ESLINT_IGNORES = ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.sun/**'];

export interface BuildFlatConfigOptions {
  readonly boundariesConfig: BoundariesConfig;
  /** Extra ignore patterns beyond the standard set */
  readonly extraIgnores?: string[];
}

/**
 * Build ESLint flat config array for boundaries-only linting.
 *
 * Contract: SUNCO lint uses boundaries-only ESLint. Standard style/type rules
 * are NOT enforced via ESLint. TypeScript compiler (tsc --noEmit) handles type errors.
 */
export function buildFlatConfig(opts: BuildFlatConfigOptions): object[] {
  const ignores = [...ESLINT_IGNORES, ...(opts.extraIgnores ?? [])];
  const { boundariesConfig } = opts;
  const hasBoundaries = boundariesConfig.elements.length > 0;

  return [
    { ignores },
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      },
      ...(hasBoundaries
        ? {
            plugins: { boundaries: boundariesPlugin },
            settings: {
              'boundaries/elements': boundariesConfig.elements,
              'boundaries/include': ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            },
            rules: {
              'boundaries/dependencies': [
                2,
                { default: 'disallow', rules: boundariesConfig.dependencyRules },
              ],
            },
          }
        : {}),
    },
  ];
}
