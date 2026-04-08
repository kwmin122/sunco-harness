/**
 * Plan creation and revision prompt builders for sunco plan.
 *
 * buildPlanCreatePrompt: Instructs a planning agent to decompose a phase
 * into 2-5 DELIVERY SLICE plans. Each plan describes WHAT to deliver
 * and HOW to verify it — but NOT implementation details like file paths,
 * function signatures, or import patterns.
 *
 * Implementation details are generated just before execution by the
 * slice-contract prompt (see slice-contract.ts).
 *
 * buildPlanRevisePrompt: Instructs a planning agent to fix issues found
 * by the plan-checker while preserving working parts.
 *
 * Requirements: WF-12
 * Decisions: D-12, D-13, D-14
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanCreateParams {
  contextMd: string;
  researchMd: string;
  requirementsMd: string;
  roadmapMd: string;
  productSpecMd: string;
  phaseGoal: string;
  requirements: string[];
  phaseSlug: string;
  paddedPhase: string;
}

export interface PlanReviseParams {
  currentPlan: string;
  issues: string[];
  contextMd: string;
  requirementsMd: string;
  productSpecMd: string;
}

// ---------------------------------------------------------------------------
// Plan Creation Prompt
// ---------------------------------------------------------------------------

/**
 * Build the prompt for the planning agent that generates delivery-slice plans.
 *
 * The agent reads input documents including the PRODUCT-SPEC and produces
 * 2-5 plans. Each plan defines a coherent delivery slice with product-level
 * verification intent — not implementation-level task packets.
 */
export function buildPlanCreatePrompt(params: PlanCreateParams): string {
  const {
    contextMd,
    researchMd,
    requirementsMd,
    roadmapMd,
    productSpecMd,
    phaseGoal,
    requirements,
    phaseSlug,
    paddedPhase,
  } = params;

  return `You are a planning agent for the SUNCO workspace OS. Your task is to decompose a phase into delivery slices.

## Input Documents

### PRODUCT-SPEC.md (What this phase delivers — the primary source of truth)
${productSpecMd || '(No product spec available — derive capabilities from context and requirements)'}

### CONTEXT.md (Product decisions and domain knowledge)
${contextMd}

### RESEARCH.md (Technical landscape)
${researchMd || '(No research document available)'}

### REQUIREMENTS.md (Full requirements list)
${requirementsMd}

### ROADMAP.md (Phase structure and progress)
${roadmapMd}

## Phase Information

- **Phase goal:** ${phaseGoal}
- **Phase slug:** ${phaseSlug}
- **Padded phase:** ${paddedPhase}
- **Phase requirements to cover:** ${requirements.join(', ')}

## Instructions

Read ALL input documents thoroughly. Then decompose this phase into **2-5 delivery slice plans**.

Each plan represents a COHERENT SLICE of product functionality — something that delivers value on its own and can be verified by using the product.

### Plan Structure

Each plan MUST include:

1. **YAML frontmatter** with these fields:
   - \`phase\`: "${phaseSlug}" (the phase slug)
   - \`plan\`: number (sequential: 01, 02, 03...)
   - \`type\`: "execute" or "tdd"
   - \`wave\`: number (1 = no dependencies, 2 = depends on wave 1, etc.)
   - \`depends_on\`: array of plan numbers this plan depends on (empty for wave 1)
   - \`autonomous\`: boolean (true if no human checkpoints needed)
   - \`requirements\`: array of requirement IDs from this phase
   - \`capabilities\`: array of capability names from PRODUCT-SPEC.md

2. **Sections** after frontmatter:
   - \`## Objective\`: What this slice delivers and why, in product language
   - \`## Capabilities\`: Which PRODUCT-SPEC capabilities this plan implements
   - \`## Delivery scope\`: Specific features/behaviors included in this slice
   - \`## Verification intent\`: How a HUMAN would verify this slice works
     - User-level success criteria (not grep conditions)
     - Example commands the user would run
     - Expected observable behaviors
   - \`## Technical direction\`: High-level approach (2-3 paragraphs max)
     - Which major components are involved
     - What the data/control flow looks like
     - Key constraints or patterns to follow
   - \`## Dependencies\`: What this slice needs from other slices or existing code
   - \`## Out of scope\`: What this slice explicitly does NOT handle

### What NOT to include in plans

These are generated at execution time by the slice-contract:
- ❌ Exact file paths or \`files_modified\` lists
- ❌ Function signatures or type definitions
- ❌ Import/export patterns or \`key_links\`
- ❌ \`<read_first>\` file lists
- ❌ \`<acceptance_criteria>\` with grep conditions
- ❌ \`<action>\` with step-by-step code instructions

### Wave Assignment Rules

- No dependencies = wave 1
- Depends on wave 1 plans = wave 2
- Depends on wave 2 plans = wave 3
- Plans in the same wave can execute in parallel

### Critical Rules

1. Every requirement ID in [${requirements.join(', ')}] MUST appear in at least one plan's requirements field
2. Each plan must deliver a COHERENT SLICE — a user-facing capability or a meaningful chunk of one
3. Verification intent should be human-testable (not "run grep on file X")
4. 2-5 plans total, balanced in scope
5. No plan should exceed ~40% of the phase scope
6. Technical direction is a COMPASS, not a map — enough to guide, not prescribe

## Output Format

Output each complete PLAN.md content separated by \`---PLAN_SEPARATOR---\`.

Example structure:
\`\`\`
---
phase: ${phaseSlug}
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [REQ-01, REQ-02]
capabilities: ["Capability 1 from product spec"]
---

## Objective
{What this slice delivers, in product language}

## Capabilities
{Which PRODUCT-SPEC capabilities}

## Delivery scope
{Specific features/behaviors}

## Verification intent
{How a human verifies this works}

## Technical direction
{High-level approach, 2-3 paragraphs}

## Dependencies
{What this needs}

## Out of scope
{What this does NOT handle}

---PLAN_SEPARATOR---

---
phase: ${phaseSlug}
plan: 02
...
---

...
\`\`\`

Now decompose the phase into delivery slices. Think product-first.`;
}

// ---------------------------------------------------------------------------
// Plan Revision Prompt
// ---------------------------------------------------------------------------

/**
 * Build the prompt for revising plans based on checker feedback.
 *
 * The agent receives the current plan output and a list of issues,
 * then produces a corrected version preserving working parts.
 */
export function buildPlanRevisePrompt(params: PlanReviseParams): string {
  const { currentPlan, issues, contextMd, requirementsMd, productSpecMd } = params;

  const issueList = issues
    .map((issue, i) => `${i + 1}. ${issue}`)
    .join('\n');

  return `You are a planning agent for the SUNCO workspace OS. Your task is to revise delivery-slice plans based on quality checker feedback.

## Current Plans

${currentPlan}

## Issues Found by Checker

${issueList}

## Reference Documents

### PRODUCT-SPEC.md
${productSpecMd || '(No product spec available)'}

### CONTEXT.md
${contextMd}

### REQUIREMENTS.md
${requirementsMd}

## Instructions

1. Read the current plans and the issues list carefully
2. Fix EACH issue while preserving parts that are working correctly
3. Return the COMPLETE revised plans (not a diff)
4. Maintain the same output format: full PLAN.md content with ---PLAN_SEPARATOR--- between plans

### Rules

- Fix all listed issues
- Do NOT introduce new issues while fixing
- Preserve plan numbers and wave assignments unless an issue specifically requires changing them
- Verification intent should be human-testable, not grep-verifiable
- Every requirement ID must still be covered
- Stay at the product/delivery level — do NOT add implementation details

## Output

Return the complete revised plans in the same format as the original (with ---PLAN_SEPARATOR--- between plans).`;
}
