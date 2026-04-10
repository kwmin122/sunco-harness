/**
 * @sunco/skills-workflow - Next Skill
 *
 * Routes the user to the next recommended skill based on current project state.
 * Uses the RecommenderApi (ctx.recommend) for deterministic, sub-ms routing.
 *
 * Command: sunco next
 *
 * Requirements: SES-02
 * Decisions: D-17 (auto-route), D-19 (recommender-based)
 */

import { defineSkill, readActiveWork, DEFAULT_ACTIVE_WORK } from '@sunco/core';
import type { SkillContext, SkillResult, BackgroundWorkItem } from '@sunco/core';
import type { RecommendationState } from '@sunco/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseStateMd } from './shared/state-reader.js';

// ---------------------------------------------------------------------------
// Background work helpers (D-14 visibility rules)
// ---------------------------------------------------------------------------

function relativeTimeNext(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function filterBackgroundWorkForNext(items: BackgroundWorkItem[]): BackgroundWorkItem[] {
  const thirtyMinsAgo = Date.now() - 30 * 60_000;
  return items
    .filter(item =>
      item.state === 'running' ||
      (item.state === 'completed' && item.completed_at && new Date(item.completed_at).getTime() > thirtyMinsAgo),
    )
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 3);
}

export default defineSkill({
  id: 'workflow.next',
  command: 'next',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  tier: 'user',
  description: 'Route to the next recommended skill based on current state',

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'Next Action',
      description: 'Finding the best next step...',
    });

    // Read STATE.md for current position
    const statePath = join(ctx.cwd, '.planning', 'STATE.md');
    const stateContent = await readFile(statePath, 'utf-8').catch(() => null);
    const state = stateContent ? parseStateMd(stateContent) : null;

    // Read active-work dashboard
    const activeWork = await readActiveWork(ctx.cwd);
    const hasActiveWork = activeWork.updated_at !== DEFAULT_ACTIVE_WORK.updated_at;

    // Build recommendation state
    const recState: RecommendationState = {
      lastSkillId: 'workflow.next',
      lastResult: { success: true },
      projectState: state
        ? {
            phase: state.phase,
            plan: state.plan,
            status: state.status,
            percent: state.progress.percent,
          }
        : {},
      activeSkills: new Set(),
    };

    const recommendations = ctx.recommend.getRecommendations(recState);

    if (recommendations.length === 0 && !hasActiveWork) {
      await ctx.ui.result({
        success: true,
        title: 'Next Action',
        summary: 'No recommendations. Project state may need initialization.',
      });

      return {
        success: true,
        summary: 'No recommendations available',
        data: { recommendations: [] },
      };
    }

    // Build 3-section display
    const details: string[] = [];

    // Section 1: Next
    details.push('## Next');
    if (recommendations.length > 0) {
      const top = recommendations.find((r) => r.isDefault) ?? recommendations[0]!;
      details.push(`\u2192 ${top.skillId} \u2014 ${top.reason}`);
    } else if (activeWork.next_recommended_action) {
      const nra = activeWork.next_recommended_action;
      details.push(`\u2192 ${nra.command} \u2014 ${nra.reason}`);
    } else {
      details.push('(no recommendation)');
    }
    details.push('');

    // Section 2: Background work (D-14 rules: running + completed ≤30min, max 3)
    if (hasActiveWork) {
      const visible = filterBackgroundWorkForNext(activeWork.background_work);
      if (visible.length > 0) {
        details.push('## Background work');
        for (const item of visible) {
          const shortId = item.agent_id.slice(0, 5);
          const time = item.completed_at ? relativeTimeNext(item.completed_at) : relativeTimeNext(item.started_at);
          details.push(`- ${item.kind} (${shortId}\u2026) ${item.description} \u2014 ${item.state} ${time}`);
        }
        details.push('');
      }
    }

    // Section 3: Blocked
    if (hasActiveWork) {
      details.push('## Blocked');
      if (activeWork.blocked_on) {
        details.push(`\u26A0 ${activeWork.blocked_on.reason} (since ${relativeTimeNext(activeWork.blocked_on.since)})`);
      } else {
        details.push('(none)');
      }
      details.push('');
    }

    // Source attribution
    if (hasActiveWork) {
      details.push('source: .sun/active-work.json + recommender');
    }

    const topTitle = recommendations.length > 0
      ? (recommendations.find((r) => r.isDefault) ?? recommendations[0])!.title
      : activeWork.next_recommended_action?.command ?? 'Check status';

    await ctx.ui.result({
      success: true,
      title: 'Next Best Action',
      summary: `Next: ${topTitle}`,
      details,
      recommendations,
    });

    return {
      success: true,
      summary: `Next: ${topTitle}`,
      data: { recommendations },
    };
  },
});
