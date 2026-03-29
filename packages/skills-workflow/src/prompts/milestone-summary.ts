/**
 * Milestone summary prompt builder for sunco milestone summary.
 *
 * Instructs an agent to produce a comprehensive milestone report with
 * work completed, key decisions, lessons learned, metrics, and
 * recommendations for the next milestone.
 *
 * Requirements: SHP-02, WF-06
 * Decisions: D-11 (milestone summary report structure)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MilestoneSummaryParams {
  /** Name of the milestone being summarized */
  milestoneName: string;
  /** Full PROJECT.md content */
  projectMd: string;
  /** Full STATE.md content */
  stateMd: string;
  /** Full ROADMAP.md content */
  roadmapMd: string;
  /** Array of plan summary contents */
  planSummaries: string[];
  /** Array of verification report contents */
  verificationReports: string[];
  /** Extracted decisions string (from STATE.md or accumulated context) */
  decisions: string;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a milestone summary prompt for an agent.
 *
 * The agent synthesizes all project state into a comprehensive
 * milestone report covering: overview, work completed, key decisions,
 * lessons learned, metrics, and recommendations.
 *
 * @param opts - Summary parameters
 * @returns Formatted prompt string for the summary agent
 */
export function buildMilestoneSummaryPrompt(opts: MilestoneSummaryParams): string {
  const {
    milestoneName,
    projectMd,
    stateMd,
    roadmapMd,
    planSummaries,
    verificationReports,
    decisions,
  } = opts;

  const planSection = planSummaries.length > 0
    ? planSummaries
        .map((s, i) => `### Plan ${i + 1}\n\n${s}`)
        .join('\n\n---\n\n')
    : '(no plan summaries available)';

  const verifySection = verificationReports.length > 0
    ? verificationReports
        .map((r, i) => `### Verification ${i + 1}\n\n${r}`)
        .join('\n\n---\n\n')
    : '(no verification reports available)';

  return `You are a milestone report writer. Your task is to produce a comprehensive summary report for milestone "${milestoneName}".

## Input Documents

### PROJECT.md

${projectMd}

### STATE.md

${stateMd}

### ROADMAP.md

${roadmapMd}

### Key Decisions

${decisions || '(no decisions recorded)'}

### Plan Summaries

${planSection}

### Verification Reports

${verifySection}

## Report Instructions

Produce a milestone summary report in markdown with the following sections:

### 1. Overview
- Milestone name and goal
- Date range (from STATE.md timestamps)
- Overall verdict (from verification reports)

### 2. Work Completed
- List each phase with its plans and outcomes
- Highlight key features delivered
- Reference specific plan summaries for detail

### 3. Key Decisions
- Extract architectural and technical decisions from STATE.md and plan summaries
- For each decision: what was decided, why, and impact

### 4. Lessons Learned
- What went well (patterns to repeat)
- What was difficult (patterns to avoid)
- Process improvements for next milestone

### 5. Metrics
- Total plans completed
- Total execution time (from STATE.md performance metrics)
- Average time per plan
- Skills used (from plan summaries)

### 6. Recommendations for Next Milestone
- Priority items for the next milestone
- Technical debt to address
- Process changes to implement

## Output Format

Output the report as clean markdown. Start with:

\`\`\`
# Milestone Report: ${milestoneName}
\`\`\`

Do not wrap the entire output in a code block. Output markdown directly.`;
}
