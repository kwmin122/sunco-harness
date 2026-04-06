/**
 * Tests for model-selector.ts — deterministic model tier selection.
 * Requirements: LH-07, LH-08
 */

import { describe, it, expect } from 'vitest';
import { selectModelTier } from '../shared/model-selector.js';

describe('selectModelTier', () => {
  describe('complexity-based selection', () => {
    it('selects fast for simple tasks', () => {
      const result = selectModelTier({ complexity: 'simple', budgetPercent: 0 });
      expect(result.tier).toBe('fast');
      expect(result.downgraded).toBe(false);
    });

    it('selects balanced for standard tasks', () => {
      const result = selectModelTier({ complexity: 'standard', budgetPercent: 0 });
      expect(result.tier).toBe('balanced');
      expect(result.downgraded).toBe(false);
    });

    it('selects quality for complex tasks', () => {
      const result = selectModelTier({ complexity: 'complex', budgetPercent: 0 });
      expect(result.tier).toBe('quality');
      expect(result.downgraded).toBe(false);
    });

    it('defaults to standard when complexity not specified', () => {
      const result = selectModelTier({ budgetPercent: 0 });
      expect(result.tier).toBe('balanced');
    });
  });

  describe('budget-aware downgrade', () => {
    it('downgrades complex to balanced at 75% budget', () => {
      const result = selectModelTier({ complexity: 'complex', budgetPercent: 75 });
      expect(result.tier).toBe('balanced');
      expect(result.downgraded).toBe(true);
    });

    it('downgrades balanced to fast at 75% budget', () => {
      const result = selectModelTier({ complexity: 'standard', budgetPercent: 80 });
      expect(result.tier).toBe('fast');
      expect(result.downgraded).toBe(true);
    });

    it('does not downgrade simple (already lowest)', () => {
      const result = selectModelTier({ complexity: 'simple', budgetPercent: 90 });
      expect(result.tier).toBe('fast');
      expect(result.downgraded).toBe(false);
    });

    it('does not downgrade below 75% budget', () => {
      const result = selectModelTier({ complexity: 'complex', budgetPercent: 74 });
      expect(result.tier).toBe('quality');
      expect(result.downgraded).toBe(false);
    });
  });

  describe('intent overrides', () => {
    it('always uses fast for lookup intent', () => {
      const result = selectModelTier({ complexity: 'complex', budgetPercent: 0, intentType: 'lookup' });
      expect(result.tier).toBe('fast');
    });

    it('always uses quality for plan intent', () => {
      const result = selectModelTier({ complexity: 'simple', budgetPercent: 0, intentType: 'plan' });
      expect(result.tier).toBe('quality');
    });

    it('always uses quality for review intent', () => {
      const result = selectModelTier({ complexity: 'simple', budgetPercent: 0, intentType: 'review' });
      expect(result.tier).toBe('quality');
    });

    it('downgrades plan/review at extreme budget (90%+)', () => {
      const result = selectModelTier({ complexity: 'complex', budgetPercent: 90, intentType: 'plan' });
      expect(result.tier).toBe('balanced');
      expect(result.downgraded).toBe(true);
    });

    it('does not affect implement/investigate intents', () => {
      const impl = selectModelTier({ complexity: 'standard', budgetPercent: 0, intentType: 'implement' });
      expect(impl.tier).toBe('balanced');

      const inv = selectModelTier({ complexity: 'standard', budgetPercent: 0, intentType: 'investigate' });
      expect(inv.tier).toBe('balanced');
    });
  });
});
