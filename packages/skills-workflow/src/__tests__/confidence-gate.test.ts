import { describe, it, expect } from 'vitest';
import { applyConfidenceGate, formatConfidenceGateSummary } from '../shared/confidence-gate.js';
import type { VerifyFinding } from '../shared/verify-types.js';

function finding(severity: VerifyFinding['severity'], desc: string): VerifyFinding {
  return { layer: 1, source: 'security', severity, description: desc };
}

describe('confidence-gate', () => {
  describe('applyConfidenceGate', () => {
    it('sorts critical and high into main', () => {
      const result = applyConfidenceGate([
        finding('critical', 'SQL injection'),
        finding('high', 'Missing auth'),
      ]);
      expect(result.main).toHaveLength(2);
      expect(result.appendix).toHaveLength(0);
      expect(result.hidden).toHaveLength(0);
    });

    it('sorts medium into appendix', () => {
      const result = applyConfidenceGate([
        finding('medium', 'Weak assertion'),
      ]);
      expect(result.main).toHaveLength(0);
      expect(result.appendix).toHaveLength(1);
    });

    it('sorts low into hidden', () => {
      const result = applyConfidenceGate([
        finding('low', 'Minor naming'),
      ]);
      expect(result.hidden).toHaveLength(1);
    });

    it('handles mixed severities', () => {
      const result = applyConfidenceGate([
        finding('critical', 'a'),
        finding('medium', 'b'),
        finding('low', 'c'),
        finding('high', 'd'),
        finding('low', 'e'),
      ]);
      expect(result.counts).toEqual({
        total: 5,
        main: 2,
        appendix: 1,
        hidden: 2,
      });
    });

    it('handles empty findings', () => {
      const result = applyConfidenceGate([]);
      expect(result.counts.total).toBe(0);
    });
  });

  describe('formatConfidenceGateSummary', () => {
    it('formats summary with counts', () => {
      const result = applyConfidenceGate([
        finding('critical', 'a'),
        finding('medium', 'b'),
        finding('low', 'c'),
      ]);
      const summary = formatConfidenceGateSummary(result);
      expect(summary).toContain('3 total');
      expect(summary).toContain('Main (critical+high): 1');
      expect(summary).toContain('Appendix (medium): 1');
      expect(summary).toContain('Hidden (low): 1');
    });
  });
});
