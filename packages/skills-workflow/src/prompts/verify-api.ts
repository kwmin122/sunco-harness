/**
 * API design specialist prompt for verify Layer 1 (Phase 23b — Review Army).
 *
 * Analyzes diffs for API contract issues, breaking changes, naming consistency,
 * versioning, and documentation gaps.
 */

const MAX_DIFF_CHARS = 50_000;

export function buildVerifyApiPrompt(diff: string): string {
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  return `You are an API design specialist agent. Analyze the provided git diff for API contract and interface design issues.

## Focus Areas

1. **Breaking changes** — Removed or renamed exports, changed function signatures, modified return types without migration
2. **Naming consistency** — Inconsistent naming conventions, unclear parameter names, misleading function names
3. **Contract stability** — Unstable interfaces exposed to consumers, missing deprecation notices, version bumps needed
4. **Error contracts** — Missing error types, inconsistent error formats, undocumented failure modes
5. **Type safety** — Loose types (any, unknown without narrowing), missing generics, inadequate overloads

## Git Diff

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. Check every exported symbol change for breaking contract impact.
2. Verify error handling contracts are complete and documented.
3. Flag any public API change without corresponding documentation.
4. If no API issues are found, return an empty findings array.

## Severity Guide

- **critical**: Breaking change to public API without migration path
- **high**: Missing error contract or undocumented failure mode in public API
- **medium**: Naming inconsistency or loose types in exported interfaces
- **low**: Documentation improvements or minor naming suggestions

## Output Format

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "clear description of the API issue",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "concrete API improvement suggestion"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
