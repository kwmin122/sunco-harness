/**
 * Product spec prompt builder for sunco plan.
 *
 * Generates a PRODUCT-SPEC.md that sits between CONTEXT.md and PLAN.md.
 * The planner works at the PRODUCT level here — what the user gets,
 * how they experience it, what "done" looks like as a product.
 *
 * No file paths, no function signatures, no wave assignments.
 * Those belong to the execution layer (slice-contract).
 *
 * Reference: Anthropic "Harness design for long-running apps" (2026-03-24)
 * — planner should be ambitious about scope and focused on product context
 * and high-level technical design, not detailed implementation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductSpecParams {
  contextMd: string;
  researchMd: string;
  requirementsMd: string;
  roadmapMd: string;
  phaseGoal: string;
  requirements: string[];
  phaseSlug: string;
  paddedPhase: string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * Build the prompt that generates PRODUCT-SPEC.md.
 *
 * The agent produces a product-level specification — what the phase
 * delivers to the user, not how it's built. Implementation details
 * are deferred to the plan and slice-contract stages.
 */
export function buildProductSpecPrompt(params: ProductSpecParams): string {
  const {
    contextMd,
    researchMd,
    requirementsMd,
    roadmapMd,
    phaseGoal,
    requirements,
    paddedPhase,
  } = params;

  return `You are a product architect for the SUNCO workspace OS. Your job is to write a PRODUCT-SPEC that defines what this phase delivers to the user.

## Input Documents

### CONTEXT.md (Product decisions and domain knowledge)
${contextMd}

### RESEARCH.md (Technical landscape)
${researchMd || '(No research document available)'}

### REQUIREMENTS.md
${requirementsMd}

### ROADMAP.md
${roadmapMd}

## Phase Information

- **Phase goal:** ${phaseGoal}
- **Phase:** ${paddedPhase}
- **Requirements to satisfy:** ${requirements.join(', ')}

## Your Task

Write a PRODUCT-SPEC.md that answers these questions:

### 1. What does this phase deliver?
Describe the capabilities in USER language. Not "implement X module" but "the user can now do Y."
- What new commands, features, or behaviors does the user get?
- What existing behaviors change?
- What problems are solved?

### 2. User experience flows
For each capability, describe the user flow:
- What does the user type/do?
- What do they see?
- What happens on success?
- What happens on failure?
- What edge cases matter?

### 3. Product-level success criteria
How would a HUMAN verify this phase is done? Not grep-verifiable code conditions, but:
- "User can run \`sunco X\` and get Y"
- "Error message clearly tells the user what to do next"
- "Feature works without requiring manual configuration"

### 4. Quality bar
What level of polish is expected?
- Must-have: minimum viable delivery
- Should-have: expected quality level
- Delighters: what would make this surprisingly good

### 5. Scope boundaries
- What's IN this phase (explicit)
- What's OUT (explicit, with rationale)
- What's DEFERRED to later phases

### 6. High-level technical approach
A 2-3 paragraph summary of the technical direction. Think "architecture decision record" level — which patterns, which major components, what the data flow looks like at a high level.

DO NOT specify:
- File paths or module names
- Function signatures or type definitions
- Import patterns or dependency wiring
- Test file locations
- Wave assignments or parallelism strategy

Those are implementation details for the execution layer.

## Output Format

Write a complete markdown document. Use this structure:

\`\`\`markdown
# Phase ${paddedPhase}: Product Specification

**Generated:** {date}
**Status:** Ready for planning

## Capabilities

### Capability 1: {name}
{description in user language}

**User flow:**
1. {step}
2. {step}

**Success criteria:**
- {human-verifiable criterion}

### Capability 2: ...

## Quality Bar

### Must-have
- {minimum viable}

### Should-have
- {expected quality}

### Delighters
- {surprisingly good}

## Scope

### In scope
- {explicit}

### Out of scope
- {explicit, with rationale}

### Deferred
- {for later, with reason}

## Technical Approach

{2-3 paragraphs, architecture-level only}

## Requirements Coverage

| Requirement | Capability | Success Criterion |
|-------------|-----------|-------------------|
| {req-id}    | {which}   | {how verified}    |
\`\`\`

## Rules

1. Be AMBITIOUS about scope — describe the best version of this phase, not the minimal one
2. Stay in product language — if you catch yourself writing code patterns, step back
3. Every requirement must map to a capability and a success criterion
4. Success criteria must be verifiable by a human using the product, not by reading code
5. The technical approach section is a COMPASS, not a map — direction, not turn-by-turn`;
}
