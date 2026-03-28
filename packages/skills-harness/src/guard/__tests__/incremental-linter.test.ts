/**
 * Tests for guard incremental linter.
 * Validates single-file ESLint lintText execution and SunLintViolation output.
 *
 * Decision: D-22 (incremental single-file linting via ESLint lintText)
 */
import { describe, it, expect } from 'vitest';
import { lintSingleFile } from '../incremental-linter.js';
import type { BoundariesConfig } from '../../lint/types.js';

/** Empty boundaries config for tests not needing boundary checks */
const emptyBoundariesConfig: BoundariesConfig = {
  elements: [],
  dependencyRules: [],
};

describe('lintSingleFile', () => {
  it('runs ESLint on one file and returns SunLintViolation[]', async () => {
    // File with a syntax issue that the parser should catch
    const fileContent = `const x: number = "not a number";\nexport {};\n`;

    const violations = await lintSingleFile({
      filePath: 'test-file.ts',
      fileContent,
      boundariesConfig: emptyBoundariesConfig,
      cwd: process.cwd(),
    });

    expect(Array.isArray(violations)).toBe(true);
    // Each violation should have the correct shape
    for (const v of violations) {
      expect(v).toHaveProperty('rule');
      expect(v).toHaveProperty('file');
      expect(v).toHaveProperty('line');
      expect(v).toHaveProperty('column');
      expect(v).toHaveProperty('violation');
      expect(v).toHaveProperty('fix_instruction');
      expect(v).toHaveProperty('severity');
    }
  });

  it('with no boundaries config still returns parse errors', async () => {
    // Intentionally broken syntax
    const fileContent = `const x = { a: ;\n`;

    const violations = await lintSingleFile({
      filePath: 'broken.ts',
      fileContent,
      boundariesConfig: emptyBoundariesConfig,
      cwd: process.cwd(),
    });

    expect(Array.isArray(violations)).toBe(true);
    // Parse errors should be detected
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.severity).toBeDefined();
  });

  it('completes within 2 seconds for a single file', async () => {
    const fileContent = `export function hello(): string { return "world"; }\n`;

    const start = Date.now();
    await lintSingleFile({
      filePath: 'fast-file.ts',
      fileContent,
      boundariesConfig: emptyBoundariesConfig,
      cwd: process.cwd(),
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });
});
