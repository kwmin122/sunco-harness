/**
 * Milestone new prompt builder for sunco milestone new.
 *
 * Instructs an agent to synthesize user answers and previous milestone
 * context into updated REQUIREMENTS.md and ROADMAP.md sections.
 * Uses the same DOCUMENT_SEPARATOR pattern as new.skill.ts synthesis.
 *
 * Requirements: SHP-02, WF-07
 * Decisions: D-08 (abbreviated new-milestone flow, no parallel research)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MilestoneNewParams {
  /** Name for the new milestone */
  milestoneName: string;
  /** High-level goal for the new milestone */
  goal: string;
  /** User answers to clarifying questions */
  answers: Record<string, string>;
  /** Previous milestone summary report (optional, for continuity) */
  previousMilestoneSummary?: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a new-milestone synthesis prompt for an agent.
 *
 * The agent takes the user's answers and optional previous milestone
 * context to produce updated REQUIREMENTS.md and ROADMAP.md documents,
 * separated by `---DOCUMENT_SEPARATOR---`.
 *
 * This is an abbreviated flow: no parallel research, just direct
 * synthesis from user answers.
 *
 * @param opts - New milestone parameters
 * @returns Formatted prompt string for the synthesis agent
 */
export function buildMilestoneNewPrompt(opts: MilestoneNewParams): string {
  const {
    milestoneName,
    goal,
    answers,
    previousMilestoneSummary,
  } = opts;

  const answerLines = Object.entries(answers)
    .map(([question, answer]) => `**Q: ${question}**\nA: ${answer}`)
    .join('\n\n');

  const previousSection = previousMilestoneSummary
    ? `## Previous Milestone Summary

${previousMilestoneSummary}

Use the previous milestone's outcomes, lessons learned, and recommendations to inform the new milestone's requirements and roadmap. Carry forward unfinished work and address identified technical debt.`
    : '(no previous milestone -- this is the first milestone)';

  return `You are a milestone planner. Your task is to create planning documents for a new milestone based on the user's goals and answers.

## New Milestone

**Name:** ${milestoneName}
**Goal:** ${goal}

## User Answers

${answerLines || '(no answers provided)'}

## Previous Context

${previousSection}

## Synthesis Instructions

Based on the goal, user answers, and previous milestone context (if any):

1. **REQUIREMENTS.md**: Define specific, testable requirements for this milestone.
   - Use a category prefix for requirement IDs (e.g., AUTH-01, UI-01, PERF-01)
   - Each requirement: one line, testable, specific
   - Group by category with checkboxes
   - Include a traceability table mapping requirements to implementation areas

2. **ROADMAP.md**: Define the execution phases for this milestone.
   - 3-10 phases ordered by dependency
   - Each phase has: name, goal, requirements it addresses, success criteria
   - Include a progress table
   - Phases should be outcome-shaped ("Auth system works end-to-end") not task-shaped ("Implement auth")

## Output Format

Produce TWO documents separated by \`---DOCUMENT_SEPARATOR---\`:

**Document 1: REQUIREMENTS.md**

\`\`\`markdown
# Requirements: ${milestoneName}

## ${milestoneName} Requirements

### [Category]
- [ ] **[PREFIX-NN]**: [requirement description]

## Traceability

| Req ID | Phase | Status |
|--------|-------|--------|
| PREFIX-01 | Phase N | Planned |
\`\`\`

---DOCUMENT_SEPARATOR---

**Document 2: ROADMAP.md**

\`\`\`markdown
# Roadmap: ${milestoneName}

## Overview
(1-2 paragraphs)

## Phases
- [ ] **Phase 1: [name]** - [description]

### Phase 1: [name]
**Goal**: [outcome]
**Requirements**: [REQ-IDs]
**Success Criteria**:
1. [criterion]

## Progress

| Phase | Plans | Status | Notes |
|-------|-------|--------|-------|
| 1. [name] | 0/? | Planned | - |
\`\`\`

Output the two documents separated by \`---DOCUMENT_SEPARATOR---\`. Do not include any text outside the documents.`;
}
