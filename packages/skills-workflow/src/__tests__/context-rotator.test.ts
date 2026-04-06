/**
 * Tests for context-rotator.ts — context rotation evaluation engine.
 * Requirements: LH-16
 */

import { describe, it, expect } from 'vitest';
import { evaluateRotation } from '../shared/context-rotator.js';

describe('evaluateRotation', () => {
  describe('continue zone (< 70%)', () => {
    it('returns continue at 0%', () => {
      const result = evaluateRotation(0);
      expect(result.action).toBe('continue');
      expect(result.shouldRotate).toBe(false);
      expect(result.currentPercent).toBe(0);
      expect(result.resumeCommand).toBe('');
    });

    it('returns continue at 50%', () => {
      const result = evaluateRotation(50);
      expect(result.action).toBe('continue');
      expect(result.shouldRotate).toBe(false);
    });

    it('returns continue at 69%', () => {
      const result = evaluateRotation(69);
      expect(result.action).toBe('continue');
      expect(result.shouldRotate).toBe(false);
    });
  });

  describe('save-and-rotate zone (70-84%)', () => {
    it('triggers rotation at exactly 70%', () => {
      const result = evaluateRotation(70);
      expect(result.action).toBe('save-and-rotate');
      expect(result.shouldRotate).toBe(true);
      expect(result.resumeCommand).toBe('sunco resume');
    });

    it('triggers rotation at 75%', () => {
      const result = evaluateRotation(75);
      expect(result.action).toBe('save-and-rotate');
      expect(result.shouldRotate).toBe(true);
    });

    it('triggers rotation at 84%', () => {
      const result = evaluateRotation(84);
      expect(result.action).toBe('save-and-rotate');
      expect(result.shouldRotate).toBe(true);
    });
  });

  describe('save-and-compact zone (85%+)', () => {
    it('triggers compact at exactly 85%', () => {
      const result = evaluateRotation(85);
      expect(result.action).toBe('save-and-compact');
      expect(result.shouldRotate).toBe(true);
      expect(result.resumeCommand).toBe('sunco resume --compact');
    });

    it('triggers compact at 90%', () => {
      const result = evaluateRotation(90);
      expect(result.action).toBe('save-and-compact');
      expect(result.shouldRotate).toBe(true);
    });

    it('triggers compact at 100%', () => {
      const result = evaluateRotation(100);
      expect(result.action).toBe('save-and-compact');
      expect(result.shouldRotate).toBe(true);
    });
  });

  describe('custom config', () => {
    it('respects custom threshold', () => {
      // Lower threshold: rotate at 50%
      const result = evaluateRotation(55, { thresholdPercent: 50 });
      expect(result.action).toBe('save-and-rotate');
      expect(result.shouldRotate).toBe(true);
    });

    it('respects custom threshold for compact zone', () => {
      // threshold=50 -> compact at 65%
      const result = evaluateRotation(65, { thresholdPercent: 50 });
      expect(result.action).toBe('save-and-compact');
    });

    it('continues below custom threshold', () => {
      const result = evaluateRotation(45, { thresholdPercent: 50 });
      expect(result.action).toBe('continue');
      expect(result.shouldRotate).toBe(false);
    });

    it('ignores maxSessionsToKeep in evaluation (metadata only)', () => {
      const result = evaluateRotation(30, { maxSessionsToKeep: 10 });
      expect(result.action).toBe('continue');
    });
  });

  describe('currentPercent passthrough', () => {
    it('always returns the input percentage', () => {
      expect(evaluateRotation(42).currentPercent).toBe(42);
      expect(evaluateRotation(78).currentPercent).toBe(78);
      expect(evaluateRotation(95).currentPercent).toBe(95);
    });
  });
});
