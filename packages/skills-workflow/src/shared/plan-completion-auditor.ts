/**
 * Plan completion auditor — verify implementation against plan tasks.
 *
 * Extracts actionable items from PLAN.md files (checkboxes, numbered steps)
 * and cross-references with the diff to classify each as DONE/PARTIAL/NOT_DONE.
 *
 * Phase 24b — Smart Review (absorbed from gstack review)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = 'DONE' | 'PARTIAL' | 'NOT_DONE' | 'CHANGED';

export interface PlanTask {
  /** Task description from plan */
  description: string;
  /** Files mentioned in the task */
  files: string[];
  /** Completion status */
  status: TaskStatus;
}

export interface CompletionAudit {
  /** Total extractable tasks */
  totalTasks: number;
  /** Tasks by status */
  done: number;
  partial: number;
  notDone: number;
  changed: number;
  /** Completion percentage */
  completionPercent: number;
  /** Individual task statuses */
  tasks: PlanTask[];
  /** Summary for display */
  summary: string;
}

// ---------------------------------------------------------------------------
// Task extraction
// ---------------------------------------------------------------------------

/**
 * Extract actionable items from plan content.
 *
 * Recognizes:
 * - Markdown checkboxes: `- [ ] task` or `- [x] task`
 * - Numbered steps: `1. Do something`
 * - Bold imperatives: `**Create** foo.ts`
 * - File references within tasks
 */
export function extractPlanTasks(planContent: string): PlanTask[] {
  const tasks: PlanTask[] = [];

  const lines = planContent.split('\n');
  for (const line of lines) {
    // Checkbox tasks
    const checkboxMatch = line.match(/^[-*]\s+\[[ x]\]\s+(.+)/i);
    if (checkboxMatch) {
      const desc = checkboxMatch[1].trim();
      const files = extractFilePaths(desc);
      tasks.push({ description: desc, files, status: 'NOT_DONE' });
      continue;
    }

    // Numbered steps
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      const desc = numberedMatch[1].trim();
      // Skip headers and non-actionable lines
      if (desc.length > 10 && !desc.startsWith('#') && !desc.startsWith('**Goal')) {
        const files = extractFilePaths(desc);
        tasks.push({ description: desc, files, status: 'NOT_DONE' });
      }
      continue;
    }

    // Bold imperatives (Create, Add, Modify, Update, etc.)
    const imperativeMatch = line.match(/^\*\*(Create|Add|Modify|Update|Extend|Remove|Delete|Implement)\*\*\s+(.+)/i);
    if (imperativeMatch) {
      const desc = `${imperativeMatch[1]} ${imperativeMatch[2].trim()}`;
      const files = extractFilePaths(desc);
      tasks.push({ description: desc, files, status: 'NOT_DONE' });
    }
  }

  return tasks;
}

/**
 * Extract file paths from a task description.
 */
function extractFilePaths(text: string): string[] {
  const paths: string[] = [];
  // Match common file path patterns
  const matches = text.match(/(?:[\w.-]+\/)+[\w.-]+\.(?:ts|js|tsx|jsx|json|md|toml|yaml|yml)/g);
  if (matches) {
    for (const m of matches) paths.push(m);
  }
  // Match backtick-enclosed file names
  const backtickMatches = text.match(/`([\w/.-]+\.(?:ts|js|tsx|jsx|json|md))`/g);
  if (backtickMatches) {
    for (const m of backtickMatches) paths.push(m.replace(/`/g, ''));
  }
  return [...new Set(paths)];
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/**
 * Audit plan completion against changed files.
 *
 * @param planContent - Raw PLAN.md content
 * @param changedFiles - Files changed in the diff
 * @returns Completion audit result
 */
export function auditPlanCompletion(
  planContent: string,
  changedFiles: string[],
): CompletionAudit {
  const tasks = extractPlanTasks(planContent);
  const changedSet = new Set(changedFiles.map((f) => f.toLowerCase()));

  // Classify each task
  for (const task of tasks) {
    if (task.files.length === 0) {
      // No file reference — check if description keywords appear in changed files
      const keywords = task.description
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);
      const anyMatch = changedFiles.some((f) =>
        keywords.some((kw) => f.toLowerCase().includes(kw)),
      );
      task.status = anyMatch ? 'PARTIAL' : 'NOT_DONE';
    } else {
      const matchedFiles = task.files.filter((f) =>
        changedFiles.some((cf) => cf.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(cf.toLowerCase())),
      );

      if (matchedFiles.length === task.files.length) {
        task.status = 'DONE';
      } else if (matchedFiles.length > 0) {
        task.status = 'PARTIAL';
      } else {
        task.status = 'NOT_DONE';
      }
    }
  }

  const done = tasks.filter((t) => t.status === 'DONE').length;
  const partial = tasks.filter((t) => t.status === 'PARTIAL').length;
  const notDone = tasks.filter((t) => t.status === 'NOT_DONE').length;
  const changed = tasks.filter((t) => t.status === 'CHANGED').length;
  const completionPercent = tasks.length > 0
    ? Math.round(((done + partial * 0.5) / tasks.length) * 100)
    : 100;

  const summary = tasks.length === 0
    ? 'No extractable tasks found in plan.'
    : `${done}/${tasks.length} tasks done (${completionPercent}%). ${notDone} not started, ${partial} partial.`;

  return {
    totalTasks: tasks.length,
    done,
    partial,
    notDone,
    changed,
    completionPercent,
    tasks,
    summary,
  };
}
