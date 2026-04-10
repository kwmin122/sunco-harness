/**
 * @sunco/skills-harness - ESLint Programmatic Runner
 *
 * Executes ESLint programmatically with eslint-plugin-boundaries for
 * architecture boundary enforcement. Uses the shared config factory
 * (eslint-config.ts) for flat config construction with standard ignores.
 *
 * Key design choices:
 * - Programmatic API only (no CLI spawn) per research anti-pattern guidance
 * - Flat config only (ESLint 10) per pitfall #2
 * - overrideConfigFile: true to bypass filesystem config search
 * - Shared config factory pattern for DRY config across runner + guard
 *
 * Decisions: D-06 (hybrid approach), D-07 (boundaries config), D-09 (--fix support)
 */

import { ESLint } from 'eslint';
import type { BoundariesConfig, LintResult, SunLintViolation } from './types.js';
import { buildFlatConfig } from './eslint-config.js';

/** Options for runLint */
export interface RunLintOptions {
  /** Files or glob patterns to lint */
  readonly files: string[];
  /** Boundaries configuration from config-generator */
  readonly boundariesConfig: BoundariesConfig;
  /** Whether to apply auto-fix corrections */
  readonly fix?: boolean;
  /** Working directory for ESLint */
  readonly cwd?: string;
}

/**
 * Run ESLint programmatically with boundaries plugin.
 *
 * Creates an ESLint instance with dynamically generated flat config from
 * the provided BoundariesConfig, then lints the specified files.
 *
 * @param opts - Lint options including files, config, and fix mode
 * @returns Structured LintResult with violations, counts, and fix status
 */
export async function runLint(opts: RunLintOptions): Promise<LintResult> {
  const { files, boundariesConfig, fix = false, cwd } = opts;

  // Short-circuit for empty file list
  if (files.length === 0) {
    return {
      violations: [],
      filesLinted: 0,
      errorCount: 0,
      warningCount: 0,
      fixApplied: false,
    };
  }

  try {
    const eslint = new ESLint({
      overrideConfigFile: true, // bypass filesystem config search (pitfall #2)
      overrideConfig: buildFlatConfig({ boundariesConfig }),
      fix,
      cwd,
    });

    const results = await eslint.lintFiles(files);

    // Apply fixes if requested
    if (fix) {
      await ESLint.outputFixes(results);
    }

    // Transform ESLint results to SunLintViolation[]
    const violations: SunLintViolation[] = [];
    let filesLinted = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (const result of results) {
      filesLinted++;
      errorCount += result.errorCount;
      warningCount += result.warningCount;

      for (const message of result.messages) {
        const severity: 'error' | 'warning' = message.severity === 2 ? 'error' : 'warning';

        violations.push({
          rule: message.ruleId ?? 'parse-error',
          file: result.filePath,
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

    return {
      violations,
      filesLinted,
      errorCount,
      warningCount,
      fixApplied: fix,
    };
  } catch (error) {
    // Handle ESLint errors gracefully (e.g., no matching files)
    const message = error instanceof Error ? error.message : String(error);

    return {
      violations: [
        {
          rule: 'eslint-error',
          file: '',
          line: 0,
          column: 0,
          violation: `ESLint execution error: ${message}`,
          fix_instruction: 'Check ESLint configuration and file paths',
          severity: 'warning',
        },
      ],
      filesLinted: 0,
      errorCount: 0,
      warningCount: 1,
      fixApplied: false,
    };
  }
}
