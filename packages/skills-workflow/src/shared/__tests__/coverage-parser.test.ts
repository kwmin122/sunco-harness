import { describe, it, expect } from 'vitest';
import { parseCoverageSummary } from '../coverage-parser.js';
import type { CoverageReport } from '../verify-types.js';

// ---------------------------------------------------------------------------
// Fixtures: realistic Istanbul/Vitest json-summary format
// ---------------------------------------------------------------------------

const FULL_COVERAGE_JSON = JSON.stringify({
  total: {
    lines: { total: 200, covered: 180, skipped: 0, pct: 90 },
    statements: { total: 220, covered: 190, skipped: 0, pct: 86.36 },
    branches: { total: 50, covered: 40, skipped: 0, pct: 80 },
    functions: { total: 30, covered: 28, skipped: 0, pct: 93.33 },
  },
  '/src/utils/math.ts': {
    lines: { total: 100, covered: 95, skipped: 0, pct: 95 },
    statements: { total: 110, covered: 100, skipped: 0, pct: 90.91 },
    branches: { total: 20, covered: 18, skipped: 0, pct: 90 },
    functions: { total: 15, covered: 14, skipped: 0, pct: 93.33 },
  },
  '/src/utils/string.ts': {
    lines: { total: 60, covered: 55, skipped: 0, pct: 91.67 },
    statements: { total: 70, covered: 60, skipped: 0, pct: 85.71 },
    branches: { total: 20, covered: 15, skipped: 0, pct: 75 },
    functions: { total: 10, covered: 9, skipped: 0, pct: 90 },
  },
  '/src/handlers/api.ts': {
    lines: { total: 40, covered: 30, skipped: 0, pct: 75 },
    statements: { total: 40, covered: 30, skipped: 0, pct: 75 },
    branches: { total: 10, covered: 7, skipped: 0, pct: 70 },
    functions: { total: 5, covered: 5, skipped: 0, pct: 100 },
  },
});

const COVERAGE_WITH_UNCOVERED = JSON.stringify({
  total: {
    lines: { total: 300, covered: 150, skipped: 0, pct: 50 },
    statements: { total: 320, covered: 160, skipped: 0, pct: 50 },
    branches: { total: 80, covered: 40, skipped: 0, pct: 50 },
    functions: { total: 40, covered: 20, skipped: 0, pct: 50 },
  },
  '/src/covered.ts': {
    lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
    statements: { total: 110, covered: 88, skipped: 0, pct: 80 },
    branches: { total: 30, covered: 24, skipped: 0, pct: 80 },
    functions: { total: 15, covered: 12, skipped: 0, pct: 80 },
  },
  '/src/uncovered-a.ts': {
    lines: { total: 100, covered: 0, skipped: 0, pct: 0 },
    statements: { total: 100, covered: 0, skipped: 0, pct: 0 },
    branches: { total: 25, covered: 0, skipped: 0, pct: 0 },
    functions: { total: 10, covered: 0, skipped: 0, pct: 0 },
  },
  '/src/uncovered-b.ts': {
    lines: { total: 100, covered: 0, skipped: 0, pct: 0 },
    statements: { total: 110, covered: 0, skipped: 0, pct: 0 },
    branches: { total: 25, covered: 0, skipped: 0, pct: 0 },
    functions: { total: 15, covered: 0, skipped: 0, pct: 0 },
  },
});

const MINIMAL_COVERAGE_JSON = JSON.stringify({
  total: {
    lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
    statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
    branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
    functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseCoverageSummary', () => {
  it('parses valid json-summary with total and per-file metrics', () => {
    const report = parseCoverageSummary(FULL_COVERAGE_JSON);

    // Overall matches total
    expect(report.overall.lines.pct).toBe(90);
    expect(report.overall.statements.pct).toBe(86.36);
    expect(report.overall.branches.pct).toBe(80);
    expect(report.overall.functions.pct).toBe(93.33);

    // Per-file entries
    expect(report.files).toHaveLength(3);
    expect(report.files[0]!.path).toBe('/src/utils/math.ts');
    expect(report.files[0]!.lines.pct).toBe(95);
    expect(report.files[1]!.path).toBe('/src/utils/string.ts');
    expect(report.files[2]!.path).toBe('/src/handlers/api.ts');

    // No uncovered files
    expect(report.uncoveredFiles).toHaveLength(0);

    // No delta without previous snapshot
    expect(report.delta).toBeUndefined();
    expect(report.previousSnapshot).toBeUndefined();
  });

  it('identifies uncovered files (files with 0% line coverage)', () => {
    const report = parseCoverageSummary(COVERAGE_WITH_UNCOVERED);

    expect(report.uncoveredFiles).toHaveLength(2);
    expect(report.uncoveredFiles).toContain('/src/uncovered-a.ts');
    expect(report.uncoveredFiles).toContain('/src/uncovered-b.ts');

    // Covered file should not be in uncovered list
    expect(report.uncoveredFiles).not.toContain('/src/covered.ts');
  });

  it('computes delta when previous snapshot is provided', () => {
    const previousSnapshot: CoverageReport['overall'] = {
      lines: { total: 200, covered: 160, skipped: 0, pct: 80 },
      statements: { total: 220, covered: 170, skipped: 0, pct: 77.27 },
      branches: { total: 50, covered: 35, skipped: 0, pct: 70 },
      functions: { total: 30, covered: 25, skipped: 0, pct: 83.33 },
    };

    const report = parseCoverageSummary(FULL_COVERAGE_JSON, previousSnapshot);

    expect(report.previousSnapshot).toBeDefined();
    expect(report.delta).toBeDefined();

    // Delta = current.pct - previous.pct
    expect(report.delta!.lines).toBeCloseTo(10, 1); // 90 - 80
    expect(report.delta!.statements).toBeCloseTo(9.09, 1); // 86.36 - 77.27
    expect(report.delta!.branches).toBeCloseTo(10, 1); // 80 - 70
    expect(report.delta!.functions).toBeCloseTo(10, 1); // 93.33 - 83.33
  });

  it('handles empty/minimal coverage (only total key)', () => {
    const report = parseCoverageSummary(MINIMAL_COVERAGE_JSON);

    expect(report.overall.lines.total).toBe(0);
    expect(report.overall.lines.pct).toBe(0);
    expect(report.files).toHaveLength(0);
    expect(report.uncoveredFiles).toHaveLength(0);
    expect(report.delta).toBeUndefined();
  });
});
