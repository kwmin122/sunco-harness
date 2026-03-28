/**
 * Domain research prompt builder for sunco research (Phase 5).
 *
 * Builds focused prompts for per-topic research agents.
 * Each agent investigates ONE topic in depth: standard stack,
 * architecture patterns, pitfalls, and codebase patterns.
 *
 * NOTE: This is separate from prompts/research.ts (Phase 4, sunco new).
 * Do NOT merge or modify that file.
 *
 * Requirements: WF-11
 * Decisions: D-08, D-09, D-11
 */

export interface ResearchDomainParams {
  /** Single research topic to investigate deeply */
  topic: string;
  /** Phase goal from ROADMAP.md */
  phaseGoal: string;
  /** Locked decisions from CONTEXT.md */
  contextDecisions: string;
  /** Requirement IDs relevant to this phase */
  requirements: string[];
  /** Existing codebase patterns and conventions (from scan or pre-scan) */
  codebaseContext: string;
}

/**
 * Build a research prompt for ONE specific topic.
 * The prompt instructs a research agent to investigate deeply, referencing
 * locked decisions from CONTEXT.md and existing codebase patterns.
 *
 * @param params - Research domain parameters
 * @returns Formatted prompt string for the research agent
 */
export function buildResearchDomainPrompt(params: ResearchDomainParams): string {
  const { topic, phaseGoal, contextDecisions, requirements, codebaseContext } = params;

  const requirementsList = requirements.length > 0
    ? requirements.map((r) => `- ${r}`).join('\n')
    : '(no specific requirements)';

  return `You are a technical domain researcher. Your task is to research ONE specific topic in depth for a software development phase.

## Research Topic
${topic}

## Phase Goal
${phaseGoal}

## Locked Decisions (from CONTEXT.md)
These decisions are already made. Your research must respect and build upon them.

${contextDecisions || '(no locked decisions)'}

## Requirements to Address
${requirementsList}

## Existing Codebase Context
${codebaseContext || '(no existing codebase context available)'}

## Research Instructions

Focus DEEPLY on "${topic}". Do NOT try to cover breadth across unrelated topics.

Investigate the following dimensions:
1. **Standard Stack**: What are the proven, battle-tested libraries for this domain? Include version numbers, weekly download counts if known, and why each is the best choice.
2. **Architecture Patterns**: How do established projects solve this? Describe 2-3 patterns with trade-offs (pros/cons) specific to this project's context.
3. **Don't Hand-Roll**: What should be reused from the existing codebase or standard libraries rather than built from scratch? Reference the locked decisions above.
4. **Common Pitfalls**: What goes wrong when implementing this? Be specific -- not generic advice but concrete failure modes observed in production.
5. **Code Examples**: Provide concrete examples. If the codebase already has relevant patterns, show how to extend them. Otherwise show standard patterns from the recommended libraries.

## Output Format

Produce a structured markdown document with these exact sections:

## Standard Stack
For each library/tool:
- **Name** vX.Y.Z - Purpose
- Why this one (not alternatives)
- Weekly downloads / ecosystem adoption

## Architecture Patterns
For each pattern:
- **Pattern Name**
- Description
- Pros (for this project)
- Cons (for this project)
- When to use

## Don't Hand-Roll
Things to reuse rather than build:
- What exists (from codebase or npm)
- Why reuse beats custom

## Common Pitfalls
Numbered list:
1. **Pitfall name**
   - What goes wrong: [specific failure mode]
   - How to avoid: [concrete mitigation]

## Code Examples
Concrete code snippets demonstrating the recommended approach.

## Confidence: {HIGH|MEDIUM|LOW}
State your confidence level and reasoning. HIGH = well-established domain with clear best practices. MEDIUM = some ambiguity in approach. LOW = emerging domain with limited established patterns.

Be specific and actionable. Reference the locked decisions. Avoid generic advice.`;
}
