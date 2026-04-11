/**
 * @sunco/skills-workflow - Status & Progress Skills
 *
 * Home screen view of project state.
 * - sunco status: formatted phase table with colored indicators
 * - sunco progress: alias to status (D-03, WF-08)
 *
 * Reads ROADMAP.md + STATE.md via fs (project root files, not FileStore).
 * Displays current phase position, plan progress, and next recommendation.
 *
 * Requirements: SES-01, WF-08
 * Decisions: D-01 (status = home screen), D-02 (next best action),
 * D-03 (progress = alias), D-04 (colored indicators)
 */

import { defineSkill, readActiveWork, DEFAULT_ACTIVE_WORK } from '@sunco/core';
import type { SkillContext, SkillResult, UsageEntry, ActiveWork } from '@sunco/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { parseRoadmap } from './shared/roadmap-parser.js';
import { parseStateMd } from './shared/state-reader.js';
import type { ParsedPhase, ParsedProgress } from './shared/types.js';

// ---------------------------------------------------------------------------
// Status Indicators (D-04)
// ---------------------------------------------------------------------------

const INDICATOR_COMPLETE = chalk.green('\u2713'); // green checkmark
const INDICATOR_IN_PROGRESS = chalk.yellow('\u25B6'); // yellow arrow
const INDICATOR_NOT_STARTED = chalk.gray('\u2500'); // gray dash

// ---------------------------------------------------------------------------
// Shared Execute Function
// ---------------------------------------------------------------------------

/**
 * Execute function for statusSkill (and the progress alias).
 * Reads .planning/ROADMAP.md and .planning/STATE.md, then displays
 * a formatted overview or JSON output.
 */
async function executeStatus(ctx: SkillContext): Promise<SkillResult> {
  // --live flag: open the read-only dashboard TUI (DASH-01)
  if (ctx.args.live === true) {
    const { renderDashboardTui } = await import('./dashboard-tui.js');
    await renderDashboardTui(ctx.cwd);
    return { success: true, summary: 'Dashboard TUI exited' };
  }

  await ctx.ui.entry({ title: 'Status', description: 'Project overview' });

  // Read planning files from project root
  const roadmapPath = join(ctx.cwd, '.planning', 'ROADMAP.md');
  const statePath = join(ctx.cwd, '.planning', 'STATE.md');

  const roadmapContent = await readFile(roadmapPath, 'utf-8').catch(() => null);
  const stateContent = await readFile(statePath, 'utf-8').catch(() => null);

  // Both missing = no .planning/ directory
  if (!roadmapContent && !stateContent) {
    return {
      success: false,
      summary: 'No .planning/ directory found. Run sunco new or sunco scan first.',
    };
  }

  // Parse available data
  const { phases, progress } = parseRoadmap(roadmapContent ?? '');
  const state = parseStateMd(stateContent ?? '');

  // --json flag: return raw data (absorbs query skill, Phase 33 Wave 1)
  // D-09: snapshot === 'query' → emit query-native shape (backcompat for alias path)
  //        json === true (no snapshot) → emit superset { status: {...}, query: {...} }
  const isJson = ctx.args.json as boolean | undefined;
  const snapshot = ctx.args.snapshot as string | undefined;
  if (isJson === true || snapshot === 'query') {
    const { buildQuerySnapshot } = await import('./shared/query-snapshot.js');
    const querySummary = `Phase ${state.phase ?? '?'}, ${state.progress.completedPlans}/${state.progress.totalPlans} plans`;
    if (snapshot === 'query') {
      // Alias path: emit query-native shape only (backcompat for `sunco query` parsers)
      const querySnapshot = await buildQuerySnapshot(ctx.cwd, ctx.state);
      return {
        success: true,
        summary: querySummary,
        data: querySnapshot,
      };
    } else {
      // New --json path: emit superset containing both status and query views
      const querySnapshot = await buildQuerySnapshot(ctx.cwd, ctx.state);
      const statusView = { phases, progress, state };
      return {
        success: true,
        summary: `Phase ${state.phase ?? '?'} | ${state.progress.completedPlans}/${state.progress.totalPlans} plans`,
        data: { status: statusView, query: querySnapshot },
      };
    }
  }

  // --brief flag: decisions/blockers only (absorbs context skill, Phase 33 Wave 1)
  if (ctx.args.brief === true) {
    const { renderContextView } = await import('./shared/context-view.js');
    const view = await renderContextView({ cwd: ctx.cwd, state: ctx.state, recommend: ctx.recommend });
    await ctx.ui.result({
      success: view.success,
      title: 'Project Context',
      summary: view.summary,
      details: view.details,
      recommendations: view.recommendations,
    });
    return {
      success: view.success,
      summary: view.summary,
    };
  }

  // Build formatted display
  const lines = buildDisplayLines(phases, progress, state);

  // Active-work dashboard sections (Phase 27)
  const activeWork = await readActiveWork(ctx.cwd);
  if (activeWork.updated_at !== DEFAULT_ACTIVE_WORK.updated_at) {
    appendActiveWorkSections(lines, activeWork);
  }

  // Cost tracking from usage history in state
  const usageHistory = (await ctx.state.get<UsageEntry[]>('usage.history')) ?? null;
  if (usageHistory && usageHistory.length > 0) {
    // Per-skill cost breakdown
    const bySkill = new Map<string, number>();
    let totalCost = 0;
    for (const entry of usageHistory) {
      bySkill.set(entry.skillId, (bySkill.get(entry.skillId) ?? 0) + entry.costUsd);
      totalCost += entry.costUsd;
    }

    lines.push('Cost breakdown:');
    for (const [skill, cost] of [...bySkill.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${skill}: $${cost.toFixed(4)}`);
    }
    lines.push(`  Total: $${totalCost.toFixed(4)}`);
    lines.push('');
  }

  // Get recommendations for "Next Best Action"
  const recommendations = ctx.recommend.getRecommendations({
    lastSkillId: 'workflow.status',
    lastResult: { success: true },
    projectState: {},
    activeSkills: new Set(),
  });

  const summary = buildSummaryLine(state, phases);

  await ctx.ui.result({
    success: true,
    title: 'Project Status',
    summary,
    details: lines,
    recommendations,
  });

  return {
    success: true,
    summary,
    data: { phases, progress, state },
  };
}

// ---------------------------------------------------------------------------
// Display Builders
// ---------------------------------------------------------------------------

/**
 * Build formatted display lines for terminal output.
 */
function buildDisplayLines(
  phases: ParsedPhase[],
  progress: ParsedProgress[],
  state: ReturnType<typeof parseStateMd>,
): string[] {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold('Project Status'));
  lines.push(chalk.gray(`${state.progress.completedPhases}/${state.progress.totalPhases} phases | ${state.progress.completedPlans}/${state.progress.totalPlans} plans | ${state.progress.percent}%`));
  lines.push('');

  // Phase table
  if (phases.length > 0) {
    lines.push(chalk.bold.underline('Phases'));
    lines.push('');

    for (const phase of phases) {
      const isCurrent = state.phase !== null && String(state.phase) === String(phase.number);
      const indicator = getPhaseIndicator(phase, isCurrent);
      const planInfo = formatPlanCount(phase, progress);

      let line = `  ${indicator}  Phase ${phase.number}: ${phase.name}`;
      if (planInfo) {
        line += chalk.gray(` (${planInfo})`);
      }

      if (isCurrent) {
        line = chalk.bold(line) + chalk.yellow(' <-- current');
      }

      lines.push(line);
    }
  } else {
    lines.push(chalk.gray('  No phases found in ROADMAP.md'));
  }

  lines.push('');

  // Current position
  if (state.phase !== null) {
    lines.push(chalk.bold('Current Position'));
    lines.push(`  Phase: ${state.phase}${state.plan ? ` | Plan: ${state.plan}` : ''}`);
    lines.push(`  Status: ${state.status || 'unknown'}`);
    if (state.lastActivity) {
      lines.push(`  Last activity: ${state.lastActivity}`);
    }
    lines.push('');
  }

  return lines;
}

/**
 * Get the status indicator for a phase.
 */
function getPhaseIndicator(phase: ParsedPhase, isCurrent: boolean): string {
  if (phase.completed) return INDICATOR_COMPLETE;
  if (isCurrent) return INDICATOR_IN_PROGRESS;
  return INDICATOR_NOT_STARTED;
}

/**
 * Format plan count string for a phase (e.g., "2/6 plans").
 */
function formatPlanCount(phase: ParsedPhase, progress: ParsedProgress[]): string {
  const prog = progress.find((p) => String(p.phaseNumber) === String(phase.number));
  if (prog) {
    return `${prog.plansComplete}/${prog.plansTotal ?? '?'} plans`;
  }
  if (phase.planCount !== null) {
    return `${phase.completedCount}/${phase.planCount} plans`;
  }
  if (phase.plans.length > 0) {
    const done = phase.plans.filter((p) => p.completed).length;
    return `${done}/${phase.plans.length} plans`;
  }
  return '';
}

/**
 * Build a one-line summary.
 */
function buildSummaryLine(
  state: ReturnType<typeof parseStateMd>,
  phases: ParsedPhase[],
): string {
  const currentPhase = phases.find((p) => String(p.number) === String(state.phase));
  const phaseName = currentPhase?.name ?? `Phase ${state.phase ?? '?'}`;
  return `${phaseName} (in progress) | ${state.progress.completedPlans}/${state.progress.totalPlans} plans complete`;
}

// ---------------------------------------------------------------------------
// Active-work section rendering (Phase 27, D-14 visibility rules)
// ---------------------------------------------------------------------------

import { relativeTime, filterVisibleBackgroundWork } from './shared/active-work-display.js';

function appendActiveWorkSections(lines: string[], work: ActiveWork): void {
  if (work.active_phase) {
    const p = work.active_phase;
    lines.push(chalk.bold('Active Phase'));
    lines.push(`  \u25B6 Phase ${p.id} (${p.slug}) \u2014 ${p.current_step} [${p.category}]`);
    lines.push('');
  }

  const visible = filterVisibleBackgroundWork(work.background_work);
  if (visible.length > 0) {
    lines.push(chalk.bold('Background Work'));
    for (const item of visible) {
      const shortId = item.agent_id.slice(0, 5);
      const time = item.completed_at ? relativeTime(item.completed_at) : relativeTime(item.started_at);
      lines.push(`  - ${item.kind} (${shortId}\u2026) ${item.description} \u2014 ${item.state} ${time}`);
    }
    lines.push('');
  }

  if (work.blocked_on) {
    lines.push(`  \u26A0 Blocked: ${work.blocked_on.reason} (since ${relativeTime(work.blocked_on.since)})`);
    lines.push('');
  }
}

// ---------------------------------------------------------------------------
// Skill Definitions
// ---------------------------------------------------------------------------

export const statusSkill = defineSkill({
  id: 'workflow.status',
  command: 'status',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  tier: 'user',
  description: 'Show current project status and progress',
  options: [
    { flags: '--json', description: 'Output as JSON (replaces query command)' },
    { flags: '--brief', description: 'Show decisions/blockers only (replaces context command)' },
    { flags: '--live', description: "Open the read-only dashboard TUI (polls .sun/active-work.json at 1Hz)" },
  ],

  // Phase 32: 'progress' is now an alias for 'status'
  // progressSkill export removed; alias infra handles CLI dispatch and ctx.run() compat
  // Phase 33 Wave 1: 'context' and 'query' absorbed into status
  aliases: [
    {
      command: 'progress',
      id: 'workflow.progress',
      hidden: true,
      replacedBy: 'status',
    },
    {
      command: 'context',
      id: 'workflow.context',
      defaultArgs: { brief: true },
      hidden: true,
      replacedBy: 'status --brief',
    },
    {
      command: 'query',
      id: 'workflow.query',
      defaultArgs: { json: true, snapshot: 'query' },
      hidden: true,
      replacedBy: 'status --json',
    },
  ],

  execute: executeStatus,
});
