/**
 * Executor agent prompt builder for sunco execute.
 *
 * Builds the prompt that instructs an executor agent to:
 * 1. Read the full PLAN.md content inline
 * 2. Execute each task sequentially within a Git worktree
 * 3. Commit atomically per task with --no-verify (D-02)
 * 4. Output a structured JSON summary
 *
 * Requirements: WF-14
 * Decisions: D-01 through D-04
 */

import type { PlanTask } from '../shared/plan-parser.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutePromptParams {
  /** Full PLAN.md content for inline context */
  planContent: string;
  /** Plan identifier (e.g., "06-01") */
  planId: string;
  /** Absolute path to the Git worktree working directory */
  worktreePath: string;
  /** Parsed tasks from the plan */
  taskList: PlanTask[];
}

/**
 * Structured summary the executor agent outputs at the end.
 * The execute skill parses this from the agent's outputText.
 */
export interface ExecuteAgentSummary {
  success: boolean;
  tasksCompleted: number;
  totalTasks: number;
  commits: string[];
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build the prompt for an executor agent that runs inside a Git worktree.
 *
 * The prompt includes the full PLAN.md so the agent has all context
 * without needing to read files. Tasks are listed explicitly with
 * their verify commands and done criteria.
 */
export function buildExecutePrompt(params: ExecutePromptParams): string {
  const { planContent, planId, worktreePath, taskList } = params;

  const taskSection = taskList
    .map((task, i) => {
      const filesStr = task.files.join(', ');
      const doneStr = task.done.map((d) => `  - ${d}`).join('\n');
      return `### Task ${i + 1}: ${task.name}
**Files:** ${filesStr}
**Action:**
${task.action}

**Verify command:**
\`\`\`bash
${task.verify || 'echo "no verify command"'}
\`\`\`

**Done criteria:**
${doneStr}

**After completing this task:**
\`\`\`bash
git add ${task.files.join(' ')}
git commit --no-verify -m "feat(${planId}): ${task.name}"
\`\`\``;
    })
    .join('\n\n---\n\n');

  return `You are an executor agent for the SUNCO workspace OS. Your job is to implement code changes described in a PLAN.md file, working inside an isolated Git worktree.

## Working Directory

All file operations MUST happen inside this directory:
\`${worktreePath}\`

Do NOT modify files outside this directory.

## Full Plan Content

<plan>
${planContent}
</plan>

## Execution Instructions

Execute each task **sequentially** in the order listed below. For each task:

1. Read the files listed in the task's files field
2. Implement the action described
3. Run the verify command to confirm correctness
4. If verify fails, fix the issue and retry ONCE
5. Stage ONLY the files listed in the task's files field
6. Commit with \`--no-verify\` flag (to avoid hook contention in worktrees)
7. Use commit message format: \`feat(${planId}): <task name>\`

## Tasks (${taskList.length} total)

${taskSection}

## Commit Rules

- One commit per task (atomic commits per D-03)
- Always use \`--no-verify\` flag on commits (per D-02)
- Only stage files listed in the task's files field
- If a task fails after one retry, stop and report failure

## Output Format

After completing all tasks (or stopping on failure), output EXACTLY this JSON block at the end of your response:

\`\`\`json
{
  "success": true_or_false,
  "tasksCompleted": number_of_completed_tasks,
  "totalTasks": ${taskList.length},
  "commits": ["hash1", "hash2", ...]
}
\`\`\`

This JSON block MUST be the last code block in your response. The orchestrator parses it to determine execution outcome.`;
}
