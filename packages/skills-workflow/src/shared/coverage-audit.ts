/**
 * @sunco/skills-workflow - Coverage Audit Shared Module
 *
 * Pure module extracted from validate.skill.ts (Phase 33 Wave 1).
 * No SkillContext dependency — accepts cwd + state as inputs.
 *
 * Phase 33 Wave 1: validate.skill.ts deleted — logic lives here, consumed by verify.skill.ts
 */

import { execFile } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import type { StateApi } from '@sunco/core';
import { parseCoverageSummary } from './coverage-parser.js';
import type { CoverageReport } from './verify-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

/** Default minimum line coverage percentage for pass/fail */
const DEFAULT_THRESHOLD = 80;

/** Maximum time for vitest coverage run (ms) */
const VITEST_TIMEOUT = 120_000;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface CoverageAuditInput {
  cwd: string;
  state: StateApi;
  threshold?: number;
}

export interface CoverageAuditOutput {
  ok: boolean;
  output: string;
  meta: {
    report: CoverageReport;
    threshold: number;
    passed: boolean;
    summary: string;
  };
}

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
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Run test coverage audit: spawn vitest, parse results, compare with snapshot.
 * Returns structured output suitable for embedding in verify's result.
 */
export async function runCoverageAudit(input: CoverageAuditInput): Promise<CoverageAuditOutput> {
  const { cwd, state } = input;
  const threshold = input.threshold ?? DEFAULT_THRESHOLD;

  // Prepare coverage directory
  const coverageDir = join(cwd, '.sun', 'coverage');
  await mkdir(coverageDir, { recursive: true });

  // Spawn vitest as child process
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
        cwd,
        timeout: VITEST_TIMEOUT,
      },
    );
  } catch {
    // vitest may exit non-zero if tests fail, but still produce coverage
  }

  // Read coverage-summary.json
  const summaryPath = join(coverageDir, 'coverage-summary.json');
  let coverageJson: string;

  try {
    coverageJson = await readFile(summaryPath, 'utf-8');
  } catch {
    const errorMsg = 'Coverage output not found. Ensure @vitest/coverage-v8 is installed.';
    return {
      ok: false,
      output: errorMsg,
      meta: {
        report: {
          overall: { lines: { pct: 0 }, branches: { pct: 0 }, statements: { pct: 0 }, functions: { pct: 0 } },
          delta: null,
          uncoveredFiles: [],
          files: [],
        } as unknown as CoverageReport,
        threshold,
        passed: false,
        summary: errorMsg,
      },
    };
  }

  // Load previous snapshot from state (delta tracking)
  const previousSnapshot = await state.get('validate.lastSnapshot') as CoverageReport['overall'] | null;

  // Parse coverage
  const report = parseCoverageSummary(coverageJson, previousSnapshot ?? undefined);

  // Save current snapshot to state
  await state.set('validate.lastSnapshot', report.overall);

  // Format report
  const markdown = formatReport(report, threshold);

  // Determine pass/fail
  const passed = report.overall.lines.pct >= threshold;
  const summary = passed
    ? `Coverage ${report.overall.lines.pct}% passes threshold ${threshold}%`
    : `Coverage ${report.overall.lines.pct}% below threshold ${threshold}%`;

  return {
    ok: passed,
    output: markdown,
    meta: {
      report,
      threshold,
      passed,
      summary,
    },
  };
}
