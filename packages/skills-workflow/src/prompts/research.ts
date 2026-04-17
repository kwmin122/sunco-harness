/**
 * Research agent prompt builder for sunco new.
 * Builds focused prompts for parallel research agents (D-02, D-15).
 * Each topic gets a specialized instruction set to guide the research agent.
 */

const TOPIC_INSTRUCTIONS: Record<string, string> = {
  brainstorming:
    'Use the vendored Superpowers brainstorming skill as the behavioral source of truth when it is available in SUNCO references. Preserve its hard gate against implementation, one-question-at-a-time discovery, 2-3 approach exploration, explicit design approval, spec review, and handoff. For this research report, summarize the approved design direction, deferred options, risks, and the next /sunco:new --from-preflight handoff.',
  'tech-stack':
    'Identify languages, frameworks, databases, and infrastructure. Consider the project\'s scale, target platform, and team constraints from context.',
  competitors:
    'Find existing products, open-source projects, and approaches in this space. Note what they do well and what gaps exist.',
  architecture:
    'Propose architecture patterns (monolith, microservices, serverless, etc.) with trade-offs for this specific project.',
  challenges:
    'List technical and non-technical challenges. For each, suggest mitigation strategies.',
  ecosystem:
    'Map the relevant ecosystem: libraries, tools, hosting, CI/CD, monitoring. Recommend specific packages with version numbers.',
};

/**
 * Build a research prompt for one topic.
 *
 * @param topic - Research topic key (e.g., 'tech-stack', 'competitors')
 * @param idea - User's project idea description
 * @param context - Key-value pairs from user answers to clarifying questions
 * @returns Formatted prompt string for the research agent
 */
export function buildResearchPrompt(
  topic: string,
  idea: string,
  context: Record<string, string>,
): string {
  const contextLines = Object.entries(context)
    .map(([key, value]) => `- **${key}**: ${value}`)
    .join('\n');

  const topicInstructions =
    TOPIC_INSTRUCTIONS[topic] ??
    `Research "${topic}" thoroughly for this project. Provide specific, actionable findings.`;

  return `You are a technical researcher. Your task is to research ONE specific topic for a new project.

## Project Idea
${idea}

## Context (from user answers)
${contextLines || '(no additional context provided)'}

## Research Topic: ${topic}

${topicInstructions}

## Output Format
Produce a concise research report (500-1000 words) with:
- Key findings (bullet points)
- Recommendations with rationale
- Risks or concerns
- Sources or references where applicable

Be specific and actionable. Avoid generic advice.`;
}
