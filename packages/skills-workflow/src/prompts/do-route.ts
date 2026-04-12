/**
 * @sunco/skills-workflow - Do Route Prompt Builder
 *
 * Builds the prompt for the `sunco do` skill's NL routing agent.
 * Given a user's natural language request, the agent identifies the
 * best skill(s) to invoke from the full skill catalog.
 *
 * Requirements: WF-15, WF-18
 * Decisions: D-12 (NL routing), D-13 (skill catalog), D-14 (quick fallback),
 *   D-15 (kind=prompt for agent dispatch)
 */

// ---------------------------------------------------------------------------
// Skill Catalog
// ---------------------------------------------------------------------------

/**
 * Full skill catalog as markdown table.
 * Used as context for the routing agent to identify matching skills.
 */
export const SKILL_CATALOG = `| ID | Command | Description | Kind |
|---|---|---|---|
| harness.init | init | Initialize workspace | deterministic |
| harness.lint | lint | Architecture linting | deterministic |
| harness.health | health | Codebase health check | deterministic |
| harness.agents | agents | Agent doc analysis | deterministic |
| harness.guard | guard | Watch mode lint | deterministic |
| workflow.status | status | Current project status | deterministic |
| workflow.next | next | Next recommended action | deterministic |
| workflow.note | note | Capture a note | deterministic |
| workflow.pause | pause | Pause session | deterministic |
| workflow.resume | resume | Resume session | deterministic |
| workflow.phase | phase | Phase management | deterministic |
| workflow.settings | settings | Configuration UI | deterministic |
| workflow.new | new | Bootstrap new project | prompt |
| workflow.scan | scan | Analyze existing codebase | prompt |
| workflow.discuss | discuss | Extract vision and decisions | prompt |
| workflow.research | research | Domain research | prompt |
| workflow.plan | plan | Create execution plan + approach preview (--assume) | prompt |
| workflow.execute | execute | Execute plans in worktrees | prompt |
| workflow.review | review | Cross-provider code review | prompt |
| workflow.verify | verify | 5-layer verification + test generation (--generate-tests) | prompt |
| workflow.ship | ship | Create PR with verification | prompt |
| workflow.release | release | Version + publish | deterministic |
| workflow.milestone | milestone | Milestone lifecycle | prompt |
| workflow.auto | auto | Full autonomous pipeline | prompt |
| workflow.quick | quick | Lightweight task execution | prompt |`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DoRoutePromptParams {
  /** The user's natural language request */
  userInput: string;
  /** Skill catalog markdown table */
  skillCatalog: string;
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build the prompt for the NL->skill routing agent.
 *
 * The prompt tells the agent to:
 * 1. Analyze the user's natural language request
 * 2. Match it against the skill catalog
 * 3. Return a JSON block with the best skill(s) and reasoning
 * 4. Return empty skills array if no match (triggers quick fallback)
 */
export function buildDoRoutePrompt(params: DoRoutePromptParams): string {
  const { userInput, skillCatalog } = params;

  return `You are a skill router for SUNCO, a workspace OS for agent-era builders.

Given the user's natural language request, identify the best skill(s) to invoke.

## Available Skills

${skillCatalog}

## User Request

"${userInput}"

## Instructions

1. Analyze the user's intent from their request.
2. Match it to the most appropriate skill from the catalog above.
3. If the request maps clearly to one skill, return that skill.
4. If the request involves multiple steps, return them in execution order.
5. If no skill matches well, return an empty skills array.

Return ONLY the JSON block wrapped in \`\`\`json...\`\`\`. No other text.

\`\`\`json
{
  "skills": ["skill.id"],
  "reasoning": "Brief explanation of why this skill matches"
}
\`\`\`

Examples:
- "run my tests" -> { "skills": ["workflow.verify"], "reasoning": "Verification pipeline matches test execution request" }
- "what should I do next" -> { "skills": ["workflow.next"], "reasoning": "Next recommended action matches the request" }
- "check the health of my project" -> { "skills": ["harness.health"], "reasoning": "Codebase health check directly matches" }
- "write me a haiku about TypeScript" -> { "skills": [], "reasoning": "No matching skill, will use quick execution" }`;
}
