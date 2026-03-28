/**
 * Coordinator synthesis prompt builder for sunco verify Layer 5.
 *
 * Builds a prompt for the coordinator agent that receives all expert findings,
 * deduplicates them, and produces a final verdict (PASS/WARN/FAIL).
 *
 * Requirements: VRF-06
 * Decisions: D-11 (coordinator synthesis), D-12 (review dimensions)
 */

import type { VerifyFinding } from '../shared/verify-types.js';

/** Maximum diff length before truncation */
const MAX_DIFF_CHARS = 50_000;

/**
 * Build a coordinator synthesis prompt.
 *
 * The coordinator receives all expert findings plus the original diff,
 * deduplicates overlapping findings, and produces a final verdict.
 *
 * @param expertFindings - All findings from expert agents (Layer 3)
 * @param diff - Original git diff for context
 * @returns Formatted prompt string for the coordinator agent
 */
export function buildVerifyCoordinatorPrompt(
  expertFindings: VerifyFinding[],
  diff: string,
): string {
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  const findingsJson = JSON.stringify(expertFindings, null, 2);

  return `You are a verification coordinator agent. Your task is to synthesize findings from multiple expert agents into a final verification verdict.

## Expert Findings

The following findings were produced by independent expert agents (security, performance, architecture, correctness):

\`\`\`json
${findingsJson}
\`\`\`

## Original Diff (for context)

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. **Deduplicate**: Multiple experts may flag the same issue. Merge overlapping findings into one, keeping the highest severity and combining suggestions.
2. **Validate**: Cross-check findings against the actual diff. Remove false positives where the expert misread the code.
3. **Determine Verdict** using these rules:
   - **FAIL**: Any finding with severity "critical", OR 3+ findings with severity "high"
   - **WARN**: Any finding with severity "high" (but fewer than 3), OR 5+ findings with severity "medium"
   - **PASS**: No "critical" or "high" findings, and fewer than 5 "medium" findings
4. **Summarize**: Write a concise 1-3 sentence summary of the overall code quality.

## Output Format

\`\`\`json
{
  "verdict": "PASS|WARN|FAIL",
  "summary": "concise overall assessment",
  "deduplicatedFindings": [
    {
      "layer": 3,
      "source": "security|performance|architecture|correctness",
      "severity": "critical|high|medium|low",
      "description": "merged description",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "combined suggestion"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
