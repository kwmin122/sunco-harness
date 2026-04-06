/**
 * @sunco/skills-workflow - Ship Skill
 *
 * Creates PR with 5-layer verification pre-check and gh CLI fallback.
 * Flow: verify -> branch creation -> push -> PR creation via gh CLI.
 * Falls back to manual push instructions when gh is unavailable.
 *
 * Requirements: SHP-01, SHP-02
 * Decisions: D-01 (verify pre-check), D-02 (verify gate), D-03 (gh CLI),
 *   D-04 (PR body auto-generation), D-15 (state tracking), D-16 (UI pattern)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { simpleGit } from 'simple-git';
import { captureGitState } from './shared/git-state.js';
import { proceedGate } from './shared/gates.js';
import { buildShipPrBody } from './prompts/ship-pr-body.js';
import type { VerifyReport } from './shared/verify-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a timestamp-based slug for branch naming.
 */
function makeTimestamp(): string {
  return Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.ship',
  command: 'ship',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'standard',
  description: 'Create PR with verification pre-check and auto-generated body',

  options: [
    { flags: '-p, --phase <number>', description: 'Phase to ship' },
    { flags: '--draft', description: 'Create draft PR' },
    // --skip-verify REMOVED: verification is mandatory before ship (stop-the-line)
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Ship',
      description: 'Preparing to ship...',
    });

    const phaseNumber = ctx.args.phase as number | undefined;
    const draft = ctx.args.draft === true;

    // --- Step 1: Capture git state ---
    const gitState = await captureGitState(ctx.cwd);

    if (gitState.uncommittedChanges) {
      ctx.log.warn('Working tree has uncommitted changes');
    }

    // --- Step 2: Mandatory verification (stop-the-line — no skip) ---
    let verifyVerdict = 'PENDING';
    let findingsCount = 0;

    {
      const verifyProgress = ctx.ui.progress({
        title: 'Verification pre-check',
        total: 1,
      });
      verifyProgress.update({ completed: 0, message: 'Running verification...' });

      const verifyResult = await ctx.run('workflow.verify', {
        phase: phaseNumber,
      });

      verifyProgress.update({ completed: 1 });
      verifyProgress.done({ summary: 'Verification complete' });

      if (!verifyResult.success) {
        const report = verifyResult.data as VerifyReport | undefined;
        const failedLayers = report?.layers?.filter((l) => !l.passed).length ?? 0;

        const summary = `Ship blocked: verification failed (${failedLayers} layer(s))`;
        await ctx.ui.result({ success: false, title: 'Ship', summary });
        return {
          success: false,
          summary,
          data: { verifyResult },
        };
      }

      const report = verifyResult.data as VerifyReport | undefined;
      verifyVerdict = report?.verdict ?? 'PASS';
      findingsCount = report?.findings?.length ?? 0;
    }

    // --- Step 2b: Proceed Gate (shared stop-the-line gate) ---
    const gate = await proceedGate(ctx);
    if (!gate.passed) {
      await ctx.ui.result({ success: false, title: 'Ship', summary: gate.reason });
      return { success: false, summary: gate.reason };
    }

    // --- Step 3: Branch creation ---
    const branchProgress = ctx.ui.progress({
      title: 'Branch',
      total: 1,
    });

    let branchName = gitState.branch;
    const git = simpleGit(ctx.cwd);

    if (branchName === 'main' || branchName === 'master') {
      branchName = `ship/phase-${phaseNumber ?? 0}-${makeTimestamp()}`;
      await git.checkoutLocalBranch(branchName);
      ctx.log.info(`Created branch: ${branchName}`);
    }

    branchProgress.update({ completed: 1 });
    branchProgress.done({ summary: `Branch: ${branchName}` });

    // --- Step 4: Push branch ---
    const pushProgress = ctx.ui.progress({
      title: 'Push',
      total: 1,
    });

    try {
      await git.push('origin', branchName, ['--set-upstream']);
      pushProgress.update({ completed: 1 });
      pushProgress.done({ summary: 'Pushed to origin' });
    } catch (err) {
      ctx.log.warn('Push failed', { error: err });
      pushProgress.done({ summary: 'Push failed (will try PR anyway)' });
    }

    // --- Step 5: PR creation via gh CLI ---
    const prProgress = ctx.ui.progress({
      title: 'PR creation',
      total: 1,
    });

    let execa: typeof import('execa')['execa'];
    try {
      const execaMod = await import('execa');
      execa = execaMod.execa;
    } catch {
      // execa not available
      prProgress.done({ summary: 'execa not available' });
      const summary = 'Branch pushed. Create PR manually.';
      await ctx.ui.result({ success: true, title: 'Ship', summary });
      return {
        success: true,
        summary,
        warnings: ['GitHub CLI (gh) not available or not authenticated.'],
        data: { manual: true, branch: branchName },
      };
    }

    // Check gh auth
    try {
      await execa('gh', ['auth', 'status']);
    } catch {
      prProgress.done({ summary: 'gh CLI not authenticated' });
      const summary = 'Branch pushed. Create PR manually.';
      await ctx.ui.result({ success: true, title: 'Ship', summary });
      return {
        success: true,
        summary,
        warnings: ['GitHub CLI (gh) not available or not authenticated.'],
        data: { manual: true, branch: branchName },
      };
    }

    // Build PR body
    const phaseName = `Phase ${phaseNumber ?? 0}`;
    const body = buildShipPrBody({
      phaseNumber: phaseNumber ?? 0,
      phaseName,
      verifyVerdict,
      findingsCount,
      changelogSummary: '',
      contextSummary: `Ship phase ${phaseNumber ?? 0}`,
      planSummaries: [],
    });

    const title = `[Phase ${phaseNumber ?? 0}] ${phaseName}`;

    // Create PR
    const ghArgs = ['pr', 'create', '--title', title, '--body', body];
    if (draft) {
      ghArgs.push('--draft');
    }

    try {
      const prResult = await execa('gh', ghArgs);
      const prUrl = prResult.stdout.trim();

      prProgress.update({ completed: 1 });
      prProgress.done({ summary: `PR created: ${prUrl}` });

      const summary = `PR created: ${prUrl}`;
      await ctx.ui.result({
        success: true,
        title: 'Ship',
        summary,
        details: [
          `Branch: ${branchName}`,
          `Verdict: ${verifyVerdict}`,
          `PR: ${prUrl}`,
        ],
      });

      return {
        success: true,
        summary,
        data: { prUrl, branch: branchName, verifyVerdict },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      prProgress.done({ summary: `PR creation failed: ${msg}` });

      const summary = `Branch pushed but PR creation failed: ${msg}`;
      await ctx.ui.result({ success: true, title: 'Ship', summary });
      return {
        success: true,
        summary,
        warnings: [`PR creation failed: ${msg}`],
        data: { manual: true, branch: branchName },
      };
    }
  },
});
