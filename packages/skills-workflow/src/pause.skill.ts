/**
 * @sunco/skills-workflow - Pause Skill
 *
 * Snapshots the current working context (phase, plan, tasks, git state)
 * into a flat HANDOFF.json file for cross-session continuity.
 *
 * Commands:
 *   sunco pause -- save session state to .sun/HANDOFF.json
 *
 * Decisions: D-17 (pause captures session state), D-21 (flat JSON format)
 * Requirements: SES-03
 */

import { defineSkill } from '@sunco/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeHandoff } from './shared/handoff.js';
import { captureGitState } from './shared/git-state.js';
import { parseStateMd } from './shared/state-reader.js';
import type { Handoff } from './shared/handoff.js';
import type { ContextZoneFile } from './shared/context-zones.js';

export default defineSkill({
  id: 'workflow.pause',
  command: 'pause',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Save session state for later resumption',

  async execute(ctx) {
    await ctx.ui.entry({ title: 'Pause', description: 'Saving session state...' });

    // Read STATE.md for current phase/plan info
    const statePath = join(ctx.cwd, '.planning', 'STATE.md');
    const stateContent = await readFile(statePath, 'utf-8').catch(() => '');
    const state = parseStateMd(stateContent);

    // Capture git state
    const gitState = await captureGitState(ctx.cwd);

    // Read context zone from .sun/context-zone.json (written by context-monitor hook)
    let contextZone: 'green' | 'yellow' | 'orange' | 'red' = 'green';
    try {
      const zoneRaw = await readFile(join(ctx.cwd, '.sun', 'context-zone.json'), 'utf-8');
      const zoneData = JSON.parse(zoneRaw) as ContextZoneFile;
      contextZone = zoneData.zone;
    } catch {
      // No zone file — default to green
    }

    // Build resume command (resume reads from HANDOFF.json, no --phase flag needed)
    const resumeCommand = 'sunco resume';

    // Build flat handoff object per D-17/D-21 + Phase 17 extensions
    const handoff: Handoff = {
      version: 1,
      timestamp: new Date().toISOString(),
      currentPhase: state.phase,
      currentPhaseName: '',
      currentPlan: state.plan,
      completedTasks: [],
      inProgressTask: null,
      pendingDecisions: [],
      blockers: [],
      branch: gitState.branch,
      uncommittedChanges: gitState.uncommittedChanges,
      uncommittedFiles: gitState.uncommittedFiles,
      lastSkillId: null,
      lastSkillResult: null,
      // Phase 17: Context Intelligence
      resumeCommand,
      contextZone,
      modifiedFiles: gitState.uncommittedFiles,
    };

    // Write HANDOFF.json
    await writeHandoff(ctx.fileStore, handoff);

    // Display confirmation
    const lines = [
      `Phase: ${state.phase ?? 'unknown'}`,
      `Plan: ${state.plan ?? 'unknown'}`,
      `Branch: ${gitState.branch}`,
      `Context zone: ${contextZone}`,
      `Uncommitted: ${gitState.uncommittedChanges ? `${gitState.uncommittedFiles.length} file(s)` : 'none'}`,
      '',
      `Resume with: ${resumeCommand}`,
    ];

    await ctx.ui.result({
      success: true,
      title: 'Session Paused',
      summary: 'HANDOFF.json saved to .sun/',
      details: lines,
    });

    return {
      success: true,
      summary: `Session paused. Resume with: ${resumeCommand}`,
    };
  },
});
