/**
 * Discuss analyze prompt builder.
 *
 * Instructs the planning agent to identify 5-10 gray areas
 * (implementation decisions not yet locked) from the phase goal
 * and requirements. Each gray area is formatted as structured JSON
 * with options for the user to choose from.
 */

/**
 * Build the gray-area identification prompt for the discuss skill.
 *
 * @param phaseGoal - The goal/description for the target phase
 * @param requirements - List of requirement IDs/descriptions for this phase
 * @param codebaseContext - Summary of current codebase state (from pre-scan or ROADMAP)
 * @returns Formatted prompt string for the planning agent
 */
export function buildDiscussAnalyzePrompt(
  phaseGoal: string,
  requirements: string[],
  codebaseContext: string,
): string {
  const reqList = requirements.length > 0
    ? requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : '(no specific requirements listed)';

  return `You are a senior architect analyzing a development phase to identify implementation decisions that need human input.

## Phase Goal
${phaseGoal}

## Requirements
${reqList}

## Current Codebase Context
${codebaseContext || '(no codebase context available)'}

## Your Task

Identify 5-10 **gray areas** -- implementation decisions that are not yet locked and require the developer's input. These are design choices where multiple valid approaches exist.

For each gray area, output a JSON block with the following structure:

\`\`\`json
{
  "id": "ga-01",
  "question": "How should X be implemented?",
  "options": [
    { "id": "opt-a", "label": "Option A", "description": "Description of approach A", "recommended": true },
    { "id": "opt-b", "label": "Option B", "description": "Description of approach B", "recommended": false }
  ],
  "defaultId": "opt-a"
}
\`\`\`

Separate each gray area with the exact delimiter: \`---GRAY_AREA---\`

## Rules
- Suggest 2-4 options per gray area, marking ONE as recommended
- Focus on decisions that affect architecture, API design, data flow, or developer experience
- Do NOT include questions about obvious choices (e.g., "should we use TypeScript?" when the stack is already TypeScript)
- Each question should be specific and actionable, not vague
- The recommended option should have a brief rationale in its description`;
}
