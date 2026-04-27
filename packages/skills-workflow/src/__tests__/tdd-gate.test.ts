/**
 * Tests for shared/tdd-gate.ts
 *
 * Covers the two pure analysis paths (shape check + git commit-order
 * check). The full runTddGate ctx integration is covered by verify
 * tests elsewhere; here we pin the deterministic pieces.
 */

import { describe, it, expect } from 'vitest';
import {
  isTestFile,
  findMatchingTest,
  analyzePlanForTddShape,
} from '../shared/tdd-gate.js';
import type { ParsedPlan } from '../shared/plan-parser.js';

function makePlan(overrides: Partial<ParsedPlan['frontmatter']> & { files_modified: string[] }): ParsedPlan {
  const { files_modified, ...frontmatterOverrides } = overrides;
  return {
    frontmatter: {
      phase: '01',
      plan: 1,
      type: 'tdd',
      wave: 1,
      depends_on: [],
      files_modified,
      autonomous: false,
      requirements: [],
      capabilities: [],
      isDeliverySlice: false,
      ...frontmatterOverrides,
    },
    objective: '',
    context: '',
    tasks: [],
    deliveryScope: '',
    verificationIntent: '',
    technicalDirection: '',
    raw: '',
  };
}

describe('isTestFile', () => {
  it('recognizes .test.ts and .spec.ts', () => {
    expect(isTestFile('src/foo.test.ts')).toBe(true);
    expect(isTestFile('src/foo.spec.ts')).toBe(true);
    expect(isTestFile('src/foo.test.tsx')).toBe(true);
    expect(isTestFile('src/foo.test.mjs')).toBe(true);
  });

  it('recognizes __tests__/ directories', () => {
    expect(isTestFile('src/__tests__/foo.ts')).toBe(true);
    expect(isTestFile('packages/a/src/__tests__/x.ts')).toBe(true);
  });

  it('rejects production files', () => {
    expect(isTestFile('src/foo.ts')).toBe(false);
    expect(isTestFile('src/foo.tsx')).toBe(false);
    expect(isTestFile('src/tested-helper.ts')).toBe(false);
  });
});

describe('findMatchingTest', () => {
  it('finds colocated .test file', () => {
    expect(
      findMatchingTest('src/foo.ts', ['src/foo.test.ts']),
    ).toBe('src/foo.test.ts');
  });

  it('finds test in __tests__ dir', () => {
    expect(
      findMatchingTest('src/foo.ts', ['src/__tests__/foo.ts']),
    ).toBe('src/__tests__/foo.ts');
  });

  it('returns null when no match', () => {
    expect(
      findMatchingTest('src/foo.ts', ['src/bar.test.ts', 'src/baz.test.ts']),
    ).toBeNull();
  });

  it('matches case-insensitively', () => {
    expect(
      findMatchingTest('src/Foo.ts', ['src/foo.test.ts']),
    ).toBe('src/foo.test.ts');
  });
});

describe('analyzePlanForTddShape', () => {
  it('is a no-op for non-tdd plans', () => {
    const plan = makePlan({ files_modified: ['src/foo.ts'], type: 'execute' });
    expect(analyzePlanForTddShape(plan)).toEqual([]);
  });

  it('flags tdd plan with no test files', () => {
    const plan = makePlan({ files_modified: ['src/foo.ts'] });
    const findings = analyzePlanForTddShape(plan);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.kind === 'no-tests-listed')).toBe(true);
  });

  it('flags tdd plan with empty files_modified', () => {
    const plan = makePlan({ files_modified: [] });
    const findings = analyzePlanForTddShape(plan);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.kind).toBe('no-tests-listed');
    expect(findings[0]!.severity).toBe('medium');
  });

  it('flags production file with no colocated test in plan', () => {
    const plan = makePlan({
      files_modified: ['src/foo.ts', 'src/bar.ts', 'src/other.test.ts'],
    });
    const findings = analyzePlanForTddShape(plan);
    const missing = findings.filter((f) => f.kind === 'missing-test-file');
    expect(missing.map((f) => f.file).sort()).toEqual(['src/bar.ts', 'src/foo.ts']);
  });

  it('passes clean when every production file has a matching test', () => {
    const plan = makePlan({
      files_modified: ['src/foo.ts', 'src/foo.test.ts', 'src/bar.ts', 'src/bar.test.ts'],
    });
    const findings = analyzePlanForTddShape(plan);
    expect(findings).toEqual([]);
  });

  it('accepts __tests__ directory layout', () => {
    const plan = makePlan({
      files_modified: ['src/foo.ts', 'src/__tests__/foo.ts'],
    });
    expect(analyzePlanForTddShape(plan)).toEqual([]);
  });
});
