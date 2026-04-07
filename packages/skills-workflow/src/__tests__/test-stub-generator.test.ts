import { describe, it, expect } from 'vitest';
import { generateTestStubs, formatTestStubSummary } from '../shared/test-stub-generator.js';
import type { VerifyFinding } from '../shared/verify-types.js';

function finding(source: VerifyFinding['source'], severity: VerifyFinding['severity'], file?: string): VerifyFinding {
  return {
    layer: 1,
    source,
    severity,
    description: 'Missing edge case test for null input',
    file,
    suggestion: 'Add test for null parameter',
  };
}

describe('test-stub-generator', () => {
  describe('generateTestStubs', () => {
    it('generates stub for testing source with file', () => {
      const stubs = generateTestStubs([
        finding('testing', 'high', 'src/handler.ts'),
      ]);
      expect(stubs).toHaveLength(1);
      expect(stubs[0].testFile).toBe('src/__tests__/handler.test.ts');
      expect(stubs[0].code).toContain('import { describe, it, expect }');
      expect(stubs[0].code).toContain('Missing edge case');
    });

    it('generates stub for correctness source', () => {
      const stubs = generateTestStubs([
        finding('correctness', 'critical', 'src/parser.ts'),
      ]);
      expect(stubs).toHaveLength(1);
      expect(stubs[0].testFile).toContain('parser.test.ts');
    });

    it('skips non-test-relevant sources', () => {
      const stubs = generateTestStubs([
        finding('performance', 'high', 'src/foo.ts'),
        finding('architecture', 'high', 'src/bar.ts'),
        finding('maintainability', 'high', 'src/baz.ts'),
      ]);
      expect(stubs).toHaveLength(0);
    });

    it('skips findings without file', () => {
      const stubs = generateTestStubs([
        finding('testing', 'high', undefined),
      ]);
      expect(stubs).toHaveLength(0);
    });

    it('skips low severity findings', () => {
      const stubs = generateTestStubs([
        finding('testing', 'low', 'src/foo.ts'),
      ]);
      expect(stubs).toHaveLength(0);
    });

    it('includes suggestion in stub code', () => {
      const stubs = generateTestStubs([
        finding('security', 'critical', 'src/auth.ts'),
      ]);
      expect(stubs[0].code).toContain('Add test for null parameter');
    });
  });

  describe('formatTestStubSummary', () => {
    it('formats empty stubs', () => {
      expect(formatTestStubSummary([])).toBe('No test stubs generated.');
    });

    it('formats stubs list', () => {
      const stubs = generateTestStubs([
        finding('testing', 'high', 'src/a.ts'),
        finding('correctness', 'high', 'src/b.ts'),
      ]);
      const summary = formatTestStubSummary(stubs);
      expect(summary).toContain('2 test stub(s)');
      expect(summary).toContain('a.test.ts');
      expect(summary).toContain('b.test.ts');
    });
  });
});
