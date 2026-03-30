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
 * Operational resilience (OPS-01 ~ OPS-05):
 *   - Crash recovery via AutoLock (.sun/auto.lock)
 *   - Stuck detection via StuckDetector (consecutive/oscillation failures)
 *   - Budget ceiling enforcement via BudgetGuard
 *   - Hard timeout per step via Promise.race
 *   - --no-resume flag to ignore crashed session and start fresh
 *
 * Requirements: WF-15, WF-18, OPS-01, OPS-02, OPS-03, OPS-04, OPS-05
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
import { AutoLock } from './shared/auto-lock.js';
import { StuckDetector } from './shared/stuck-detector.js';
import { BudgetGuard } from './shared/budget-guard.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_HARD_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (reserved for future idle watchdog)

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

/**
 * Run a skill step with a hard timeout.
 * Resolves with the skill result, or resolves with a failure result on timeout.
 */
async function runWithTimeout(
  ctx: SkillContext,
  skillId: string,
  args: Record<string, unknown>,
  hardTimeoutMs: number,
): Promise<SkillResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<SkillResult>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({
        success: false,
        summary: `Hard timeout: ${skillId} exceeded ${hardTimeoutMs / 60000} minutes`,
      });
    }, hardTimeoutMs);
  });

  try {
    const result = await Promise.race([ctx.run(skillId, args), timeoutPromise]);
    return result;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
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
    {
      flags: '--no-resume',
      description: 'Ignore crashed session and start fresh (force-releases existing lock)',
    },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Auto',
      description: 'Running autonomous pipeline...',
    });

    // --- Initialize operational resilience ---
    const sunDir = join(ctx.cwd, '.sun');
    const lock = new AutoLock(sunDir);
    const stuckDetector = new StuckDetector();

    // Read budget ceiling from state (config does not have a budget_ceiling field)
    const budgetCeiling = (await ctx.state.get<number>('auto.budget_ceiling')) ?? null;
    const budgetGuard = new BudgetGuard(budgetCeiling);

    // Read timeout config from state (falls back to defaults)
    const hardTimeoutMinutes =
      (await ctx.state.get<number>('auto.hard_timeout_minutes')) ?? DEFAULT_HARD_TIMEOUT_MS / 60000;
    const hardTimeoutMs = hardTimeoutMinutes * 60 * 1000;

    // Suppress unused variable warning for idle timeout (reserved for future watchdog)
    void DEFAULT_IDLE_TIMEOUT_MS;

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

    // --- Crash recovery or fresh start ---
    const noResume = ctx.args['resume'] === false; // Commander sets --no-resume as resume=false

    if (noResume) {
      // Force-release any existing lock and start fresh
      ctx.log.info('--no-resume: ignoring crashed session, releasing any existing lock');
      try {
        await lock.release();
      } catch {
        // No lock to release — that's fine
      }
    } else {
      // Check for crashed previous session
      const lockCheck = await lock.check();
      if (lockCheck.crashed && lockCheck.state) {
        ctx.log.warn('Crashed session detected', {
          previousPhase: lockCheck.state.phase,
          previousStep: lockCheck.state.step,
          startedAt: lockCheck.state.startedAt,
        });
        // Resume from the phase that was interrupted
        if (startPhase === null || startPhase === (statePhase ?? 1)) {
          startPhase = lockCheck.state.phase;
          ctx.log.info(`Resuming from Phase ${lockCheck.state.phase}, step: ${lockCheck.state.step}`);
        }
      }
    }

    // Acquire lock for this session
    await lock.acquire(startPhase ?? 1, 'init');

    // --- Step 2: Read ROADMAP.md ---
    const roadmapPath = join(ctx.cwd, '.planning', 'ROADMAP.md');
    let roadmapContent: string;
    try {
      roadmapContent = await readFile(roadmapPath, 'utf-8');
    } catch {
      await lock.release();
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
      await lock.release();
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
        // Mandatory lint gate: runs deterministically after execute, before verify.
        // Agent CANNOT skip this. Stripe Minions pattern: "hardcoded script always
        // runs the linter and the agent cannot skip this."
        name: 'lint-gate',
        skillId: 'harness.lint',
      },
      {
        name: 'verify',
        skillId: 'workflow.verify',
      },
    ];

    try {
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

          // Update lock to track current step
          await lock.updateStep(phaseNumber, step.name);

          // Budget check before agent dispatch
          const currentCostUsd = (await ctx.state.get<number>('usage.totalCostUsd')) ?? 0;
          const budgetResult = budgetGuard.check(currentCostUsd);
          if (budgetResult.status === 'exceeded') {
            ctx.log.error('Budget ceiling reached', {
              current: budgetResult.currentCostUsd,
              ceiling: budgetResult.ceilingUsd,
              message: budgetResult.message,
            });
            aborted = true;
            break;
          }
          if (budgetResult.message) {
            ctx.log.warn(budgetResult.message);
          }

          ctx.log.info(`Auto: running ${step.skillId} for phase ${phaseNumber}`);

          // Run with hard timeout (resolves to failure result on timeout, never rejects)
          const result = await runWithTimeout(
            ctx,
            step.skillId,
            { phase: phaseNumber },
            hardTimeoutMs,
          );

          // Record invocation for stuck detection
          await lock.recordInvocation(step.skillId, result.success);

          // If the step timed out, treat as failure with phaseFailed=true
          if (!result.success && result.summary?.startsWith('Hard timeout:')) {
            ctx.log.error(`Hard timeout on ${step.skillId} for phase ${phaseNumber}`, {
              summary: result.summary,
            });
            phaseFailed = true;
            break;
          }

          // Check for stuck state
          const history = await lock.getHistory();
          const stuckResult = stuckDetector.analyze(history);
          if (stuckResult.stuck) {
            ctx.log.error('Stuck detected — stopping auto pipeline', {
              reason: stuckResult.reason,
              failedSkillId: stuckResult.failedSkillId,
              consecutiveFailures: stuckResult.consecutiveFailures,
            });
            // Attempt debug diagnostic (best-effort)
            try {
              await ctx.run('workflow.debug', { phase: phaseNumber });
            } catch {
              // Debug skill failed too — continue to abort
            }
            aborted = true;
            break;
          }

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
              // Re-run the failed step (also with timeout)
              const retryResult = await runWithTimeout(
                ctx,
                step.skillId,
                { phase: phaseNumber },
                hardTimeoutMs,
              );
              // Record retry invocation for stuck detection
              await lock.recordInvocation(step.skillId, retryResult.success);
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

          // Adaptive replan: re-read roadmap to catch dynamically inserted phases
          try {
            const freshRoadmap = await readFile(roadmapPath, 'utf-8');
            const freshParsed = parseRoadmap(freshRoadmap);
            const freshRemaining = freshParsed.phases
              .filter((p) => !p.completed && Number(p.number) >= phaseNumber + 1)
              .sort((a, b) => Number(a.number) - Number(b.number));

            // Check if new phases were inserted
            if (freshRemaining.length !== remainingPhases.length - (i + 1)) {
              ctx.log.info('Roadmap changed — replanning', {
                previous: remainingPhases.length - (i + 1),
                current: freshRemaining.length,
              });
              // Replace remaining phases with fresh data
              remainingPhases.splice(i + 1, remainingPhases.length, ...freshRemaining);
              pipelineProgress.update({
                message: `Roadmap updated — ${freshRemaining.length} phases remaining`,
              });
            }
          } catch {
            ctx.log.warn('Could not re-read roadmap for adaptive replan');
          }
        }
      }
    } finally {
      // Always release lock on exit (idempotent — safe to call even if already released)
      try {
        await lock.release();
      } catch {
        // Ignore release errors
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
