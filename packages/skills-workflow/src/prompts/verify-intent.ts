/**
 * Intent reconstruction prompt builder for sunco verify Layer 4.
 *
 * Builds a prompt for the intent verification agent that checks whether
 * the implementation matches the original CONTEXT.md vision and must_haves.
 * "Did we build what we intended?"
 *
 * Requirements: VRF-06
 * Decisions: D-07 (intent reconstruction)
 */

/** Maximum diff length before truncation */
const MAX_DIFF_CHARS = 50_000;

/**
 * Build an intent verification prompt.
 *
 * @param diff - Git diff to verify against intent
 * @param contextMd - Full CONTEXT.md content describing the original vision
 * @param mustHaves - List of must_have items from the plan frontmatter
 * @returns Formatted prompt string for the intent verification agent
 */
export function buildVerifyIntentPrompt(
  diff: string,
  contextMd: string,
  mustHaves: string[],
): string {
  let effectiveDiff = diff;
  let truncationNotice = '';
  if (diff.length > MAX_DIFF_CHARS) {
    effectiveDiff = diff.slice(0, MAX_DIFF_CHARS);
    truncationNotice = '\n\n[... diff truncated at 50,000 chars ...]';
  }

  const mustHavesList = mustHaves
    .map((m, i) => `${i + 1}. ${m}`)
    .join('\n');

  return `You are an intent verification agent. Your task is to determine whether the implementation matches the original vision. You answer the question: "Did we build what we intended?"

## Original Vision (CONTEXT.md)

${contextMd}

## Must-Have Requirements

The following items were declared as must-haves for this plan:

${mustHavesList}

## Implementation (Git Diff)

\`\`\`diff
${effectiveDiff}${truncationNotice}
\`\`\`

## Instructions

1. **Read the vision** from CONTEXT.md. Understand the goals, design decisions, and constraints.
2. **Check each must-have** against the implementation. Is it satisfied? Partially? Not at all?
3. **Assess overall alignment**: Does the implementation reflect the spirit of the vision, not just the letter?
4. **Report findings** for any misalignment, missing features, or unexpected additions.

## Alignment Levels

- **aligned**: Implementation matches intent accurately. Must-haves satisfied.
- **partial**: Most intent is captured but notable gaps exist.
- **misaligned**: Implementation diverges significantly from stated intent.

## Output Format

\`\`\`json
{
  "intentAlignment": "aligned|partial|misaligned",
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "description of the misalignment",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "how to align with intent"
    }
  ],
  "mustHaveResults": [
    {
      "mustHave": "the must-have text",
      "satisfied": true,
      "evidence": "brief evidence from the diff supporting this assessment"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
