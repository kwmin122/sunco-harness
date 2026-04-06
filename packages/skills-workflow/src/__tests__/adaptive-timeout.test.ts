/**
 * Tests for adaptive-timeout.ts — skill-aware timeout selection.
 * Requirements: LH-17
 */

import { describe, it, expect } from 'vitest';
import { getAdaptiveTimeout, DEFAULT_TIMEOUTS } from '../shared/adaptive-timeout.js';

describe('getAdaptiveTimeout', () => {
  describe('deterministic skills', () => {
    it('always returns simple timeout regardless of complexity', () => {
      expect(getAdaptiveTimeout('deterministic')).toBe(DEFAULT_TIMEOUTS.simple);
      expect(getAdaptiveTimeout('deterministic', 'simple')).toBe(DEFAULT_TIMEOUTS.simple);
      expect(getAdaptiveTimeout('deterministic', 'standard')).toBe(DEFAULT_TIMEOUTS.simple);
      expect(getAdaptiveTimeout('deterministic', 'complex')).toBe(DEFAULT_TIMEOUTS.simple);
    });
  });

  describe('prompt skills', () => {
    it('returns simple timeout for simple complexity', () => {
      expect(getAdaptiveTimeout('prompt', 'simple')).toBe(DEFAULT_TIMEOUTS.simple);
    });

    it('returns standard timeout for standard complexity', () => {
      expect(getAdaptiveTimeout('prompt', 'standard')).toBe(DEFAULT_TIMEOUTS.standard);
    });

    it('returns standard timeout when complexity is undefined', () => {
      expect(getAdaptiveTimeout('prompt')).toBe(DEFAULT_TIMEOUTS.standard);
    });

    it('returns complex timeout for complex complexity', () => {
      expect(getAdaptiveTimeout('prompt', 'complex')).toBe(DEFAULT_TIMEOUTS.complex);
    });
  });

  describe('hybrid skills', () => {
    it('returns simple timeout for simple complexity', () => {
      expect(getAdaptiveTimeout('hybrid', 'simple')).toBe(DEFAULT_TIMEOUTS.simple);
    });

    it('returns standard timeout when complexity is undefined', () => {
      expect(getAdaptiveTimeout('hybrid')).toBe(DEFAULT_TIMEOUTS.standard);
    });

    it('returns standard timeout for standard complexity', () => {
      expect(getAdaptiveTimeout('hybrid', 'standard')).toBe(DEFAULT_TIMEOUTS.standard);
    });

    it('returns complex timeout for complex complexity', () => {
      expect(getAdaptiveTimeout('hybrid', 'complex')).toBe(DEFAULT_TIMEOUTS.complex);
    });
  });

  describe('custom overrides', () => {
    it('uses overridden simple timeout', () => {
      const result = getAdaptiveTimeout('deterministic', undefined, { simple: 10_000 });
      expect(result).toBe(10_000);
    });

    it('uses overridden standard timeout', () => {
      const result = getAdaptiveTimeout('prompt', 'standard', { standard: 900_000 });
      expect(result).toBe(900_000);
    });

    it('uses overridden complex timeout', () => {
      const result = getAdaptiveTimeout('prompt', 'complex', { complex: 7_200_000 });
      expect(result).toBe(7_200_000);
    });

    it('partial overrides do not affect other profiles', () => {
      const result = getAdaptiveTimeout('prompt', 'simple', { complex: 999_999 });
      expect(result).toBe(DEFAULT_TIMEOUTS.simple);
    });
  });

  describe('DEFAULT_TIMEOUTS', () => {
    it('has correct default values in milliseconds', () => {
      expect(DEFAULT_TIMEOUTS.simple).toBe(300_000);       // 5 min
      expect(DEFAULT_TIMEOUTS.standard).toBe(1_800_000);   // 30 min
      expect(DEFAULT_TIMEOUTS.complex).toBe(3_600_000);    // 60 min
      expect(DEFAULT_TIMEOUTS.research).toBe(3_600_000);   // 60 min
    });
  });
});
