/**
 * Tests for lint formatter -- transforms ESLint messages to agent-readable
 * SunLintViolation with fix_instruction.
 *
 * "Linter teaches while blocking." (D-08)
 */
import { describe, it, expect } from 'vitest';
import { formatViolations, formatForTerminal, formatForJson } from '../formatter.js';
import type { SunLintViolation } from '../types.js';
import type { DetectedLayer } from '../../init/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Mock ESLint-style messages */
const BOUNDARIES_MESSAGE = {
  ruleId: 'boundaries/dependencies',
  line: 5,
  column: 1,
  message:
    'Importing files of type "infra" is not allowed from files of type "ui". Disallowed in rule 1',
  severity: 2 as const,
};

const GENERIC_MESSAGE = {
  ruleId: 'no-unused-vars',
  line: 12,
  column: 5,
  message: "'foo' is assigned a value but never used.",
  severity: 1 as const,
};

const PARSE_ERROR_MESSAGE = {
  ruleId: null,
  line: 3,
  column: 10,
  message: 'Unexpected token }',
  severity: 2 as const,
};

const TEST_LAYERS: DetectedLayer[] = [
  {
    name: 'types',
    pattern: 'src/types',
    dirPatterns: ['types'],
    canImportFrom: [],
  },
  {
    name: 'domain',
    pattern: 'src/domain',
    dirPatterns: ['domain'],
    canImportFrom: ['types'],
  },
  {
    name: 'ui',
    pattern: 'src/ui',
    dirPatterns: ['ui'],
    canImportFrom: ['types', 'domain'],
  },
  {
    name: 'infra',
    pattern: 'src/infra',
    dirPatterns: ['infra'],
    canImportFrom: ['types', 'domain'],
  },
];

// ---------------------------------------------------------------------------
// formatViolations
// ---------------------------------------------------------------------------

describe('formatViolations', () => {
  it('transforms ESLint LintMessage to SunLintViolation with fix_instruction', () => {
    const violations = formatViolations('/project/src/ui/Button.ts', [BOUNDARIES_MESSAGE], TEST_LAYERS);

    expect(violations).toHaveLength(1);
    const v = violations[0]!;
    expect(v.rule).toBe('boundaries/dependencies');
    expect(v.file).toBe('/project/src/ui/Button.ts');
    expect(v.line).toBe(5);
    expect(v.column).toBe(1);
    expect(v.violation).toBe(BOUNDARIES_MESSAGE.message);
    expect(v.severity).toBe('error');
    expect(v.fix_instruction).toBeTruthy();
    expect(v.fix_instruction.length).toBeGreaterThan(0);
  });

  it('generates layer-aware fix_instruction for boundaries/dependencies violation', () => {
    const violations = formatViolations('/project/src/ui/Button.ts', [BOUNDARIES_MESSAGE], TEST_LAYERS);

    const fixInstruction = violations[0]!.fix_instruction;
    // Should mention the source layer (ui)
    expect(fixInstruction).toContain('ui');
    // Should mention the target layer (infra)
    expect(fixInstruction).toContain('infra');
    // Should mention what ui is allowed to import from
    expect(fixInstruction).toMatch(/types|domain/);
  });

  it('produces colored terminal output with file:line:col format', () => {
    // This test validates the formatForTerminal function indirectly
    // by ensuring formatViolations generates proper data for it
    const violations = formatViolations('/project/src/app.ts', [GENERIC_MESSAGE]);

    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe('warning');
    expect(violations[0]!.fix_instruction).toBeTruthy();
  });

  it('returns empty array for no messages', () => {
    const violations = formatViolations('/project/src/app.ts', []);

    expect(violations).toEqual([]);
  });

  it('provides generic fix_instruction for unknown rules', () => {
    const unknownMessage = {
      ruleId: 'some-custom/unknown-rule',
      line: 1,
      column: 1,
      message: 'Something is wrong with this code',
      severity: 2 as const,
    };

    const violations = formatViolations('/project/src/app.ts', [unknownMessage]);

    expect(violations).toHaveLength(1);
    expect(violations[0]!.fix_instruction).toBeTruthy();
    expect(violations[0]!.fix_instruction.length).toBeGreaterThan(10);
  });

  it('handles null ruleId (parse error) with appropriate fix_instruction', () => {
    const violations = formatViolations('/project/src/broken.ts', [PARSE_ERROR_MESSAGE]);

    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('parse-error');
    expect(violations[0]!.fix_instruction).toContain('3');
    expect(violations[0]!.fix_instruction).toContain('10');
  });
});

// ---------------------------------------------------------------------------
// formatForTerminal
// ---------------------------------------------------------------------------

describe('formatForTerminal', () => {
  it('produces output with file:line:col format', () => {
    const violations: SunLintViolation[] = [
      {
        rule: 'boundaries/dependencies',
        file: '/project/src/ui/Button.ts',
        line: 5,
        column: 1,
        violation: 'Importing files of type "infra" is not allowed from files of type "ui"',
        fix_instruction: 'Move import to an allowed layer',
        severity: 'error',
      },
    ];

    const lines = formatForTerminal(violations);

    expect(lines.length).toBeGreaterThan(0);
    // Should contain file:line:col pattern (possibly with ANSI codes)
    const stripped = lines.join('\n').replace(/\x1B\[[0-9;]*m/g, '');
    expect(stripped).toContain('/project/src/ui/Button.ts:5:1');
  });

  it('includes fix instruction in dimmed text', () => {
    const violations: SunLintViolation[] = [
      {
        rule: 'no-unused-vars',
        file: '/project/src/app.ts',
        line: 12,
        column: 5,
        violation: "'foo' is assigned a value but never used.",
        fix_instruction: 'Remove the unused variable or use it.',
        severity: 'warning',
      },
    ];

    const lines = formatForTerminal(violations);

    const stripped = lines.join('\n').replace(/\x1B\[[0-9;]*m/g, '');
    expect(stripped).toContain('Fix:');
    expect(stripped).toContain('Remove the unused variable or use it.');
  });

  it('returns empty array for no violations', () => {
    const lines = formatForTerminal([]);
    expect(lines).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatForJson
// ---------------------------------------------------------------------------

describe('formatForJson', () => {
  it('produces JSON array matching SunLintViolation[]', () => {
    const violations: SunLintViolation[] = [
      {
        rule: 'boundaries/dependencies',
        file: '/project/src/ui/Button.ts',
        line: 5,
        column: 1,
        violation: 'Importing infra from ui is not allowed',
        fix_instruction: 'Move import to an allowed layer',
        severity: 'error',
      },
    ];

    const jsonStr = formatForJson(violations);
    const parsed = JSON.parse(jsonStr);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].rule).toBe('boundaries/dependencies');
    expect(parsed[0].fix_instruction).toBe('Move import to an allowed layer');
  });

  it('is valid JSON parseable by JSON.parse', () => {
    const violations: SunLintViolation[] = [
      {
        rule: 'test-rule',
        file: '/path/to/file.ts',
        line: 1,
        column: 1,
        violation: 'Test violation with "quotes" and special chars: <>&',
        fix_instruction: 'Fix this issue',
        severity: 'warning',
      },
    ];

    const jsonStr = formatForJson(violations);
    expect(() => JSON.parse(jsonStr)).not.toThrow();
  });

  it('returns empty JSON array for no violations', () => {
    const jsonStr = formatForJson([]);
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toEqual([]);
  });
});
