/**
 * @sunco/skills-workflow - Assume Prompt Builder
 *
 * Builds the prompt for the assume skill's planning agent.
 * The agent reads CONTEXT.md + ROADMAP.md + codebase context,
 * then produces structured assumptions about its implementation approach.
 *
 * Each assumption is delimited by ---ASSUMPTION--- and includes
 * ID, AREA, ASSUMPTION, CONFIDENCE, RATIONALE, and ALTERNATIVE fields.
 *
 * Requirements: WF-10
 * Decisions: D-05 (approach preview), D-06 (corrections to CONTEXT.md), D-07 (single agent)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssumePromptParams {
  /** Full content of CONTEXT.md */
  contextMd: string;
  /** Full content of ROADMAP.md */
  roadmapMd: string;
  /** The current phase goal/description */
  phaseGoal: string;
  /** Requirement IDs relevant to this phase */
  requirements: string[];
  /** Pre-scanned codebase context (file tree, key files) */
  codebaseContext: string;
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build the prompt for the assume agent.
 *
 * The prompt instructs the agent to:
 * 1. Read CONTEXT.md locked decisions and the phase goal
 * 2. Analyze codebase context (file structure, existing patterns)
 * 3. Produce a structured list of assumptions about its implementation approach
 * 4. Be honest about LOW confidence areas (most valuable for user correction)
 *
 * Corrections become locked decisions, so the agent focuses on areas where
 * a wrong assumption would cause significant rework.
 */
export function buildAssumePrompt(params: AssumePromptParams): string {
  const { contextMd, roadmapMd, phaseGoal, requirements, codebaseContext } = params;

  return `You are a planning agent for SUNCO, a workspace OS for agent-era builders.

Your task: Preview what you would do to implement the current phase, and present your assumptions so the user can correct any wrong ones before execution begins.

## Current Phase Goal

${phaseGoal}

## Requirements

${requirements.length > 0 ? requirements.map((r) => `- ${r}`).join('\n') : 'No specific requirements listed.'}

## CONTEXT.md (Locked Decisions)

${contextMd}

## ROADMAP.md (Project Plan)

${roadmapMd}

## Codebase Context

${codebaseContext}

---

## Instructions

Analyze the above context carefully. Then produce a list of assumptions about how you would implement the work for this phase. Focus on decisions that, if wrong, would cause significant rework.

For each assumption, use this exact format:

---ASSUMPTION---
ID: A-{N}
AREA: {category - e.g., "File Structure", "API Design", "Dependencies", "Naming Conventions"}
ASSUMPTION: {what you would do and why}
CONFIDENCE: {HIGH|MEDIUM|LOW}
RATIONALE: {evidence from context/codebase that supports this assumption}
ALTERNATIVE: {what you would do differently if this assumption is wrong}

Cover these areas (at minimum):

1. **File Organization** - Where new files go, directory structure decisions
2. **Naming Conventions** - Function names, file names, variable patterns based on existing code
3. **Dependency Choices** - Which libraries/utilities to use (existing vs new)
4. **API Patterns** - Function signatures, return types, error handling conventions
5. **Error Handling** - How errors are surfaced, fallback behavior
6. **Test Strategy** - What to test, test structure, mocking patterns

Important guidelines:
- Be HONEST about LOW confidence areas. These are the most valuable for the user to correct.
- Reference specific files and patterns from the codebase context as evidence.
- If CONTEXT.md has locked decisions that constrain your approach, mark those assumptions as HIGH confidence (they are decided).
- Focus on areas where ambiguity exists -- where the context does NOT give a clear answer.
- Corrections from the user will become locked decisions appended to CONTEXT.md, so prioritize assumptions where getting it wrong would mean throwing away work.
- Aim for 5-10 assumptions. Quality over quantity.
- Do NOT include assumptions about things that are already explicitly decided in CONTEXT.md -- those are settled.

Start your response with the first ---ASSUMPTION--- block. Do not include any preamble.`;
}
