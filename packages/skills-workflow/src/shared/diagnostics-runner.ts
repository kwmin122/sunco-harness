/**
 * @sunco/skills-workflow - Diagnostics Runner (shared module)
 *
 * Extracted from diagnose.skill.ts (Phase 33 Wave 3 absorption).
 * Provides deterministic log analysis: parses test failures, type errors,
 * and lint errors from build/test output. Zero LLM cost.
 *
 * Exported parsers are used by debug.skill.ts and tests.
 *
 * Requirements: DBG-02
 * Decisions: D-05 (defineSkill), D-08 (DiagnoseResult structure)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiagnoseError, DiagnoseResult } from './debug-types.js';

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
// Options interface
// ---------------------------------------------------------------------------

export interface DiagnosticsOptions {
  cwd: string;
  testOnly?: boolean;
  typeOnly?: boolean;
  lintOnly?: boolean;
  log: { info: (message: string, data?: Record<string, unknown>) => void; warn: (message: string, data?: Record<string, unknown>) => void };
}

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
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run all configured diagnostic tools and return structured results.
 *
 * Spawns vitest, tsc, and/or eslint based on the options, parses output,
 * and returns a DiagnoseResult. Does not depend on SkillContext.
 */
export async function runDiagnostics(opts: DiagnosticsOptions): Promise<DiagnoseResult> {
  const { cwd, testOnly = false, typeOnly = false, lintOnly = false, log } = opts;

  const runTest = !typeOnly && !lintOnly;
  const runTsc = !testOnly && !lintOnly;
  const runLint = !testOnly && !typeOnly;

  const testFailures: DiagnoseError[] = [];
  const typeErrors: DiagnoseError[] = [];
  const lintErrors: DiagnoseError[] = [];
  const rawOutput: DiagnoseResult['raw_output'] = {};

  // --- Test analysis ---
  if (runTest) {
    try {
      const { stdout } = await execFileAsync(
        'npx',
        ['vitest', 'run', '--reporter=json'],
        { cwd, timeout: TOOL_TIMEOUT },
      );
      rawOutput.test = stdout;
      testFailures.push(...parseTestOutput(stdout));
    } catch (error: unknown) {
      // vitest exits non-zero on test failures, capture stdout from error
      const execError = error as { stdout?: string; stderr?: string };
      const output = execError.stdout ?? '';
      rawOutput.test = output;
      testFailures.push(...parseTestOutput(output));
      log.warn('Vitest exited with error (parsing output for failures)', {
        error: String(error),
      });
    }
  }

  // --- TypeScript type check ---
  if (runTsc) {
    try {
      const { stdout } = await execFileAsync(
        'npx',
        ['tsc', '--noEmit', '--pretty', 'false'],
        { cwd, timeout: TOOL_TIMEOUT },
      );
      rawOutput.tsc = stdout;
      typeErrors.push(...parseTypeErrors(stdout));
    } catch (error: unknown) {
      // tsc exits non-zero on type errors, capture stdout from error
      const execError = error as { stdout?: string; stderr?: string };
      const output = execError.stdout ?? '';
      rawOutput.tsc = output;
      typeErrors.push(...parseTypeErrors(output));
      log.warn('tsc exited with error (parsing output for type errors)', {
        error: String(error),
      });
    }
  }

  // --- Lint analysis ---
  if (runLint) {
    try {
      const { stdout } = await execFileAsync(
        'npx',
        ['eslint', '.', '--format', 'json'],
        { cwd, timeout: TOOL_TIMEOUT },
      );
      rawOutput.lint = stdout;
      lintErrors.push(...parseLintErrors(stdout));
    } catch (error: unknown) {
      // eslint exits non-zero on lint errors, capture stdout from error
      const execError = error as { stdout?: string; stderr?: string };
      const output = execError.stdout ?? '';
      rawOutput.lint = output;
      lintErrors.push(...parseLintErrors(output));
      log.warn('ESLint exited with error (parsing output for lint errors)', {
        error: String(error),
      });
    }
  }

  const totalErrors = testFailures.length + typeErrors.length + lintErrors.length;

  return {
    test_failures: testFailures,
    type_errors: typeErrors,
    lint_errors: lintErrors,
    total_errors: totalErrors,
    raw_output: rawOutput,
  };
}
