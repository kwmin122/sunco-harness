/**
 * Research synthesis prompt builder for sunco research (Phase 5).
 *
 * Combines per-topic research results into a single RESEARCH.md document.
 * The synthesis agent consolidates findings, resolves conflicts between
 * topic results, and adds a validation architecture section.
 *
 * NOTE: This is separate from prompts/synthesis.ts (Phase 4, sunco new).
 * Do NOT merge or modify that file.
 *
 * Requirements: WF-11
 * Decisions: D-10 (synthesis into RESEARCH.md with validation architecture)
 */

export interface TopicResult {
  /** Research topic name */
  topic: string;
  /** Raw research content from the domain agent */
  content: string;
}

export interface ResearchSynthesizeParams {
  /** Per-topic research results from successful agents */
  topicResults: TopicResult[];
  /** Phase goal from ROADMAP.md */
  phaseGoal: string;
  /** Requirement IDs relevant to this phase */
  requirements: string[];
}

/**
 * Build a synthesis prompt that combines per-topic research into RESEARCH.md.
 * The output follows the project's established RESEARCH.md structure:
 * header, summary, constraints, requirements table, stack, patterns,
 * don't-hand-roll, pitfalls, validation architecture, open questions, sources.
 *
 * @param params - Synthesis parameters including topic results
 * @returns Formatted prompt string for the synthesis agent
 */
export function buildResearchSynthesizePrompt(params: ResearchSynthesizeParams): string {
  const { topicResults, phaseGoal, requirements } = params;

  const topicSections = topicResults
    .map(
      (tr, i) => `### Topic ${i + 1}: ${tr.topic}

${tr.content}

---`,
    )
    .join('\n\n');

  const requirementsList = requirements.length > 0
    ? requirements.map((r) => `- ${r}`).join('\n')
    : '(no specific requirements)';

  return `You are a technical research synthesizer. Your task is to combine multiple per-topic research results into a single, cohesive RESEARCH.md document.

## Phase Goal
${phaseGoal}

## Requirements
${requirementsList}

## Per-Topic Research Results

${topicSections}

## Synthesis Instructions

Read ALL per-topic research results above carefully. Then produce a single RESEARCH.md that:

1. **Consolidates** findings across topics -- do not just concatenate. Merge overlapping library recommendations, resolve conflicts between topic suggestions, and identify cross-cutting patterns.
2. **Preserves specifics** -- version numbers, download counts, concrete code examples. Do not lose detail during synthesis.
3. **Adds a Validation Architecture section** -- map each requirement to a test behavior (Nyquist compliance per D-10). Identify Wave 0 test gaps.
4. **Flags open questions** -- where topics disagree or where information is insufficient.

## Output Format

Produce a RESEARCH.md with this EXACT structure:

---
phase: [phase number from context]
domain: [domain description]
confidence: [HIGH|MEDIUM|LOW]
---

# Phase [N]: [Name] Research

## Summary
1-3 paragraph overall assessment of the research findings. What is the recommended approach and why?

<user_constraints>
## User Constraints
Reference locked decisions from CONTEXT.md that constrain implementation choices.
</user_constraints>

<phase_requirements>
## Phase Requirements

| Req ID | Description | Research Support |
|--------|-------------|------------------|
| REQ-XX | [description] | [how research supports this] |
</phase_requirements>

## Standard Stack

Consolidated library/tool recommendations from all topics. For each:
| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| name | vX.Y | purpose | rationale | HIGH/MEDIUM/LOW |

## Architecture Patterns

Consolidated patterns with code examples. For each pattern:
- Name and description
- When to use (specific to this phase)
- Pros/Cons
- Code example (if available)

## Don't Hand-Roll

| What | Use Instead | Why |
|------|-------------|-----|
| [thing to avoid building] | [existing solution] | [rationale] |

## Common Pitfalls

Consolidated, numbered pitfalls from all topics:
1. **[Pitfall name]**
   - What goes wrong: [failure mode]
   - How to avoid: [mitigation]
   - Source topic: [which research topic identified this]

## Validation Architecture

Per D-10 (Nyquist compliance):

| Requirement | Test Behavior | Test Type | Wave 0 Gap? |
|-------------|---------------|-----------|-------------|
| REQ-XX | [observable behavior to test] | unit/integration/e2e | yes/no |

### Test Framework
- Recommended test approach for this phase
- Key testing patterns

### Sampling Rate
- Critical paths needing 100% coverage
- Areas where sampling is acceptable

### Wave 0 Gaps
- Requirements that cannot be tested in Wave 0
- Mitigation strategy for each gap

## Open Questions

Numbered list of unresolved questions:
1. [Question] -- [why it matters] -- [suggested resolution path]

## Sources

- [Source 1](url) -- [what it covers]
- [Source 2](url) -- [what it covers]

---

IMPORTANT: The output must be valid markdown. Do not include any text outside the RESEARCH.md format above. Start directly with the YAML frontmatter (---).`;
}
