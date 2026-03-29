/**
 * Unit tests for BudgetGuard — cost ceiling enforcement.
 */

import { describe, it, expect } from 'vitest';
import { BudgetGuard } from '../shared/budget-guard.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BudgetGuard', () => {
  describe('no ceiling (null)', () => {
    it('always returns ok when no ceiling is set', () => {
      const guard = new BudgetGuard(null);
      expect(guard.check(0).status).toBe('ok');
      expect(guard.check(100).status).toBe('ok');
      expect(guard.check(0.001).status).toBe('ok');
    });

    it('returns null ceilingUsd and null message when no ceiling', () => {
      const guard = new BudgetGuard(null);
      const result = guard.check(5);
      expect(result.ceilingUsd).toBeNull();
      expect(result.message).toBeNull();
      expect(result.percentUsed).toBe(0);
    });
  });

  describe('with ceiling = $10.00', () => {
    const guard = new BudgetGuard(10);

    it('returns ok when under 50% ($4.99)', () => {
      const result = guard.check(4.99);
      expect(result.status).toBe('ok');
      expect(result.message).toBeNull();
    });

    it('returns warning_50 at exactly 50% ($5.00)', () => {
      const result = guard.check(5.0);
      expect(result.status).toBe('warning_50');
      expect(result.message).toContain('50%');
      expect(result.message).toContain('$5.00');
    });

    it('returns warning_50 between 50% and 75% ($6.00)', () => {
      const result = guard.check(6.0);
      expect(result.status).toBe('warning_50');
    });

    it('returns warning_75 at exactly 75% ($7.50)', () => {
      const result = guard.check(7.5);
      expect(result.status).toBe('warning_75');
      expect(result.message).toContain('75%');
    });

    it('returns warning_75 between 75% and 90% ($8.00)', () => {
      const result = guard.check(8.0);
      expect(result.status).toBe('warning_75');
    });

    it('returns warning_90 at exactly 90% ($9.00)', () => {
      const result = guard.check(9.0);
      expect(result.status).toBe('warning_90');
      expect(result.message).toContain('90%');
    });

    it('returns warning_90 between 90% and 100% ($9.50)', () => {
      const result = guard.check(9.5);
      expect(result.status).toBe('warning_90');
    });

    it('returns exceeded at exactly 100% ($10.00)', () => {
      const result = guard.check(10.0);
      expect(result.status).toBe('exceeded');
      expect(result.message).toContain('stopping auto mode');
    });

    it('returns exceeded when over 100% ($12.00)', () => {
      const result = guard.check(12.0);
      expect(result.status).toBe('exceeded');
    });

    it('includes correct percentUsed in result', () => {
      const result = guard.check(7.5);
      expect(result.percentUsed).toBe(75);
    });

    it('includes currentCostUsd and ceilingUsd in result', () => {
      const result = guard.check(3.0);
      expect(result.currentCostUsd).toBe(3.0);
      expect(result.ceilingUsd).toBe(10);
    });
  });

  describe('fromConfig factory', () => {
    it('creates guard with ceiling from config', () => {
      const guard = BudgetGuard.fromConfig({ budget_ceiling: 5 });
      expect(guard.check(5).status).toBe('exceeded');
    });

    it('creates guard with null ceiling when budget_ceiling is missing', () => {
      const guard = BudgetGuard.fromConfig({});
      expect(guard.check(9999).status).toBe('ok');
    });

    it('creates guard with null ceiling when budget_ceiling is 0', () => {
      const guard = BudgetGuard.fromConfig({ budget_ceiling: 0 });
      expect(guard.check(1).status).toBe('ok');
    });

    it('creates guard with null ceiling when budget_ceiling is undefined', () => {
      const guard = BudgetGuard.fromConfig({ budget_ceiling: undefined });
      expect(guard.check(100).status).toBe('ok');
    });
  });
});
