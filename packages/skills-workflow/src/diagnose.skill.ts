/**
 * @sunco/skills-workflow - Diagnose Skill
 *
 * Deterministic log analysis skill. Parses test failures, type errors,
 * and lint errors from build/test output into structured DiagnoseResult.
 * Zero LLM cost -- entirely regex/JSON based.
 *
 * Requirements: DBG-02
 * Decisions: D-05 (defineSkill), D-06 (ID != command), D-07 (stage),
 *   D-08 (DiagnoseResult structure)
 */

import { defineSkill } from '@sunco/core';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiagnoseError, DiagnoseResult } from './shared/debug-types.js';

// ---------------------------------------------------------------------------
// Promisified execFile
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum time for each tool spawn (ms) */
const TOOL_TIMEOUT = 120_000;

// ---------------------------------------------------------------------------
// Parser: vitest JSON output -> test failures
// ---------------------------------------------------------------------------

/**
 * Parse vitest JSON reporter output to extract test failures.
 *
 * Expects the JSON format produced by `vitest run --reporter=json`.
 * Each testResult has assertionResults with status, fullName, failureMessages.
 *
 * @param json - Raw JSON string from vitest --reporter=json
 * @returns Array of DiagnoseError for failed tests
 */
export function parseTestOutput(json: string): DiagnoseError[] {
  if (!json.trim()) return [];

  try {
    const data = JSON.parse(json) as {
      testResults: Array<{
        name: string;
        assertionResults: Array<{
          fullName: string;
          status: string;
          failureMessages: string[];
          ancestorTitles: string[];
        }>;
      }>;
    };

    const errors: DiagnoseError[] = [];

    for (const testResult of data.testResults ?? []) {
      for (const assertion of testResult.assertionResults ?? []) {
        if (assertion.status !== 'failed') continue;

        const failureMessage = assertion.failureMessages?.[0] ?? '';

        // Try to extract line number from stack trace
        let line: number | null = null;
        const lineMatch = failureMessage.match(/:(\d+):\d+\)?$/m);
        if (lineMatch) {
          line = parseInt(lineMatch[1]!, 10);
        }

        errors.push({
          type: 'test_failure',
          file: testResult.name,
          line,
          message: assertion.fullName,
          stack: failureMessage || undefined,
        });
      }
    }

    return errors;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Parser: tsc output -> type errors
// ---------------------------------------------------------------------------

/**
 * Parse TypeScript compiler output to extract type errors.
 *
 * Expects the format produced by `tsc --noEmit --pretty false`:
 *   file(line,col): error TSxxxx: message
 *
 * @param output - Raw stdout from tsc --noEmit --pretty false
 * @returns Array of DiagnoseError for type errors
 */
export function parseTypeErrors(output: string): DiagnoseError[] {
  if (!output.trim()) return [];

  const errors: DiagnoseError[] = [];
  const pattern = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(output)) !== null) {
    errors.push({
      type: 'type_error',
      file: match[1]!,
      line: parseInt(match[2]!, 10),
      message: match[5]!,
      code: match[4]!,
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Parser: eslint JSON output -> lint errors
// ---------------------------------------------------------------------------

/**
 * Parse ESLint JSON formatter output to extract lint errors.
 *
 * Expects the format produced by `eslint . --format json`:
 *   Array of { filePath, messages: [{ ruleId, line, message, severity }] }
 *
 * @param json - Raw JSON string from eslint --format json
 * @returns Array of DiagnoseError for lint errors
 */
export function parseLintErrors(json: string): DiagnoseError[] {
  if (!json.trim()) return [];

  try {
    const data = JSON.parse(json) as Array<{
      filePath: string;
      messages: Array<{
        ruleId: string | null;
        line: number;
        column: number;
        message: string;
        severity: number;
      }>;
    }>;

    const errors: DiagnoseError[] = [];

    for (const fileResult of data) {
      for (const msg of fileResult.messages ?? []) {
        // Only include errors (severity 2), not warnings
        if (msg.severity < 2) continue;

        errors.push({
          type: 'lint_error',
          file: fileResult.filePath,
          line: msg.line ?? null,
          message: msg.message,
          code: msg.ruleId ?? undefined,
        });
      }
    }

    return errors;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.diagnose',
  command: 'diagnose',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Analyze build/test output and extract structured error diagnostics',
  options: [
    { flags: '--test-only', description: 'Only run test analysis' },
    { flags: '--type-only', description: 'Only run TypeScript type check analysis' },
    { flags: '--lint-only', description: 'Only run ESLint analysis' },
  ],

  async execute(ctx) {
    // --- Step 0: Entry ---
    await ctx.ui.entry({
      title: 'Diagnose',
      description: 'Analyzing build/test output...',
    });

    const testOnly = Boolean(ctx.args['test-only'] ?? ctx.args.testOnly);
    const typeOnly = Boolean(ctx.args['type-only'] ?? ctx.args.typeOnly);
    const lintOnly = Boolean(ctx.args['lint-only'] ?? ctx.args.lintOnly);

    const runTest = !typeOnly && !lintOnly;
    const runTsc = !testOnly && !lintOnly;
    const runLint = !testOnly && !typeOnly;

    const totalSteps = [runTest, runTsc, runLint].filter(Boolean).length;
    const progress = ctx.ui.progress({
      title: 'Running diagnostics...',
      total: totalSteps,
    });

    let step = 0;

    // Accumulate results
    const testFailures: DiagnoseError[] = [];
    const typeErrors: DiagnoseError[] = [];
    const lintErrors: DiagnoseError[] = [];
    const rawOutput: DiagnoseResult['raw_output'] = {};

    // --- Step 1: Test analysis ---
    if (runTest) {
      try {
        const { stdout } = await execFileAsync(
          'npx',
          ['vitest', 'run', '--reporter=json'],
          { cwd: ctx.cwd, timeout: TOOL_TIMEOUT },
        );
        rawOutput.test = stdout;
        testFailures.push(...parseTestOutput(stdout));
      } catch (error: unknown) {
        // vitest exits non-zero on test failures, capture stdout from error
        const execError = error as { stdout?: string; stderr?: string };
        const output = execError.stdout ?? '';
        rawOutput.test = output;
        testFailures.push(...parseTestOutput(output));
        ctx.log.warn('Vitest exited with error (parsing output for failures)', {
          error: String(error),
        });
      }
      step++;
      progress.update({ completed: step, message: 'Test analysis complete' });
    }

    // --- Step 2: TypeScript type check ---
    if (runTsc) {
      try {
        const { stdout } = await execFileAsync(
          'npx',
          ['tsc', '--noEmit', '--pretty', 'false'],
          { cwd: ctx.cwd, timeout: TOOL_TIMEOUT },
        );
        rawOutput.tsc = stdout;
        typeErrors.push(...parseTypeErrors(stdout));
      } catch (error: unknown) {
        // tsc exits non-zero on type errors, capture stdout from error
        const execError = error as { stdout?: string; stderr?: string };
        const output = execError.stdout ?? '';
        rawOutput.tsc = output;
        typeErrors.push(...parseTypeErrors(output));
        ctx.log.warn('tsc exited with error (parsing output for type errors)', {
          error: String(error),
        });
      }
      step++;
      progress.update({ completed: step, message: 'Type check analysis complete' });
    }

    // --- Step 3: Lint analysis ---
    if (runLint) {
      try {
        const { stdout } = await execFileAsync(
          'npx',
          ['eslint', '.', '--format', 'json'],
          { cwd: ctx.cwd, timeout: TOOL_TIMEOUT },
        );
        rawOutput.lint = stdout;
        lintErrors.push(...parseLintErrors(stdout));
      } catch (error: unknown) {
        // eslint exits non-zero on lint errors, capture stdout from error
        const execError = error as { stdout?: string; stderr?: string };
        const output = execError.stdout ?? '';
        rawOutput.lint = output;
        lintErrors.push(...parseLintErrors(output));
        ctx.log.warn('ESLint exited with error (parsing output for lint errors)', {
          error: String(error),
        });
      }
      step++;
      progress.update({ completed: step, message: 'Lint analysis complete' });
    }

    // --- Step 4: Build DiagnoseResult ---
    const totalErrors = testFailures.length + typeErrors.length + lintErrors.length;

    const result: DiagnoseResult = {
      test_failures: testFailures,
      type_errors: typeErrors,
      lint_errors: lintErrors,
      total_errors: totalErrors,
      raw_output: rawOutput,
    };

    // --- Step 5: Store in state ---
    await ctx.state.set('diagnose.lastResult', result);

    // --- Step 6: Report ---
    const details: string[] = [];
    if (testFailures.length > 0) details.push(`Test failures: ${testFailures.length}`);
    if (typeErrors.length > 0) details.push(`Type errors: ${typeErrors.length}`);
    if (lintErrors.length > 0) details.push(`Lint errors: ${lintErrors.length}`);
    if (details.length === 0) details.push('No errors found');

    const summary = totalErrors === 0
      ? 'All checks passed -- no errors detected'
      : `Found ${totalErrors} error(s): ${details.join(', ')}`;

    progress.done({ summary });

    await ctx.ui.result({
      success: totalErrors === 0,
      title: 'Diagnose',
      summary,
      details,
    });

    // --- Step 7: Return structured result ---
    return {
      success: totalErrors === 0,
      summary,
      data: result,
    };
  },
});
