import { describe, it, expect } from 'vitest';
import {
  evaluateSpecialistGate,
  updateSpecialistRecord,
  createSpecialistRecord,
  ALL_SPECIALISTS,
} from '../shared/specialist-gate.js';
import type { SpecialistRecord } from '../shared/specialist-gate.js';

describe('specialist-gate', () => {
  describe('evaluateSpecialistGate', () => {
    it('enables all specialists when no history', () => {
      const result = evaluateSpecialistGate([]);
      expect(result.enabled).toEqual(ALL_SPECIALISTS);
      expect(result.gated).toEqual([]);
    });

    it('never gates core specialists (security, correctness)', () => {
      const records: SpecialistRecord[] = [
        { specialistId: 'security', consecutiveZeroFindings: 50, totalRuns: 50, totalFindings: 0, lastFindingAt: null },
        { specialistId: 'correctness', consecutiveZeroFindings: 50, totalRuns: 50, totalFindings: 0, lastFindingAt: null },
      ];
      const result = evaluateSpecialistGate(records);
      expect(result.enabled).toContain('security');
      expect(result.enabled).toContain('correctness');
      expect(result.gated).not.toContain('security');
      expect(result.gated).not.toContain('correctness');
    });

    it('gates non-core specialist after threshold', () => {
      const records: SpecialistRecord[] = [
        { specialistId: 'migration', consecutiveZeroFindings: 10, totalRuns: 10, totalFindings: 0, lastFindingAt: null },
      ];
      const result = evaluateSpecialistGate(records, 10);
      expect(result.gated).toContain('migration');
      expect(result.enabled).not.toContain('migration');
    });

    it('keeps specialist enabled below threshold', () => {
      const records: SpecialistRecord[] = [
        { specialistId: 'migration', consecutiveZeroFindings: 9, totalRuns: 9, totalFindings: 0, lastFindingAt: null },
      ];
      const result = evaluateSpecialistGate(records, 10);
      expect(result.enabled).toContain('migration');
    });

    it('calculates estimated token savings', () => {
      const records: SpecialistRecord[] = [
        { specialistId: 'migration', consecutiveZeroFindings: 15, totalRuns: 15, totalFindings: 0, lastFindingAt: null },
        { specialistId: 'maintainability', consecutiveZeroFindings: 12, totalRuns: 12, totalFindings: 0, lastFindingAt: null },
      ];
      const result = evaluateSpecialistGate(records, 10);
      expect(result.gated).toHaveLength(2);
      expect(result.estimatedTokensSaved).toBe(8000); // 2 * 4000
    });
  });

  describe('updateSpecialistRecord', () => {
    it('increments consecutiveZeroFindings on zero findings', () => {
      const record = createSpecialistRecord('testing');
      const updated = updateSpecialistRecord(record, 0);
      expect(updated.consecutiveZeroFindings).toBe(1);
      expect(updated.totalRuns).toBe(1);
    });

    it('resets consecutiveZeroFindings on findings', () => {
      let record = createSpecialistRecord('testing');
      record = updateSpecialistRecord(record, 0);
      record = updateSpecialistRecord(record, 0);
      record = updateSpecialistRecord(record, 3);
      expect(record.consecutiveZeroFindings).toBe(0);
      expect(record.totalFindings).toBe(3);
      expect(record.lastFindingAt).not.toBeNull();
    });
  });

  describe('createSpecialistRecord', () => {
    it('creates fresh record with zero counters', () => {
      const record = createSpecialistRecord('api-design');
      expect(record.specialistId).toBe('api-design');
      expect(record.consecutiveZeroFindings).toBe(0);
      expect(record.totalRuns).toBe(0);
      expect(record.totalFindings).toBe(0);
      expect(record.lastFindingAt).toBeNull();
    });
  });
});
