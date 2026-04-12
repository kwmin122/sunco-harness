/**
 * Tests for diagnostics-runner.ts (Phase 33 Wave 3)
 *
 * Parsers extracted from diagnose.skill.ts and re-homed here.
 * Verifies:
 * - parseTestOutput extracts failing test name, file, line, error message from vitest JSON output
 * - parseTestOutput returns empty array for all-passing output
 * - parseTypeErrors extracts TS error code, file, line, message from tsc output
 * - parseTypeErrors returns empty array for clean tsc output
 * - parseLintErrors extracts rule, file, line, message from eslint JSON output
 * - parseLintErrors returns empty array for clean lint output
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock node:child_process
// ---------------------------------------------------------------------------

const mockExecFile = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

// ---------------------------------------------------------------------------
// Mock node:util (for promisify)
// ---------------------------------------------------------------------------

vi.mock('node:util', () => ({
  promisify: vi.fn((fn: unknown) => fn),
}));

// ---------------------------------------------------------------------------
// Fixtures: vitest JSON output
// ---------------------------------------------------------------------------

const VITEST_FAILING_JSON = JSON.stringify({
  testResults: [
    {
      name: '/project/src/__tests__/math.test.ts',
      assertionResults: [
        {
          fullName: 'math > should add numbers',
          status: 'passed',
          failureMessages: [],
          ancestorTitles: ['math'],
        },
        {
          fullName: 'math > should subtract numbers',
          status: 'failed',
          failureMessages: [
            'Error: expect(received).toBe(expected)\n\nExpected: 3\nReceived: 5\n    at Object.<anonymous> (/project/src/__tests__/math.test.ts:12:18)',
          ],
          ancestorTitles: ['math'],
        },
      ],
    },
    {
      name: '/project/src/__tests__/utils.test.ts',
      assertionResults: [
        {
          fullName: 'utils > should parse config',
          status: 'failed',
          failureMessages: [
            "TypeError: Cannot read properties of undefined (reading 'name')\n    at parseConfig (/project/src/utils.ts:45:10)\n    at Object.<anonymous> (/project/src/__tests__/utils.test.ts:8:20)",
          ],
          ancestorTitles: ['utils'],
        },
      ],
    },
  ],
});

const VITEST_PASSING_JSON = JSON.stringify({
  testResults: [
    {
      name: '/project/src/__tests__/math.test.ts',
      assertionResults: [
        {
          fullName: 'math > should add numbers',
          status: 'passed',
          failureMessages: [],
          ancestorTitles: ['math'],
        },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// Fixtures: tsc output
// ---------------------------------------------------------------------------

const TSC_ERRORS_OUTPUT = `src/config/loader.ts(23,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/utils/parse.ts(45,12): error TS2345: Argument of type 'undefined' is not assignable to parameter of type 'string'.
src/index.ts(10,1): error TS7016: Could not find a declaration file for module 'some-lib'.`;

const TSC_CLEAN_OUTPUT = '';

// ---------------------------------------------------------------------------
// Fixtures: eslint JSON output
// ---------------------------------------------------------------------------

const ESLINT_ERRORS_JSON = JSON.stringify([
  {
    filePath: '/project/src/utils.ts',
    messages: [
      {
        ruleId: 'no-unused-vars',
        severity: 2,
        message: "'foo' is defined but never used.",
        line: 10,
        column: 7,
      },
      {
        ruleId: '@typescript-eslint/no-explicit-any',
        severity: 2,
        message: 'Unexpected any. Specify a different type.',
        line: 25,
        column: 15,
      },
    ],
    errorCount: 2,
    warningCount: 0,
  },
  {
    filePath: '/project/src/config.ts',
    messages: [
      {
        ruleId: 'no-console',
        severity: 2,
        message: 'Unexpected console statement.',
        line: 8,
        column: 5,
      },
    ],
    errorCount: 1,
    warningCount: 0,
  },
]);

const ESLINT_CLEAN_JSON = JSON.stringify([
  {
    filePath: '/project/src/utils.ts',
    messages: [],
    errorCount: 0,
    warningCount: 0,
  },
]);

// ---------------------------------------------------------------------------
// Tests: parseTestOutput
// ---------------------------------------------------------------------------

describe('parseTestOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts failing test name, file, line, error message from vitest output', async () => {
    const { parseTestOutput } = await import('../diagnostics-runner.js');
    const errors = parseTestOutput(VITEST_FAILING_JSON);

    expect(errors).toHaveLength(2);

    expect(errors[0]).toMatchObject({
      type: 'test_failure',
      file: '/project/src/__tests__/math.test.ts',
      message: expect.stringContaining('should subtract numbers'),
    });

    expect(errors[1]).toMatchObject({
      type: 'test_failure',
      file: '/project/src/__tests__/utils.test.ts',
      message: expect.stringContaining('should parse config'),
    });

    // Should have stack traces
    expect(errors[0]!.stack).toBeDefined();
    expect(errors[1]!.stack).toBeDefined();
  });

  it('returns empty array for all-passing output', async () => {
    const { parseTestOutput } = await import('../diagnostics-runner.js');
    const errors = parseTestOutput(VITEST_PASSING_JSON);

    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: parseTypeErrors
// ---------------------------------------------------------------------------

describe('parseTypeErrors', () => {
  it('extracts TS error code, file, line, message from tsc output', async () => {
    const { parseTypeErrors } = await import('../diagnostics-runner.js');
    const errors = parseTypeErrors(TSC_ERRORS_OUTPUT);

    expect(errors).toHaveLength(3);

    expect(errors[0]).toMatchObject({
      type: 'type_error',
      file: 'src/config/loader.ts',
      line: 23,
      code: 'TS2322',
      message: expect.stringContaining('not assignable'),
    });

    expect(errors[1]).toMatchObject({
      type: 'type_error',
      file: 'src/utils/parse.ts',
      line: 45,
      code: 'TS2345',
    });

    expect(errors[2]).toMatchObject({
      type: 'type_error',
      file: 'src/index.ts',
      line: 10,
      code: 'TS7016',
    });
  });

  it('returns empty array for clean tsc output', async () => {
    const { parseTypeErrors } = await import('../diagnostics-runner.js');
    const errors = parseTypeErrors(TSC_CLEAN_OUTPUT);

    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: parseLintErrors
// ---------------------------------------------------------------------------

describe('parseLintErrors', () => {
  it('extracts rule, file, line, message from eslint JSON output', async () => {
    const { parseLintErrors } = await import('../diagnostics-runner.js');
    const errors = parseLintErrors(ESLINT_ERRORS_JSON);

    expect(errors).toHaveLength(3);

    expect(errors[0]).toMatchObject({
      type: 'lint_error',
      file: '/project/src/utils.ts',
      line: 10,
      code: 'no-unused-vars',
      message: expect.stringContaining('defined but never used'),
    });

    expect(errors[1]).toMatchObject({
      type: 'lint_error',
      file: '/project/src/utils.ts',
      line: 25,
      code: '@typescript-eslint/no-explicit-any',
    });

    expect(errors[2]).toMatchObject({
      type: 'lint_error',
      file: '/project/src/config.ts',
      line: 8,
      code: 'no-console',
    });
  });

  it('returns empty array for clean lint output', async () => {
    const { parseLintErrors } = await import('../diagnostics-runner.js');
    const errors = parseLintErrors(ESLINT_CLEAN_JSON);

    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: runDiagnostics integration
// ---------------------------------------------------------------------------

describe('runDiagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns structured DiagnoseResult with all 3 error arrays', async () => {
    const { runDiagnostics } = await import('../diagnostics-runner.js');

    // Mock execFile to return test failures and tsc errors
    mockExecFile.mockImplementation(
      (cmd: string, args: string[], _opts: unknown, cb?: (err: Error | null, stdout: string, stderr: string) => void) => {
        const argsStr = (args as string[]).join(' ');

        if (argsStr.includes('vitest')) {
          // vitest exits non-zero with test failures
          const error = new Error('Process exited with code 1') as Error & { stdout: string; stderr: string };
          error.stdout = VITEST_FAILING_JSON;
          error.stderr = '';
          if (cb) {
            cb(error, VITEST_FAILING_JSON, '');
          }
          return { stdout: VITEST_FAILING_JSON, stderr: '' };
        }

        if (argsStr.includes('tsc')) {
          const error = new Error('Process exited with code 2') as Error & { stdout: string; stderr: string };
          error.stdout = TSC_ERRORS_OUTPUT;
          error.stderr = '';
          if (cb) {
            cb(error, TSC_ERRORS_OUTPUT, '');
          }
          return { stdout: TSC_ERRORS_OUTPUT, stderr: '' };
        }

        if (argsStr.includes('eslint')) {
          const error = new Error('Process exited with code 1') as Error & { stdout: string; stderr: string };
          error.stdout = ESLINT_ERRORS_JSON;
          error.stderr = '';
          if (cb) {
            cb(error, ESLINT_ERRORS_JSON, '');
          }
          return { stdout: ESLINT_ERRORS_JSON, stderr: '' };
        }

        // Default success
        if (cb) {
          cb(null, '', '');
        }
        return { stdout: '', stderr: '' };
      },
    );

    const log = { info: vi.fn(), warn: vi.fn() };
    const result = await runDiagnostics({ cwd: '/test/project', log });

    expect(result.test_failures).toHaveLength(2);
    expect(result.type_errors).toHaveLength(3);
    expect(result.lint_errors).toHaveLength(3);
    expect(result.total_errors).toBe(8);
  });
});
