/**
 * @sunco/skills-harness - Guard Incremental Linter
 *
 * Runs ESLint on a single file via lintText() for fast incremental linting.
 * This is the hot path for --watch mode -- must be fast (no full project scan).
 *
 * Uses the same ESLint configuration approach as lint/runner.ts but with
 * lintText() instead of lintFiles() for single-file operation.
 *
 * Decision: D-22 (incremental single-file linting via ESLint lintText)
 */

import { createRequire } from 'node:module';
import { ESLint } from 'eslint';
import type { BoundariesConfig, SunLintViolation } from '../lint/types.js';

// Load CJS plugins via createRequire (ESM project, same pattern as lint/runner.ts)
const require = createRequire(import.meta.url);
const boundariesPlugin = require('eslint-plugin-boundaries') as Record<string, unknown>;
const tseslint = require('typescript-eslint') as { parser: unknown };

/**
 * Lint a single file using ESLint's lintText() method.
 *
 * Uses lintText() instead of lintFiles() for performance -- no file system
 * read needed since we already have the content from chokidar or direct read.
 *
 * @param opts - File path, content, boundaries config, and working directory
 * @returns Array of SunLintViolation for the single file
 */
export async function lintSingleFile(opts: {
  filePath: string;
  fileContent: string;
  boundariesConfig: BoundariesConfig;
  cwd: string;
}): Promise<SunLintViolation[]> {
  const { filePath, fileContent, boundariesConfig, cwd } = opts;

  try {
    // Build ESLint config -- only include boundaries plugin if config has elements
    const overrideConfig: object[] = [
      {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
          },
        },
        ...(boundariesConfig.elements.length > 0
          ? {
              plugins: { boundaries: boundariesPlugin },
              settings: {
                'boundaries/elements': boundariesConfig.elements,
                'boundaries/include': ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
              },
              rules: {
                'boundaries/dependencies': [
                  2,
                  {
                    default: 'disallow',
                    rules: boundariesConfig.dependencyRules,
                  },
                ],
              },
            }
          : {}),
      },
    ];

    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig,
      cwd,
    });

    const results = await eslint.lintText(fileContent, { filePath });

    // Transform ESLint results to SunLintViolation[]
    const violations: SunLintViolation[] = [];

    for (const result of results) {
      for (const message of result.messages) {
        const severity: 'error' | 'warning' = message.severity === 2 ? 'error' : 'warning';

        violations.push({
          rule: message.ruleId ?? 'parse-error',
          file: filePath,
          line: message.line,
          column: message.column,
          violation: message.message,
          fix_instruction: message.ruleId
            ? `Fix the ${severity}: ${message.message}`
            : `Resolve syntax error at line ${message.line}:${message.column}`,
          severity,
        });
      }
    }

    return violations;
  } catch (error) {
    // Handle ESLint errors gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);

    return [
      {
        rule: 'eslint-error',
        file: filePath,
        line: 0,
        column: 0,
        violation: `ESLint execution error: ${errorMessage}`,
        fix_instruction: 'Check ESLint configuration',
        severity: 'warning',
      },
    ];
  }
}
