/**
 * @sunco/skills-workflow - Export Skill
 *
 * Generates a self-contained HTML report from .planning/ artifacts.
 * All CSS inlined — zero external dependencies.
 * Reads ROADMAP.md, STATE.md, VERIFICATION.md, SUMMARY.md files.
 *
 * Usage:
 *   sunco export --html
 *   sunco export --html --output ./report.html
 *
 * Requirements: HLS-05
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult, UsageEntry } from '@sunco/core';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRoadmap } from './shared/roadmap-parser.js';
import { parseStateMd } from './shared/state-reader.js';
import type { ParsedPhase, ParsedProgress } from './shared/types.js';

// ---------------------------------------------------------------------------
// HTML Generation
// ---------------------------------------------------------------------------

/**
 * Build the full self-contained HTML report string.
 */
function buildHtml(opts: {
  projectName: string;
  generatedAt: string;
  phases: ParsedPhase[];
  progress: ParsedProgress[];
  state: ReturnType<typeof parseStateMd>;
  phaseDetails: PhaseDetail[];
  costRows: CostRow[];
  timeline: TimelineEntry[];
}): string {
  const { projectName, generatedAt, phases, progress, state, phaseDetails, costRows, timeline } = opts;

  const overallPercent = state.progress.percent;
  const completedPhases = state.progress.completedPhases;
  const totalPhases = state.progress.totalPhases;
  const completedPlans = state.progress.completedPlans;
  const totalPlans = state.progress.totalPlans;

  // Phase table rows
  const phaseRows = phases
    .map((phase) => {
      const prog = progress.find((p) => String(p.phaseNumber) === String(phase.number));
      const plansComplete = prog ? prog.plansComplete : phase.plans.filter((pl) => pl.completed).length;
      const plansTotal = prog?.plansTotal ?? phase.planCount ?? phase.plans.length;
      const statusLabel = phase.completed
        ? 'Complete'
        : prog?.status
          ? prog.status
          : 'Not Started';
      const statusClass = phase.completed
        ? 'status-complete'
        : statusLabel.toLowerCase().includes('progress')
          ? 'status-in-progress'
          : 'status-not-started';

      const isCurrent =
        state.phase !== null && String(state.phase) === String(phase.number);
      const rowClass = isCurrent ? ' class="current-phase"' : '';

      return `    <tr${rowClass}>
      <td class="phase-num">${phase.number}</td>
      <td class="phase-name">${escapeHtml(phase.name)}${isCurrent ? ' <span class="badge">current</span>' : ''}</td>
      <td class="phase-plans">${plansComplete}/${plansTotal !== null ? plansTotal : '?'}</td>
      <td class="phase-desc">${escapeHtml(phase.description)}</td>
      <td><span class="${statusClass}">${escapeHtml(statusLabel)}</span></td>
    </tr>`;
    })
    .join('\n');

  // Phase detail cards
  const detailCards = phaseDetails
    .map((detail) => {
      const verificationHtml = detail.verification
        ? `<div class="artifact">
        <h4>Verification</h4>
        <pre class="artifact-body">${escapeHtml(detail.verification)}</pre>
      </div>`
        : '';
      const summaryHtml = detail.summary
        ? `<div class="artifact">
        <h4>Summary</h4>
        <pre class="artifact-body">${escapeHtml(detail.summary)}</pre>
      </div>`
        : '';
      if (!verificationHtml && !summaryHtml) return '';
      return `  <div class="phase-detail">
    <h3>Phase ${escapeHtml(String(detail.phaseNumber))}: ${escapeHtml(detail.phaseName)}</h3>
    ${verificationHtml}
    ${summaryHtml}
  </div>`;
    })
    .filter(Boolean)
    .join('\n');

  // Cost table rows
  const costTableRows =
    costRows.length > 0
      ? costRows
          .map(
            (row) =>
              `    <tr><td>${escapeHtml(row.skillId)}</td><td class="cost-value">$${row.costUsd.toFixed(4)}</td></tr>`,
          )
          .join('\n')
      : '';

  const costSection =
    costRows.length > 0
      ? `<section class="section">
  <h2>Cost Summary</h2>
  <table class="data-table">
    <thead><tr><th>Skill</th><th>Cost (USD)</th></tr></thead>
    <tbody>
${costTableRows}
    </tbody>
  </table>
</section>`
      : '';

  // Timeline rows
  const timelineRows = timeline
    .map(
      (entry) =>
        `    <tr>
      <td class="commit-hash">${escapeHtml(entry.hash)}</td>
      <td class="commit-date">${escapeHtml(entry.date)}</td>
      <td>${escapeHtml(entry.message)}</td>
    </tr>`,
    )
    .join('\n');

  const timelineSection =
    timeline.length > 0
      ? `<section class="section">
  <h2>Recent Timeline</h2>
  <table class="data-table timeline-table">
    <thead><tr><th>Commit</th><th>Date</th><th>Message</th></tr></thead>
    <tbody>
${timelineRows}
    </tbody>
  </table>
</section>`
      : '';

  const detailsSection =
    detailCards
      ? `<section class="section">
  <h2>Phase Details</h2>
${detailCards}
</section>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(projectName)} — Project Report</title>
  <style>
    /* =========================================================
       SUNCO Project Report — Self-contained stylesheet
       Dark/light mode, print-friendly, CSS grid layout
    ========================================================= */

    :root {
      --bg: #ffffff;
      --bg-card: #f8f9fa;
      --bg-code: #f1f3f5;
      --border: #dee2e6;
      --text: #212529;
      --text-muted: #6c757d;
      --text-head: #343a40;
      --accent: #4263eb;
      --accent-light: #e7f5ff;
      --green: #2f9e44;
      --green-bg: #ebfbee;
      --yellow: #e67700;
      --yellow-bg: #fff3bf;
      --gray-bg: #f1f3f5;
      --gray-text: #868e96;
      --badge-bg: #4263eb;
      --badge-text: #ffffff;
      --progress-track: #dee2e6;
      --progress-fill: #4263eb;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1a1b1e;
        --bg-card: #25262b;
        --bg-code: #2c2e33;
        --border: #373a40;
        --text: #c1c2c5;
        --text-muted: #909296;
        --text-head: #e9ecef;
        --accent: #748ffc;
        --accent-light: #1e2460;
        --green: #40c057;
        --green-bg: #1a3a24;
        --yellow: #fab005;
        --yellow-bg: #3a2a00;
        --gray-bg: #2c2e33;
        --gray-text: #909296;
        --badge-bg: #748ffc;
        --badge-text: #1a1b1e;
        --progress-track: #373a40;
        --progress-fill: #748ffc;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
    }

    /* ---- Layout ---- */
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* ---- Header ---- */
    .report-header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }

    .report-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-head);
      letter-spacing: -0.02em;
    }

    .report-meta {
      margin-top: 0.5rem;
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    /* ---- Progress bar ---- */
    .progress-wrap {
      margin: 1.5rem 0;
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.3rem;
    }

    .progress-track {
      height: 8px;
      background: var(--progress-track);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--progress-fill);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    /* ---- Stats grid ---- */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-head);
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 0.2rem;
    }

    /* ---- Sections ---- */
    .section {
      margin-bottom: 2.5rem;
    }

    .section h2 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-head);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid var(--border);
    }

    /* ---- Tables ---- */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .data-table th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-head);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .data-table td {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      vertical-align: top;
    }

    .data-table tr.current-phase td {
      background: var(--accent-light);
    }

    .data-table tr:hover td {
      background: var(--bg-card);
    }

    .data-table tr.current-phase:hover td {
      background: var(--accent-light);
    }

    .phase-num {
      font-variant-numeric: tabular-nums;
      color: var(--text-muted);
      width: 3rem;
    }

    .phase-name {
      font-weight: 500;
      color: var(--text-head);
    }

    .phase-plans {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      width: 6rem;
    }

    .phase-desc {
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    /* ---- Status badges ---- */
    .status-complete {
      color: var(--green);
      background: var(--green-bg);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-in-progress {
      color: var(--yellow);
      background: var(--yellow-bg);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-not-started {
      color: var(--gray-text);
      background: var(--gray-bg);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .badge {
      display: inline-block;
      background: var(--badge-bg);
      color: var(--badge-text);
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      vertical-align: middle;
    }

    /* ---- Phase detail cards ---- */
    .phase-detail {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1rem;
      background: var(--bg-card);
    }

    .phase-detail h3 {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-head);
      margin-bottom: 0.75rem;
    }

    .artifact {
      margin-top: 0.75rem;
    }

    .artifact h4 {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }

    .artifact-body {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.78rem;
      background: var(--bg-code);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.75rem;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 300px;
      overflow-y: auto;
      color: var(--text);
    }

    /* ---- Cost table ---- */
    .cost-value {
      font-variant-numeric: tabular-nums;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    }

    /* ---- Timeline table ---- */
    .timeline-table {
      font-size: 0.8rem;
    }

    .commit-hash {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      color: var(--accent);
      width: 6rem;
      white-space: nowrap;
    }

    .commit-date {
      white-space: nowrap;
      color: var(--text-muted);
      width: 10rem;
    }

    /* ---- Footer ---- */
    .report-footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: center;
    }

    /* ---- Print styles ---- */
    @media print {
      body { font-size: 12px; }
      .container { max-width: 100%; padding: 0; }
      .artifact-body { max-height: none; overflow: visible; }
      .data-table tr:hover td { background: inherit; }
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <header class="report-header">
      <div class="report-title">${escapeHtml(projectName)}</div>
      <div class="report-meta">Generated ${escapeHtml(generatedAt)} · SUNCO Project Report</div>

      <!-- Overall progress bar -->
      <div class="progress-wrap">
        <div class="progress-label">
          <span>Overall Progress</span>
          <span>${overallPercent}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${overallPercent}%"></div>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${completedPhases}/${totalPhases}</div>
          <div class="stat-label">Phases Complete</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${completedPlans}/${totalPlans}</div>
          <div class="stat-label">Plans Complete</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${state.phase ?? '—'}</div>
          <div class="stat-label">Current Phase</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${escapeHtml(state.status || '—')}</div>
          <div class="stat-label">Status</div>
        </div>
      </div>
    </header>

    <!-- Phase Progress Table -->
    <section class="section">
      <h2>Phase Progress</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Phase</th>
            <th>Plans</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
${phaseRows}
        </tbody>
      </table>
    </section>

    <!-- Phase Details (verification + summary artifacts) -->
    ${detailsSection}

    <!-- Cost Summary -->
    ${costSection}

    <!-- Timeline -->
    ${timelineSection}

    <footer class="report-footer">
      SUNCO &mdash; ${escapeHtml(projectName)} &mdash; ${escapeHtml(generatedAt)}
    </footer>

  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Data Gathering
// ---------------------------------------------------------------------------

interface PhaseDetail {
  phaseNumber: number | string;
  phaseName: string;
  verification: string | null;
  summary: string | null;
}

interface CostRow {
  skillId: string;
  costUsd: number;
}

interface TimelineEntry {
  hash: string;
  date: string;
  message: string;
}

/**
 * Scan phase directories under .planning/ for VERIFICATION.md and SUMMARY.md.
 */
async function scanPhaseArtifacts(
  planningDir: string,
  phases: ParsedPhase[],
): Promise<PhaseDetail[]> {
  const details: PhaseDetail[] = [];

  let entries: string[] = [];
  try {
    entries = await readdir(planningDir);
  } catch {
    return details;
  }

  // Match directories like "01-core-platform", "13-headless-cicd", etc.
  const phaseDirRe = /^(\d+(?:\.\d+)?)-/;

  for (const entry of entries) {
    const match = phaseDirRe.exec(entry);
    if (!match) continue;

    const phaseNum = match[1];
    const phase = phases.find((p) => String(p.number) === phaseNum);
    if (!phase) continue;

    const phaseDir = join(planningDir, entry);

    const verificationPath = join(phaseDir, 'VERIFICATION.md');
    const summaryPath = join(phaseDir, 'SUMMARY.md');

    const [verification, summary] = await Promise.all([
      readFile(verificationPath, 'utf-8').catch(() => null),
      readFile(summaryPath, 'utf-8').catch(() => null),
    ]);

    if (verification || summary) {
      details.push({
        phaseNumber: phase.number,
        phaseName: phase.name,
        verification: verification ? verification.trim().slice(0, 2000) : null,
        summary: summary ? summary.trim().slice(0, 2000) : null,
      });
    }
  }

  return details;
}

/**
 * Read git log (last 50 commits) via child_process.
 */
async function readGitTimeline(cwd: string): Promise<TimelineEntry[]> {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync(
      'git',
      ['log', '--oneline', '--format=%h|%ai|%s', '-50'],
      { cwd },
    );

    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, date, ...rest] = line.split('|');
        return {
          hash: (hash ?? '').trim(),
          date: (date ?? '').trim().slice(0, 19).replace('T', ' '),
          message: rest.join('|').trim(),
        };
      });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.export',
  command: 'export',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Generate a self-contained HTML project report from .planning/ artifacts',
  options: [
    { flags: '--html', description: 'Generate HTML report (required)' },
    { flags: '--output <path>', description: 'Override default output path' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({ title: 'Export', description: 'Generating project report' });

    const isHtml = ctx.args.html as boolean | undefined;
    if (!isHtml) {
      return {
        success: false,
        summary: 'No format specified. Use --html to generate an HTML report.',
      };
    }

    // -----------------------------------------------------------------------
    // Read .planning/ artifacts
    // -----------------------------------------------------------------------
    const planningDir = join(ctx.cwd, '.planning');
    const roadmapPath = join(planningDir, 'ROADMAP.md');
    const statePath = join(planningDir, 'STATE.md');

    const [roadmapContent, stateContent] = await Promise.all([
      readFile(roadmapPath, 'utf-8').catch(() => null),
      readFile(statePath, 'utf-8').catch(() => null),
    ]);

    if (!roadmapContent && !stateContent) {
      return {
        success: false,
        summary: 'No .planning/ directory found. Run sunco new or sunco scan first.',
      };
    }

    const { phases, progress } = parseRoadmap(roadmapContent ?? '');
    const state = parseStateMd(stateContent ?? '');

    // -----------------------------------------------------------------------
    // Scan phase directories for VERIFICATION.md / SUMMARY.md
    // -----------------------------------------------------------------------
    const phaseDetails = await scanPhaseArtifacts(planningDir, phases);

    // -----------------------------------------------------------------------
    // Cost data from usage history in state
    // -----------------------------------------------------------------------
    const costRows: CostRow[] = [];
    const usageHistory = (await ctx.state.get<UsageEntry[]>('usage.history')) ?? null;
    if (usageHistory && usageHistory.length > 0) {
      const bySkill = new Map<string, number>();
      for (const entry of usageHistory) {
        bySkill.set(entry.skillId, (bySkill.get(entry.skillId) ?? 0) + entry.costUsd);
      }
      for (const [skillId, costUsd] of [...bySkill.entries()].sort((a, b) => b[1] - a[1])) {
        costRows.push({ skillId, costUsd });
      }
    }

    // -----------------------------------------------------------------------
    // Git timeline
    // -----------------------------------------------------------------------
    const timeline = await readGitTimeline(ctx.cwd);

    // -----------------------------------------------------------------------
    // Determine output path
    // -----------------------------------------------------------------------
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const defaultDir = join(ctx.cwd, '.sun', 'reports');
    const defaultPath = join(defaultDir, `${datePart}-report.html`);
    const outputPath = (ctx.args.output as string | undefined) ?? defaultPath;

    // Ensure output directory exists
    const outputDir = outputPath.includes('/')
      ? outputPath.slice(0, outputPath.lastIndexOf('/'))
      : '.';
    await mkdir(outputDir, { recursive: true });

    // -----------------------------------------------------------------------
    // Derive project name from cwd (last segment)
    // -----------------------------------------------------------------------
    const cwdParts = ctx.cwd.replace(/\\/g, '/').split('/');
    const projectName = cwdParts[cwdParts.length - 1] ?? 'Project';

    const generatedAt = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    // -----------------------------------------------------------------------
    // Generate HTML
    // -----------------------------------------------------------------------
    const html = buildHtml({
      projectName,
      generatedAt,
      phases,
      progress,
      state,
      phaseDetails,
      costRows,
      timeline,
    });

    await writeFile(outputPath, html, 'utf-8');

    const summary = `Report written to ${outputPath}`;

    await ctx.ui.result({
      success: true,
      title: 'Export',
      summary,
      details: [`File: ${outputPath}`, `Phases: ${phases.length}`, `Phase details: ${phaseDetails.length}`, `Timeline entries: ${timeline.length}`],
    });

    return {
      success: true,
      summary,
      data: { outputPath, phases: phases.length, phaseDetails: phaseDetails.length },
    };
  },
});
