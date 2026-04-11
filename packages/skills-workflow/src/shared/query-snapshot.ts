/**
 * @sunco/skills-workflow - Query Snapshot Shared Module
 *
 * Pure module extracted from query.skill.ts (Phase 33 Wave 1).
 * No SkillContext dependency — accepts cwd + state as inputs.
 *
 * Phase 33 Wave 1: query.skill.ts deleted — logic lives here, consumed by status.skill.ts
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StateApi } from '@sunco/core';
import { parseStateMd } from './state-reader.js';
import { parseRoadmap } from './roadmap-parser.js';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface QuerySnapshot {
  phase: number | null;
  status: string;
  stoppedAt: string;
  progress: {
    total: number;
    completed: number;
    percent: number;
  };
  nextAction: string | null;
  costs: { totalUsd: number };
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Build a deterministic JSON state snapshot from ROADMAP.md + STATE.md.
 * Zero LLM cost. Matches the shape query.skill.ts previously emitted.
 *
 * @param cwd - Project root directory
 * @param state - StateApi for reading cost data
 */
export async function buildQuerySnapshot(cwd: string, state: StateApi): Promise<QuerySnapshot> {
  const statePath = join(cwd, '.planning', 'STATE.md');
  const roadmapPath = join(cwd, '.planning', 'ROADMAP.md');

  // Read and parse STATE.md
  let phase: number | null = null;
  let status = 'unknown';
  let stoppedAt = '';
  try {
    const stateContent = await readFile(statePath, 'utf-8');
    const parsedState = parseStateMd(stateContent);
    phase = parsedState.phase;
    status = parsedState.status !== '' ? parsedState.status : 'unknown';
    stoppedAt = parsedState.lastActivity ?? '';
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
    const cost = await state.get<number>('usage.totalCostUsd');
    if (cost !== null && cost !== undefined) {
      totalCostUsd = cost;
    }
  } catch {
    // No cost data — leave default
  }

  const percent = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  return {
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
}
