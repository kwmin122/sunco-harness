/**
 * Context recovery — auto-restore session context at startup.
 *
 * Reads recent timeline, checkpoint, and learnings to build
 * a welcome-back briefing after context window compaction.
 *
 * Phase 24a — Learnings + Timeline
 */

import { getLastSession, getRecentTimeline } from './skill-timeline.js';
import { searchLearnings } from './learnings.js';
import type { TimelineEntry } from './skill-timeline.js';
import type { Learning } from './learnings.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecoveryContext {
  /** Last completed skill session */
  lastSession: TimelineEntry | null;
  /** Recent skill pattern (last 5 entries) */
  recentSkills: string[];
  /** High-confidence learnings for current context */
  relevantLearnings: Learning[];
  /** Pre-formatted welcome briefing */
  briefing: string;
}

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

/**
 * Recover context for a session start or context window compaction.
 *
 * @param cwd - Project working directory
 * @param branch - Current git branch
 * @returns Recovery context with briefing
 */
export async function recoverContext(
  cwd: string,
  branch: string,
): Promise<RecoveryContext> {
  // Gather data in parallel
  const [lastSession, recentTimeline, learnings] = await Promise.all([
    getLastSession(cwd, branch),
    getRecentTimeline(cwd, 10),
    searchLearnings(cwd, { minConfidence: 5 }),
  ]);

  const recentSkills = recentTimeline
    .filter((e) => e.event === 'completed')
    .map((e) => e.skill)
    .slice(-5);

  const relevantLearnings = learnings.slice(0, 5);

  // Build briefing
  const lines: string[] = [];

  if (lastSession) {
    const duration = lastSession.durationMs
      ? ` (${Math.round(lastSession.durationMs / 1000)}s)`
      : '';
    lines.push(
      `Last session on ${branch}: /${lastSession.skill.replace('workflow.', '')} ` +
      `(${lastSession.outcome ?? 'unknown'})${duration}`,
    );
  }

  if (recentSkills.length > 0) {
    lines.push(`Recent: ${recentSkills.map((s) => s.replace('workflow.', '')).join(' → ')}`);
  }

  if (relevantLearnings.length > 0) {
    lines.push(`Learnings: ${relevantLearnings.length} active (top: "${relevantLearnings[0].key}")`);
  }

  if (lines.length === 0) {
    lines.push('Fresh session — no prior context.');
  }

  return {
    lastSession,
    recentSkills,
    relevantLearnings,
    briefing: lines.join('\n'),
  };
}

/**
 * Format recovery context as a short welcome message.
 */
export function formatWelcomeBriefing(ctx: RecoveryContext): string {
  return ctx.briefing;
}
