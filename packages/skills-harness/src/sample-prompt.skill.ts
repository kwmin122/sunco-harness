/**
 * @sunco/skills-harness - Sample Prompt Skill
 *
 * Demonstrates agent dispatch through the Agent Router.
 * Prompt skill: requires agent access (ctx.agent is real, not blocked).
 *
 * Commands:
 *   sunco sample-prompt                         -- ask default question
 *   sunco sample-prompt --question "Hello"       -- ask custom question
 *
 * Requirement: SKL-05 (agent dispatch), AGT flow demonstration
 */

import { defineSkill } from '@sunco/core';

export default defineSkill({
  id: 'sample.prompt',
  command: 'sample-prompt',
  kind: 'prompt',
  stage: 'experimental',
  category: 'sample',
  routing: 'directExec',
  description: 'Sample skill demonstrating agent dispatch (experimental)',
  options: [
    { flags: '--question <text>', description: 'Question to ask the agent' },
  ],

  async execute(ctx) {
    await ctx.ui.entry({
      title: 'Sample Prompt',
      description: 'Demonstrating agent dispatch',
    });

    const question =
      (ctx.args.question as string | undefined) ??
      'What are the key files in this project?';

    const progress = ctx.ui.progress({ title: 'Asking agent...' });

    try {
      const result = await ctx.agent.run({
        role: 'research',
        prompt: question,
        permissions: {
          role: 'research',
          readPaths: ['**'],
          writePaths: [],
          allowTests: false,
          allowNetwork: false,
          allowGitWrite: false,
          allowCommands: [],
        },
        timeout: 60_000,
      });

      progress.done({ summary: 'Agent responded' });

      await ctx.ui.result({
        success: result.success,
        title: 'Agent Response',
        summary: result.success ? 'Agent completed successfully' : 'Agent failed',
        details: result.outputText.split('\n'),
      });

      return { success: result.success, data: result };
    } catch (error) {
      progress.done({ summary: 'Agent failed' });
      const summary =
        error instanceof Error ? error.message : String(error);
      await ctx.ui.result({
        success: false,
        title: 'Agent Error',
        summary,
      });
      return { success: false, summary };
    }
  },
});
