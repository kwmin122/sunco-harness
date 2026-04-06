/** @sunco/skills-workflow - Fast Skill: zero-overhead agent dispatch with atomic commit.
 * Requirements: WF-16, WF-17 | Decisions: D-09, D-10, D-11 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult, PermissionSet } from '@sunco/core';

/** Wide permissions for ad-hoc fast tasks */
const FAST_PERMISSIONS: PermissionSet = {
  role: 'execution',
  readPaths: ['**'],
  writePaths: ['**'],
  allowTests: true,
  allowNetwork: false,
  allowGitWrite: true,
  allowCommands: ['npm test', 'npm run build', 'git add', 'git commit'],
};

export default defineSkill({
  id: 'workflow.fast',
  command: 'fast',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'simple',
  description: 'Immediate task execution -- zero planning overhead',
  options: [],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({ title: 'Fast', description: 'Executing immediately...' });

    const positionalArgs = ctx.args._ as string[] | undefined;
    let taskDescription = positionalArgs ? positionalArgs.join(' ').trim() : '';

    if (!taskDescription) {
      const response = await ctx.ui.askText({
        message: 'What should I do?',
        placeholder: 'Describe the task...',
      });
      taskDescription = response.text.trim();
    }

    if (!taskDescription) {
      const msg = 'No task description provided.';
      await ctx.ui.result({ success: false, title: 'Fast', summary: msg });
      return { success: false, summary: msg };
    }

    const prompt = [
      'Execute this task immediately in the current project.',
      'Make an atomic commit when done.',
      '',
      `Task: ${taskDescription}`,
      '',
      'Commit with a descriptive message summarizing the change.',
    ].join('\n');

    const result = await ctx.agent.run({
      role: 'execution',
      prompt,
      permissions: FAST_PERMISSIONS,
      timeout: 180_000,
    });

    const summary = result.success
      ? result.outputText.slice(0, 200) || 'Task executed'
      : `Task failed: ${result.outputText.slice(0, 200)}`;

    await ctx.ui.result({ success: result.success, title: 'Fast', summary });

    return {
      success: result.success,
      summary,
      data: { task: taskDescription, agentSuccess: result.success },
    };
  },
});
