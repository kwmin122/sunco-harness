/**
 * Discuss scenario prompt builder.
 *
 * Instructs the planning agent to generate BDD holdout scenarios
 * in Given/When/Then format based on locked decisions. These scenarios
 * are invisible to coding agents and used by verification agents only.
 */

/**
 * Build the BDD holdout scenario generation prompt.
 *
 * @param decisions - Map of locked decision IDs to their text
 * @param phaseGoal - The goal/description for the target phase
 * @param requirements - List of requirement IDs/descriptions for this phase
 * @returns Formatted prompt string for the planning agent
 */
export function buildDiscussScenarioPrompt(
  decisions: Record<string, string>,
  phaseGoal: string,
  requirements: string[],
): string {
  const decisionLines = Object.entries(decisions)
    .map(([id, text]) => `- ${id}: ${text}`)
    .join('\n');

  const reqList = requirements.length > 0
    ? requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : '(no specific requirements listed)';

  return `You are a QA architect generating holdout acceptance scenarios.

## Phase Goal
${phaseGoal}

## Locked Decisions
${decisionLines || '(no decisions locked yet)'}

## Requirements
${reqList}

## Your Task

Generate BDD (Behavior-Driven Development) holdout scenarios that verify the implementation matches the locked decisions and requirements. These scenarios will be used by a **verification agent** (not the coding agent) to validate correctness after implementation.

For each scenario, use this format:

# Scenario: {descriptive title}

## Given
{preconditions -- what state the system is in}

## When
{actions -- what the user or agent does}

## Then
{expected outcomes -- what should happen}

---

Separate each scenario with the exact delimiter: \`---SCENARIO---\`

## Rules
- Generate 3-8 scenarios covering the most critical decisions
- Each scenario should test ONE specific decision or requirement
- Include both happy-path and edge-case scenarios
- Be specific about expected behavior -- no vague assertions
- These are acceptance criteria, not unit tests -- focus on observable behavior
- Each scenario title should clearly indicate which decision/requirement it validates`;
}
