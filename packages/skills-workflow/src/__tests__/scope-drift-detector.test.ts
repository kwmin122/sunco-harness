import { describe, it, expect } from 'vitest';
import { extractIntent, detectDrift } from '../shared/scope-drift-detector.js';

describe('scope-drift-detector', () => {
  describe('extractIntent', () => {
    it('extracts scope from conventional commits', () => {
      const intents = extractIntent({ commitMessages: ['feat(auth): add JWT support'] });
      expect(intents).toContain('auth');
    });

    it('extracts keywords from messages', () => {
      const intents = extractIntent({ commitMessages: ['implement debug learnings system'] });
      expect(intents.some((i) => i.includes('debug') || i.includes('learnings'))).toBe(true);
    });

    it('extracts requirement IDs from plan', () => {
      const intents = extractIntent({ planContent: 'Requirements: DBG-01, VRF-02' });
      expect(intents).toContain('dbg-01');
      expect(intents).toContain('vrf-02');
    });

    it('extracts file paths from plan', () => {
      const intents = extractIntent({ planContent: 'Modify src/shared/debug-types.ts' });
      expect(intents.some((i) => i.includes('src/shared/debug-types.ts'))).toBe(true);
    });
  });

  describe('detectDrift', () => {
    it('returns CLEAN when all files match intent', () => {
      const result = detectDrift(
        ['src/debug.ts', 'src/debug.test.ts'],
        ['debug'],
      );
      expect(result.verdict).toBe('CLEAN');
    });

    it('detects drift when many files are out of scope', () => {
      const result = detectDrift(
        ['src/auth.ts', 'src/billing.ts', 'src/ui.ts', 'src/debug.ts'],
        ['debug'],
      );
      expect(result.verdict).toBe('DRIFT_DETECTED');
      expect(result.outOfScopeFiles.length).toBeGreaterThan(0);
    });

    it('detects missing requirements', () => {
      const result = detectDrift(
        ['src/auth.ts'],
        ['auth', 'billing'],
        ['billing-integration'],
      );
      expect(result.verdict).toBe('REQUIREMENTS_MISSING');
      expect(result.missingRequirements).toContain('billing-integration');
    });

    it('returns CLEAN with no intent data', () => {
      const result = detectDrift(['a.ts'], []);
      expect(result.verdict).toBe('CLEAN');
    });
  });
});
