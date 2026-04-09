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

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import type { RecommendationState } from '@sunco/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseStateMd } from './shared/state-reader.js';

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

    // Get recommendations
    const recommendations = ctx.recommend.getRecommendations(recState);

    if (recommendations.length === 0) {
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

    // Build display
    const top = recommendations.find((r) => r.isDefault) ?? recommendations[0]!;
    const details: string[] = [];

    for (let i = 0; i < Math.min(recommendations.length, 3); i++) {
      const rec = recommendations[i]!;
      const badge = rec.isDefault ? ' (Recommended)' : '';
      details.push(`${i + 1}. ${rec.title}${badge}`);
      details.push(`   ${rec.reason}`);
      details.push(`   Skill: ${rec.skillId} | Priority: ${rec.priority}`);
      details.push('');
    }

    await ctx.ui.result({
      success: true,
      title: 'Next Best Action',
      summary: `${top.title} -- ${top.reason}`,
      details,
      recommendations,
    });

    return {
      success: true,
      summary: `Next: ${top.title}`,
      data: { recommendations },
    };
  },
});
