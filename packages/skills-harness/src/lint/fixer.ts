/**
 * @sunco/skills-harness - Lint Fixer
 *
 * Coordinates --fix auto-correction by running ESLint with fix=true.
 * Deterministic violations that ESLint can auto-fix are corrected in-place;
 * complex violations that can't be auto-fixed remain in the violations array
 * with their fix_instruction for agent/human review.
 *
 * Decision: D-09 (--fix auto-corrects what's deterministically fixable)
 */

import { runLint } from './runner.js';
import type { BoundariesConfig, LintResult } from './types.js';

/** Options for runLintWithFix */
export interface RunLintWithFixOptions {
  /** Files or glob patterns to lint */
  readonly files: string[];
  /** Boundaries configuration from config-generator */
  readonly boundariesConfig: BoundariesConfig;
  /** Working directory for ESLint */
  readonly cwd?: string;
}

/**
 * Run ESLint with auto-fix enabled.
 *
 * Delegates to runLint() with fix=true. ESLint applies deterministic fixes
 * (e.g., whitespace, quotes, semicolons) and writes them to disk.
 * Violations that can't be auto-fixed (e.g., boundary violations) remain
 * in the result with their fix_instruction for manual resolution.
 *
 * @param opts - Lint options (files, config, cwd)
 * @returns LintResult with fixApplied=true and remaining unfixed violations
 */
export async function runLintWithFix(opts: RunLintWithFixOptions): Promise<LintResult> {
  return runLint({
    files: opts.files,
    boundariesConfig: opts.boundariesConfig,
    fix: true,
    cwd: opts.cwd,
  });
}
