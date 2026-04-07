/**
 * Iron Law debug prompt builder — enhanced analysis with root cause protocol.
 *
 * Wraps the standard debug-analyze prompt with:
 * 1. Iron Law declaration (no fixes without root cause)
 * 2. Pre-classified bug pattern with indicators
 * 3. Prior learnings from previous sessions
 * 4. Hypothesis-driven protocol
 * 5. Sanitized error context
 *
 * Phase 23a — Iron Law Engine
 */

import type { BugPattern, FailureType, IronLawState } from '../shared/debug-types.js';

/** Maximum input length per section before truncation */
const MAX_CHARS = 50_000;

function truncate(input: string, label: string): string {
  if (input.length <= MAX_CHARS) return input;
  return input.slice(0, MAX_CHARS) + `\n\n[... ${label} truncated at 50,000 chars ...]`;
}

export interface IronLawPromptParams {
  gitLog: string;
  testOutput: string;
  buildOutput: string;
  stateSnapshot: string;
  recentErrors: string;
  bugClassification: FailureType;
  bugPattern: BugPattern;
  priorLearnings: string;
  ironLawState: IronLawState;
  freezeScope?: string[];
}

/**
 * Build an Iron Law debug prompt for hypothesis-driven root cause analysis.
 */
export function buildDebugIronLawPrompt(params: IronLawPromptParams): string {
  const gitLog = truncate(params.gitLog, 'git log');
  const testOutput = truncate(params.testOutput, 'test output');
  const buildOutput = truncate(params.buildOutput, 'build output');
  const stateSnapshot = truncate(params.stateSnapshot, 'state snapshot');
  const recentErrors = truncate(params.recentErrors, 'recent errors');
  const { bugClassification, bugPattern, priorLearnings, freezeScope } = params;

  return `You are a debugging expert agent operating under the **Iron Law**.

## THE IRON LAW

**You MUST NOT suggest code changes until root cause is confirmed.**

Follow this protocol:
1. **Observe** — read all context (errors, logs, state)
2. **Hypothesize** — form 1-3 specific hypotheses about the root cause
3. **Verify** — for each hypothesis, describe what evidence confirms or rejects it
4. **Confirm** — mark exactly ONE hypothesis as confirmed with evidence
5. **Fix** — only THEN suggest code changes

If no hypothesis can be confirmed, say so. Do NOT guess.

## Pre-Classification

The failure has been pre-classified as: **${bugClassification}** (${bugPattern.category})

**Description:** ${bugPattern.description}

**Known indicators for this pattern:**
${bugPattern.indicators.map((i) => `- ${i}`).join('\n')}

**Common fixes for this pattern:**
${bugPattern.commonFixes.map((f) => `- ${f}`).join('\n')}

Use this classification as a starting point, but verify it. Override if evidence points elsewhere.
${freezeScope && freezeScope.length > 0 ? `\n## Freeze Scope\n\nLimit your fix suggestions to these directories ONLY:\n${freezeScope.map((d) => '- ' + d).join('\n')}\n\nDo not suggest changes outside these directories.` : ''}

## Failure Classification (9 types)

Classify the failure as ONE of:

**Structural:**
1. \`context_shortage\` — incomplete context, missing imports
2. \`direction_error\` — fundamentally wrong approach
3. \`structural_conflict\` — architecture prevents the change
4. \`boundary_violation\` — cross-package or layer breach

**Behavioral:**
5. \`state_corruption\` — stale cache, inconsistent state
6. \`race_condition\` — timing-dependent, intermittent
7. \`silent_failure\` — no errors but wrong output

**Environmental:**
8. \`type_mismatch\` — TypeScript / schema validation errors
9. \`dependency_conflict\` — version conflicts, peer deps
${priorLearnings}

## Git History

\`\`\`
${gitLog}
\`\`\`

## Test Output

\`\`\`
${testOutput}
\`\`\`

## Build Output

\`\`\`
${buildOutput}
\`\`\`

## State Snapshot

\`\`\`
${stateSnapshot}
\`\`\`

## Recent Errors (sanitized)

\`\`\`
${recentErrors}
\`\`\`

## Output Format

\`\`\`json
{
  "failure_type": "one of the 9 types above",
  "root_cause": "specific root cause description",
  "root_cause_confirmed": true,
  "hypotheses_tested": [
    {
      "description": "hypothesis statement",
      "verification": "what evidence was checked",
      "result": "confirmed|rejected"
    }
  ],
  "affected_files": [
    { "file": "path/to/file.ts", "line": 42, "reason": "why relevant" }
  ],
  "fix_suggestions": [
    { "action": "specific fix", "file": "path/to/file.ts", "priority": "high|medium|low" }
  ],
  "confidence": 85,
  "prior_learnings_matched": []
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
