/**
 * Slice contract prompt builder.
 *
 * Generates execution-ready task packets from a delivery-slice plan.
 * This is where implementation details belong — file paths, read_first,
 * acceptance_criteria, grep-verifiable conditions.
 *
 * The slice contract is generated JUST BEFORE execution, not during planning.
 * This means the executor agent reads the actual codebase state to determine
 * correct file paths, imports, and function signatures — rather than the
 * planner guessing them ahead of time.
 *
 * Pipeline position: PRODUCT-SPEC → PLAN (delivery slices) → SLICE-CONTRACT → EXECUTE
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SliceContractParams {
  planContent: string;
  productSpecMd: string;
  contextMd: string;
  phaseSlug: string;
  paddedPhase: string;
  planNumber: string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * Build the prompt that expands a delivery-slice plan into an
 * execution-ready contract with full implementation details.
 *
 * The agent reads the codebase to determine actual file paths,
 * existing patterns, and correct import structure — instead of guessing.
 */
export function buildSliceContractPrompt(params: SliceContractParams): string {
  const {
    planContent,
    productSpecMd,
    contextMd,
    paddedPhase,
    planNumber,
  } = params;

  return `You are an execution preparation agent for the SUNCO workspace OS. Your job is to expand a delivery-slice plan into an execution-ready contract.

## Delivery Slice Plan
${planContent}

## Product Specification
${productSpecMd}

## Context (Locked Decisions)
${contextMd}

## Your Task

Expand this plan into a SLICE-CONTRACT — a fully detailed execution packet that any agent can implement without interpretation.

**CRITICAL: Read the codebase first.** Use Glob and Read tools to discover:
- Actual file paths and directory structure
- Existing patterns and conventions
- Import paths and export structure
- Test file locations and naming conventions

Do NOT guess file paths. Find them.

### Contract Structure

For each task in the plan, produce:

\`\`\`xml
<task type="auto">
  <name>{task name}</name>
  <read_first>
    {files the executor MUST read before modifying — discovered by reading the codebase}
  </read_first>
  <files>
    {files to create or modify — verified against actual directory structure}
  </files>
  <action>
    {step-by-step instructions with CONCRETE values}
    {exact function signatures, config keys, import paths}
    {based on what you READ from the codebase, not guessed}
  </action>
  <acceptance_criteria>
    {grep-verifiable conditions}
    {e.g., "file.ts contains export function foo"}
  </acceptance_criteria>
  <verify>
    <automated>{commands to verify completion}</automated>
  </verify>
  <done>
    {bullet list of completion criteria}
  </done>
</task>
\`\`\`

### Wave Assignment

Assign each task a wave based on dependencies:
- Wave 1: No dependencies on other tasks
- Wave 2+: Depends on outputs from previous wave
- Tasks in the same wave can execute in parallel

### Key Links

For each critical connection between files, document:
\`\`\`
KEY_LINK: {from_file} → {to_file} via {import/export/config}
  Pattern: {how they connect}
\`\`\`

## Output Format

\`\`\`markdown
# Slice Contract: ${paddedPhase}-${planNumber}

**Generated:** {date}
**Wave:** {wave number}
**Depends on:** {list of plan numbers, or "none"}

## Files Modified
{list of actual file paths, verified against codebase}

## Tasks

{XML task blocks}

## Key Links
{critical connections}

## Verification
{overall verification commands}
\`\`\`

## Rules

1. NEVER guess a file path — use tools to find it
2. NEVER write "align with X" or "match Y" — specify exact values
3. Every action step must be implementable by a fresh agent with zero context
4. acceptance_criteria must be grep-verifiable (not "works correctly")
5. read_first must include at minimum the file being modified AND the source of truth it depends on
6. If a file doesn't exist yet, specify exactly where to create it based on existing directory patterns`;
}
