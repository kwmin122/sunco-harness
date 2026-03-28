/**
 * Review prompt builder for sunco review (Phase 6).
 *
 * Builds structured prompts for per-provider review agents.
 * Each agent independently reviews a diff against defined review dimensions,
 * producing structured findings with severity ratings.
 *
 * Requirements: WF-13
 * Decisions: D-08 (multi-provider review dispatch), D-10 (verification role),
 *   D-12 (review dimensions)
 */

// ---------------------------------------------------------------------------
// Review dimensions (D-12)
// ---------------------------------------------------------------------------

/**
 * Standard review dimensions applied to every code review.
 * Each dimension is investigated independently by the review agent.
 */
export const REVIEW_DIMENSIONS = [
  'SQL safety and injection risks',
  'Trust boundary violations',
  'Conditional side effects (hidden state mutations)',
  'Architectural pattern adherence',
  'Test coverage gaps',
  'Security vulnerabilities',
  'Performance concerns',
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single finding from a review agent */
export interface ReviewFinding {
  /** Which dimension this finding relates to */
  dimension: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Description of the issue */
  description: string;
  /** File path where the issue was found (if identifiable) */
  file?: string;
  /** Line number (if identifiable) */
  line?: number;
  /** Suggested fix or improvement */
  suggestion: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum diff length before truncation (per RESEARCH Pitfall 6) */
const MAX_DIFF_CHARS = 50_000;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export interface BuildReviewPromptParams {
  /** Git diff to review */
  diff: string;
  /** Review dimensions to evaluate */
  dimensions: readonly string[];
  /** Optional context (e.g., plan objective) for understanding intent */
  context?: string;
}

/**
 * Build a review prompt for ONE provider agent.
 * Instructs the agent to analyze the provided diff against each review dimension
 * and produce structured JSON findings.
 *
 * @param opts - Review prompt parameters
 * @returns Formatted prompt string for the review agent
 */
export function buildReviewPrompt(opts: BuildReviewPromptParams): string {
  const { diff, dimensions, context } = opts;

  // Truncate diff if it exceeds the limit (Pitfall 6)
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  const dimensionsList = dimensions
    .map((d, i) => `${i + 1}. ${d}`)
    .join('\n');

  const contextSection = context
    ? `\n## Context\n${context}\n`
    : '';

  return `You are a code review agent. Your task is to review the provided git diff against specific review dimensions and produce structured findings.

## Review Dimensions

Analyze the diff against each of the following dimensions:

${dimensionsList}

${contextSection}
## Git Diff

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. Examine the diff carefully against each review dimension.
2. For each issue found, create a finding with severity, description, and suggestion.
3. Be specific: reference file names and line numbers when possible.
4. Do NOT report issues for dimensions where the code is clean.
5. Focus on ACTUAL issues, not stylistic preferences.

## Severity Guide

- **critical**: Security vulnerability, data loss risk, or correctness bug that WILL cause failures
- **high**: Significant issue that likely causes problems in production
- **medium**: Code quality issue or potential future problem
- **low**: Minor improvement suggestion or best practice recommendation

## Output Format

Produce a JSON object with this exact structure:

\`\`\`json
{
  "findings": [
    {
      "dimension": "dimension name from the list above",
      "severity": "critical|high|medium|low",
      "description": "clear description of the issue",
      "file": "path/to/file.ts (if identifiable from diff)",
      "line": 42,
      "suggestion": "concrete suggestion to fix this"
    }
  ]
}
\`\`\`

If no issues are found, return: \`{ "findings": [] }\`

Important: Output ONLY the JSON object. No markdown fences around it, no explanation before or after.`;
}
