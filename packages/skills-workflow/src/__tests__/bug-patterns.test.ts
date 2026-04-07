import { describe, it, expect } from 'vitest';
import { classifyBug, getBugPattern, getPatternsByCategory } from '../shared/bug-patterns.js';
import type { DiagnoseError } from '../shared/debug-types.js';

describe('bug-patterns', () => {
  describe('getBugPattern', () => {
    it('returns pattern for known type', () => {
      const pattern = getBugPattern('state_corruption');
      expect(pattern).toBeDefined();
      expect(pattern!.category).toBe('behavioral');
      expect(pattern!.indicators.length).toBeGreaterThan(0);
    });

    it('returns undefined for unknown type', () => {
      expect(getBugPattern('unknown' as never)).toBeUndefined();
    });

    it('returns all 9 pattern types', () => {
      const types = [
        'context_shortage', 'direction_error', 'structural_conflict',
        'state_corruption', 'race_condition', 'type_mismatch',
        'dependency_conflict', 'boundary_violation', 'silent_failure',
      ] as const;
      for (const t of types) {
        expect(getBugPattern(t)).toBeDefined();
      }
    });
  });

  describe('getPatternsByCategory', () => {
    it('returns structural patterns', () => {
      const patterns = getPatternsByCategory('structural');
      expect(patterns.length).toBe(4);
      expect(patterns.every((p) => p.category === 'structural')).toBe(true);
    });

    it('returns behavioral patterns', () => {
      const patterns = getPatternsByCategory('behavioral');
      expect(patterns.length).toBe(3);
    });

    it('returns environmental patterns', () => {
      const patterns = getPatternsByCategory('environmental');
      expect(patterns.length).toBe(2);
    });
  });

  describe('classifyBug', () => {
    it('classifies type_mismatch from TS errors', () => {
      const errors: DiagnoseError[] = [
        {
          type: 'type_error',
          file: 'src/foo.ts',
          line: 10,
          message: "Type 'string' is not assignable to type 'number'",
          code: 'TS2322',
        },
      ];
      expect(classifyBug(errors, '')).toBe('type_mismatch');
    });

    it('classifies race_condition from timeout errors', () => {
      const errors: DiagnoseError[] = [
        {
          type: 'test_failure',
          file: 'src/foo.test.ts',
          line: 5,
          message: 'Test timed out after 5000ms',
        },
      ];
      expect(classifyBug(errors, 'intermittent failure')).toBe('race_condition');
    });

    it('classifies dependency_conflict from npm errors', () => {
      const errors: DiagnoseError[] = [
        {
          type: 'lint_error',
          file: '',
          line: null,
          message: 'ERESOLVE Could not resolve dependency tree',
        },
      ];
      expect(classifyBug(errors, 'npm ERR peer dep conflict')).toBe('dependency_conflict');
    });

    it('classifies silent_failure from assertion errors', () => {
      const errors: DiagnoseError[] = [
        {
          type: 'test_failure',
          file: 'src/bar.test.ts',
          line: 20,
          message: "expected 'hello' but received 'world'",
        },
      ];
      expect(classifyBug(errors, '')).toBe('silent_failure');
    });

    it('classifies state_corruption from stale cache', () => {
      const errors: DiagnoseError[] = [];
      expect(classifyBug(errors, 'stale cache entry, SQLITE_BUSY lock file detected')).toBe('state_corruption');
    });

    it('defaults to context_shortage when no indicators match', () => {
      const errors: DiagnoseError[] = [
        { type: 'test_failure', file: 'x.ts', line: 1, message: 'some random thing happened' },
      ];
      expect(classifyBug(errors, '')).toBe('context_shortage');
    });

    it('classifies boundary_violation from cross-package imports', () => {
      const errors: DiagnoseError[] = [
        {
          type: 'lint_error',
          file: 'src/a.ts',
          line: 1,
          message: 'cross-package import detected: packages/core to packages/cli',
        },
      ];
      expect(classifyBug(errors, '')).toBe('boundary_violation');
    });
  });
});
