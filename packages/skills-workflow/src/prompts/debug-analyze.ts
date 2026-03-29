/**
 * Debug analysis prompt builder for sunco debug.
 *
 * Builds a prompt for the debug agent that analyzes failure context
 * (git history, test output, build logs, .sun/ state) and classifies
 * the failure as context_shortage, direction_error, or structural_conflict.
 *
 * Requirements: DBG-02
 * Decisions: D-01 (failure classification), D-02 (context gathering),
 *   D-03 (structured analysis output)
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
 * Build a debug analysis prompt for failure classification.
 *
 * The prompt instructs the agent to:
 * 1. Analyze the failure context (git history, test output, build logs, .sun/ state)
 * 2. Classify the failure type
 * 3. Identify root cause with specific files and lines
 * 4. Suggest actionable fixes with priority
 * 5. Output structured JSON matching DebugAnalysis interface
 *
 * @param params - Context inputs for the debug analysis
 * @returns Formatted prompt string for the debug agent
 */
export function buildDebugAnalyzePrompt(params: {
  gitLog: string;
  testOutput: string;
  buildOutput: string;
  stateSnapshot: string;
  recentErrors: string;
}): string {
  const gitLog = truncate(params.gitLog, 'git log');
  const testOutput = truncate(params.testOutput, 'test output');
  const buildOutput = truncate(params.buildOutput, 'build output');
  const stateSnapshot = truncate(params.stateSnapshot, 'state snapshot');
  const recentErrors = truncate(params.recentErrors, 'recent errors');

  return `You are a debugging expert agent. Your task is to analyze a build/test failure and produce a structured diagnosis.

## Failure Classification

Classify the failure as ONE of three types:

1. **context_shortage** -- The agent ran out of context window, had incomplete file contents, or was missing critical information needed to complete the task correctly.
2. **direction_error** -- The agent took a fundamentally wrong approach (wrong API, wrong pattern, wrong assumption about how the code works).
3. **structural_conflict** -- The codebase architecture prevents the intended change (circular dependency, incompatible abstraction layers, conflicting design constraints).

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

## State Snapshot (.sun/ state)

\`\`\`
${stateSnapshot}
\`\`\`

## Recent Errors

\`\`\`
${recentErrors}
\`\`\`

## Instructions

1. **Classify** the failure into exactly one of: \`context_shortage\`, \`direction_error\`, or \`structural_conflict\`.
2. **Identify the root cause** -- be specific about what went wrong and why.
3. **List affected files** with line numbers and reasons why each file is relevant.
4. **Suggest fixes** with priority levels:
   - **high**: Must fix to resolve the failure
   - **medium**: Should fix to prevent recurrence
   - **low**: Nice-to-have improvement
5. **Rate your confidence** (0-100) based on how much evidence supports your diagnosis.

## Output Format

\`\`\`json
{
  "failure_type": "context_shortage|direction_error|structural_conflict",
  "root_cause": "clear description of the root cause",
  "affected_files": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "reason": "why this file is relevant to the failure"
    }
  ],
  "fix_suggestions": [
    {
      "action": "specific actionable fix description",
      "file": "path/to/file.ts",
      "priority": "high|medium|low"
    }
  ],
  "confidence": 85
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
