/**
 * Maintainability specialist prompt for verify Layer 1 (Phase 23b — Review Army).
 *
 * Analyzes diffs for code complexity, duplication, readability,
 * dependency management, and long-term maintenance burden.
 */

const MAX_DIFF_CHARS = 50_000;

export function buildVerifyMaintainabilityPrompt(diff: string): string {
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  return `You are a maintainability specialist agent. Analyze the provided git diff for long-term maintenance risks.

## Focus Areas

1. **Complexity** — Functions too long (>50 lines), deep nesting (>3 levels), cyclomatic complexity
2. **Duplication** — Copy-paste code, similar patterns that should be abstracted, repeated error handling
3. **Dependency hygiene** — Unnecessary new dependencies, tight coupling to specific implementations, missing abstractions
4. **Naming clarity** — Ambiguous variable names, misleading function names, cryptic abbreviations
5. **Dead code** — Unused imports, unreachable branches, commented-out code, unused parameters

## Git Diff

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. Check added/modified functions for complexity and readability.
2. Look for patterns repeated across files that should be shared.
3. Flag any new dependency that could be avoided.
4. If no maintainability issues are found, return an empty findings array.
5. Be practical: don't flag single-use helpers or reasonable duplication of 2-3 lines.

## Severity Guide

- **critical**: Unmaintainable code that will cause bugs (>100 line function, 5+ nesting levels)
- **high**: Significant duplication or tight coupling that will slow future changes
- **medium**: Complexity or naming issues that reduce readability
- **low**: Minor cleanup opportunities

## Output Format

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "clear description of the maintainability issue",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "concrete improvement suggestion"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
