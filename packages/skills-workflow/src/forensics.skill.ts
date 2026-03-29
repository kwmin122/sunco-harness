/**
 * @sunco/skills-workflow - Forensics Skill: Agent-powered workflow post-mortem
 *
 * Reconstructs a timeline of workflow events, identifies the divergence point,
 * and provides prevention recommendations based on post-mortem analysis.
 *
 * Requirements: DBG-03
 * Decisions: D-09 (forensics scope), D-10 (ForensicsReport structure),
 *   D-11 (kind: prompt), D-12 (session selection)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult, PermissionSet } from '@sunco/core';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildForensicsPostmortemPrompt } from './prompts/forensics-postmortem.js';
import { resolvePhaseDir } from './shared/phase-reader.js';
import type { ForensicsReport } from './shared/debug-types.js';

// ---------------------------------------------------------------------------
// Permissions (purely read-only)
// ---------------------------------------------------------------------------

const FORENSICS_PERMISSIONS: PermissionSet = {
  role: 'verification',
  readPaths: ['**'],
  writePaths: [],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

// ---------------------------------------------------------------------------
// JSON parser helper (same pattern as debug.skill.ts)
// ---------------------------------------------------------------------------

/**
 * Parse agent output into ForensicsReport.
 *
 * Tries extracting from the last JSON code block first.
 * Falls back to parsing the entire output as JSON.
 * Returns null if parsing fails.
 */
function parseForensicsOutput(output: string): ForensicsReport | null {
  if (!output || !output.trim()) return null;

  // Try extracting JSON from the last code block
  const codeBlockMatches = [...output.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)];
  if (codeBlockMatches.length > 0) {
    const lastMatch = codeBlockMatches[codeBlockMatches.length - 1]!;
    try {
      return JSON.parse(lastMatch[1]!) as ForensicsReport;
    } catch {
      // Fall through to raw parse
    }
  }

  // Try parsing the entire output as JSON
  try {
    return JSON.parse(output.trim()) as ForensicsReport;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read all files matching a suffix from a directory, concatenated with headers.
 */
async function readFilesWithSuffix(dir: string, suffix: string): Promise<string> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return '';
  }

  const matched = entries.filter((e) => e.endsWith(suffix)).sort();
  if (matched.length === 0) return '';

  const parts: string[] = [];
  for (const filename of matched) {
    try {
      const content = await readFile(join(dir, filename), 'utf-8');
      parts.push(`--- ${filename} ---\n${content}`);
    } catch {
      parts.push(`--- ${filename} --- [read error]`);
    }
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.forensics',
  command: 'forensics',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Reconstruct workflow timeline and perform post-mortem analysis',
  options: [
    { flags: '-p, --phase <number>', description: 'Which phase to analyze (required)' },
    { flags: '--session <id>', description: 'Specific session to analyze (default: most recent)' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Forensics',
      description: 'Reconstructing workflow timeline...',
    });

    // --- Validate --phase ---
    const phaseArg = ctx.args.phase as number | undefined;
    if (phaseArg === undefined) {
      const msg = 'Usage: sunco forensics --phase <number>';
      await ctx.ui.result({ success: false, title: 'Forensics', summary: msg });
      return { success: false, summary: msg };
    }

    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseArg);
    if (!phaseDir) {
      const msg = `Phase ${phaseArg} directory not found`;
      await ctx.ui.result({ success: false, title: 'Forensics', summary: msg });
      return { success: false, summary: msg };
    }

    const progress = ctx.ui.progress({
      title: 'Gathering forensics data',
      total: 5,
    });

    // --- Step 1: Gather git history ---
    let gitHistory = '';
    try {
      const git = simpleGit(ctx.cwd);
      const log = await git.log({ maxCount: 100 });
      gitHistory = [...log.all]
        .reverse()
        .map((c: { hash: string; date: string; message: string }) => `${c.hash.slice(0, 7)} ${c.date} ${c.message}`)
        .join('\n');
    } catch {
      gitHistory = '[git history unavailable]';
    }
    progress.update({ completed: 1, message: 'Git history gathered' });

    // --- Step 2: Gather plan files ---
    const planFiles = await readFilesWithSuffix(phaseDir, '-PLAN.md');
    progress.update({ completed: 2, message: 'Plan files gathered' });

    // --- Step 3: Gather summary files ---
    const summaryFiles = await readFilesWithSuffix(phaseDir, '-SUMMARY.md');
    progress.update({ completed: 3, message: 'Summary files gathered' });

    // --- Step 4: Gather verification reports ---
    const verificationReports = await readFilesWithSuffix(phaseDir, '-VERIFICATION.md');
    // Also check for single VERIFICATION.md
    let singleVerification = '';
    try {
      singleVerification = await readFile(join(phaseDir, 'VERIFICATION.md'), 'utf-8');
    } catch {
      // No single verification file
    }
    const allVerificationReports = [verificationReports, singleVerification]
      .filter(Boolean)
      .join('\n\n');
    progress.update({ completed: 4, message: 'Verification reports gathered' });

    // --- Step 5: Gather state history ---
    let stateHistory = '';
    try {
      stateHistory = await readFile(join(ctx.cwd, '.planning', 'STATE.md'), 'utf-8');
    } catch {
      stateHistory = '[STATE.md not found]';
    }

    // If --session provided, note it in the state context
    const sessionArg = ctx.args.session as string | undefined;
    if (sessionArg) {
      stateHistory += `\n\n--- Requested session: ${sessionArg} ---`;
    }
    progress.update({ completed: 5, message: 'State history gathered' });
    progress.done({ summary: 'All forensics data gathered' });

    // --- Build prompt ---
    const prompt = buildForensicsPostmortemPrompt({
      gitHistory,
      planFiles,
      summaryFiles,
      verificationReports: allVerificationReports,
      stateHistory,
    });

    // --- Dispatch agent (longer timeout for deep analysis) ---
    const result = await ctx.agent.run({
      role: 'verification',
      prompt,
      permissions: FORENSICS_PERMISSIONS,
      timeout: 180_000,
    });

    // --- Parse result ---
    const report = parseForensicsOutput(result.outputText);

    if (!report) {
      // Graceful degradation
      const summary = `Forensics analysis completed (unstructured): ${result.outputText.slice(0, 300)}`;
      await ctx.state.set('forensics.lastResult', {
        phase: phaseArg,
        timestamp: new Date().toISOString(),
        raw: result.outputText,
      });

      await ctx.ui.result({
        success: true,
        title: 'Forensics',
        summary,
        details: ['Agent output could not be parsed as structured JSON', 'Raw output stored in state'],
      });

      return {
        success: true,
        summary,
        data: { raw: result.outputText },
        warnings: ['Agent output was not parseable as ForensicsReport JSON'],
      };
    }

    // --- Write report to .sun/forensics/ ---
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const padded = String(phaseArg).padStart(2, '0');
    const forensicsDir = join(ctx.cwd, '.sun', 'forensics');
    const reportFilename = `phase-${padded}-${timestamp}.md`;
    const reportPath = join(forensicsDir, reportFilename);

    try {
      await mkdir(forensicsDir, { recursive: true });

      const reportMd = formatForensicsReport(report, phaseArg);
      await writeFile(reportPath, reportMd, 'utf-8');
      ctx.log.info('Forensics report written', { path: reportPath });
    } catch (err) {
      ctx.log.warn('Failed to write forensics report', { error: String(err) });
    }

    // --- Store in state ---
    await ctx.state.set('forensics.lastResult', {
      phase: phaseArg,
      timestamp,
      verdict: report.root_cause_hypothesis,
    });

    // --- Format output ---
    const summary = `Phase ${phaseArg}: ${report.timeline.length} events, divergence at "${report.divergence_point.slice(0, 100)}"`;

    await ctx.ui.result({
      success: true,
      title: 'Forensics',
      summary,
      details: [
        `Timeline events: ${report.timeline.length}`,
        `Divergence point: ${report.divergence_point}`,
        `Root cause: ${report.root_cause_hypothesis}`,
        `Affected plans: ${report.affected_plans.join(', ') || 'none'}`,
        `Prevention recommendations: ${report.prevention_recommendations.length}`,
        `Report: ${reportPath}`,
      ],
    });

    return {
      success: true,
      summary,
      data: report,
    };
  },
});

// ---------------------------------------------------------------------------
// Report formatter
// ---------------------------------------------------------------------------

/**
 * Format a ForensicsReport as markdown for file output.
 */
function formatForensicsReport(report: ForensicsReport, phase: number): string {
  const lines: string[] = [];

  lines.push(`# Forensics Report: Phase ${phase}`);
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  // Timeline
  lines.push('## Timeline');
  lines.push('');
  if (report.timeline.length > 0) {
    lines.push('| Timestamp | Event | Source |');
    lines.push('|-----------|-------|--------|');
    for (const entry of report.timeline) {
      lines.push(`| ${entry.timestamp} | ${entry.event} | ${entry.source} |`);
    }
  } else {
    lines.push('No timeline events reconstructed.');
  }
  lines.push('');

  // Divergence
  lines.push('## Divergence Point');
  lines.push('');
  lines.push(report.divergence_point);
  lines.push('');

  // Root Cause
  lines.push('## Root Cause Hypothesis');
  lines.push('');
  lines.push(report.root_cause_hypothesis);
  lines.push('');

  // Affected Plans
  lines.push('## Affected Plans');
  lines.push('');
  if (report.affected_plans.length > 0) {
    for (const plan of report.affected_plans) {
      lines.push(`- ${plan}`);
    }
  } else {
    lines.push('No specific plans identified.');
  }
  lines.push('');

  // Prevention
  lines.push('## Prevention Recommendations');
  lines.push('');
  if (report.prevention_recommendations.length > 0) {
    for (const rec of report.prevention_recommendations) {
      lines.push(`- ${rec}`);
    }
  } else {
    lines.push('No recommendations generated.');
  }
  lines.push('');

  lines.push('---');
  lines.push(`*Generated by sunco forensics at ${new Date().toISOString()}*`);

  return lines.join('\n');
}
