/**
 * Test generation prompt builder for sunco test-gen.
 *
 * Builds a prompt that generates unit test code for specified source files.
 * Respects the project's test framework (default: Vitest).
 *
 * Requirements: VRF-10
 * Decisions: D-16 (test generation), D-17 (framework detection)
 */

/**
 * Build a test generation prompt.
 *
 * @param files - List of file paths to generate tests for
 * @param fileContents - Map of file path to source content
 * @param framework - Test framework to use (default: 'vitest')
 * @returns Formatted prompt string for the test generation agent
 */
export function buildTestGenPrompt(
  files: string[],
  fileContents: Record<string, string>,
  framework: string = 'vitest',
): string {
  const fileBlocks = files
    .filter((f) => fileContents[f] !== undefined)
    .map((f) => {
      return `### ${f}

\`\`\`typescript
${fileContents[f]}
\`\`\``;
    })
    .join('\n\n');

  return `You are a test generation agent. Your task is to generate comprehensive unit tests for the provided source files using ${framework}.

## Source Files

${fileBlocks}

## Instructions

1. **Analyze each file**: Identify all exported functions, classes, and their public methods.
2. **Generate tests** for each exported symbol:
   - Happy path with typical inputs
   - Edge cases (empty inputs, null/undefined, boundary values)
   - Error cases (invalid inputs, expected throws)
3. **Follow ${framework} conventions**:
   - Use \`describe\` blocks grouped by function/class
   - Use \`it\` or \`test\` with descriptive names
   - Import from the source file using relative paths with .js extension
4. **Be thorough but practical**: Test observable behavior, not implementation details.
5. **Handle async code**: Use async/await for promise-returning functions.
6. **Do NOT mock internal implementation**: Only mock external dependencies if necessary.

## Framework: ${framework}

${framework === 'vitest' ? `\`\`\`typescript
import { describe, it, expect, vi } from 'vitest';
\`\`\`` : `Use the standard import pattern for ${framework}.`}

## Output Format

For each source file, produce a complete test file. Output each test file as a separate typescript code block with the file path as a comment on the first line:

\`\`\`typescript
// __tests__/filename.test.ts
import { describe, it, expect } from '${framework}';
import { exportedFn } from '../filename.js';

describe('exportedFn', () => {
  it('should handle typical input', () => {
    expect(exportedFn('input')).toBe('expected');
  });
});
\`\`\`

Generate complete, runnable test files. Do not include placeholder tests or TODO comments.`;
}
