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
import type { SkillContext, SkillResult, UsageEntry, ActiveWork, BackgroundWorkItem } from '@sunco/core';
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
 * Execute function shared between statusSkill and progressSkill.
 * Reads .planning/ROADMAP.md and .planning/STATE.md, then displays
 * a formatted overview or JSON output.
 */
async function executeStatus(ctx: SkillContext): Promise<SkillResult> {
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

  // --json flag: return raw data without formatting
  const isJson = ctx.args.json as boolean | undefined;
  if (isJson) {
    return {
      success: true,
      summary: `Phase ${state.phase ?? '?'} | ${state.progress.completedPlans}/${state.progress.totalPlans} plans`,
      data: { phases, progress, state },
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

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function filterBackgroundWork(items: BackgroundWorkItem[]): BackgroundWorkItem[] {
  const thirtyMinsAgo = Date.now() - 30 * 60_000;
  return items
    .filter(item =>
      item.state === 'running' ||
      (item.state === 'completed' && item.completed_at && new Date(item.completed_at).getTime() > thirtyMinsAgo),
    )
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 3);
}

function appendActiveWorkSections(lines: string[], work: ActiveWork): void {
  if (work.active_phase) {
    const p = work.active_phase;
    lines.push(chalk.bold('Active Phase'));
    lines.push(`  \u25B6 Phase ${p.id} (${p.slug}) \u2014 ${p.current_step} [${p.category}]`);
    lines.push('');
  }

  const visible = filterBackgroundWork(work.background_work);
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
  options: [{ flags: '--json', description: 'Output as JSON' }],
  execute: executeStatus,
});

export const progressSkill = defineSkill({
  id: 'workflow.progress',
  command: 'progress',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  tier: 'user',
  description: 'Show overall progress and next actions',
  options: [{ flags: '--json', description: 'Output as JSON' }],
  execute: executeStatus,
});
