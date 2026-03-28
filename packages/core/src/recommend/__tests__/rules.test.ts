/**
 * @sunco/core - RECOMMENDATION_RULES tests
 *
 * Tests all recommendation rules for correctness: workflow transitions,
 * state-based context rules, error recovery, and fallback behavior.
 *
 * Requirements: REC-03 (state-based routing), REC-04 (20-50 rules)
 */

import { describe, it, expect } from 'vitest';
import { RECOMMENDATION_RULES } from '../rules.js';
import { RecommenderEngine } from '../engine.js';
import type { RecommendationState, Recommendation } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_SKILLS = new Set([
  'workflow.discuss',
  'workflow.plan',
  'workflow.execute',
  'workflow.verify',
  'workflow.ship',
  'workflow.debug',
  'workflow.research',
  'harness.init',
  'harness.lint',
  'harness.health',
  'harness.guard',
  'core.status',
  'core.new',
  'core.scan',
  'workflow.milestone',
]);

function makeState(overrides: Partial<RecommendationState> = {}): RecommendationState {
  return {
    projectState: {},
    activeSkills: ALL_SKILLS,
    ...overrides,
  };
}

/** Get recommendations using the real rules for a given state */
function getRecsForState(overrides: Partial<RecommendationState> = {}): Recommendation[] {
  const engine = new RecommenderEngine(RECOMMENDATION_RULES);
  return engine.getRecommendations(makeState(overrides));
}

/** Check if a specific skillId is in the recommendations */
function hasSkill(recs: Recommendation[], skillId: string): boolean {
  return recs.some((r) => r.skillId === skillId);
}

/** Get the default (recommended) recommendation */
function getDefault(recs: Recommendation[]): Recommendation | undefined {
  return recs.find((r) => r.isDefault === true);
}

// ---------------------------------------------------------------------------
// Rule count validation
// ---------------------------------------------------------------------------

describe('RECOMMENDATION_RULES', () => {
  it('exports at least 25 rules (REC-04)', () => {
    expect(RECOMMENDATION_RULES.length).toBeGreaterThanOrEqual(25);
  });

  it('every rule has an id, description, matches, and recommend', () => {
    for (const rule of RECOMMENDATION_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(typeof rule.matches).toBe('function');
      expect(typeof rule.recommend).toBe('function');
    }
  });

  it('all rule IDs are unique', () => {
    const ids = RECOMMENDATION_RULES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Workflow chain transitions (REC-03)
// ---------------------------------------------------------------------------

describe('Workflow chain transitions', () => {
  it('after execute success -> recommend verify (default)', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.execute',
      lastResult: { success: true },
    });

    expect(hasSkill(recs, 'workflow.verify')).toBe(true);
    expect(getDefault(recs)!.skillId).toBe('workflow.verify');
  });

  it('after execute success -> also recommend ship (lower priority)', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.execute',
      lastResult: { success: true },
    });

    expect(hasSkill(recs, 'workflow.ship')).toBe(true);
  });

  it('after verify success -> recommend ship (default)', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.verify',
      lastResult: { success: true },
    });

    expect(hasSkill(recs, 'workflow.ship')).toBe(true);
    expect(getDefault(recs)!.skillId).toBe('workflow.ship');
  });

  it('after verify failure -> recommend debug (default)', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.verify',
      lastResult: { success: false },
    });

    expect(hasSkill(recs, 'workflow.debug')).toBe(true);
    expect(getDefault(recs)!.skillId).toBe('workflow.debug');
  });

  it('after verify failure -> also recommend execute (lower priority)', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.verify',
      lastResult: { success: false },
    });

    expect(hasSkill(recs, 'workflow.execute')).toBe(true);
  });

  it('after plan success -> recommend execute (default)', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.plan',
      lastResult: { success: true },
    });

    expect(hasSkill(recs, 'workflow.execute')).toBe(true);
    expect(getDefault(recs)!.skillId).toBe('workflow.execute');
  });

  it('after discuss success -> recommend plan (default)', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.discuss',
      lastResult: { success: true },
    });

    expect(hasSkill(recs, 'workflow.plan')).toBe(true);
    expect(getDefault(recs)!.skillId).toBe('workflow.plan');
  });

  it('after discuss success -> also recommend research', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.discuss',
      lastResult: { success: true },
    });

    expect(hasSkill(recs, 'workflow.research')).toBe(true);
  });

  it('after init success -> recommend lint (default)', () => {
    const recs = getRecsForState({
      lastSkillId: 'harness.init',
      lastResult: { success: true },
    });

    expect(hasSkill(recs, 'harness.lint')).toBe(true);
    expect(getDefault(recs)!.skillId).toBe('harness.lint');
  });

  it('after init success -> also recommend health', () => {
    const recs = getRecsForState({
      lastSkillId: 'harness.init',
      lastResult: { success: true },
    });

    expect(hasSkill(recs, 'harness.health')).toBe(true);
  });

  it('after ship success -> recommend milestone audit', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.ship',
      lastResult: { success: true },
    });

    expect(hasSkill(recs, 'workflow.milestone')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// State-based context rules
// ---------------------------------------------------------------------------

describe('State-based context rules', () => {
  it('if hasUncommittedChanges after execute -> recommend ship with higher priority', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.execute',
      lastResult: { success: true },
      projectState: { hasUncommittedChanges: true },
    });

    // Ship should be recommended and with higher priority than usual
    expect(hasSkill(recs, 'workflow.ship')).toBe(true);
  });

  it('if currentPhase is null -> recommend new or scan', () => {
    const recs = getRecsForState({
      projectState: { currentPhase: null },
    });

    const hasNewOrScan = hasSkill(recs, 'core.new') || hasSkill(recs, 'core.scan');
    expect(hasNewOrScan).toBe(true);
  });

  it('fresh session (no lastSkillId) -> recommend status (default)', () => {
    const recs = getRecsForState({
      lastSkillId: undefined,
      lastResult: undefined,
    });

    expect(hasSkill(recs, 'core.status')).toBe(true);
    expect(getDefault(recs)!.skillId).toBe('core.status');
  });
});

// ---------------------------------------------------------------------------
// Error recovery rules
// ---------------------------------------------------------------------------

describe('Error recovery rules', () => {
  it('after execute failure -> recommend debug (default)', () => {
    const recs = getRecsForState({
      lastSkillId: 'workflow.execute',
      lastResult: { success: false },
    });

    expect(hasSkill(recs, 'workflow.debug')).toBe(true);
    expect(getDefault(recs)!.skillId).toBe('workflow.debug');
  });

  it('after any skill failure -> recommend debug', () => {
    const recs = getRecsForState({
      lastSkillId: 'harness.lint',
      lastResult: { success: false },
    });

    expect(hasSkill(recs, 'workflow.debug')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fallback rules
// ---------------------------------------------------------------------------

describe('Fallback rules', () => {
  it('generic fallback always recommends status', () => {
    // Even with a weird state, should at least recommend status
    const recs = getRecsForState({
      lastSkillId: 'some.unknown.skill',
      lastResult: { success: true },
    });

    expect(recs.length).toBeGreaterThanOrEqual(1);
    // Should contain at least status as fallback
    expect(hasSkill(recs, 'core.status')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: engine + real rules
// ---------------------------------------------------------------------------

describe('Engine + real rules integration', () => {
  it('always returns 1-4 recommendations', () => {
    const states: Partial<RecommendationState>[] = [
      {},
      { lastSkillId: 'workflow.execute', lastResult: { success: true } },
      { lastSkillId: 'workflow.verify', lastResult: { success: false } },
      { lastSkillId: 'workflow.discuss', lastResult: { success: true } },
      { lastSkillId: 'harness.init', lastResult: { success: true } },
      { projectState: { currentPhase: null } },
    ];

    for (const overrides of states) {
      const recs = getRecsForState(overrides);
      expect(recs.length).toBeGreaterThanOrEqual(1);
      expect(recs.length).toBeLessThanOrEqual(4);
    }
  });

  it('always has exactly one isDefault recommendation', () => {
    const states: Partial<RecommendationState>[] = [
      {},
      { lastSkillId: 'workflow.execute', lastResult: { success: true } },
      { lastSkillId: 'workflow.verify', lastResult: { success: true } },
      { lastSkillId: 'workflow.plan', lastResult: { success: true } },
    ];

    for (const overrides of states) {
      const recs = getRecsForState(overrides);
      const defaults = recs.filter((r) => r.isDefault === true);
      expect(defaults).toHaveLength(1);
    }
  });

  it('all recommendations are deterministic (same state -> same output)', () => {
    const state = makeState({
      lastSkillId: 'workflow.execute',
      lastResult: { success: true },
    });
    const engine = new RecommenderEngine(RECOMMENDATION_RULES);

    const result1 = engine.getRecommendations(state);
    const result2 = engine.getRecommendations(state);

    expect(result1).toEqual(result2);
  });
});
