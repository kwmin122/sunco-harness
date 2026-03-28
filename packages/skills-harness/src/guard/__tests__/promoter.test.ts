/**
 * Tests for guard promoter.
 * Validates anti-pattern frequency tracking and lint rule promotion suggestions.
 *
 * Decision: D-21 (promotion is suggest-only, guard does NOT auto-add rules)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { StateApi } from '@sunco/core';
import type { AntiPatternMatch } from '../types.js';
import { detectPromotionCandidates, formatPromotionSuggestion } from '../promoter.js';

/** Create a mock StateApi backed by a plain Map */
function createMockState(): StateApi & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return store.get(key) as T | undefined;
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<boolean> {
      return store.delete(key);
    },
    async list(prefix?: string): Promise<string[]> {
      const keys = [...store.keys()];
      if (!prefix) return keys;
      return keys.filter((k) => k.startsWith(prefix));
    },
    async has(key: string): Promise<boolean> {
      return store.has(key);
    },
  };
}

describe('detectPromotionCandidates', () => {
  let state: ReturnType<typeof createMockState>;

  beforeEach(() => {
    state = createMockState();
  });

  it('returns suggestion when same anti-pattern appears 3+ times', async () => {
    const antiPatterns: AntiPatternMatch[] = [
      { pattern: 'any-type', file: 'src/a.ts', line: 1, match: ': any' },
      { pattern: 'any-type', file: 'src/b.ts', line: 5, match: 'as any' },
      { pattern: 'any-type', file: 'src/c.ts', line: 10, match: ': any' },
    ];

    const suggestions = await detectPromotionCandidates({
      antiPatterns,
      state,
      threshold: 3,
    });

    expect(suggestions.length).toBe(1);
    expect(suggestions[0]!.pattern).toBe('any-type');
    expect(suggestions[0]!.occurrences).toBe(3);
    expect(suggestions[0]!.files).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });

  it('returns empty for patterns appearing only once', async () => {
    const antiPatterns: AntiPatternMatch[] = [
      { pattern: 'console-log', file: 'src/a.ts', line: 1, match: 'console.log(' },
    ];

    const suggestions = await detectPromotionCandidates({
      antiPatterns,
      state,
      threshold: 3,
    });

    expect(suggestions.length).toBe(0);
  });

  it('produces SunLintRule-shaped JSON for the promoted pattern', async () => {
    const antiPatterns: AntiPatternMatch[] = [
      { pattern: 'console-log', file: 'src/a.ts', line: 1, match: 'console.log(' },
      { pattern: 'console-log', file: 'src/b.ts', line: 2, match: 'console.warn(' },
      { pattern: 'console-log', file: 'src/c.ts', line: 3, match: 'console.error(' },
      { pattern: 'console-log', file: 'src/d.ts', line: 4, match: 'console.log(' },
    ];

    const suggestions = await detectPromotionCandidates({
      antiPatterns,
      state,
      threshold: 3,
    });

    expect(suggestions.length).toBe(1);
    const rule = suggestions[0]!.suggestedRule;
    expect(rule.id).toContain('console-log');
    expect(rule.source).toBe('guard-promoted');
    expect(rule.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(rule.pattern).toBeDefined();
    expect(rule.eslintConfig).toBeDefined();
  });

  it('tracks pattern frequency via StateApi pattern counters', async () => {
    const antiPatterns: AntiPatternMatch[] = [
      { pattern: 'any-type', file: 'src/a.ts', line: 1, match: ': any' },
      { pattern: 'any-type', file: 'src/b.ts', line: 5, match: 'as any' },
    ];

    await detectPromotionCandidates({ antiPatterns, state, threshold: 3 });

    // Pattern counts should be persisted in state
    const counts = await state.get<Record<string, number>>('guard.patternCounts');
    expect(counts).toBeDefined();
    expect(counts!['any-type']).toBe(2);
  });
});

describe('formatPromotionSuggestion', () => {
  it('produces human-readable promotion message', () => {
    const suggestion = {
      pattern: 'any-type',
      occurrences: 15,
      files: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts', 'g.ts', 'h.ts'],
      suggestedRule: {
        id: 'guard-promoted-any-type',
        source: 'guard-promoted' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
        pattern: 'Disallow explicit `any` type usage',
        eslintConfig: { rules: { '@typescript-eslint/no-explicit-any': ['error'] } },
      },
      message: "Pattern 'any-type' found 15 times across 8 files. Promote to lint rule?",
    };

    const formatted = formatPromotionSuggestion(suggestion);

    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('any-type');
    expect(formatted).toContain('15');
    expect(formatted).toContain('8');
  });
});
