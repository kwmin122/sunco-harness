/**
 * Performance expert prompt builder for sunco verify Layer 3.
 *
 * Builds a prompt for the performance expert agent that analyzes diffs
 * for algorithmic complexity, memory leaks, N+1 queries, and blocking I/O.
 *
 * Requirements: VRF-06
 * Decisions: D-10 (expert agents), D-12 (review dimensions)
 */

/** Maximum diff length before truncation */
const MAX_DIFF_CHARS = 50_000;

/**
 * Build a performance expert review prompt.
 *
 * @param diff - Git diff to analyze for performance issues
 * @returns Formatted prompt string for the performance expert agent
 */
export function buildVerifyPerformancePrompt(diff: string): string {
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  return `You are a performance expert agent. Your task is to analyze the provided git diff for performance issues and produce structured findings.

## Focus Areas

Analyze the diff for the following performance concerns:

1. **Algorithmic Complexity** -- O(n^2) or worse nested loops, quadratic string concatenation, unnecessary sorting, brute-force searches where indexed lookups exist
2. **Memory Leaks** -- Unclosed file handles/streams/connections, growing caches without eviction, event listeners without cleanup, closures retaining large objects
3. **N+1 Query Patterns** -- Database queries inside loops, missing batch operations, sequential API calls that could be parallelized
4. **Unnecessary Allocations** -- Object creation in hot loops, repeated regex compilation, string building without buffer, redundant cloning
5. **Blocking I/O** -- Synchronous file operations in hot paths, missing async/await, blocking the event loop
6. **Missing Pagination** -- Unbounded result sets, loading entire collections into memory, missing LIMIT clauses

## Git Diff

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. Examine every changed line for performance implications.
2. For each issue found, provide severity, description, file, line (if identifiable), and a concrete suggestion.
3. Focus on ACTUAL performance issues, not premature optimization.
4. Consider the context -- a rare admin operation has different requirements than a hot request path.
5. If no performance issues are found, return an empty findings array.

## Severity Guide

- **critical**: Will cause outages or unacceptable latency in production (unbounded queries, memory leaks in long-running processes)
- **high**: Significant performance degradation under normal load
- **medium**: Performance concern that matters at scale
- **low**: Optimization opportunity with measurable but minor impact

## Output Format

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "clear description of the performance issue",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "concrete fix suggestion"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
