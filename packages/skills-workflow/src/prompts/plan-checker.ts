/**
 * Plan checker prompt builder for sunco plan.
 *
 * Verifies delivery-slice plans at the PRODUCT level:
 * requirement coverage, coherent slicing, verification intent quality,
 * dependency correctness, scope sanity, and product contract compliance.
 *
 * Does NOT check implementation details (file paths, grep criteria,
 * read_first lists) — those are in slice-contracts, not plans.
 *
 * Requirements: WF-12
 * Decisions: D-13 (validation loop), D-16 (separate verification agent)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanCheckerParams {
  plans: string[];
  contextMd: string;
  requirementsMd: string;
  productSpecMd: string;
  phaseRequirements: string[];
}

// ---------------------------------------------------------------------------
// Plan Checker Prompt
// ---------------------------------------------------------------------------

/**
 * Build the prompt for the verification agent that checks plan quality.
 *
 * The agent evaluates delivery-slice plans against product-level
 * dimensions and outputs structured issue blocks or NO_ISSUES_FOUND.
 */
export function buildPlanCheckerPrompt(params: PlanCheckerParams): string {
  const { plans, contextMd, requirementsMd, productSpecMd, phaseRequirements } = params;

  const plansText = plans
    .map((plan, i) => `### Plan ${i + 1}\n\n${plan}`)
    .join('\n\n---\n\n');

  return `You are a verification agent for the SUNCO workspace OS. Your task is to check the quality of delivery-slice plans before they are written to disk.

These are PRODUCT-LEVEL plans — they define what to deliver and how to verify it, NOT implementation details. Do not flag the absence of file paths, grep criteria, or read_first lists — those belong in slice-contracts generated at execution time.

## Plans to Check

${plansText}

## Reference Documents

### PRODUCT-SPEC.md (Primary source of truth for what this phase delivers)
${productSpecMd || '(No product spec available)'}

### CONTEXT.md (Product decisions)
${contextMd}

### REQUIREMENTS.md
${requirementsMd}

### Phase Requirements
These requirement IDs must ALL be covered: ${phaseRequirements.join(', ')}

## Verification Dimensions

Check each plan against ALL 6 dimensions:

### 1. requirement_coverage
Every phase requirement ID [${phaseRequirements.join(', ')}] MUST appear in at least one plan's \`requirements\` frontmatter field.
- Missing coverage is a **blocker**

### 2. capability_alignment
Each plan's capabilities must map to PRODUCT-SPEC capabilities.
- Plan claims a capability not in PRODUCT-SPEC: **warning**
- PRODUCT-SPEC capability not covered by any plan: **blocker**
- Capability description contradicts PRODUCT-SPEC: **blocker**

### 3. verification_intent_quality
Each plan must have a "Verification intent" section with:
- Human-testable success criteria (not grep conditions or code assertions)
- Example commands or user actions to verify
- Expected observable behaviors
- Missing verification intent: **blocker**
- Verification is code-level instead of product-level (e.g., "file contains export"): **warning**

### 4. dependency_correctness
- \`depends_on\` must reference valid plan numbers that exist
- Wave numbers must be consistent: wave 1 = no deps, wave 2 = depends on wave 1 only, etc.
- Circular dependencies are a **blocker**

### 5. scope_sanity
- Each plan should represent a coherent delivery slice (not too small, not too large)
- No single plan should deliver more than ~40% of the phase scope
- Plans should have clear boundaries — overlapping delivery scope is a **warning**
- A plan with no clear product value (purely internal/infra): **warning**

### 6. product_contract_compliance
If any plan touches user-facing commands, install/update paths, or release artifacts:
- Runtime impact must be mentioned
- How the user discovers/accesses the feature must be clear
- Missing any of the above is a **warning**

## What NOT to check (deferred to slice-contract)

- ❌ File paths or files_modified completeness
- ❌ Function signatures or type definitions
- ❌ Import/export patterns or key_links
- ❌ read_first lists
- ❌ Grep-verifiable acceptance_criteria
- ❌ Step-by-step action instructions

## Output Format

For each issue found, output:

\`\`\`
---ISSUE---
PLAN: {plan number}
DIMENSION: {dimension name}
SEVERITY: {blocker|warning}
DESCRIPTION: {what's wrong}
FIX_HINT: {how to fix}
\`\`\`

If NO issues are found across ALL dimensions, output exactly:

\`\`\`
NO_ISSUES_FOUND
\`\`\`

## Strictness Guidelines

- Be **strict** on blockers: uncovered requirements, missing capabilities, missing verification intent, circular deps
- Be **lenient** on warnings: minor wording issues, plans with infrastructure focus that still serve product goals
- Do NOT flag absence of implementation details — that's by design
- Focus on: Does this plan clearly deliver product value? Can a human verify it works?

Now check ALL plans against ALL 6 dimensions.`;
}
