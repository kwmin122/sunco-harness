/**
 * Security expert prompt builder for sunco verify Layer 3.
 *
 * Builds a prompt for the security expert agent that analyzes diffs
 * for injection, auth, data exposure, input validation, and dependency risks.
 *
 * Requirements: VRF-06
 * Decisions: D-10 (expert agents), D-12 (review dimensions)
 */

/** Maximum diff length before truncation */
const MAX_DIFF_CHARS = 50_000;

/**
 * Build a security expert review prompt.
 *
 * @param diff - Git diff to analyze for security issues
 * @returns Formatted prompt string for the security expert agent
 */
export function buildVerifySecurityPrompt(diff: string): string {
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  return `You are a security expert agent. Your task is to analyze the provided git diff for security vulnerabilities and produce structured findings.

## Focus Areas

Analyze the diff for the following security concerns:

1. **Injection** -- SQL injection, command injection, XSS, template injection, path traversal
2. **Authentication/Authorization** -- Missing auth checks, privilege escalation, insecure token handling, session fixation
3. **Data Exposure** -- Secrets in code, PII logging, error message leaks, sensitive data in URLs
4. **Input Validation** -- Missing or insufficient validation, type coercion issues, boundary violations
5. **Dependency Risks** -- Known vulnerable patterns, unsafe deserialization, prototype pollution vectors

## Git Diff

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. Examine every changed line for security implications.
2. For each issue found, provide severity, description, file, line (if identifiable), and a concrete suggestion.
3. Be specific and actionable -- reference exact code patterns.
4. Do NOT report stylistic issues or non-security concerns.
5. If no security issues are found, return an empty findings array.

## Severity Guide

- **critical**: Exploitable vulnerability (injection, auth bypass, secret exposure)
- **high**: Security weakness likely exploitable with additional context
- **medium**: Defense-in-depth gap or hardening opportunity
- **low**: Minor security improvement suggestion

## Output Format

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "clear description of the security issue",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "concrete fix suggestion"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
