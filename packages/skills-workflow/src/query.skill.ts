/**
 * @sunco/skills-workflow - Query Skill
 *
 * Instant JSON state snapshot — reads STATE.md + ROADMAP.md deterministically.
 * Zero LLM cost. Designed for CI/CD via `sunco headless query`.
 *
 * Returns: phase, progress, nextAction, costs, timestamp.
 *
 * Requirements: HLS-01, HLS-02, HLS-03, HLS-04
 */

import { defineSkill } from '@sunco/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseStateMd } from './shared/state-reader.js';
import { parseRoadmap } from './shared/roadmap-parser.js';

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.query',
  command: 'query',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Instant JSON state snapshot — phase, progress, next action (no LLM)',

  async execute(ctx) {
    const statePath = join(ctx.cwd, '.planning', 'STATE.md');
    const roadmapPath = join(ctx.cwd, '.planning', 'ROADMAP.md');

    // Read and parse STATE.md
    let phase: number | null = null;
    let status = 'unknown';
    let stoppedAt = '';
    try {
      const stateContent = await readFile(statePath, 'utf-8');
      const state = parseStateMd(stateContent);
      phase = state.phase;
      status = state.status !== '' ? state.status : 'unknown';
      stoppedAt = state.lastActivity ?? '';
    } catch {
      // No state file — leave defaults
    }

    // Read and parse ROADMAP.md
    let totalPhases = 0;
    let completedPhases = 0;
    let nextPhase: string | null = null;
    try {
      const roadmapContent = await readFile(roadmapPath, 'utf-8');
      const roadmap = parseRoadmap(roadmapContent);
      totalPhases = roadmap.phases.length;
      completedPhases = roadmap.phases.filter((p) => p.completed).length;
      const next = roadmap.phases.find((p) => !p.completed);
      nextPhase = next ? `Phase ${next.number}: ${next.name}` : null;
    } catch {
      // No roadmap file — leave defaults
    }

    // Read cost from state store (best-effort)
    let totalCostUsd = 0;
    try {
      const cost = await ctx.state.get<number>('usage.totalCostUsd');
      if (cost !== null && cost !== undefined) {
        totalCostUsd = cost;
      }
    } catch {
      // No cost data — leave default
    }

    const percent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

    const snapshot = {
      phase,
      status,
      stoppedAt,
      progress: {
        total: totalPhases,
        completed: completedPhases,
        percent,
      },
      nextAction: nextPhase,
      costs: { totalUsd: totalCostUsd },
      timestamp: new Date().toISOString(),
    };

    const summary = `Phase ${phase ?? '?'}, ${completedPhases}/${totalPhases} complete, ${status}`;

    await ctx.ui.result({ success: true, title: 'Query', summary });

    return { success: true, summary, data: snapshot };
  },
});
