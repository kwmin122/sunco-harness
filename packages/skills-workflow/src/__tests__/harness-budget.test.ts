/**
 * Unit tests for Harness Budget — harness self-budget enforcement.
 */

import { describe, it, expect } from 'vitest';
import {
  checkHarnessBudget,
  HARNESS_BUDGET_PERCENT,
} from '../shared/harness-budget.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HarnessBudget', () => {
  describe('HARNESS_BUDGET_PERCENT', () => {
    it('is 5%', () => {
      expect(HARNESS_BUDGET_PERCENT).toBe(5);
    });
  });

  describe('checkHarnessBudget', () => {
    it('returns withinBudget=true when harness is under 5%', () => {
      const result = checkHarnessBudget(4000, 100_000);
      expect(result.withinBudget).toBe(true);
      expect(result.harnessPercent).toBe(4);
      expect(result.message).toBeNull();
    });

    it('returns withinBudget=true at exactly 5% (boundary)', () => {
      const result = checkHarnessBudget(5000, 100_000);
      expect(result.withinBudget).toBe(true);
      expect(result.harnessPercent).toBe(5);
      expect(result.message).toBeNull();
    });

    it('returns withinBudget=false when over 5%', () => {
      const result = checkHarnessBudget(6000, 100_000);
      expect(result.withinBudget).toBe(false);
      expect(result.harnessPercent).toBe(6);
      expect(result.message).not.toBeNull();
    });

    it('includes correct tokens in result', () => {
      const result = checkHarnessBudget(3000, 200_000);
      expect(result.harnessTokens).toBe(3000);
      expect(result.totalTokens).toBe(200_000);
    });

    it('handles zero harness tokens', () => {
      const result = checkHarnessBudget(0, 100_000);
      expect(result.withinBudget).toBe(true);
      expect(result.harnessPercent).toBe(0);
      expect(result.message).toBeNull();
    });

    it('handles zero total tokens (edge case)', () => {
      const result = checkHarnessBudget(100, 0);
      expect(result.withinBudget).toBe(false);
      expect(result.harnessPercent).toBe(100);
      expect(result.message).toContain('greater than 0');
    });

    it('handles negative total tokens (edge case)', () => {
      const result = checkHarnessBudget(100, -1);
      expect(result.withinBudget).toBe(false);
      expect(result.message).toContain('greater than 0');
    });

    it('computes precise percentage with rounding', () => {
      // 3333 / 100000 = 3.333%
      const result = checkHarnessBudget(3333, 100_000);
      expect(result.harnessPercent).toBe(3.33);
    });

    it('message includes actual percentage when over budget', () => {
      const result = checkHarnessBudget(8000, 100_000);
      expect(result.message).toContain('8.0%');
      expect(result.message).toContain('limit: 5%');
    });

    it('handles large token counts (1M context)', () => {
      const result = checkHarnessBudget(40_000, 1_000_000);
      expect(result.withinBudget).toBe(true);
      expect(result.harnessPercent).toBe(4);
    });

    it('just barely over budget (5.01%)', () => {
      const result = checkHarnessBudget(5010, 100_000);
      expect(result.withinBudget).toBe(false);
      expect(result.harnessPercent).toBe(5.01);
    });

    it('just barely under budget (4.99%)', () => {
      const result = checkHarnessBudget(4990, 100_000);
      expect(result.withinBudget).toBe(true);
      expect(result.harnessPercent).toBe(4.99);
    });
  });
});
