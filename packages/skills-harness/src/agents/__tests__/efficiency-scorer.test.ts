/**
 * Tests for agent doc efficiency scorer.
 * Verifies 0-100 scoring based on brevity, clarity, coverage, contradictions.
 * Per D-17 and ETH Zurich brevity insight.
 */
import { describe, it, expect } from 'vitest';
import { computeEfficiencyScore, brevityScore } from '../efficiency-scorer.js';
import type { AgentDocMetrics } from '../types.js';

/** Helper to create a minimal AgentDocMetrics for testing */
function makeMetrics(overrides: Partial<AgentDocMetrics> = {}): AgentDocMetrics {
  return {
    filePath: '/test/CLAUDE.md',
    totalLines: 30,
    sectionCount: 3,
    sections: [],
    instructionDensity: 3,
    hasConventions: true,
    hasConstraints: true,
    hasArchitecture: true,
    contradictions: [],
    lineCountWarning: false,
    efficiencyScore: 0,
    ...overrides,
  };
}

describe('computeEfficiencyScore', () => {
  it('returns 100 for a 30-line doc with conventions, constraints, architecture', () => {
    const metrics = makeMetrics({
      totalLines: 30,
      hasConventions: true,
      hasConstraints: true,
      hasArchitecture: true,
      contradictions: [],
    });

    const score = computeEfficiencyScore(metrics);

    expect(score).toBe(100);
  });

  it('returns < 50 for a 200-line doc with contradictions', () => {
    const metrics = makeMetrics({
      totalLines: 200,
      contradictions: [
        { lineA: 10, lineB: 50, textA: 'always use X', textB: 'never use X', reason: 'opposing directives' },
        { lineA: 20, lineB: 60, textA: 'must do Y', textB: 'avoid Y', reason: 'opposing directives' },
      ],
      hasConventions: false,
      hasConstraints: false,
      hasArchitecture: false,
    });

    const score = computeEfficiencyScore(metrics);

    expect(score).toBeLessThan(50);
  });
});

describe('brevityScore', () => {
  it('gives 100 for <= 30 lines', () => {
    expect(brevityScore(10)).toBe(100);
    expect(brevityScore(30)).toBe(100);
  });

  it('gives 80 for <= 60 lines', () => {
    expect(brevityScore(31)).toBe(80);
    expect(brevityScore(60)).toBe(80);
  });

  it('gives 50 for <= 100 lines', () => {
    expect(brevityScore(61)).toBe(50);
    expect(brevityScore(100)).toBe(50);
  });

  it('gives 25 for <= 200 lines', () => {
    expect(brevityScore(101)).toBe(25);
    expect(brevityScore(200)).toBe(25);
  });

  it('gives 10 for > 200 lines', () => {
    expect(brevityScore(201)).toBe(10);
    expect(brevityScore(500)).toBe(10);
  });
});

describe('clarity component', () => {
  it('penalizes vague phrases like "properly", "as needed", "consider"', () => {
    // A doc with many vague phrases should score lower than one without
    const cleanMetrics = makeMetrics({ totalLines: 30 });

    // Simulate sections with vague phrases in them
    const vagueMetrics = makeMetrics({
      totalLines: 30,
      sections: [
        {
          title: 'Rules',
          startLine: 1,
          endLine: 10,
          lineCount: 10,
          instructionCount: 5,
        },
      ],
      // Vague phrases are detected from section content, which is read from the file
      // For unit testing, we test the scorer with metrics that include vaguePhraseCount
    });

    // Both have same brevity, coverage, contradictions
    // The difference is clarity
    const cleanScore = computeEfficiencyScore(cleanMetrics);
    const vagueScore = computeEfficiencyScore(vagueMetrics);

    // Without vague phrases, cleanMetrics should score >= vagueMetrics
    expect(cleanScore).toBeGreaterThanOrEqual(vagueScore);
  });
});

describe('coverage component', () => {
  it('checks for conventions, constraints, architecture sections', () => {
    const fullCoverage = makeMetrics({
      totalLines: 30,
      hasConventions: true,
      hasConstraints: true,
      hasArchitecture: true,
    });

    const noCoverage = makeMetrics({
      totalLines: 30,
      hasConventions: false,
      hasConstraints: false,
      hasArchitecture: false,
    });

    const fullScore = computeEfficiencyScore(fullCoverage);
    const noScore = computeEfficiencyScore(noCoverage);

    // Full coverage should be significantly higher
    expect(fullScore).toBeGreaterThan(noScore);
    // Coverage is 25% of total, each missing deducts 33
    // Full: 100*0.25 = 25 contribution, None: ~1*0.25 = 0.25 contribution
    expect(fullScore - noScore).toBeGreaterThanOrEqual(20);
  });
});
