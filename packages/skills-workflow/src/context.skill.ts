/**
 * @sunco/skills-workflow - Context Skill
 *
 * Displays current decisions, blockers, pending todos, and next actions.
 * Provides a focused view of the project's accumulated context.
 *
 * Command: sunco context
 *
 * Requirements: SES-05
 * Decisions: D-20 (context aggregation)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import chalk from 'chalk';
import { parseStateMd } from './shared/state-reader.js';

// ---------------------------------------------------------------------------
// Section Extractors
// ---------------------------------------------------------------------------

/**
 * Extract content under a markdown heading from STATE.md body.
 * Looks for ### heading and captures lines until the next ### or end.
 */
function extractSection(content: string, heading: string): string[] {
  const lines = content.split('\n');
  const headingRe = new RegExp(`^###\\s+${escapeRegex(heading)}`, 'i');
  const nextHeadingRe = /^###?\s+/;

  let inSection = false;
  const result: string[] = [];

  for (const line of lines) {
    if (headingRe.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && nextHeadingRe.test(line)) {
      break;
    }
    if (inSection) {
      const trimmed = line.trim();
      if (trimmed) {
        result.push(trimmed);
      }
    }
  }

  return result;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the current phase CONTEXT.md file path by scanning phase directories.
 */
async function findContextFile(cwd: string, phaseNum: number): Promise<string | null> {
  const phasesDir = join(cwd, '.planning', 'phases');
  try {
    const entries = await readdir(phasesDir);
    const padded = String(phaseNum).padStart(2, '0');
    const phaseDir = entries.find((e) => e.startsWith(padded + '-'));
    if (phaseDir) {
      return join(phasesDir, phaseDir, `${padded}-CONTEXT.md`);
    }
  } catch {
    // phases directory doesn't exist
  }
  return null;
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.context',
  command: 'context',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Display current decisions, blockers, and next actions',

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'Context',
      description: 'Gathering project context...',
    });

    // Read STATE.md
    const statePath = join(ctx.cwd, '.planning', 'STATE.md');
    const stateContent = await readFile(statePath, 'utf-8').catch(() => null);

    if (!stateContent) {
      return {
        success: false,
        summary: 'No .planning/STATE.md found. Run sunco new or sunco scan first.',
      };
    }

    const state = parseStateMd(stateContent);
    const details: string[] = [];

    // Section 1: Current Position
    details.push(chalk.bold.underline('Current Position'));
    details.push('');
    details.push(`  Phase: ${state.phase ?? 'unknown'}`);
    if (state.plan) {
      details.push(`  Plan: ${state.plan}`);
    }
    details.push(`  Status: ${state.status || 'unknown'}`);
    if (state.lastActivity) {
      details.push(`  Last activity: ${state.lastActivity}`);
    }
    details.push('');

    // Section 2: Decisions (from STATE.md)
    const decisions = extractSection(stateContent, 'Decisions');
    details.push(chalk.bold.underline('Decisions'));
    details.push('');
    if (decisions.length > 0) {
      for (const decision of decisions.slice(0, 10)) {
        details.push(`  ${decision}`);
      }
      if (decisions.length > 10) {
        details.push(chalk.gray(`  ... and ${decisions.length - 10} more`));
      }
    } else {
      details.push(chalk.gray('  No decisions recorded yet.'));
    }
    details.push('');

    // Section 3: Blockers/Concerns (from STATE.md)
    const blockers = extractSection(stateContent, 'Blockers/Concerns');
    details.push(chalk.bold.underline('Blockers/Concerns'));
    details.push('');
    if (blockers.length > 0) {
      for (const blocker of blockers) {
        details.push(`  ${blocker}`);
      }
    } else {
      details.push(chalk.gray('  No blockers recorded.'));
    }
    details.push('');

    // Section 4: Phase Context (from CONTEXT.md if available)
    if (state.phase !== null) {
      const contextPath = await findContextFile(ctx.cwd, state.phase);
      if (contextPath) {
        const contextContent = await readFile(contextPath, 'utf-8').catch(() => null);
        if (contextContent) {
          const contextLines = contextContent.split('\n').filter((l) => l.trim()).slice(0, 5);
          details.push(chalk.bold.underline('Phase Context'));
          details.push('');
          for (const line of contextLines) {
            details.push(`  ${line.trim()}`);
          }
          details.push('');
        }
      }
    }

    // Section 5: Pending Todos (from StateApi)
    const todoItems = await ctx.state.get<Array<{ text: string; done: boolean }>>('todo.items');
    const pendingTodos = todoItems?.filter((t) => !t.done) ?? [];
    details.push(chalk.bold.underline('Pending Todos'));
    details.push('');
    if (pendingTodos.length > 0) {
      for (const todo of pendingTodos.slice(0, 5)) {
        details.push(`  [ ] ${todo.text}`);
      }
      if (pendingTodos.length > 5) {
        details.push(chalk.gray(`  ... and ${pendingTodos.length - 5} more`));
      }
    } else {
      details.push(chalk.gray('  No pending todos.'));
    }
    details.push('');

    // Section 6: Next Actions (from recommender)
    const recommendations = ctx.recommend.getRecommendations({
      lastSkillId: 'workflow.context',
      lastResult: { success: true },
      projectState: state.phase !== null ? { phase: state.phase } : {},
      activeSkills: new Set(),
    });

    details.push(chalk.bold.underline('Next Actions'));
    details.push('');
    if (recommendations.length > 0) {
      const top = recommendations.find((r) => r.isDefault) ?? recommendations[0]!;
      details.push(`  ${top.title} (${top.priority})`);
      details.push(`  ${top.reason}`);
    } else {
      details.push(chalk.gray('  No recommendations available.'));
    }
    details.push('');

    const summary = `Phase ${state.phase ?? '?'} | ${state.status || 'unknown'} | ${decisions.length} decisions | ${blockers.length} blockers`;

    await ctx.ui.result({
      success: true,
      title: 'Project Context',
      summary,
      details,
      recommendations,
    });

    return {
      success: true,
      summary,
    };
  },
});
