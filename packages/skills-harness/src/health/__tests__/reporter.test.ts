/**
 * Tests for health reporter.
 * Tests weighted score computation and terminal table formatting.
 */
import { describe, it, expect } from 'vitest';
import {
  computeHealthScore,
  computePatternScore,
  formatHealthReport,
} from '../reporter.js';
import type { FreshnessResult, HealthReport } from '../types.js';

describe('computePatternScore', () => {
  it('returns 100 for zero patterns', () => {
    const score = computePatternScore([]);
    expect(score).toBe(100);
  });

  it('applies penalty multipliers per pattern type', () => {
    const score = computePatternScore([
      { pattern: 'any-type', count: 5, files: ['a.ts'] },       // 5 * 2 = 10
      { pattern: 'console-log', count: 3, files: ['b.ts'] },    // 3 * 1 = 3
      { pattern: 'eslint-disable', count: 2, files: ['c.ts'] }, // 2 * 3 = 6
    ]);
    // Penalty: 10 + 3 + 6 = 19, score = 100 - 19 = 81
    expect(score).toBe(81);
  });

  it('caps penalty at 100 (score >= 0)', () => {
    const score = computePatternScore([
      { pattern: 'any-type', count: 100, files: ['a.ts'] }, // 100 * 2 = 200 (capped at 100)
    ]);
    expect(score).toBe(0);
  });

  it('adds trend penalty when patterns are increasing', () => {
    const current = [{ pattern: 'any-type', count: 20, files: ['a.ts'] }];
    const previous = [{ pattern: 'any-type', count: 5, files: ['a.ts'] }];
    const score = computePatternScore(current, previous);
    // Base penalty: 20 * 2 = 40, trend penalty: +10 = 50, score = 100 - 50 = 50
    expect(score).toBe(50);
  });
});

describe('computeHealthScore', () => {
  it('applies correct weights: freshness 30%, patterns 40%, conventions 30%', () => {
    const freshness: FreshnessResult = {
      score: 80,
      staleDocuments: [],
      brokenReferences: [],
      totalDocuments: 5,
    };

    const score = computeHealthScore({
      freshness,
      patternScore: 70,
      conventionScore: 90,
    });

    // 80 * 0.30 + 70 * 0.40 + 90 * 0.30 = 24 + 28 + 27 = 79
    expect(score).toBe(79);
  });

  it('returns 100 when all scores are 100', () => {
    const freshness: FreshnessResult = {
      score: 100,
      staleDocuments: [],
      brokenReferences: [],
      totalDocuments: 0,
    };

    const score = computeHealthScore({
      freshness,
      patternScore: 100,
      conventionScore: 100,
    });

    expect(score).toBe(100);
  });

  it('returns 0 when all scores are 0', () => {
    const freshness: FreshnessResult = {
      score: 0,
      staleDocuments: [],
      brokenReferences: [],
      totalDocuments: 10,
    };

    const score = computeHealthScore({
      freshness,
      patternScore: 0,
      conventionScore: 0,
    });

    expect(score).toBe(0);
  });
});

describe('formatHealthReport', () => {
  const report: HealthReport = {
    overallScore: 82,
    freshness: {
      score: 85,
      details: {
        score: 85,
        staleDocuments: [],
        brokenReferences: [],
        totalDocuments: 10,
      },
    },
    patterns: {
      score: 72,
      trends: [
        {
          pattern: 'any-type',
          currentCount: 15,
          previousCount: 10,
          trend: 'increasing',
          changePercent: 50,
        },
      ],
      counts: [{ pattern: 'any-type', count: 15, files: ['a.ts'] }],
    },
    conventions: {
      score: 95,
      deviations: [],
    },
    trend: 'stable',
  };

  it('contains "Document Freshness" category', () => {
    const lines = formatHealthReport(report);
    const text = lines.join('\n');
    expect(text).toContain('Document Freshness');
  });

  it('contains "Anti-patterns" category', () => {
    const lines = formatHealthReport(report);
    const text = lines.join('\n');
    expect(text).toContain('Anti-patterns');
  });

  it('contains "Conventions" category', () => {
    const lines = formatHealthReport(report);
    const text = lines.join('\n');
    expect(text).toContain('Conventions');
  });

  it('contains "Overall" with score', () => {
    const lines = formatHealthReport(report);
    const text = lines.join('\n');
    expect(text).toContain('Overall');
    expect(text).toContain('82');
  });

  it('shows trend arrows', () => {
    const lines = formatHealthReport(report);
    const text = lines.join('\n');
    // Should contain some trend indicator
    expect(text).toMatch(/stable|improving|degrading/);
  });
});
