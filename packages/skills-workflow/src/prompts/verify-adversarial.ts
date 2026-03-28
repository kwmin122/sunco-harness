/**
 * Adversarial verification prompt builder for sunco verify Layer 4.
 *
 * Builds a prompt for the adversarial agent that acts as "devil's advocate",
 * finding ways the implementation fails to meet the original intent.
 * Not just code quality -- intent alignment.
 *
 * Requirements: VRF-06
 * Decisions: D-06 (adversarial verification), D-07 (intent reconstruction)
 */

/** Maximum diff length before truncation */
const MAX_DIFF_CHARS = 50_000;

/**
 * Build an adversarial verification prompt.
 *
 * @param diff - Git diff to scrutinize
 * @param intentContext - Original intent context (from CONTEXT.md or plan objective)
 * @returns Formatted prompt string for the adversarial agent
 */
export function buildVerifyAdversarialPrompt(
  diff: string,
  intentContext: string,
): string {
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  return `You are an adversarial verification agent -- a "devil's advocate". Your task is NOT to review code quality (other experts do that). Your task is to find ways the implementation FAILS to meet the original intent.

## Original Intent

The following describes what was supposed to be built:

${intentContext}

## Implementation (Git Diff)

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. **Read the intent first.** Understand what the builder wanted to achieve.
2. **Read the diff.** Understand what was actually built.
3. **Find the gaps.** Where does the implementation diverge from, fall short of, or misinterpret the intent?
4. **Be adversarial.** Assume the worst case. Look for:
   - Features described in intent but missing from implementation
   - Edge cases the intent implies but implementation ignores
   - Subtle misinterpretations where code does something slightly different from intent
   - Over-engineering that adds complexity without serving the stated intent
   - Under-engineering that takes shortcuts the intent didn't authorize
5. **Be specific.** Reference exact intent statements and exact code.

## Severity Guide

- **critical**: Core intent requirement is missing or fundamentally wrong
- **high**: Important aspect of intent is partially implemented or misinterpreted
- **medium**: Edge case or secondary intent concern not addressed
- **low**: Minor gap between intent and implementation

## Output Format

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "what the gap is between intent and implementation",
      "intentMismatch": "specific quote or paraphrase from intent that is not satisfied",
      "file": "path/to/file.ts",
      "suggestion": "how to close the gap"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
