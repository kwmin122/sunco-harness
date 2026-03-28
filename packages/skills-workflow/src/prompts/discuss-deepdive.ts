/**
 * Discuss deep-dive prompt builder.
 *
 * Instructs the planning agent to take a user's gray-area answer,
 * generate a locked decision statement, check for conflicts with
 * prior decisions, and identify follow-up questions if needed.
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

  return `You are a senior architect locking an implementation decision.

## Phase Goal
${phaseGoal}

## Gray Area
**Question:** ${area.question}
**User's Answer:** ${area.userAnswer}

## Prior Decisions
${priorText}

## Your Task

Based on the user's answer, produce:

1. **DECISION**: A locked, implementation-specific, actionable decision statement. This should be concrete enough for a coding agent to implement without ambiguity. One sentence.

2. **FOLLOW_UP**: If the user's answer reveals a new sub-decision that needs clarification, state it as a question. If no follow-up is needed, write "none".

3. **CONFLICTS**: If this decision conflicts with any prior decisions listed above, list the conflicting decision IDs and explain the conflict. If no conflicts, write "none".

## Output Format (exact)

DECISION: {concrete decision text}
FOLLOW_UP: {follow-up question or "none"}
CONFLICTS: {conflicting IDs and explanation, or "none"}`;
}
