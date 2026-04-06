/**
 * @sunco/skills-workflow - Resume Skill
 *
 * Reads HANDOFF.json, displays a summary of where the session left off,
 * validates the environment (branch matching), and recommends next action.
 *
 * Commands:
 *   sunco resume -- restore and validate previous session
 *
 * Decisions: D-18 (resume validates environment), D-21 (flat JSON format)
 * Requirements: SES-04
 */

import { defineSkill } from '@sunco/core';
import { readHandoff } from './shared/handoff.js';
import { captureGitState } from './shared/git-state.js';

export default defineSkill({
  id: 'workflow.resume',
  command: 'resume',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Restore and validate a paused session',

  async execute(ctx) {
    await ctx.ui.entry({ title: 'Resume', description: 'Restoring session...' });

    // Read HANDOFF.json
    const handoff = await readHandoff(ctx.fileStore);

    if (!handoff) {
      await ctx.ui.result({
        success: false,
        title: 'Resume',
        summary: 'No HANDOFF.json found. Nothing to resume.',
      });
      return {
        success: false,
        summary: 'No HANDOFF.json found. Nothing to resume.',
      };
    }

    // Validate environment per D-18
    const currentGit = await captureGitState(ctx.cwd);
    const warnings: string[] = [];

    if (handoff.branch !== currentGit.branch) {
      warnings.push(
        `Branch mismatch: session was on '${handoff.branch}', now on '${currentGit.branch}'`,
      );
    }

    // Build display sections
    const lines: string[] = [
      `Session from: ${handoff.timestamp}`,
      `Phase: ${handoff.currentPhase ?? 'unknown'}${handoff.currentPhaseName ? ` (${handoff.currentPhaseName})` : ''}`,
      `Plan: ${handoff.currentPlan ?? 'unknown'}`,
    ];

    // Phase 17: Context Intelligence info
    if (handoff.contextZone) {
      lines.push(`Context zone at pause: ${handoff.contextZone}`);
    }

    if (handoff.resumeCommand) {
      lines.push(`Resume command: ${handoff.resumeCommand}`);
    }

    lines.push(
      '',
      '--- Git State ---',
      `Branch: ${handoff.branch}`,
      `Uncommitted: ${handoff.uncommittedChanges ? `${handoff.uncommittedFiles.length} file(s)` : 'none'}`,
    );

    // Modified files from session
    if (handoff.modifiedFiles && handoff.modifiedFiles.length > 0) {
      lines.push('', '--- Modified Files ---');
      for (const f of handoff.modifiedFiles.slice(0, 10)) {
        lines.push(`  - ${f}`);
      }
      if (handoff.modifiedFiles.length > 10) {
        lines.push(`  ... and ${handoff.modifiedFiles.length - 10} more`);
      }
    }

    // Add pending decisions/blockers if any
    if (handoff.pendingDecisions.length > 0) {
      lines.push('', '--- Pending Decisions ---');
      for (const d of handoff.pendingDecisions) {
        lines.push(`  - ${d}`);
      }
    }

    if (handoff.blockers.length > 0) {
      lines.push('', '--- Blockers ---');
      for (const b of handoff.blockers) {
        lines.push(`  - ${b}`);
      }
    }

    // Last decisions from context
    if (handoff.lastDecisions && handoff.lastDecisions.length > 0) {
      lines.push('', '--- Recent Decisions ---');
      for (const d of handoff.lastDecisions.slice(0, 5)) {
        lines.push(`  - ${d}`);
      }
    }

    // Add warnings if any
    if (warnings.length > 0) {
      lines.push('', '--- Warnings ---');
      for (const w of warnings) {
        lines.push(`  ! ${w}`);
      }
    }

    await ctx.ui.result({
      success: true,
      title: 'Session Restored',
      summary: 'Session restored.',
      details: lines,
    });

    return {
      success: true,
      summary: 'Session restored.',
      data: handoff,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
});
