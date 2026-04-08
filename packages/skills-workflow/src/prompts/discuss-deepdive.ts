/**
 * Discuss deep-dive prompt builder.
 *
 * Takes a user's gray-area answer and generates a locked PRODUCT
 * decision statement. Decisions describe what the product does,
 * not how it's built.
 *
 * Implementation details are deferred to the plan/slice-contract stages.
 */

/**
 * Build the deep-dive follow-up prompt for the discuss skill.
 *
 * @param area - The gray area being discussed, with the user's answer
 * @param priorDecisions - Map of already-locked decision IDs to their text
 * @param phaseGoal - The goal/description for the target phase
 * @returns Formatted prompt string for the planning agent
 */
export function buildDiscussDeepDivePrompt(
  area: { id: string; question: string; userAnswer: string },
  priorDecisions: Record<string, string>,
  phaseGoal: string,
): string {
  const priorLines = Object.entries(priorDecisions);
  const priorText = priorLines.length > 0
    ? priorLines.map(([id, text]) => `- ${id}: ${text}`).join('\n')
    : '(no prior decisions)';

  return `You are a product architect locking a product decision.

## Phase Goal
${phaseGoal}

## Gray Area
**Question:** ${area.question}
**User's Answer:** ${area.userAnswer}

## Prior Decisions
${priorText}

## Your Task

Based on the user's answer, produce:

1. **DECISION**: A locked product decision that describes WHAT the product does, from the user's perspective. This should be concrete enough to verify by using the product, not by reading code. One sentence.

   Good: "When no AI provider is configured, the user sees a clear error with setup instructions."
   Bad: "skill returns { success: false } when no provider available."

   Good: "The compound skill writes a COMPOUND.md report and optionally promotes rules to .claude/rules/."
   Bad: "compound.skill.ts exports a defineSkill with --promote flag that calls writeFile to .claude/rules/."

2. **FOLLOW_UP**: If the user's answer reveals a new product question that needs clarification, state it. If no follow-up is needed, write "none".

3. **CONFLICTS**: If this decision conflicts with any prior decisions listed above, list the conflicting decision IDs and explain the conflict. If no conflicts, write "none".

## Output Format (exact)

DECISION: {product-level decision text}
FOLLOW_UP: {follow-up question or "none"}
CONFLICTS: {conflicting IDs and explanation, or "none"}`;
}
