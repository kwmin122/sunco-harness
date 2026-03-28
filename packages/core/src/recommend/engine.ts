/**
 * @sunco/core - Recommendation Engine
 *
 * Deterministic rule engine that maps (state, lastSkillResult) to Recommendation[].
 * Sub-millisecond response time, no LLM involved.
 *
 * Requirements: REC-01 (rule engine), REC-02 (next best action),
 * REC-04 (sub-ms for 50 rules)
 */

import type {
  Recommendation,
  RecommendationRule,
  RecommendationState,
  RecommenderApi,
} from './types.js';
import { RECOMMENDATION_RULES } from './rules.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of recommendations to return */
const MAX_RECOMMENDATIONS = 4;

/** Priority sort order: high=0, medium=1, low=2 */
const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Fallback recommendation when no rules match */
const FALLBACK_RECOMMENDATION: Recommendation = {
  skillId: 'core.status',
  title: 'Check project status',
  reason: 'No specific next action detected -- check current project status',
  priority: 'low',
  isDefault: true,
};

// ---------------------------------------------------------------------------
// RecommenderEngine
// ---------------------------------------------------------------------------

/**
 * Rule-based recommendation engine.
 *
 * Iterates rules in order, collects recommendations from matching rules,
 * deduplicates by skillId (highest priority wins), sorts by priority,
 * limits to MAX_RECOMMENDATIONS, and sets exactly one isDefault=true.
 */
export class RecommenderEngine implements RecommenderApi {
  private readonly rules: readonly RecommendationRule[];

  constructor(rules: RecommendationRule[]) {
    this.rules = rules;
  }

  /**
   * Get recommendations based on current state.
   *
   * 1. Iterate rules; collect recommendations from matching rules
   * 2. Deduplicate by skillId (keep highest priority)
   * 3. Sort by priority (high > medium > low)
   * 4. Limit to 4 max
   * 5. Set exactly one isDefault=true (highest priority)
   * 6. If no matches, return fallback
   */
  getRecommendations(state: RecommendationState): Recommendation[] {
    // Step 1: Collect all recommendations from matching rules
    const collected: Recommendation[] = [];

    for (const rule of this.rules) {
      if (rule.matches(state)) {
        const recs = rule.recommend(state);
        collected.push(...recs);
      }
    }

    // No matches -> return fallback
    if (collected.length === 0) {
      return [{ ...FALLBACK_RECOMMENDATION }];
    }

    // Step 2: Deduplicate by skillId (highest priority wins)
    const bySkillId = new Map<string, Recommendation>();
    for (const rec of collected) {
      const existing = bySkillId.get(rec.skillId);
      if (!existing || comparePriority(rec.priority, existing.priority) < 0) {
        bySkillId.set(rec.skillId, rec);
      }
    }
    const deduped = Array.from(bySkillId.values());

    // Step 3: Sort by priority (high first)
    deduped.sort((a, b) => comparePriority(a.priority, b.priority));

    // Step 4: Limit to max
    const limited = deduped.slice(0, MAX_RECOMMENDATIONS);

    // Step 5: Set exactly one isDefault=true (clear all, set on first)
    for (const rec of limited) {
      rec.isDefault = undefined;
    }
    limited[0]!.isDefault = true;

    return limited;
  }

  /**
   * Get the single top recommendation (convenience method).
   */
  getTopRecommendation(state: RecommendationState): Recommendation | undefined {
    const recs = this.getRecommendations(state);
    return recs.find((r) => r.isDefault === true);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a recommender with the built-in rules or custom rules.
 *
 * @param rules - Custom rules override. Defaults to RECOMMENDATION_RULES.
 */
export function createRecommender(rules?: RecommendationRule[]): RecommenderApi {
  return new RecommenderEngine(rules ?? RECOMMENDATION_RULES);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Compare two priorities. Returns negative if a is higher priority. */
function comparePriority(a: string, b: string): number {
  return (PRIORITY_ORDER[a] ?? 99) - (PRIORITY_ORDER[b] ?? 99);
}
