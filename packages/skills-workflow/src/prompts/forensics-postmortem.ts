/**
 * Forensics post-mortem prompt builder for sunco forensics.
 *
 * Builds a prompt for the forensics agent that reconstructs a timeline
 * of events, identifies where the workflow diverged from the plan,
 * and produces a structured post-mortem report.
 *
 * Requirements: DBG-02
 * Decisions: D-09 (forensics scope), D-10 (ForensicsReport structure)
 */

/** Maximum input length per section before truncation */
const MAX_CHARS = 50_000;

/**
 * Truncate a string to MAX_CHARS with a notice appended.
 */
function truncate(input: string, label: string): string {
  if (input.length <= MAX_CHARS) return input;
  return input.slice(0, MAX_CHARS) + `\n\n[... ${label} truncated at 50,000 chars ...]`;
}

/**
 * Build a forensics post-mortem prompt for failure analysis.
 *
 * The prompt instructs the agent to:
 * 1. Reconstruct a timeline of events from git commits, plan execution, and verification
 * 2. Identify where the workflow diverged from the plan
 * 3. Hypothesize the root cause of the failure
 * 4. List affected plans
 * 5. Recommend prevention measures
 * 6. Output structured JSON matching ForensicsReport interface
 *
 * @param params - Context inputs for the forensics analysis
 * @returns Formatted prompt string for the forensics agent
 */
export function buildForensicsPostmortemPrompt(params: {
  gitHistory: string;
  planFiles: string;
  summaryFiles: string;
  verificationReports: string;
  stateHistory: string;
}): string {
  const gitHistory = truncate(params.gitHistory, 'git history');
  const planFiles = truncate(params.planFiles, 'plan files');
  const summaryFiles = truncate(params.summaryFiles, 'summary files');
  const verificationReports = truncate(params.verificationReports, 'verification reports');
  const stateHistory = truncate(params.stateHistory, 'state history');

  return `You are a forensics expert agent. Your task is to perform a post-mortem analysis of a failed workflow execution and produce a structured report.

## Goal

Reconstruct what happened, identify where things went wrong, and recommend how to prevent similar failures.

## Git History

\`\`\`
${gitHistory}
\`\`\`

## Plan Files

\`\`\`
${planFiles}
\`\`\`

## Execution Summaries

\`\`\`
${summaryFiles}
\`\`\`

## Verification Reports

\`\`\`
${verificationReports}
\`\`\`

## State History

\`\`\`
${stateHistory}
\`\`\`

## Instructions

1. **Reconstruct the timeline**: Walk through git commits, plan execution logs, and verification reports chronologically. Each timeline entry should have a timestamp, event description, and source (git/plan/verification/state).

2. **Identify the divergence point**: Find the exact moment where the actual execution diverged from the planned execution. This could be a commit that introduced a bug, a plan step that was skipped, or a verification that was ignored.

3. **Hypothesize the root cause**: Based on the evidence, what is the most likely root cause? Consider:
   - Was the plan itself flawed?
   - Was the execution incorrect?
   - Was the verification insufficient?
   - Were there external factors (dependency changes, environment issues)?

4. **List affected plans**: Which plans were impacted by this failure? Include both directly failed plans and any downstream plans that depend on them.

5. **Recommend prevention**: What specific measures would prevent this class of failure? Be concrete -- reference specific verification steps, plan constraints, or architectural guardrails.

## Output Format

\`\`\`json
{
  "timeline": [
    {
      "timestamp": "ISO timestamp or relative reference",
      "event": "description of what happened",
      "source": "git|plan|verification|state"
    }
  ],
  "divergence_point": "clear description of where execution diverged from plan",
  "root_cause_hypothesis": "detailed hypothesis for the root cause",
  "affected_plans": ["plan-id-1", "plan-id-2"],
  "prevention_recommendations": [
    "specific actionable recommendation"
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
