/**
 * Synthesis/planning agent prompt builder for sunco new.
 * Builds the prompt for a single planning agent that synthesizes
 * all research results into PROJECT.md, REQUIREMENTS.md, ROADMAP.md (D-05).
 */

/**
 * Build a synthesis prompt that combines research results into planning artifacts.
 *
 * @param idea - User's project idea description
 * @param context - Key-value pairs from user answers to clarifying questions
 * @param researchResults - Array of successful research outputs with their topics
 * @returns Formatted prompt string for the planning/synthesis agent
 */
export function buildSynthesisPrompt(
  idea: string,
  context: Record<string, string>,
  researchResults: Array<{ topic: string; content: string }>,
): string {
  const contextLines = Object.entries(context)
    .map(([key, value]) => `- **${key}**: ${value}`)
    .join('\n');

  const researchSection = researchResults
    .map((r) => `### ${r.topic}\n${r.content}`)
    .join('\n\n');

  return `You are a technical project planner. You have received research on a new project idea and must synthesize it into three planning documents.

## Project Idea
${idea}

## User Context
${contextLines || '(no additional context provided)'}

## Research Results
${researchSection || '(no research results available)'}

## Your Task

Produce THREE documents separated by \`---DOCUMENT_SEPARATOR---\`:

### Document 1: PROJECT.md
\`\`\`markdown
# {Project Name}

## What This Is
(1-3 paragraphs describing the project)

## Core Value
(The single most important value proposition)

## Requirements
### Active
(Bullet list of requirements, categorized)

## Constraints
(Technical and non-technical constraints)

## Key Decisions
| Decision | Rationale |
\`\`\`

### Document 2: REQUIREMENTS.md
\`\`\`markdown
# Requirements: {Project Name}

## v1 Requirements
(Categorized requirements with IDs like REQ-01, REQ-02)
(Each requirement: one line, testable, specific)
\`\`\`

### Document 3: ROADMAP.md
\`\`\`markdown
# Roadmap: {Project Name}

## Overview
(1-2 paragraphs)

## Phases
- [ ] Phase 1: {name} - {description}
...

## Phase Details
### Phase 1: {name}
**Goal**: {outcome-shaped goal}
**Depends on**: {dependencies}
**Requirements**: {REQ-IDs}
**Success Criteria**:
  1. {testable criterion}
\`\`\`

Use \`---DOCUMENT_SEPARATOR---\` between the three documents. Do not include any text outside the documents.`;
}
