/**
 * Test stub generator — create test skeletons from verification findings.
 *
 * For each finding that suggests a test gap, generates a vitest test stub
 * with arrange-act-assert structure and the finding context.
 *
 * Phase 23b — Review Army
 */

import type { VerifyFinding } from './verify-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestStub {
  /** Target test file path */
  testFile: string;
  /** Test description */
  description: string;
  /** Generated test code */
  code: string;
  /** Source finding that triggered this stub */
  finding: VerifyFinding;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** Sources that indicate test-relevant findings */
const TEST_RELEVANT_SOURCES = new Set([
  'testing',
  'correctness',
  'security',
  'acceptance',
]);

/**
 * Generate test stubs from verification findings.
 *
 * Only generates stubs for findings from test-relevant sources
 * (testing, correctness, security, acceptance) that reference a specific file.
 */
export function generateTestStubs(
  findings: VerifyFinding[],
): TestStub[] {
  const stubs: TestStub[] = [];

  for (const finding of findings) {
    if (!TEST_RELEVANT_SOURCES.has(finding.source)) continue;
    if (!finding.file) continue;
    if (finding.severity === 'low') continue;

    const sourceFile = finding.file;
    const testFile = deriveTestPath(sourceFile);
    const testName = sanitizeTestName(finding.description);

    const code = `import { describe, it, expect } from 'vitest';
// TODO: import from '${toRelativeImport(sourceFile, testFile)}'

describe('${baseFileName(sourceFile)}', () => {
  it('${testName}', () => {
    // Finding: ${finding.description}
    // Severity: ${finding.severity}
    // Source: ${finding.source}
    ${finding.suggestion ? `// Suggestion: ${finding.suggestion}` : ''}

    // Arrange
    // TODO: Set up test conditions

    // Act
    // TODO: Call the function under test

    // Assert
    // TODO: Verify expected behavior
    expect(true).toBe(false); // Placeholder — implement this test
  });
});
`;

    stubs.push({
      testFile,
      description: finding.description,
      code,
      finding,
    });
  }

  return stubs;
}

/**
 * Format test stubs as a summary for display.
 */
export function formatTestStubSummary(stubs: TestStub[]): string {
  if (stubs.length === 0) return 'No test stubs generated.';

  const lines = [`${stubs.length} test stub(s) generated:`];
  for (const stub of stubs) {
    lines.push(`  - ${stub.testFile}: ${stub.description.slice(0, 80)}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveTestPath(sourceFile: string): string {
  const parts = sourceFile.split('/');
  const fileName = parts.pop()!;
  const dir = parts.join('/');
  const baseName = fileName.replace(/\.(ts|js|tsx|jsx)$/, '');
  return `${dir}/__tests__/${baseName}.test.ts`;
}

function sanitizeTestName(description: string): string {
  return description
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function baseFileName(filePath: string): string {
  const name = filePath.split('/').pop() ?? filePath;
  return name.replace(/\.(ts|js|tsx|jsx)$/, '');
}

function toRelativeImport(sourceFile: string, testFile: string): string {
  // Simple relative path: from __tests__/ back to parent
  const fileName = sourceFile.split('/').pop()!;
  return `../${fileName.replace(/\.ts$/, '.js')}`;
}
