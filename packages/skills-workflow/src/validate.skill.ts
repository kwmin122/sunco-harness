/**
 * @sunco/skills-workflow - Validate Skill
 *
 * Deterministic test coverage audit. Spawns vitest with v8 coverage,
 * parses Istanbul json-summary output, compares with previous snapshot,
 * and reports pass/fail based on configurable threshold.
 *
 * Requirements: VRF-10, VRF-11
 * Decisions: D-13 (coverage audit), D-14 (delta tracking),
 *   D-15 (snapshot persistence)
 */

import { defineSkill } from '@sunco/core';
import { execFile } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { parseCoverageSummary } from './shared/coverage-parser.js';
import type { CoverageReport } from './shared/verify-types.js';

// ---------------------------------------------------------------------------
// Promisified execFile
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default minimum line coverage percentage for pass/fail */
const DEFAULT_THRESHOLD = 80;

/** Maximum time for vitest coverage run (ms) */
const VITEST_TIMEOUT = 120_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a coverage report as markdown.
 */
function formatReport(report: CoverageReport, threshold: number): string {
  const { overall, delta, uncoveredFiles, files } = report;

  let md = '# Coverage Report\n\n';
  md += `Overall: ${overall.lines.pct}% lines | ${overall.branches.pct}% branches | ${overall.statements.pct}% statements | ${overall.functions.pct}% functions\n`;

  if (delta) {
    const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
    md += `Delta: ${fmt(delta.lines)}% lines | ${fmt(delta.branches)}% branches | ${fmt(delta.statements)}% statements | ${fmt(delta.functions)}% functions\n`;
  }

  md += `Threshold: ${threshold}%\n\n`;

  if (uncoveredFiles.length > 0) {
    md += '## Uncovered Files\n\n';
    for (const f of uncoveredFiles) {
      md += `- ${f} (0% lines)\n`;
    }
    md += '\n';
  }

  if (files.length > 0) {
    md += '## Per-File Coverage\n\n';
    md += '| File | Lines | Branches | Statements | Functions |\n';
    md += '|------|-------|----------|------------|-----------|\n';
    for (const f of files) {
      md += `| ${f.path} | ${f.lines.pct}% | ${f.branches.pct}% | ${f.statements.pct}% | ${f.functions.pct}% |\n`;
    }
  }

  return md;
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.validate',
  command: 'validate',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Run test coverage audit and produce structured report',
  options: [
    { flags: '-t, --threshold <number>', description: 'Minimum line coverage % (default: 80)' },
    { flags: '-p, --phase <number>', description: 'Phase-scoped validation (optional)' },
  ],

  async execute(ctx) {
    // --- Step 0: Entry ---
    await ctx.ui.entry({
      title: 'Validate',
      description: 'Running test coverage audit...',
    });

    const threshold = typeof ctx.args.threshold === 'number'
      ? ctx.args.threshold
      : DEFAULT_THRESHOLD;

    // --- Step 1: Prepare coverage directory ---
    const coverageDir = join(ctx.cwd, '.sun', 'coverage');
    await mkdir(coverageDir, { recursive: true });

    // --- Step 2: Spawn vitest as child process (Pitfall 6) ---
    const progress = ctx.ui.progress({
      title: 'Running vitest coverage...',
      total: 2,
    });

    try {
      await execFileAsync(
        'npx',
        [
          'vitest',
          'run',
          '--coverage.enabled',
          '--coverage.provider=v8',
          '--coverage.reporter=json-summary',
          `--coverage.reportsDirectory=${coverageDir}`,
        ],
        {
          cwd: ctx.cwd,
          timeout: VITEST_TIMEOUT,
        },
      );
    } catch (error) {
      // vitest may exit non-zero if tests fail, but still produce coverage
      ctx.log.warn('Vitest exited with error (coverage may still be available)', {
        error: String(error),
      });
    }

    progress.update({ completed: 1, message: 'Vitest completed' });

    // --- Step 3: Read coverage-summary.json ---
    const summaryPath = join(coverageDir, 'coverage-summary.json');
    let coverageJson: string;

    try {
      coverageJson = await readFile(summaryPath, 'utf-8') as string;
    } catch {
      // Pitfall 3: coverage output not found
      const errorMsg = 'Coverage output not found. Ensure @vitest/coverage-v8 is installed.';

      await ctx.ui.result({
        success: false,
        title: 'Validate',
        summary: errorMsg,
        details: [
          `Expected: ${summaryPath}`,
          'Install: npm install -D @vitest/coverage-v8',
        ],
      });

      progress.done({ summary: 'Failed' });

      return { success: false, summary: errorMsg };
    }

    // --- Step 4: Load previous snapshot from state (D-15) ---
    const previousSnapshot = await ctx.state.get('validate.lastSnapshot') as CoverageReport['overall'] | null;

    // --- Step 5: Parse coverage ---
    const report = parseCoverageSummary(
      coverageJson,
      previousSnapshot ?? undefined,
    );

    // --- Step 6: Save current snapshot to state (D-15) ---
    await ctx.state.set('validate.lastSnapshot', report.overall);

    progress.update({ completed: 2, message: 'Coverage parsed' });

    // --- Step 7: Format report ---
    const markdown = formatReport(report, threshold);
    ctx.log.info('Coverage report generated', {
      lines: report.overall.lines.pct,
      threshold,
    });

    // --- Step 8: Determine pass/fail ---
    const passed = report.overall.lines.pct >= threshold;

    const summary = passed
      ? `Coverage ${report.overall.lines.pct}% passes threshold ${threshold}%`
      : `Coverage ${report.overall.lines.pct}% below threshold ${threshold}%`;

    progress.done({ summary });

    await ctx.ui.result({
      success: passed,
      title: 'Validate',
      summary,
      details: [markdown],
    });

    // --- Step 9: Return structured result ---
    return {
      success: passed,
      summary,
      data: report,
    };
  },
});
