/**
 * Skill timeline — track skill invocations for predictive suggestions.
 *
 * Records start/completion events per skill with branch, outcome, duration.
 * Enables pattern detection (e.g., review→ship→review) for next-skill prediction.
 *
 * Storage: JSONL in `.sun/timeline.jsonl`
 *
 * Phase 24a — Learnings + Timeline
 */

import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  skill: string;
  event: 'started' | 'completed';
  branch: string;
  outcome?: 'success' | 'error' | 'abort';
  durationMs?: number;
  session: string;
  timestamp: string;
}

export interface SkillPattern {
  /** Recent skill sequence */
  sequence: string[];
  /** Predicted next skill */
  prediction: string | null;
  /** Confidence in prediction (0-1) */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function timelinePath(cwd: string): string {
  return join(cwd, '.sun', 'timeline.jsonl');
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/**
 * Log a timeline event.
 */
export async function logTimelineEvent(
  cwd: string,
  entry: TimelineEntry,
): Promise<void> {
  const path = timelinePath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(entry) + '\n', 'utf-8');
}

/**
 * Read recent timeline entries.
 */
export async function getRecentTimeline(
  cwd: string,
  limit: number = 20,
): Promise<TimelineEntry[]> {
  const path = timelinePath(cwd);
  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch {
    return [];
  }

  const entries: TimelineEntry[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as TimelineEntry);
    } catch {
      // Skip corrupted lines
    }
  }

  // Return last N entries
  return entries.slice(-limit);
}

/**
 * Get timeline entries for a specific branch.
 */
export async function getBranchTimeline(
  cwd: string,
  branch: string,
  limit: number = 10,
): Promise<TimelineEntry[]> {
  const all = await getRecentTimeline(cwd, 100);
  return all.filter((e) => e.branch === branch).slice(-limit);
}

/**
 * Get the last completed skill session for a branch.
 */
export async function getLastSession(
  cwd: string,
  branch: string,
): Promise<TimelineEntry | null> {
  const entries = await getBranchTimeline(cwd, branch, 50);
  const completed = entries.filter((e) => e.event === 'completed');
  return completed.length > 0 ? completed[completed.length - 1] : null;
}

// ---------------------------------------------------------------------------
// Pattern Detection
// ---------------------------------------------------------------------------

/**
 * Detect skill invocation patterns and predict next skill.
 *
 * Looks at the last N completed skills on a branch and finds repeating sequences.
 * If a pattern repeats (e.g., review→ship→review→ship), predicts the next step.
 */
export async function detectSkillPattern(
  cwd: string,
  branch: string,
): Promise<SkillPattern> {
  const entries = await getBranchTimeline(cwd, branch, 20);
  const completed = entries
    .filter((e) => e.event === 'completed' && e.outcome === 'success')
    .map((e) => e.skill);

  if (completed.length < 3) {
    return { sequence: completed, prediction: null, confidence: 0 };
  }

  const recent = completed.slice(-6);

  // Check for 2-skill cycle: A→B→A→B → predict A
  if (recent.length >= 4) {
    const last4 = recent.slice(-4);
    if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
      return {
        sequence: recent.slice(-3),
        prediction: last4[0],
        confidence: 0.8,
      };
    }
  }

  // Check for 3-skill cycle: A→B→C→A→B→C → predict A
  if (recent.length >= 6) {
    const last6 = recent.slice(-6);
    if (last6[0] === last6[3] && last6[1] === last6[4] && last6[2] === last6[5]) {
      return {
        sequence: recent.slice(-3),
        prediction: last6[0],
        confidence: 0.7,
      };
    }
  }

  // Workflow chain prediction: discuss→plan→execute→verify→ship
  const WORKFLOW_CHAIN: Record<string, string> = {
    'workflow.discuss': 'workflow.plan',
    'workflow.plan': 'workflow.execute',
    'workflow.execute': 'workflow.verify',
    'workflow.verify': 'workflow.ship',
  };

  const lastSkill = completed[completed.length - 1];
  const chainNext = WORKFLOW_CHAIN[lastSkill];
  if (chainNext) {
    return {
      sequence: recent.slice(-3),
      prediction: chainNext,
      confidence: 0.6,
    };
  }

  return { sequence: recent.slice(-3), prediction: null, confidence: 0 };
}
