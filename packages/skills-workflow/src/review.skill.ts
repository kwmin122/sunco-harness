/**
 * @sunco/skills-workflow - Review Skill
 *
 * Multi-provider cross-review that sends diffs to multiple AI providers
 * independently and synthesizes findings into a unified REVIEWS.md.
 * Supports both staged changes review (default) and full phase review.
 *
 * This is the "check" complement to execute. Independent AI providers
 * review code from different perspectives, catching blind spots that
 * a single reviewer would miss.
 *
 * Requirements: WF-13
 * Decisions: D-08 (multi-provider dispatch), D-09 (provider flags),
 *   D-10 (verification role), D-11 (synthesis into REVIEWS.md),
 *   D-12 (review dimensions), D-13 (phase vs default mode)
 */

import { defineSkill } from '@sunco/core';
import type { PermissionSet } from '@sunco/core';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolvePhaseDir, writePhaseArtifact } from './shared/phase-reader.js';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildReviewPrompt, REVIEW_DIMENSIONS } from './prompts/review.js';
import { buildReviewSynthesizePrompt } from './prompts/review-synthesize.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum diff length before truncation (per RESEARCH Pitfall 6) */
const MAX_DIFF_CHARS = 50_000;

/** Provider flag to family mapping (D-09) */
const FLAG_FAMILY_MAP: Record<string, string> = {
  claude: 'claude',
  codex: 'openai',
  gemini: 'google',
};

/** Read-only + test permissions for review agents (D-10) */
const VERIFICATION_PERMISSIONS: PermissionSet = {
  role: 'verification',
  readPaths: ['**'],
  writePaths: [],
  allowTests: true,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: ['npm test'],
};

/** Permissions for synthesis agent */
const PLANNING_PERMISSIONS: PermissionSet = {
  role: 'planning',
  readPaths: ['**'],
  writePaths: ['.planning/**'],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.review',
  command: 'review',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'standard',
  description: 'Multi-provider cross-review with synthesized REVIEWS.md',
  options: [
    { flags: '-p, --phase <number>', description: 'Review all plans in a phase' },
    { flags: '--claude', description: 'Include Claude provider' },
    { flags: '--codex', description: 'Include OpenAI/Codex provider' },
    { flags: '--gemini', description: 'Include Google/Gemini provider' },
  ],

  async execute(ctx) {
    // --- Step 0: Entry + provider check ---
    await ctx.ui.entry({
      title: 'Review',
      description: 'Starting multi-provider cross-review...',
    });

    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Review',
        summary: 'No AI provider available',
        details: [
          'sunco review requires at least one AI provider for code review.',
          'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
          'Or set ANTHROPIC_API_KEY for the SDK provider.',
        ],
      });
      return { success: false, summary: 'No AI provider available' };
    }

    // --- Step 1: Determine review mode and generate diff ---
    const phaseArg = ctx.args.phase as number | undefined;
    let diff = '';

    if (phaseArg) {
      // Phase mode: resolve phase dir and generate diff
      const phaseDir = await resolvePhaseDir(ctx.cwd, phaseArg);
      if (!phaseDir) {
        await ctx.ui.result({
          success: false,
          title: 'Review',
          summary: `Phase ${phaseArg} directory not found`,
        });
        return { success: false, summary: `Phase ${phaseArg} directory not found` };
      }

      const git = simpleGit(ctx.cwd);

      // Try to find the base commit for this phase via git log
      try {
        const log = await git.log({ maxCount: 50 });
        const padded = String(phaseArg).padStart(2, '0');

        // Find the oldest commit related to this phase
        const phaseCommits = log.all.filter((c) =>
          c.message.includes(`(${padded}-`) || c.message.includes(`Phase ${phaseArg}`),
        );

        if (phaseCommits.length > 0) {
          const oldestPhaseCommit = phaseCommits[phaseCommits.length - 1]!;
          diff = await git.diff([`${oldestPhaseCommit.hash}^..HEAD`]);
        } else {
          // Fallback: use HEAD~10 if no phase commits found
          diff = await git.diff(['HEAD~10..HEAD']);
        }
      } catch {
        // Fallback: staged + unstaged
        const staged = await git.diff(['--cached']);
        const unstaged = await git.diff();
        diff = [staged, unstaged].filter(Boolean).join('\n');
      }
    } else {
      // Default mode: staged + unstaged changes
      const git = simpleGit(ctx.cwd);
      const staged = await git.diff(['--cached']);
      const unstaged = await git.diff();
      diff = [staged, unstaged].filter(Boolean).join('\n');
    }

    // --- Step 2: Validate diff ---
    if (!diff || diff.trim().length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Review',
        summary: 'No changes to review',
        details: [
          'No staged or unstaged changes found.',
          'Stage changes with `git add` or use `--phase N` to review a phase.',
        ],
      });
      return { success: false, summary: 'No changes to review' };
    }

    // Diff truncation is handled inside prompt builders (buildReviewPrompt
    // at 50K chars, buildReviewSynthesizePrompt at 20K chars). Track for reporting.
    const truncated = diff.length > MAX_DIFF_CHARS;
    if (truncated) {
      ctx.log.warn('Diff exceeds 50,000 chars — prompt builders will truncate', { length: diff.length });
    }

    // --- Step 3: Resolve providers (D-09) ---
    const flagFamilies: string[] = [];
    if (ctx.args.claude) flagFamilies.push(FLAG_FAMILY_MAP.claude!);
    if (ctx.args.codex) flagFamilies.push(FLAG_FAMILY_MAP.codex!);
    if (ctx.args.gemini) flagFamilies.push(FLAG_FAMILY_MAP.gemini!);

    let matchedProviderIds: string[];
    if (flagFamilies.length > 0) {
      // Filter providers by family prefix
      matchedProviderIds = providers.filter((pid) =>
        flagFamilies.some((family) => pid.startsWith(family) || pid.includes(family)),
      );
    } else {
      // Use all available providers
      matchedProviderIds = [...providers];
    }

    if (matchedProviderIds.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Review',
        summary: 'No matching providers found for the specified flags',
        details: [
          `Available providers: ${providers.join(', ')}`,
          `Requested families: ${flagFamilies.join(', ')}`,
        ],
      });
      return { success: false, summary: 'No matching providers found' };
    }

    ctx.log.info('Review providers resolved', { matchedProviderIds, flagFamilies });

    // --- Step 4: Dispatch reviews (D-08, D-10) ---
    const reviewProgress = ctx.ui.progress({
      title: 'Dispatching cross-review',
      total: matchedProviderIds.length,
    });

    const reviewPrompt = buildReviewPrompt({
      diff,
      dimensions: REVIEW_DIMENSIONS,
    });

    const reviewResults = await ctx.agent.crossVerify(
      {
        role: 'verification',
        prompt: reviewPrompt,
        permissions: VERIFICATION_PERMISSIONS,
        timeout: 180_000,
      },
      matchedProviderIds,
    );

    reviewProgress.update({ completed: matchedProviderIds.length, message: 'Reviews received' });
    reviewProgress.done({
      summary: `${reviewResults.length} provider(s) reviewed`,
    });

    const successfulReviews = reviewResults.filter((r) => r.success);
    const warnings: string[] = [];

    if (successfulReviews.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Review',
        summary: 'All review agents failed',
      });
      return { success: false, summary: 'All review agents failed' };
    }

    for (const r of reviewResults) {
      if (!r.success) {
        warnings.push(`Review agent ${r.providerId} failed`);
      }
    }

    // --- Step 5: Synthesize (D-11) ---
    const synthProgress = ctx.ui.progress({ title: 'Synthesizing reviews...', total: 1 });

    const synthesisResult = await ctx.agent.run({
      role: 'planning',
      prompt: buildReviewSynthesizePrompt({
        reviews: successfulReviews.map((r) => ({
          providerId: r.providerId,
          findings: r.outputText,
        })),
        diff,
      }),
      permissions: PLANNING_PERMISSIONS,
      timeout: 120_000,
    });

    synthProgress.update({ completed: 1, message: 'Synthesis complete' });
    synthProgress.done({ summary: 'Synthesis complete' });

    const reviewsContent = synthesisResult.outputText;

    // --- Step 6: Write output ---
    let outputPath: string;
    if (phaseArg) {
      // Write to phase directory
      const phaseDir = await resolvePhaseDir(ctx.cwd, phaseArg);
      if (phaseDir) {
        await mkdir(phaseDir, { recursive: true });
        outputPath = join(phaseDir, 'REVIEWS.md');
      } else {
        // Fallback to .planning/
        const planningDir = join(ctx.cwd, '.planning');
        await mkdir(planningDir, { recursive: true });
        outputPath = join(planningDir, 'REVIEWS.md');
      }
    } else {
      const planningDir = join(ctx.cwd, '.planning');
      await mkdir(planningDir, { recursive: true });
      outputPath = join(planningDir, 'REVIEWS.md');
    }

    await writeFile(outputPath, reviewsContent, 'utf-8');
    ctx.log.info('REVIEWS.md written', { path: outputPath });

    // --- Step 7: Return result ---
    // Count findings from review results (best-effort)
    let findingsCount = 0;
    for (const r of successfulReviews) {
      try {
        const parsed = JSON.parse(r.outputText);
        if (parsed.findings && Array.isArray(parsed.findings)) {
          findingsCount += parsed.findings.length;
        }
      } catch {
        // Non-JSON output -- can't count findings
      }
    }

    const summary = `${successfulReviews.length} providers reviewed, ${findingsCount} findings, REVIEWS.md written`;

    await ctx.ui.result({
      success: true,
      title: 'Review',
      summary,
      details: [
        `Providers: ${successfulReviews.map((r) => r.providerId).join(', ')}`,
        `Output: ${outputPath}`,
        ...(truncated ? ['Note: Diff was truncated at 50,000 chars'] : []),
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    return {
      success: true,
      summary,
      data: {
        providers: successfulReviews.map((r) => r.providerId),
        findingsCount,
        outputPath,
        truncated,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
});
