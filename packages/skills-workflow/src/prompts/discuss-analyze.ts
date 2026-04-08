/**
 * Discuss analyze prompt builder.
 *
 * Instructs the planning agent to identify 5-7 gray areas
 * — PRODUCT decisions that need human input. These are about
 * what the product delivers and how users experience it,
 * NOT about implementation details like file structure or API design.
 *
 * Implementation decisions (architecture, data flow, code patterns)
 * are deferred to the plan and slice-contract stages where the
 * executor can read the actual codebase.
 *
 * Reference: Anthropic "Harness design for long-running apps" (2026-03-24)
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

  return `You are a product architect analyzing a development phase to identify PRODUCT decisions that need human input.

## Phase Goal
${phaseGoal}

## Requirements
${reqList}

## Current Codebase Context
${codebaseContext || '(no codebase context available)'}

## Your Task

Identify 5-7 **gray areas** — product decisions that are not yet locked and require the developer's input. These are decisions about WHAT the product delivers and HOW users experience it.

For each gray area, output a JSON block with the following structure:

\`\`\`json
{
  "id": "ga-01",
  "question": "What should the user see when X happens?",
  "options": [
    { "id": "opt-a", "label": "Option A", "description": "Description of approach A", "recommended": true },
    { "id": "opt-b", "label": "Option B", "description": "Description of approach B", "recommended": false }
  ],
  "defaultId": "opt-a"
}
\`\`\`

Separate each gray area with the exact delimiter: \`---GRAY_AREA---\`

## What to ask about (PRODUCT level)
- User-facing behavior: What does the user see, type, or experience?
- Feature scope: What's included vs deferred?
- Quality bar: What level of polish is expected?
- User flows: How does the user get from A to B?
- Error experience: What happens when things go wrong, from the user's perspective?
- Non-goals: What are we explicitly NOT doing?
- Success criteria: How will a human verify this works?

## What NOT to ask about (IMPLEMENTATION level — defer these)
- File paths, module structure, or directory layout
- API design, function signatures, or type definitions
- Architecture patterns or data flow internals
- Database schema or state management approach
- Test strategy or coverage targets
- Import patterns or dependency wiring

Implementation decisions are made later when the executor reads the actual codebase.

## Rules
- Suggest 2-4 options per gray area, marking ONE as recommended
- Every question must be answerable by a product owner who doesn't read code
- Do NOT include questions about obvious choices already determined by the tech stack
- Each question should be specific and actionable, not vague
- The recommended option should have a brief rationale in its description`;
}
