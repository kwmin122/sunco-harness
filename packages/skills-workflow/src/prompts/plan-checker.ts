/**
 * Plan checker prompt builder for sunco plan.
 *
 * Instructs a verification agent to check generated plans against
 * 6 quality dimensions: requirement_coverage, task_completeness,
 * dependency_correctness, key_links_planned, scope_sanity, must_haves_derivation.
 *
 * Outputs structured ---ISSUE--- blocks or NO_ISSUES_FOUND.
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
  phaseRequirements: string[];
}

// ---------------------------------------------------------------------------
// Plan Checker Prompt
// ---------------------------------------------------------------------------

/**
 * Build the prompt for the verification agent that checks plan quality.
 *
 * The agent evaluates plans against 6 dimensions and outputs structured
 * issue blocks. If no issues are found, outputs NO_ISSUES_FOUND.
 */
export function buildPlanCheckerPrompt(params: PlanCheckerParams): string {
  const { plans, contextMd, requirementsMd, phaseRequirements } = params;

  const plansText = plans
    .map((plan, i) => `### Plan ${i + 1}\n\n${plan}`)
    .join('\n\n---\n\n');

  return `You are a verification agent for the SUNCO workspace OS. Your task is to check the quality of execution plans before they are written to disk.

## Plans to Check

${plansText}

## Reference Documents

### CONTEXT.md (Phase decisions)
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

### 2. task_completeness
Every \`<task>\` element must have: \`<name>\`, \`<files>\`, \`<action>\`, \`<verify>\`, \`<done>\`.
- Missing verify or done is a **blocker**
- Missing files is a **warning** (might be intentional for pure config tasks)

### 3. dependency_correctness
- \`depends_on\` must reference valid plan numbers that exist
- Wave numbers must be consistent: wave 1 = no deps, wave 2 = depends on wave 1 only, etc.
- Circular dependencies are a **blocker**

### 4. key_links_planned
- Critical import/dependency connections in \`must_haves.key_links\` should correspond to actual tasks
- A key_link referencing a file not in any task's files is a **warning**

### 5. scope_sanity
- Each plan should have 2-3 tasks (1 task is a **warning**, 4+ tasks is a **warning**)
- No single plan should try to do more than ~50% of the phase work
- Plans should be focused on a coherent subset of functionality

### 6. must_haves_derivation
- \`must_haves.truths\` should be BDD-style testable behaviors (not vague statements)
- \`must_haves.artifacts\` should list concrete file paths with exports/contains
- \`must_haves.key_links\` should cover critical connections between files
- Missing truths or artifacts is a **blocker**

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

- Be **strict** on blockers: missing verify/done, uncovered requirements, circular deps, missing truths/artifacts
- Be **lenient** on warnings: minor formatting, 1-task plans that make logical sense, stylistic choices
- Do NOT flag issues that are clearly intentional design choices documented in CONTEXT.md
- Focus on correctness and completeness, not style

Now check ALL plans against ALL 6 dimensions.`;
}
