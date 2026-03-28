/**
 * @sunco/core - Recommendation System Types
 *
 * Types for the proactive recommendation engine.
 * Pure function: (state, lastSkillResult) => Recommendation[]
 * Deterministic, sub-ms, no LLM.
 *
 * Requirements: REC-01 (rule engine), REC-02 (next best action),
 * REC-03 (state-based routing), REC-04 (20-50 rules, sub-ms)
 */

import type { SkillId } from '../types.js';
import type { SkillResult } from '../skill/types.js';

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

/** Priority level for recommendations */
export type RecommendationPriority = 'high' | 'medium' | 'low';

/**
 * A single recommendation presented to the user after skill execution.
 * Displayed via SkillResult pattern with recommendation cards.
 */
export interface Recommendation {
  /** Recommended skill ID to execute next */
  skillId: SkillId;

  /** Human-readable title (e.g., 'Run verification') */
  title: string;

  /** Why this is recommended */
  reason: string;

  /** Priority level */
  priority: RecommendationPriority;

  /** Whether this is the primary recommendation (shown with "Recommended" badge) */
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// RecommendationRule (REC-04: deterministic rules)
// ---------------------------------------------------------------------------

/**
 * A recommendation rule that maps state + last result to recommendations.
 * Rules are evaluated in priority order; first match wins.
 */
export interface RecommendationRule {
  /** Unique rule ID for debugging/tracing */
  id: string;

  /** Human-readable rule description */
  description: string;

  /**
   * Predicate: should this rule fire?
   * Pure function, must be sub-ms.
   */
  matches(state: RecommendationState): boolean;

  /**
   * Produce recommendations when this rule matches.
   * Pure function, must be sub-ms.
   */
  recommend(state: RecommendationState): Recommendation[];
}

// ---------------------------------------------------------------------------
// RecommendationState (input to the rule engine)
// ---------------------------------------------------------------------------

/**
 * State snapshot provided to recommendation rules.
 * Contains everything needed to determine next best action.
 */
export interface RecommendationState {
  /** ID of the skill that just executed (undefined for initial state) */
  lastSkillId?: SkillId;

  /** Result of the last skill execution */
  lastResult?: SkillResult;

  /** Current project state from StateApi (key-value snapshot) */
  projectState: Record<string, unknown>;

  /** Currently active skill IDs */
  activeSkills: ReadonlySet<SkillId>;
}

// ---------------------------------------------------------------------------
// RecommenderApi (skill-facing API via ctx.recommend)
// ---------------------------------------------------------------------------

/**
 * Recommender API exposed to skills and the CLI lifecycle.
 */
export interface RecommenderApi {
  /**
   * Get recommendations based on current state.
   * Returns sorted by priority (high first).
   */
  getRecommendations(state: RecommendationState): Recommendation[];

  /**
   * Get the single top recommendation (convenience method).
   * Returns undefined if no recommendations match.
   */
  getTopRecommendation(state: RecommendationState): Recommendation | undefined;
}
