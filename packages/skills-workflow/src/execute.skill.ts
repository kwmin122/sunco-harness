/**
 * @sunco/skills-workflow - Execute Skill
 *
 * Wave-based parallel execution orchestrator with Git worktree isolation.
 * Reads PLAN.md files from a phase directory, groups them by wave number,
 * and dispatches parallel executor agents in isolated Git worktrees.
 * Each wave completes before the next starts. Commits are cherry-picked
 * back to the main branch.
 *
 * This is the most complex skill in SUNCO -- it transforms plans into code.
 *
 * Requirements: WF-14
 * Decisions: D-01 (multi-wave orchestrator), D-02 (worktree isolation + --no-verify),
 *   D-03 (atomic commits per task), D-04 (execution permissions),
 *   D-05 (SUMMARY.md per plan), D-06 (checkpoint handling), D-07 (wave safety)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult, PermissionSet } from '@sunco/core';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parsePlanMd, groupPlansByWave } from './shared/plan-parser.js';
import type { ParsedPlan } from './shared/plan-parser.js';
import { WorktreeManager } from './shared/worktree-manager.js';
import { resolvePhaseDir, writePhaseArtifact, readPhaseArtifact } from './shared/phase-reader.js';
import { captureGitState } from './shared/git-state.js';
import { buildExecutePrompt } from './prompts/execute.js';
import { buildSliceContractPrompt } from './prompts/slice-contract.js';
import type { ExecuteAgentSummary } from './prompts/execute.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default execution permissions for executor agents (D-04) */
const EXECUTION_PERMISSIONS: PermissionSet = {
  role: 'execution' as PermissionSet['role'],
  readPaths: ['**'],
  writePaths: ['src/**', 'packages/**', 'tests/**'],
  allowTests: true,
  allowNetwork: false,
  allowGitWrite: true,
  allowCommands: ['npm test', 'npm run build'],
};

/** Agent execution timeout (5 minutes per plan) */
const AGENT_TIMEOUT = 300_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the ExecuteAgentSummary JSON from agent output.
 * Looks for the last ```json...``` block in the output.
 */
function parseAgentSummary(outputText: string): ExecuteAgentSummary | null {
  const jsonBlocks = outputText.match(/```json\s*\n([\s\S]*?)```/g);
  if (!jsonBlocks || jsonBlocks.length === 0) return null;

  const lastBlock = jsonBlocks[jsonBlocks.length - 1];
  const jsonStr = lastBlock.replace(/```json\s*\n?/, '').replace(/```$/, '').trim();

  try {
    return JSON.parse(jsonStr) as ExecuteAgentSummary;
  } catch {
    return null;
  }
}

/**
 * Build a plan identifier from frontmatter (e.g., "06-01").
 */
function planIdFromPlan(plan: ParsedPlan): string {
  const paddedPhase = plan.frontmatter.phase.match(/^(\d+)/)?.[1]?.padStart(2, '0') ?? '00';
  const paddedPlan = String(plan.frontmatter.plan).padStart(2, '0');
  return `${paddedPhase}-${paddedPlan}`;
}

/**
 * Build a raw execution prompt for plans without structured tasks.
 * Used when slice-contract output doesn't parse into legacy task format.
 * The agent reads the full contract/plan and implements it end-to-end.
 */
function buildRawExecutePrompt(rawContent: string, planId: string, worktreePath: string): string {
  return `You are an executor agent for the SUNCO workspace OS. Your job is to implement code changes described below, working inside an isolated Git worktree.

## Working Directory

All file operations MUST happen inside this directory:
\`${worktreePath}\`

Do NOT modify files outside this directory.

## Plan / Contract

<plan>
${rawContent}
</plan>

## Execution Instructions

1. Read the plan/contract above carefully
2. Identify all files that need to be created or modified
3. Implement each change, reading existing files first to understand patterns
4. After each logical unit of work, commit with: \`git commit --no-verify -m "feat(${planId}): <description>"\`
5. Run any verification commands mentioned in the plan
6. If verification fails, fix and retry ONCE

## Output Format

After completing all work (or stopping on failure), output EXACTLY this JSON block at the end:

\`\`\`json
{
  "success": true_or_false,
  "tasksCompleted": number_of_logical_units_completed,
  "totalTasks": estimated_total,
  "commits": ["hash1", "hash2"]
}
\`\`\``;
}

/**
 * Build scoped permissions for a plan.
 * If plan modifies .planning/** paths, use planning role instead of execution (D-04 / Pitfall 7).
 */
function buildPlanPermissions(plan: ParsedPlan): PermissionSet {
  const filesModified = plan.frontmatter.files_modified ?? [];

  const hasPlanningFiles = filesModified.some(
    (f) => f.startsWith('.planning/') || f.startsWith('.planning\\'),
  );

  if (hasPlanningFiles) {
    return {
      role: 'planning' as PermissionSet['role'],
      readPaths: ['**'],
      writePaths: ['.planning/**'],
      allowTests: false,
      allowNetwork: false,
      allowGitWrite: false,
      allowCommands: [],
    };
  }

  // Scope write paths to plan's files_modified if available
  const writePaths =
    filesModified.length > 0
      ? filesModified
      : EXECUTION_PERMISSIONS.writePaths;

  return { ...EXECUTION_PERMISSIONS, writePaths };
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.execute',
  command: 'execute',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'standard',
  description:
    'Execute plans in parallel with Git worktree isolation -- wave-based orchestration',

  options: [
    {
      flags: '-p, --phase <number>',
      description: 'Phase number to execute',
    },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Execute',
      description: 'Executing phase plans...',
    });

    // --- Step 0: Validate --phase arg ---
    const phaseArg = ctx.args['phase'] as number | undefined;
    if (phaseArg === undefined) {
      const msg = 'Usage: sunco execute --phase <number>';
      await ctx.ui.result({ success: false, title: 'Execute', summary: msg });
      return { success: false, summary: msg };
    }

    // --- Step 1: Check provider availability ---
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      const msg =
        'No AI provider available. Install Claude Code CLI or set ANTHROPIC_API_KEY.';
      await ctx.ui.result({
        success: false,
        title: 'Execute',
        summary: msg,
        details: [
          'sunco execute requires an AI provider to dispatch executor agents.',
          'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
          'Or set ANTHROPIC_API_KEY for the SDK provider.',
        ],
      });
      return { success: false, summary: msg };
    }

    // --- Step 2: Resolve phase directory ---
    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseArg);
    if (!phaseDir) {
      const msg = `Phase directory not found for phase ${phaseArg}`;
      await ctx.ui.result({ success: false, title: 'Execute', summary: msg });
      return { success: false, summary: msg };
    }

    // --- Step 3: Read PLAN.md files ---
    const entries = await readdir(phaseDir);
    const planFiles = entries.filter(
      (e: string) => e.match(/-PLAN\.md$/) && !e.includes('SUMMARY'),
    );

    if (planFiles.length === 0) {
      const msg = `No plans found in phase ${phaseArg}`;
      await ctx.ui.result({ success: false, title: 'Execute', summary: msg });
      return { success: false, summary: msg };
    }

    // Parse all plans
    const plans: ParsedPlan[] = [];
    for (const file of planFiles) {
      const content = await readFile(join(phaseDir, file), 'utf-8');
      plans.push(parsePlanMd(content));
    }

    // --- Step 3.5: Expand delivery-slice plans via slice-contract ---
    const deliverySlices = plans.filter((p) => p.frontmatter.isDeliverySlice);
    if (deliverySlices.length > 0) {
      const sliceProgress = ctx.ui.progress({
        title: 'Generating slice contracts from delivery plans',
        total: deliverySlices.length,
      });

      // Read context artifacts for slice-contract generation
      const padded = String(phaseArg).padStart(2, '0');
      const productSpecMd = await readPhaseArtifact(ctx.cwd, phaseArg, `${padded}-PRODUCT-SPEC.md`) ?? '';
      const contextMd = await readPhaseArtifact(ctx.cwd, phaseArg, `${padded}-CONTEXT.md`) ?? '';

      const phaseDirName = phaseDir.split('/').pop() ?? '';
      const phaseSlug = phaseDirName.replace(/^\d+-/, '');

      for (let i = 0; i < deliverySlices.length; i++) {
        const slice = deliverySlices[i];
        const planNum = String(slice.frontmatter.plan).padStart(2, '0');

        sliceProgress.update({ completed: i, message: `Expanding plan ${planNum}...` });

        const contractResult = await ctx.agent.run({
          role: 'execution',
          prompt: buildSliceContractPrompt({
            planContent: slice.raw,
            productSpecMd,
            contextMd,
            phaseSlug,
            paddedPhase: padded,
            planNumber: planNum,
          }),
          permissions: {
            role: 'execution',
            readPaths: ['**'],
            writePaths: [],
            allowTests: false,
            allowNetwork: false,
            allowGitWrite: false,
            allowCommands: [],
          },
          timeout: AGENT_TIMEOUT,
        });

        if (contractResult.success && contractResult.outputText) {
          // Re-parse the contract as a legacy-format plan with tasks
          try {
            const expanded = parsePlanMd(contractResult.outputText);
            // Merge: keep delivery-slice metadata, use expanded tasks
            const idx = plans.indexOf(slice);
            if (idx >= 0) {
              plans[idx] = {
                ...expanded,
                frontmatter: {
                  ...slice.frontmatter,
                  files_modified: expanded.frontmatter.files_modified,
                  isDeliverySlice: false, // now expanded
                },
              };
            }
          } catch {
            // If contract output isn't parseable as plan format, use raw as execution prompt
            ctx.log.warn(`Slice contract for plan ${planNum} not in standard format, using raw`);
            const idx = plans.indexOf(slice);
            if (idx >= 0) {
              plans[idx] = {
                ...slice,
                frontmatter: { ...slice.frontmatter, isDeliverySlice: false },
                raw: contractResult.outputText, // pass raw contract to executor
              };
            }
          }
        } else {
          ctx.log.warn(`Slice contract generation failed for plan ${planNum}`);
        }
      }

      sliceProgress.done({ summary: `${deliverySlices.length} slice contract(s) generated` });
    }

    // --- Step 4: Group by wave ---
    const waves = groupPlansByWave(plans);
    const totalWaves = waves.size;
    const totalPlans = plans.length;

    ctx.log.info(
      `Phase ${phaseArg}: ${totalPlans} plan(s) in ${totalWaves} wave(s)`,
    );

    // --- Step 5: Capture git state for base branch ---
    const gitState = await captureGitState(ctx.cwd);
    const baseBranch = gitState.branch;

    // --- Step 6: Wave execution loop ---
    const wtManager = new WorktreeManager(ctx.cwd);
    let completedPlans = 0;
    let failedPlans = 0;
    let aborted = false;
    const allCommits: string[] = [];

    const waveProgress = ctx.ui.progress({
      title: 'Executing phase',
      total: totalPlans,
    });

    try {
      let waveIndex = 0;
      for (const [waveNum, wavePlans] of waves) {
        waveIndex++;
        if (aborted) break;

        waveProgress.update({
          message: `Wave ${waveIndex}/${totalWaves}: executing ${wavePlans.length} plan(s)`,
        });

        // --- Checkpoint handling for non-autonomous plans (D-06) ---
        for (const plan of wavePlans) {
          if (!plan.frontmatter.autonomous) {
            const planId = planIdFromPlan(plan);
            const checkpointResult = await ctx.ui.ask({
              message: `Plan ${planId} requires human verification. Continue?`,
              options: [
                { id: 'approve', label: 'Approve' },
                { id: 'skip', label: 'Skip' },
                { id: 'abort', label: 'Abort' },
              ],
            });

            if (checkpointResult.selectedId === 'abort') {
              aborted = true;
              break;
            }
            if (checkpointResult.selectedId === 'skip') {
              failedPlans++;
              continue;
            }
          }
        }

        if (aborted) break;

        // --- Create worktrees for all plans in this wave ---
        const worktreeMap = new Map<
          string,
          { plan: ParsedPlan; worktreePath: string }
        >();

        for (const plan of wavePlans) {
          const planId = planIdFromPlan(plan);
          const wt = await wtManager.create(planId, baseBranch);
          worktreeMap.set(planId, { plan, worktreePath: wt.path });
        }

        // --- Dispatch agents in parallel (D-01, D-07) ---
        const agentPromises = [...worktreeMap.entries()].map(
          ([planId, { plan, worktreePath }]) => {
            // Choose prompt strategy based on whether tasks were parsed
            const prompt = plan.tasks.length > 0
              ? buildExecutePrompt({
                  planContent: plan.raw,
                  planId,
                  worktreePath,
                  taskList: plan.tasks,
                })
              : buildRawExecutePrompt(plan.raw, planId, worktreePath);

            return ctx.agent
              .run({
                role: 'execution',
                prompt,
                permissions: buildPlanPermissions(plan),
                timeout: AGENT_TIMEOUT,
              })
              .then((result) => ({
                planId,
                result,
                plan,
                error: null as string | null,
              }))
              .catch((err) => ({
                planId,
                result: null as null,
                plan,
                error: err instanceof Error ? err.message : String(err),
              }));
          },
        );

        const results = await Promise.all(agentPromises);

        // --- Evaluate results ---
        const succeeded: { planId: string; plan: ParsedPlan }[] = [];
        const failed: { planId: string; reason: string }[] = [];

        for (const { planId, result, plan, error } of results) {
          if (error || !result) {
            failed.push({ planId, reason: error ?? 'Agent returned no result' });
            continue;
          }

          const summary = parseAgentSummary(result.outputText);

          if (summary && summary.success) {
            succeeded.push({ planId, plan });
            // Note: commits are tracked via cherry-pick hashes, not agent-reported
          } else {
            const reason = summary
              ? `${summary.tasksCompleted}/${summary.totalTasks} tasks completed`
              : 'Agent returned unsuccessful result';
            failed.push({ planId, reason });
          }
        }

        // --- Cherry-pick successful commits back (D-01 step 4) ---
        for (const { planId } of succeeded) {
          try {
            const cherryHashes = await wtManager.cherryPick(
              planId,
              baseBranch,
            );
            allCommits.push(...cherryHashes);
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : String(err);
            ctx.log.warn(`Cherry-pick failed for ${planId}: ${msg}`);
          }
          completedPlans++;
        }

        // --- Handle failures (D-07) ---
        if (failed.length > 0) {
          const failureReport = failed
            .map((f) => `${f.planId}: ${f.reason}`)
            .join('\n');

          const choice = await ctx.ui.ask({
            message: `${failed.length} plan(s) failed in wave ${waveIndex}:\n${failureReport}\n\nHow to proceed?`,
            options: [
              { id: 'skip', label: 'Skip and continue to next wave' },
              { id: 'abort', label: 'Abort execution' },
            ],
          });

          if (choice.selectedId === 'abort') {
            aborted = true;
          } else {
            failedPlans += failed.length;
          }
        }

        waveProgress.update({ completed: completedPlans });
      }
    } finally {
      // --- Cleanup: always remove all worktrees (D-07) ---
      await wtManager.removeAll();
    }

    waveProgress.done({
      summary: `${completedPlans}/${totalPlans} plans completed`,
    });

    // --- Build result ---
    const success = completedPlans > 0 && !aborted;
    const summary = aborted
      ? `Execution aborted. ${completedPlans}/${totalPlans} plans completed.`
      : `${completedPlans}/${totalPlans} plans completed across ${totalWaves} wave(s).`;

    await ctx.ui.result({
      success,
      title: 'Execute',
      summary,
      details: [
        `Plans completed: ${completedPlans}`,
        `Plans failed: ${failedPlans}`,
        `Waves executed: ${totalWaves}`,
        `Commits: ${allCommits.length}`,
      ],
    });

    return {
      success,
      summary,
      data: {
        completedPlans,
        failedPlans,
        totalPlans,
        totalWaves,
        commits: allCommits,
      },
    };
  },
});
