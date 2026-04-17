/**
 * SUNCO wrapper for the vendored Superpowers brainstorming skill.
 *
 * The behavioral source of truth is the Superpowers SKILL.md installed under
 * sunco/references/superpowers/brainstorming/SKILL.md.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';

async function readSuperpowersBrainstormingSource(ctx: SkillContext): Promise<string> {
  const candidates = [
    join(homedir(), '.claude', 'sunco', 'references', 'superpowers', 'brainstorming', 'SKILL.md'),
    join(homedir(), '.codex', 'sunco', 'references', 'superpowers', 'brainstorming', 'SKILL.md'),
    join(homedir(), '.cursor', 'sunco', 'references', 'superpowers', 'brainstorming', 'SKILL.md'),
    join(homedir(), '.antigravity', 'sunco', 'references', 'superpowers', 'brainstorming', 'SKILL.md'),
    join(ctx.cwd, 'packages', 'cli', 'references', 'superpowers', 'brainstorming', 'SKILL.md'),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf-8');
    } catch {
      // Try the next runtime install location.
    }
  }

  throw new Error('Vendored Superpowers brainstorming source not found.');
}

export default defineSkill({
  id: 'workflow.brainstorming',
  command: 'brainstorming',
  aliases: [
    {
      command: 'brainstorm',
      id: 'workflow.brainstorm',
      hidden: false,
      replacedBy: 'brainstorming',
    },
  ],
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'complex',
  tier: 'user',
  description: 'Run vendored Superpowers brainstorming before SUNCO planning',

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'Brainstorming',
      description: 'Running vendored Superpowers brainstorming',
    });

    const positional = (ctx.args._ as string[] | undefined) ?? [];
    let idea = positional.join(' ').trim();
    if (!idea) {
      const response = await ctx.ui.askText({
        message: 'What idea should we brainstorm?',
        placeholder: 'Describe the project, feature, or behavior...',
      });
      idea = response.text;
    }

    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      const msg =
        'No AI provider available. Install Claude Code CLI or set an agent provider to use brainstorming.';
      await ctx.ui.result({ success: false, title: 'Brainstorming', summary: msg });
      return { success: false, summary: msg };
    }

    let superpowersSource: string;
    try {
      superpowersSource = await readSuperpowersBrainstormingSource(ctx);
    } catch (error) {
      const msg = String(error instanceof Error ? error.message : error);
      await ctx.ui.result({ success: false, title: 'Brainstorming', summary: msg });
      return { success: false, summary: msg };
    }

    const result = await ctx.agent.run({
      role: 'planning',
      prompt: `Run the following Superpowers brainstorming skill as SUNCO's brainstorming layer.

Hard requirements:
- Treat the Superpowers source below as the behavioral source of truth.
- Do not implement, scaffold, or modify product code.
- Produce the approved design/spec content in your output. If tool permissions prevent writing the file directly, include the recommended path.
- After the spec is approved, the next step is /sunco:new --from-preflight <spec-path>.

User idea:
${idea || '(no idea provided)'}

Vendored Superpowers brainstorming source:
${superpowersSource}`,
      permissions: {
        role: 'planning',
        readPaths: ['**'],
        writePaths: [],
        allowTests: false,
        allowNetwork: false,
        allowGitWrite: false,
        allowCommands: [],
      },
      timeout: 180_000,
    });

    if (!result.success) {
      const msg = 'Superpowers brainstorming agent failed.';
      await ctx.ui.result({ success: false, title: 'Brainstorming', summary: msg });
      return { success: false, summary: msg };
    }

    const summary =
      'Brainstorming complete. Use the approved spec with /sunco:new --from-preflight <spec-path>.';
    await ctx.ui.result({
      success: true,
      title: 'Brainstorming',
      summary,
      details: result.outputText ? [result.outputText.slice(0, 2000)] : undefined,
    });

    return {
      success: true,
      summary,
      data: { next: '/sunco:new --from-preflight <spec-path>' },
    };
  },
});
