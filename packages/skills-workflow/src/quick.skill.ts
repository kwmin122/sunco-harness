/**
 * @sunco/skills-workflow - Quick Skill
 *
 * Lightweight task execution with optional planning depth.
 * `sunco quick` accepts a task description and executes it with
 * configurable discuss/research steps before agent dispatch.
 *
 * - No flags: straight to agent execution
 * - --discuss: add context gathering step before execution
 * - --research: add domain research step before execution
 * - --full: add both discuss and research steps
 *
 * Requirements: WF-16, WF-17
 * Decisions: D-05 (agent dispatch), D-06 (execution flow),
 *   D-07 (kind=prompt), D-08 (askText fallback), D-16/D-17 (composition)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult, PermissionSet } from '@sunco/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Execution permissions for quick tasks */
const EXECUTION_PERMISSIONS: PermissionSet = {
  role: 'execution',
  readPaths: ['**'],
  writePaths: ['src/**', 'packages/**', 'tests/**', '*.ts', '*.tsx', '*.js'],
  allowTests: true,
  allowNetwork: false,
  allowGitWrite: true,
  allowCommands: ['npm test', 'npm run build'],
};

/** Agent timeout: 5 minutes */
const AGENT_TIMEOUT = 300_000;

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.quick',
  command: 'quick',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'simple',
  description: 'Lightweight task execution with optional planning steps',

  options: [
    { flags: '--discuss', description: 'Add context gathering step' },
    { flags: '--research', description: 'Add domain research step' },
    { flags: '--full', description: 'Add both discuss and research steps' },
    { flags: '--speed <mode>', description: 'Execution speed: fast (zero planning, atomic commit) | normal (default)' },
  ],

  // Phase 32: 'fast' is now an alias for 'quick --speed fast'
  // fast.skill.ts deleted; alias infra handles the CLI dispatch and ctx.run() compat
  aliases: [
    {
      command: 'fast',
      id: 'workflow.fast',
      defaultArgs: { speed: 'fast' },
      hidden: true,
      replacedBy: 'quick --speed fast',
    },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Quick',
      description: 'Running lightweight task...',
    });

    // --- Get task description ---
    const positionalArgs = ctx.args._ as string[] | undefined;
    let taskDescription = positionalArgs ? positionalArgs.join(' ').trim() : '';

    if (!taskDescription) {
      const response = await ctx.ui.askText({
        message: 'Describe the task:',
        placeholder: 'What should be done?',
      });
      taskDescription = response.text.trim();
    }

    if (!taskDescription) {
      const msg = 'No task description provided.';
      await ctx.ui.result({ success: false, title: 'Quick', summary: msg });
      return { success: false, summary: msg };
    }

    // --- Fast mode: zero planning, atomic commit, immediate dispatch ---
    if (ctx.args.speed === 'fast') {
      const FAST_PERMISSIONS: PermissionSet = {
        role: 'execution',
        readPaths: ['**'],
        writePaths: ['**'],
        allowTests: true,
        allowNetwork: false,
        allowGitWrite: true,
        allowCommands: ['npm test', 'npm run build', 'git add', 'git commit'],
      };

      const fastPrompt = [
        'Execute this task immediately in the current project.',
        'Make an atomic commit when done.',
        '',
        `Task: ${taskDescription}`,
        '',
        'Commit with a descriptive message summarizing the change.',
      ].join('\n');

      const fastResult = await ctx.agent.run({
        role: 'execution',
        prompt: fastPrompt,
        permissions: FAST_PERMISSIONS,
        timeout: 180_000,
      });

      const fastSummary = fastResult.success
        ? fastResult.outputText.slice(0, 200) || 'Task executed'
        : `Task failed: ${fastResult.outputText.slice(0, 200)}`;

      await ctx.ui.result({ success: fastResult.success, title: 'Quick (fast)', summary: fastSummary });
      return { success: fastResult.success, summary: fastSummary, data: { task: taskDescription, speed: 'fast' } };
    }

    // --- Determine flags ---
    const discuss = ctx.args.discuss === true || ctx.args.full === true;
    const research = ctx.args.research === true || ctx.args.full === true;
    const warnings: string[] = [];

    // --- Optional discuss step ---
    if (discuss) {
      ctx.log.info('Running context gathering...');
      try {
        const discussResult = await ctx.run('workflow.discuss', {});
        if (!discussResult.success) {
          const warnMsg = `Discuss step completed with warnings: ${discussResult.summary ?? 'unknown'}`;
          ctx.log.warn(warnMsg);
          warnings.push(warnMsg);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const warnMsg = `Discuss step failed: ${errMsg}`;
        ctx.log.warn(warnMsg);
        warnings.push(warnMsg);
      }
    }

    // --- Optional research step ---
    if (research) {
      ctx.log.info('Running domain research...');
      try {
        const researchResult = await ctx.run('workflow.research', {});
        if (!researchResult.success) {
          const warnMsg = `Research step completed with warnings: ${researchResult.summary ?? 'unknown'}`;
          ctx.log.warn(warnMsg);
          warnings.push(warnMsg);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const warnMsg = `Research step failed: ${errMsg}`;
        ctx.log.warn(warnMsg);
        warnings.push(warnMsg);
      }
    }

    // --- Execution step (always) ---
    const executionPrompt = [
      'Execute the following task in the current project:',
      '',
      taskDescription,
      '',
      'Make atomic commits for each logical change. Write tests if the change is testable.',
    ].join('\n');

    const agentResult = await ctx.agent.run({
      role: 'execution',
      prompt: executionPrompt,
      permissions: EXECUTION_PERMISSIONS,
      timeout: AGENT_TIMEOUT,
    });

    // --- Build result ---
    const success = agentResult.success;
    const summary = success
      ? 'Task completed'
      : `Task failed: ${agentResult.outputText.slice(0, 200)}`;

    await ctx.ui.result({
      success,
      title: 'Quick',
      summary,
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    return {
      success,
      summary,
      data: {
        task: taskDescription,
        discuss: !!discuss,
        research: !!research,
        agentSuccess: agentResult.success,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
});
