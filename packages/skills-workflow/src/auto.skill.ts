/**
 * @sunco/skills-workflow - Auto Skill
 *
 * Full autonomous pipeline orchestrator. Reads ROADMAP.md and STATE.md
 * to determine remaining phases, then loops through
 * discuss -> plan -> execute -> verify per phase.
 *
 * Stops at blockers (failed verify) or gray areas (user prompt)
 * and reports progress. This is a THIN WRAPPER -- the actual work
 * happens in the composed skills via ctx.run().
 *
 * Requirements: WF-15, WF-18
 * Decisions: D-01 (pipeline loop), D-02 (phase chain),
 *   D-03 (kind=prompt for agent access), D-04 (error recovery),
 *   D-16 (thin composition), D-17 (inter-skill chaining)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseStateMd } from './shared/state-reader.js';
import { parseRoadmap } from './shared/roadmap-parser.js';
import { resolvePhaseDir } from './shared/phase-reader.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutoResultData {
  completedPhases: number;
  failedPhases: number;
  skippedPhases: number;
  totalPhases: number;
  lastPhase: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a phase directory already contains CONTEXT.md.
 */
async function hasContextMd(phaseDir: string): Promise<boolean> {
  try {
    const entries = await readdir(phaseDir);
    return entries.some((e: string) => e.endsWith('-CONTEXT.md') || e === 'CONTEXT.md');
  } catch {
    return false;
  }
}

/**
 * Check whether a phase directory already contains PLAN.md files.
 */
async function hasPlanFiles(phaseDir: string): Promise<boolean> {
  try {
    const entries = await readdir(phaseDir);
    return entries.some((e: string) => e.match(/-PLAN\.md$/) !== null);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.auto',
  command: 'auto',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Full autonomous pipeline -- loops discuss/plan/execute/verify per phase',

  options: [
    {
      flags: '-p, --from <phase>',
      description: 'Start from specific phase number',
    },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Auto',
      description: 'Running autonomous pipeline...',
    });

    // --- Step 1: Read STATE.md ---
    let startPhase: number | null = null;

    const fromArg = ctx.args['from'] as number | undefined;
    if (fromArg !== undefined) {
      startPhase = Number(fromArg);
    }

    const statePath = join(ctx.cwd, '.planning', 'STATE.md');
    let statePhase: number | null = null;
    try {
      const stateContent = await readFile(statePath, 'utf-8');
      const state = parseStateMd(stateContent);
      statePhase = state.phase;
    } catch {
      ctx.log.warn('STATE.md not found or unreadable');
    }

    if (startPhase === null) {
      startPhase = statePhase ?? 1;
    }

    // --- Step 2: Read ROADMAP.md ---
    const roadmapPath = join(ctx.cwd, '.planning', 'ROADMAP.md');
    let roadmapContent: string;
    try {
      roadmapContent = await readFile(roadmapPath, 'utf-8');
    } catch {
      const msg = 'ROADMAP.md not found. Run sunco new first to create planning artifacts.';
      await ctx.ui.result({ success: false, title: 'Auto', summary: msg });
      return { success: false, summary: msg };
    }

    const roadmap = parseRoadmap(roadmapContent);

    // --- Step 3: Determine remaining phases ---
    const remainingPhases = roadmap.phases
      .filter((p) => !p.completed && Number(p.number) >= startPhase!)
      .sort((a, b) => Number(a.number) - Number(b.number));

    if (remainingPhases.length === 0) {
      const msg = 'All phases complete. Nothing to do.';
      await ctx.ui.result({ success: true, title: 'Auto', summary: msg });
      return {
        success: true,
        summary: msg,
        data: {
          completedPhases: 0,
          failedPhases: 0,
          skippedPhases: 0,
          totalPhases: 0,
          lastPhase: null,
        } satisfies AutoResultData,
      };
    }

    // --- Step 4: Phase loop ---
    let completedPhases = 0;
    let failedPhases = 0;
    let skippedPhases = 0;
    let lastPhase: number | null = null;
    let aborted = false;

    const pipelineProgress = ctx.ui.progress({
      title: 'Autonomous Pipeline',
      total: remainingPhases.length,
    });

    /**
     * Pipeline steps in order: discuss -> plan -> execute -> verify.
     * Each step maps to a workflow skill via ctx.run().
     */
    const PIPELINE_STEPS: ReadonlyArray<{
      name: string;
      skillId: string;
      skipCheck?: (phaseDir: string | null) => Promise<boolean>;
      skipReason?: string;
    }> = [
      {
        name: 'discuss',
        skillId: 'workflow.discuss',
        skipCheck: async (phaseDir) => phaseDir !== null && (await hasContextMd(phaseDir)),
        skipReason: 'CONTEXT.md exists',
      },
      {
        name: 'plan',
        skillId: 'workflow.plan',
        skipCheck: async (phaseDir) => phaseDir !== null && (await hasPlanFiles(phaseDir)),
        skipReason: 'PLAN.md files exist',
      },
      {
        name: 'execute',
        skillId: 'workflow.execute',
      },
      {
        name: 'verify',
        skillId: 'workflow.verify',
      },
    ];

    for (let i = 0; i < remainingPhases.length; i++) {
      if (aborted) break;

      const phase = remainingPhases[i]!;
      const phaseNumber = Number(phase.number);
      lastPhase = phaseNumber;

      pipelineProgress.update({
        completed: i,
        message: `Phase ${phaseNumber}: ${phase.name}`,
      });

      ctx.log.info(`Auto: starting phase ${phaseNumber} -- ${phase.name}`);

      let phaseFailed = false;

      for (const step of PIPELINE_STEPS) {
        if (aborted || phaseFailed) break;

        // Check if this step can be skipped (e.g., artifacts already exist)
        if (step.skipCheck) {
          const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);
          if (await step.skipCheck(phaseDir)) {
            ctx.log.info(`Phase ${phaseNumber}: skipping ${step.name} (${step.skipReason})`);
            continue;
          }
        }

        ctx.log.info(`Auto: running ${step.skillId} for phase ${phaseNumber}`);

        const result = await ctx.run(step.skillId, { phase: phaseNumber });

        if (!result.success) {
          ctx.log.warn(`Auto: ${step.skillId} failed for phase ${phaseNumber}`, {
            summary: result.summary,
          });

          // Error recovery: ask user what to do
          const choice = await ctx.ui.ask({
            message: `Phase ${phaseNumber} step "${step.name}" failed: ${result.summary ?? 'Unknown error'}\n\nHow to proceed?`,
            options: [
              { id: 'retry', label: 'Retry this step' },
              { id: 'skip', label: 'Skip this phase' },
              { id: 'abort', label: 'Abort pipeline' },
            ],
          });

          if (choice.selectedId === 'retry') {
            // Re-run the failed step
            const retryResult = await ctx.run(step.skillId, { phase: phaseNumber });
            if (!retryResult.success) {
              ctx.log.warn(`Auto: retry of ${step.skillId} also failed for phase ${phaseNumber}`);
              phaseFailed = true;
            }
          } else if (choice.selectedId === 'skip') {
            phaseFailed = true;
          } else {
            aborted = true;
          }
        }
      }

      if (phaseFailed) {
        if (aborted) break;
        // Determine if this was a skip or actual failure
        skippedPhases++;
        failedPhases++;
      } else if (!aborted) {
        completedPhases++;
      }
    }

    pipelineProgress.update({ completed: completedPhases + failedPhases + skippedPhases });
    pipelineProgress.done({
      summary: `${completedPhases} completed, ${failedPhases} failed, ${skippedPhases} skipped`,
    });

    // --- Step 5: Result ---
    const success = completedPhases > 0 && !aborted;
    const summary = aborted
      ? `Pipeline aborted. ${completedPhases}/${remainingPhases.length} phases completed.`
      : `Pipeline complete. ${completedPhases}/${remainingPhases.length} phases completed.`;

    await ctx.ui.result({
      success,
      title: 'Auto',
      summary,
      details: [
        `Phases completed: ${completedPhases}`,
        `Phases failed: ${failedPhases}`,
        `Phases skipped: ${skippedPhases}`,
        `Total remaining: ${remainingPhases.length}`,
        `Last phase: ${lastPhase ?? 'none'}`,
      ],
    });

    return {
      success,
      summary,
      data: {
        completedPhases,
        failedPhases,
        skippedPhases,
        totalPhases: remainingPhases.length,
        lastPhase,
      } satisfies AutoResultData,
    };
  },
});
