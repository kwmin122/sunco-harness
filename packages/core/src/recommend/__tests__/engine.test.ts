/**
 * @sunco/core - RecommenderEngine tests
 *
 * Tests the recommendation engine: rule iteration, priority sorting,
 * max-4 limit, isDefault flag logic, fallback behavior, and performance.
 *
 * Requirements: REC-01 (rule engine), REC-02 (next best action),
 * REC-04 (sub-ms response)
 */

import { describe, it, expect } from 'vitest';
import { RecommenderEngine, createRecommender } from '../engine.js';
import type {
  RecommendationRule,
  RecommendationState,
  Recommendation,
} from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid state for testing */
function makeState(overrides: Partial<RecommendationState> = {}): RecommendationState {
  return {
    projectState: {},
    activeSkills: new Set(['workflow.execute', 'workflow.verify', 'workflow.ship']),
    ...overrides,
  };
}

/** Helper to create a simple rule */
function makeRule(
  id: string,
  matchFn: (s: RecommendationState) => boolean,
  recommendations: Recommendation[],
): RecommendationRule {
  return {
    id,
    description: `Test rule: ${id}`,
    matches: matchFn,
    recommend: () => recommendations,
  };
}

/** Helper to create a recommendation */
function makeRec(
  skillId: string,
  priority: 'high' | 'medium' | 'low',
  title?: string,
): Recommendation {
  return {
    skillId,
    title: title ?? `Run ${skillId}`,
    reason: `Because ${skillId} is next`,
    priority,
  };
}

// ---------------------------------------------------------------------------
// RecommenderEngine
// ---------------------------------------------------------------------------

describe('RecommenderEngine', () => {
  describe('constructor', () => {
    it('accepts an array of rules', () => {
      const engine = new RecommenderEngine([]);
      expect(engine).toBeInstanceOf(RecommenderEngine);
    });

    it('accepts an empty rules array', () => {
      const engine = new RecommenderEngine([]);
      expect(engine).toBeInstanceOf(RecommenderEngine);
    });
  });

  describe('getRecommendations', () => {
    it('returns recommendations from matching rules', () => {
      const rule = makeRule('test', () => true, [
        makeRec('workflow.verify', 'high'),
      ]);
      const engine = new RecommenderEngine([rule]);
      const result = engine.getRecommendations(makeState());

      expect(result).toHaveLength(1);
      expect(result[0]!.skillId).toBe('workflow.verify');
    });

    it('skips rules where matches() returns false', () => {
      const matchingRule = makeRule('match', () => true, [
        makeRec('workflow.verify', 'high'),
      ]);
      const nonMatchingRule = makeRule('no-match', () => false, [
        makeRec('workflow.ship', 'high'),
      ]);
      const engine = new RecommenderEngine([matchingRule, nonMatchingRule]);
      const result = engine.getRecommendations(makeState());

      expect(result).toHaveLength(1);
      expect(result[0]!.skillId).toBe('workflow.verify');
    });

    it('collects recommendations from multiple matching rules', () => {
      const rule1 = makeRule('r1', () => true, [makeRec('workflow.verify', 'high')]);
      const rule2 = makeRule('r2', () => true, [makeRec('workflow.ship', 'medium')]);
      const engine = new RecommenderEngine([rule1, rule2]);
      const result = engine.getRecommendations(makeState());

      expect(result).toHaveLength(2);
    });

    it('sorts by priority: high before medium before low', () => {
      const rule = makeRule('mixed', () => true, [
        makeRec('low-skill', 'low'),
        makeRec('high-skill', 'high'),
        makeRec('medium-skill', 'medium'),
      ]);
      const engine = new RecommenderEngine([rule]);
      const result = engine.getRecommendations(makeState());

      expect(result[0]!.skillId).toBe('high-skill');
      expect(result[1]!.skillId).toBe('medium-skill');
      expect(result[2]!.skillId).toBe('low-skill');
    });

    it('limits output to max 4 recommendations', () => {
      const rule = makeRule('many', () => true, [
        makeRec('s1', 'high'),
        makeRec('s2', 'high'),
        makeRec('s3', 'medium'),
        makeRec('s4', 'medium'),
        makeRec('s5', 'low'),
        makeRec('s6', 'low'),
      ]);
      const engine = new RecommenderEngine([rule]);
      const result = engine.getRecommendations(makeState());

      expect(result.length).toBeLessThanOrEqual(4);
    });

    it('sets isDefault=true on exactly one recommendation (the highest priority)', () => {
      const rule = makeRule('multi', () => true, [
        makeRec('s1', 'high'),
        makeRec('s2', 'medium'),
        makeRec('s3', 'low'),
      ]);
      const engine = new RecommenderEngine([rule]);
      const result = engine.getRecommendations(makeState());

      const defaults = result.filter((r) => r.isDefault === true);
      expect(defaults).toHaveLength(1);
      expect(defaults[0]!.skillId).toBe('s1');
    });

    it('clears isDefault from rules that set it (engine controls isDefault)', () => {
      const rule = makeRule('preset-default', () => true, [
        { skillId: 's1', title: 'S1', reason: 'r', priority: 'medium', isDefault: true },
        { skillId: 's2', title: 'S2', reason: 'r', priority: 'high' },
      ]);
      const engine = new RecommenderEngine([rule]);
      const result = engine.getRecommendations(makeState());

      // Engine sets isDefault on highest priority, not on pre-set ones
      const defaults = result.filter((r) => r.isDefault === true);
      expect(defaults).toHaveLength(1);
      expect(defaults[0]!.skillId).toBe('s2'); // high priority wins
    });

    it('returns fallback recommendation when no rules match', () => {
      const rule = makeRule('never', () => false, [makeRec('s1', 'high')]);
      const engine = new RecommenderEngine([rule]);
      const result = engine.getRecommendations(makeState());

      expect(result).toHaveLength(1);
      expect(result[0]!.skillId).toBe('core.status');
      expect(result[0]!.isDefault).toBe(true);
    });

    it('returns fallback when rules array is empty', () => {
      const engine = new RecommenderEngine([]);
      const result = engine.getRecommendations(makeState());

      expect(result).toHaveLength(1);
      expect(result[0]!.skillId).toBe('core.status');
    });

    it('deduplicates recommendations by skillId (keeps highest priority)', () => {
      const rule1 = makeRule('r1', () => true, [makeRec('workflow.verify', 'medium')]);
      const rule2 = makeRule('r2', () => true, [makeRec('workflow.verify', 'high')]);
      const engine = new RecommenderEngine([rule1, rule2]);
      const result = engine.getRecommendations(makeState());

      const verifyRecs = result.filter((r) => r.skillId === 'workflow.verify');
      expect(verifyRecs).toHaveLength(1);
      expect(verifyRecs[0]!.priority).toBe('high');
    });
  });

  describe('getTopRecommendation', () => {
    it('returns the isDefault recommendation', () => {
      const rule = makeRule('test', () => true, [
        makeRec('s1', 'high'),
        makeRec('s2', 'medium'),
      ]);
      const engine = new RecommenderEngine([rule]);
      const top = engine.getTopRecommendation(makeState());

      expect(top).toBeDefined();
      expect(top!.skillId).toBe('s1');
      expect(top!.isDefault).toBe(true);
    });

    it('returns undefined only if getRecommendations returns empty (should not happen due to fallback)', () => {
      // With fallback, getTopRecommendation should always return something
      const engine = new RecommenderEngine([]);
      const top = engine.getTopRecommendation(makeState());

      expect(top).toBeDefined();
      expect(top!.skillId).toBe('core.status');
    });
  });

  describe('performance', () => {
    it('completes 1000 iterations in < 100ms for 50 rules (REC-04)', () => {
      // Build 50 rules, half matching, half not
      const rules: RecommendationRule[] = [];
      for (let i = 0; i < 50; i++) {
        rules.push(
          makeRule(
            `perf-rule-${i}`,
            () => i % 2 === 0,
            [makeRec(`skill-${i}`, i < 10 ? 'high' : i < 30 ? 'medium' : 'low')],
          ),
        );
      }

      const engine = new RecommenderEngine(rules);
      const state = makeState({ lastSkillId: 'workflow.execute' });

      const start = performance.now();
      for (let iter = 0; iter < 1000; iter++) {
        engine.getRecommendations(state);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });
});

// ---------------------------------------------------------------------------
// createRecommender (factory)
// ---------------------------------------------------------------------------

describe('createRecommender', () => {
  it('returns a RecommenderApi with getRecommendations and getTopRecommendation', () => {
    const recommender = createRecommender();

    expect(typeof recommender.getRecommendations).toBe('function');
    expect(typeof recommender.getTopRecommendation).toBe('function');
  });

  it('uses built-in RECOMMENDATION_RULES when no rules provided', () => {
    const recommender = createRecommender();
    const state = makeState({
      lastSkillId: 'workflow.execute',
      lastResult: { success: true },
    });
    const result = recommender.getRecommendations(state);

    // Should get recommendations from built-in rules, not empty fallback
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('accepts custom rules override', () => {
    const customRule = makeRule('custom', () => true, [
      makeRec('custom.skill', 'high'),
    ]);
    const recommender = createRecommender([customRule]);
    const result = recommender.getRecommendations(makeState());

    expect(result[0]!.skillId).toBe('custom.skill');
  });
});
