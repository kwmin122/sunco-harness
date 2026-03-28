/**
 * Architecture expert prompt builder for sunco verify Layer 3.
 *
 * Builds a prompt for the architecture expert agent that analyzes diffs
 * for coupling violations, layer breaches, abstraction leaks, and naming issues.
 *
 * Requirements: VRF-06
 * Decisions: D-10 (expert agents), D-12 (review dimensions)
 */

/** Maximum diff length before truncation */
const MAX_DIFF_CHARS = 50_000;

/**
 * Build an architecture expert review prompt.
 *
 * @param diff - Git diff to analyze for architectural issues
 * @returns Formatted prompt string for the architecture expert agent
 */
export function buildVerifyArchitecturePrompt(diff: string): string {
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  return `You are an architecture expert agent. Your task is to analyze the provided git diff for architectural violations and produce structured findings.

## Focus Areas

Analyze the diff for the following architectural concerns:

1. **Coupling Violations** -- Circular dependencies between modules, God objects that know too much, tight coupling between unrelated subsystems, shared mutable state
2. **Layer Breaches** -- UI code importing database modules directly, business logic depending on framework internals, infrastructure leaking into domain layer, wrong-direction imports
3. **Abstraction Leaks** -- Implementation details exposed through public APIs, internal types in external interfaces, leaky abstractions that force callers to understand internals
4. **Naming Inconsistencies** -- Mixed conventions (camelCase vs snake_case in same layer), misleading names, inconsistent terminology for same concepts
5. **Missing Interfaces** -- Concrete types where interfaces should exist, missing abstractions that prevent testability, hard-coded implementations where strategy pattern applies

## Git Diff

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. Examine every changed line for architectural implications.
2. Consider the broader context -- a single import might indicate a systemic coupling problem.
3. For each issue found, provide severity, description, file, line (if identifiable), and a concrete suggestion.
4. Focus on STRUCTURAL issues, not code style or formatting.
5. If no architectural issues are found, return an empty findings array.

## Severity Guide

- **critical**: Fundamental architectural violation that will cause cascading problems (circular dependency, layer inversion at core boundary)
- **high**: Significant coupling or abstraction issue affecting maintainability
- **medium**: Architectural concern that should be addressed before it spreads
- **low**: Minor improvement to naming, organization, or interface design

## Output Format

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "clear description of the architectural issue",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "concrete fix suggestion"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
