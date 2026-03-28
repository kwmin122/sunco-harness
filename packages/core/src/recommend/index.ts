/**
 * @sunco/core - Recommendation System
 *
 * Public API for the proactive recommender.
 * createRecommender() creates a RecommenderApi instance with built-in rules.
 * RECOMMENDATION_RULES exported for testing and custom engine composition.
 */

export { createRecommender, RecommenderEngine } from './engine.js';
export { RECOMMENDATION_RULES } from './rules.js';
export type {
  Recommendation,
  RecommendationPriority,
  RecommendationRule,
  RecommendationState,
  RecommenderApi,
} from './types.js';
