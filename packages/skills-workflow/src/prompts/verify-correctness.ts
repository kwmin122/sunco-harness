/**
 * Correctness expert prompt builder for sunco verify Layer 3.
 *
 * Builds a prompt for the correctness expert agent that analyzes diffs
 * for logic errors, edge cases, data flow issues, and error handling gaps.
 *
 * Requirements: VRF-06
 * Decisions: D-10 (expert agents), D-12 (review dimensions)
 */

/** Maximum diff length before truncation */
const MAX_DIFF_CHARS = 50_000;

/**
 * Build a correctness expert review prompt.
 *
 * @param diff - Git diff to analyze for correctness issues
 * @returns Formatted prompt string for the correctness expert agent
 */
export function buildVerifyCorrectnessPrompt(diff: string): string {
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  return `You are a correctness expert agent. Your task is to analyze the provided git diff for logic errors, edge cases, and correctness issues, and produce structured findings.

## Focus Areas

Analyze the diff for the following correctness concerns:

1. **Logic Errors** -- Off-by-one errors, wrong comparators (< vs <=), inverted conditions, incorrect boolean logic, wrong variable in expression
2. **Edge Cases** -- Null/undefined handling, empty arrays/strings, boundary values (0, -1, MAX_INT), Unicode edge cases, concurrent access
3. **Data Flow Issues** -- Unhandled promise rejections, race conditions, stale closures, missing await, use-before-define, dead code paths
4. **Type Narrowing Gaps** -- Missing type guards, unsafe type assertions, unhandled union variants, implicit any from poor narrowing
5. **Incomplete Error Handling** -- Missing catch blocks, swallowed errors, generic catch-all without logging, missing finally cleanup, error recovery that loses context

## Git Diff

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. Examine every changed line for correctness implications.
2. Trace data flow through the changed code to find hidden issues.
3. For each issue found, provide severity, description, file, line (if identifiable), and a concrete suggestion.
4. Focus on ACTUAL bugs and correctness risks, not style.
5. If no correctness issues are found, return an empty findings array.

## Severity Guide

- **critical**: Definite bug that WILL cause wrong behavior or crash (null dereference, off-by-one causing data loss)
- **high**: Likely bug that will surface under common conditions (race condition, unhandled error path)
- **medium**: Potential bug that surfaces under edge conditions
- **low**: Code that could be more robust but works for typical inputs

## Output Format

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "clear description of the correctness issue",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "concrete fix suggestion"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
