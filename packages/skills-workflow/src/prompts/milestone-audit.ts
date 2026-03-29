/**
 * Milestone audit prompt builder for sunco milestone audit.
 *
 * Instructs an agent to compare each requirement against delivery
 * evidence from verification reports and plan summaries, producing
 * a scored audit with met/unmet requirement classification.
 *
 * Requirements: SHP-01, WF-05
 * Decisions: D-09 (milestone audit scoring: PASS > 90, WARN 70-90, FAIL < 70)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MilestoneAuditParams {
  /** Name of the milestone being audited */
  milestoneName: string;
  /** Full PROJECT.md content for requirement context */
  projectMd: string;
  /** Full REQUIREMENTS.md content for requirement definitions */
  requirementsMd: string;
  /** Array of verification report contents (one per phase) */
  verificationReports: string[];
  /** Array of plan summary contents (one per completed plan) */
  planSummaries: string[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a milestone audit prompt for an agent.
 *
 * The agent compares each requirement from REQUIREMENTS.md against
 * evidence from verification reports and plan summaries. It outputs
 * a JSON structure with score, met/unmet lists, and analysis.
 *
 * Scoring: score = (met.length / total_reqs) * 100
 *   PASS > 90, WARN 70-90, FAIL < 70
 *
 * @param opts - Audit parameters
 * @returns Formatted prompt string for the audit agent
 */
export function buildMilestoneAuditPrompt(opts: MilestoneAuditParams): string {
  const {
    milestoneName,
    projectMd,
    requirementsMd,
    verificationReports,
    planSummaries,
  } = opts;

  const verificationSection = verificationReports.length > 0
    ? verificationReports
        .map((r, i) => `### Verification Report ${i + 1}\n\n${r}`)
        .join('\n\n---\n\n')
    : '(no verification reports available)';

  const summarySection = planSummaries.length > 0
    ? planSummaries
        .map((s, i) => `### Plan Summary ${i + 1}\n\n${s}`)
        .join('\n\n---\n\n')
    : '(no plan summaries available)';

  return `You are a milestone auditor. Your task is to audit milestone "${milestoneName}" by comparing each requirement against delivery evidence.

## PROJECT.md

${projectMd}

## REQUIREMENTS.md

${requirementsMd}

## Delivery Evidence

### Verification Reports

${verificationSection}

### Plan Summaries

${summarySection}

## Audit Instructions

1. **Extract all requirements** from REQUIREMENTS.md. Each requirement has an ID (e.g., REQ-01, AUTH-01).
2. **For each requirement**, search the verification reports and plan summaries for evidence that it was delivered:
   - Look for the requirement ID being mentioned
   - Look for functionality that matches the requirement description
   - Look for test results that validate the requirement
3. **Classify each requirement** as "met" or "unmet":
   - **Met**: Clear evidence of delivery (code exists, tests pass, verification mentions it)
   - **Unmet**: No evidence, or evidence of incomplete/broken implementation
4. **Calculate score**: score = (met_count / total_requirement_count) * 100, rounded to nearest integer.
5. **Determine verdict**: PASS if score > 90, WARN if 70-90, FAIL if < 70.
6. **Write analysis**: Brief explanation of gaps and strengths.

## Output Format

\`\`\`json
{
  "score": 85,
  "verdict": "WARN",
  "met": ["REQ-01", "REQ-02", "AUTH-01"],
  "unmet": ["REQ-03", "PERF-01"],
  "analysis": "Most core requirements are met. Performance optimization (PERF-01) and advanced search (REQ-03) are incomplete."
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
