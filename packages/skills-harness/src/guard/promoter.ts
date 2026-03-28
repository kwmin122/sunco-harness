/**
 * @sunco/skills-harness - Guard Promoter
 *
 * Tracks anti-pattern frequency across guard runs and suggests promoting
 * recurring patterns to permanent lint rules. Suggest-only: Guard does NOT
 * auto-add rules to .sun/rules/ (D-21).
 *
 * Pattern counts are persisted in StateApi ('guard.patternCounts') to
 * accumulate across multiple guard runs.
 *
 * Decisions: D-21 (promotion is suggest-only)
 */

import type { StateApi } from '@sunco/core';
import type { SunLintRule } from '../lint/types.js';
import type { AntiPatternMatch, PromotionSuggestion } from './types.js';
import { DEFAULT_GUARD_CONFIG } from './types.js';

/** State key for persisted pattern frequency counters */
const PATTERN_COUNTS_KEY = 'guard.patternCounts';

/**
 * Map of known anti-pattern IDs to ESLint rules they correspond to.
 * Used for generating the suggestedRule in PromotionSuggestion.
 */
const PATTERN_TO_ESLINT_RULE: Record<string, { rule: string; config: unknown }> = {
  'any-type': {
    rule: '@typescript-eslint/no-explicit-any',
    config: ['error'],
  },
  'console-log': {
    rule: 'no-console',
    config: ['error'],
  },
  'todo-comment': {
    rule: 'no-warning-comments',
    config: ['warn', { terms: ['TODO', 'FIXME', 'HACK', 'XXX'] }],
  },
  'eslint-disable': {
    rule: 'no-restricted-syntax',
    config: ['error'],
  },
  'type-assertion': {
    rule: '@typescript-eslint/consistent-type-assertions',
    config: ['error', { assertionStyle: 'never' }],
  },
};

/**
 * Detect anti-patterns that exceed the promotion threshold and suggest
 * promoting them to permanent lint rules.
 *
 * Counts occurrences per pattern, merges with persisted counts from state,
 * and generates PromotionSuggestion for patterns exceeding the threshold.
 *
 * @param opts - Anti-patterns from current scan, StateApi, and optional threshold
 * @returns Array of PromotionSuggestion for patterns exceeding threshold
 */
export async function detectPromotionCandidates(opts: {
  antiPatterns: AntiPatternMatch[];
  state: StateApi;
  threshold?: number;
}): Promise<PromotionSuggestion[]> {
  const { antiPatterns, state, threshold = DEFAULT_GUARD_CONFIG.promotionThreshold } = opts;

  // Count current occurrences per pattern
  const currentCounts = new Map<string, { count: number; files: Set<string> }>();
  for (const ap of antiPatterns) {
    const entry = currentCounts.get(ap.pattern) ?? { count: 0, files: new Set<string>() };
    entry.count++;
    entry.files.add(ap.file);
    currentCounts.set(ap.pattern, entry);
  }

  // Load persisted pattern counts and merge
  const persistedCounts = (await state.get<Record<string, number>>(PATTERN_COUNTS_KEY)) ?? {};
  const mergedCounts: Record<string, number> = { ...persistedCounts };

  for (const [pattern, data] of currentCounts) {
    mergedCounts[pattern] = (mergedCounts[pattern] ?? 0) + data.count;
  }

  // Persist updated counts
  await state.set(PATTERN_COUNTS_KEY, mergedCounts);

  // Generate suggestions for patterns exceeding threshold
  const suggestions: PromotionSuggestion[] = [];

  for (const [pattern, data] of currentCounts) {
    if (data.count >= threshold) {
      const eslintMapping = PATTERN_TO_ESLINT_RULE[pattern];
      const suggestedRule: SunLintRule = {
        id: `guard-promoted-${pattern}`,
        source: 'guard-promoted',
        createdAt: new Date().toISOString(),
        pattern: `Disallow '${pattern}' anti-pattern`,
        eslintConfig: eslintMapping
          ? { rules: { [eslintMapping.rule]: eslintMapping.config } }
          : { rules: {} },
      };

      const files = [...data.files];
      const occurrences = data.count;

      suggestions.push({
        pattern,
        occurrences,
        files,
        suggestedRule,
        message: `Pattern '${pattern}' found ${occurrences} times across ${files.length} files. Promote to lint rule?`,
      });
    }
  }

  return suggestions;
}

/**
 * Format a PromotionSuggestion as a human-readable string.
 *
 * @param suggestion - The promotion suggestion to format
 * @returns Formatted multi-line string describing the promotion
 */
export function formatPromotionSuggestion(suggestion: PromotionSuggestion): string {
  const lines = [
    `[Promotion Suggestion] '${suggestion.pattern}'`,
    `  Occurrences: ${suggestion.occurrences} across ${suggestion.files.length} files`,
    `  Suggested rule: ${suggestion.suggestedRule.id}`,
    `  Pattern: ${suggestion.suggestedRule.pattern}`,
    `  ${suggestion.message}`,
  ];
  return lines.join('\n');
}
