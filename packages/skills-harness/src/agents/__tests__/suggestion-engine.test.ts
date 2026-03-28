/**
 * Tests for agent doc suggestion engine.
 * Verifies that suggestions are specific, actionable, and include line numbers.
 * Per D-18: analyze only, never auto-generate or modify files.
 * Per D-19: specific with line numbers, not vague.
 */
import { describe, it, expect } from 'vitest';
import { generateSuggestions } from '../suggestion-engine.js';
import type { AgentDocMetrics, AgentDocSuggestion } from '../types.js';

/** Helper to create a minimal AgentDocMetrics for testing */
function makeMetrics(overrides: Partial<AgentDocMetrics> = {}): AgentDocMetrics {
  return {
    filePath: '/test/CLAUDE.md',
    totalLines: 30,
    sectionCount: 3,
    sections: [
      { title: 'Conventions', startLine: 1, endLine: 10, lineCount: 10, instructionCount: 5 },
      { title: 'Constraints', startLine: 11, endLine: 20, lineCount: 10, instructionCount: 5 },
      { title: 'Architecture', startLine: 21, endLine: 30, lineCount: 10, instructionCount: 5 },
    ],
    instructionDensity: 5,
    hasConventions: true,
    hasConstraints: true,
    hasArchitecture: true,
    contradictions: [],
    lineCountWarning: false,
    efficiencyScore: 100,
    ...overrides,
  };
}

describe('generateSuggestions', () => {
  it('includes brevity suggestion with severity high for 200-line doc', () => {
    const metrics = makeMetrics({
      totalLines: 200,
      lineCountWarning: true,
    });

    const suggestions = generateSuggestions(metrics);

    const brevitySuggestion = suggestions.find((s) => s.type === 'brevity');
    expect(brevitySuggestion).toBeDefined();
    expect(brevitySuggestion!.severity).toBe('high');
    expect(brevitySuggestion!.message).toContain('200');
    expect(brevitySuggestion!.message).toContain('60');
  });

  it('includes contradiction suggestion with line numbers', () => {
    const metrics = makeMetrics({
      contradictions: [
        {
          lineA: 12,
          lineB: 45,
          textA: 'Always use semicolons',
          textB: 'Never use semicolons',
          reason: 'Opposing directives on "semicolons"',
        },
      ],
    });

    const suggestions = generateSuggestions(metrics);

    const contradictionSuggestion = suggestions.find((s) => s.type === 'contradiction');
    expect(contradictionSuggestion).toBeDefined();
    expect(contradictionSuggestion!.severity).toBe('high');
    expect(contradictionSuggestion!.message).toContain('12');
    expect(contradictionSuggestion!.message).toContain('45');
    expect(contradictionSuggestion!.lineRange).toEqual({ start: 12, end: 45 });
  });

  it('includes coverage suggestion for doc missing architecture section', () => {
    const metrics = makeMetrics({
      hasArchitecture: false,
    });

    const suggestions = generateSuggestions(metrics);

    const coverageSuggestion = suggestions.find(
      (s) => s.type === 'coverage' && s.message.toLowerCase().includes('architecture'),
    );
    expect(coverageSuggestion).toBeDefined();
    expect(coverageSuggestion!.severity).toBe('medium');
  });

  it('returns empty array for perfect doc', () => {
    const metrics = makeMetrics({
      totalLines: 30,
      hasConventions: true,
      hasConstraints: true,
      hasArchitecture: true,
      contradictions: [],
      lineCountWarning: false,
      instructionDensity: 5,
    });

    const suggestions = generateSuggestions(metrics);

    expect(suggestions).toEqual([]);
  });

  it('all suggestions have specific line ranges when applicable', () => {
    const metrics = makeMetrics({
      totalLines: 200,
      lineCountWarning: true,
      contradictions: [
        {
          lineA: 5,
          lineB: 50,
          textA: 'Always use TypeScript',
          textB: 'Never use TypeScript',
          reason: 'Opposing directives',
        },
      ],
      hasConventions: false,
      instructionDensity: 1,
    });

    const suggestions = generateSuggestions(metrics);

    // Contradiction suggestions must have lineRange
    const contradictionSuggestions = suggestions.filter((s) => s.type === 'contradiction');
    for (const s of contradictionSuggestions) {
      expect(s.lineRange).toBeDefined();
      expect(s.lineRange!.start).toBeGreaterThan(0);
      expect(s.lineRange!.end).toBeGreaterThanOrEqual(s.lineRange!.start);
    }

    // All suggestions should have non-empty message
    for (const s of suggestions) {
      expect(s.message.length).toBeGreaterThan(0);
    }
  });

  it('suggestion messages do not contain vague language like "consider" or "ensure"', () => {
    const metrics = makeMetrics({
      totalLines: 200,
      lineCountWarning: true,
      contradictions: [
        {
          lineA: 5,
          lineB: 50,
          textA: 'Always use X',
          textB: 'Never use X',
          reason: 'test',
        },
      ],
      hasConventions: false,
      hasConstraints: false,
      hasArchitecture: false,
      instructionDensity: 0.5,
    });

    const suggestions = generateSuggestions(metrics);

    // Per D-19: suggestions must be specific, not vague
    const vagueStarters = ['consider ', 'ensure ', 'you might '];
    for (const s of suggestions) {
      const lower = s.message.toLowerCase();
      for (const vague of vagueStarters) {
        expect(lower.startsWith(vague)).toBe(false);
      }
    }
  });
});
