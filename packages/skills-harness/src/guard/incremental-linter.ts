/**
 * @sunco/skills-harness - Guard Incremental Linter
 *
 * Runs ESLint on a single file via lintText() for fast incremental linting.
 * This is the hot path for --watch mode -- must be fast (no full project scan).
 *
 * Uses the shared config factory (eslint-config.ts) for flat config construction,
 * with lintText() instead of lintFiles() for single-file operation.
 *
 * Decision: D-22 (incremental single-file linting via ESLint lintText)
 */

import { ESLint } from 'eslint';
import type { BoundariesConfig, SunLintViolation } from '../lint/types.js';
import { buildFlatConfig } from '../lint/eslint-config.js';

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
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: buildFlatConfig({ boundariesConfig }),
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
