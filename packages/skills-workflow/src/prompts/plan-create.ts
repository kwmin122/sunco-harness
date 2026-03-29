/**
 * Plan creation and revision prompt builders for sunco plan.
 *
 * buildPlanCreatePrompt: Instructs a planning agent to decompose a phase
 * into 2-5 execution plans with frontmatter, XML tasks, and BDD must_haves.
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
}

// ---------------------------------------------------------------------------
// Plan Creation Prompt
// ---------------------------------------------------------------------------

/**
 * Build the prompt for the planning agent that generates PLAN.md files.
 *
 * The agent reads 4 input documents and produces 2-5 plans separated
 * by ---PLAN_SEPARATOR--- markers. Each plan includes YAML frontmatter
 * with BDD-style must_haves and XML task sections.
 */
export function buildPlanCreatePrompt(params: PlanCreateParams): string {
  const {
    contextMd,
    researchMd,
    requirementsMd,
    roadmapMd,
    phaseGoal,
    requirements,
    phaseSlug,
    paddedPhase,
  } = params;

  return `You are a planning agent for the SUNCO workspace OS. Your task is to decompose a phase into detailed execution plans.

## Input Documents

### CONTEXT.md (Phase decisions and domain knowledge)
${contextMd}

### RESEARCH.md (Technical research and patterns)
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

Read ALL 4 input documents thoroughly. Then decompose this phase into **2-5 plans**, each with **2-3 tasks**.

### Plan Structure

Each plan MUST include:

1. **YAML frontmatter** with these fields:
   - \`phase\`: "${phaseSlug}" (the phase slug)
   - \`plan\`: number (sequential: 01, 02, 03...)
   - \`type\`: "execute" or "tdd"
   - \`wave\`: number (1 = no dependencies, 2 = depends on wave 1, etc.)
   - \`depends_on\`: array of plan numbers this plan depends on (empty for wave 1)
   - \`files_modified\`: array of file paths this plan will create/modify
   - \`autonomous\`: boolean (true if no human checkpoints needed)
   - \`requirements\`: array of requirement IDs from this phase
   - \`must_haves\`: object with truths, artifacts, key_links

2. **must_haves** structure:
   - \`truths\`: array of BDD-style observable behaviors (user perspective, testable)
   - \`artifacts\`: array of { path, provides, exports/contains }
   - \`key_links\`: array of { from, to, via, pattern } describing critical connections

3. **XML sections** after frontmatter:
   - \`<objective>\`: What this plan accomplishes and why
   - \`<context>\`: @-references to files the executor should read
   - \`<tasks>\`: Contains \`<task type="auto">\` elements, each with:
     - \`<name>\`: Task name
     - \`<read_first>\`: Files the executor MUST read before modifying anything (MANDATORY -- at least the file being modified + any source of truth)
     - \`<files>\`: Files created/modified
     - \`<action>\`: Detailed step-by-step instructions with CONCRETE values (NOT "align X with Y" -- specify exact values, signatures, config keys)
     - \`<acceptance_criteria>\`: Grep-verifiable completion conditions (e.g., "file.ts contains export function foo")
     - \`<verify>\`: \`<automated>\` commands to verify completion
     - \`<done>\`: Bullet list of completion criteria
   - \`<verification>\`: Overall plan verification commands
   - \`<success_criteria>\`: High-level success criteria

### Wave Assignment Rules

- No dependencies = wave 1
- Depends on wave 1 plans = wave 2
- Depends on wave 2 plans = wave 3
- Plans in the same wave can execute in parallel

### Critical Rules

1. Every requirement ID in [${requirements.join(', ')}] MUST appear in at least one plan's requirements field
2. Each task action must be specific enough that a different Claude instance can execute without asking questions
3. Must_haves truths should be BDD-style testable behaviors (e.g., "skill returns { success: false } when no provider available")
4. 2-3 tasks per plan (not more)
5. No plan should exceed ~50% of context budget
6. Key links must cover critical import/dependency connections that could break
7. Every task MUST have <read_first> listing at minimum the file being modified
8. Every <action> must contain concrete values -- never say "align with" or "match to" without specifying the exact target
9. Every task MUST have <acceptance_criteria> with grep-verifiable conditions

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
...
---

<objective>...</objective>
<context>...</context>
<tasks>
<task type="auto">
  <name>Task 1: ...</name>
  ...
</task>
</tasks>
<verification>...</verification>
<success_criteria>...</success_criteria>

---PLAN_SEPARATOR---

---
phase: ${phaseSlug}
plan: 02
...
---

...
\`\`\`

Now decompose the phase into plans. Be thorough and specific.`;
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
  const { currentPlan, issues, contextMd, requirementsMd } = params;

  const issueList = issues
    .map((issue, i) => `${i + 1}. ${issue}`)
    .join('\n');

  return `You are a planning agent for the SUNCO workspace OS. Your task is to revise execution plans based on quality checker feedback.

## Current Plans

${currentPlan}

## Issues Found by Checker

${issueList}

## Reference Documents

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
- Keep must_haves BDD-style and testable
- Every requirement ID must still be covered

## Output

Return the complete revised plans in the same format as the original (with ---PLAN_SEPARATOR--- between plans).`;
}
