/**
 * SUNCO wrapper for the vendored Superpowers brainstorming skill.
 *
 * The behavioral source of truth is the Superpowers SKILL.md installed under
 * sunco/references/superpowers/brainstorming/SKILL.md.
 *
 * `--visual` opts into the vendored visual companion (local HTTP server
 * serving mockups/diagrams). The server is booted via the vendored
 * start-server.sh under superpowers/brainstorming/scripts/ and the URL
 * is injected into the agent prompt so the agent knows it can publish
 * visual content for the user.
 */

import { readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';

const execFileP = promisify(execFile);

const BRAINSTORM_REF_SEGMENTS = [
  'sunco',
  'references',
  'superpowers',
  'brainstorming',
];

function runtimeCandidatePaths(
  ctx: SkillContext,
  ...trailing: string[]
): string[] {
  const runtimes = ['.claude', '.codex', '.cursor', '.antigravity'];
  const candidates = runtimes.map((r) =>
    join(homedir(), r, ...BRAINSTORM_REF_SEGMENTS, ...trailing),
  );
  candidates.push(
    join(ctx.cwd, 'packages', 'cli', 'references', 'superpowers', 'brainstorming', ...trailing),
  );
  return candidates;
}

async function readSuperpowersBrainstormingSource(ctx: SkillContext): Promise<string> {
  const candidates = runtimeCandidatePaths(ctx, 'SKILL.md');
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf-8');
    } catch {
      // Try the next runtime install location.
    }
  }
  throw new Error('Vendored Superpowers brainstorming source not found.');
}

/**
 * Locate the vendored start-server.sh for the visual companion.
 * Returns an absolute path or null if no runtime has it installed.
 */
export async function findVisualStartScript(ctx: SkillContext): Promise<string | null> {
  const candidates = runtimeCandidatePaths(ctx, 'scripts', 'start-server.sh');
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.F_OK);
      return candidate;
    } catch {
      // Try next.
    }
  }
  return null;
}

export interface VisualCompanionLaunch {
  started: boolean;
  url?: string;
  sessionDir?: string;
  stateDir?: string;
  screenDir?: string;
  port?: number;
  error?: string;
}

/**
 * Parse the first `server-started` JSON line from start-server.sh stdout.
 * Returns null if the line is missing or not valid JSON.
 */
export function parseVisualStartOutput(stdout: string): VisualCompanionLaunch | null {
  const line = stdout
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.includes('server-started') || l.includes('"url"'));
  if (!line) return null;
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    return {
      started: true,
      url: typeof parsed.url === 'string' ? parsed.url : undefined,
      sessionDir: typeof parsed.session_dir === 'string'
        ? parsed.session_dir
        : typeof parsed.sessionDir === 'string'
          ? parsed.sessionDir
          : undefined,
      stateDir: typeof parsed.state_dir === 'string' ? parsed.state_dir : undefined,
      screenDir: typeof parsed.screen_dir === 'string' ? parsed.screen_dir : undefined,
      port: typeof parsed.port === 'number' ? parsed.port : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Boot the visual companion server by invoking the vendored
 * start-server.sh. Runs with a 15s timeout and captures stdout. Returns
 * a VisualCompanionLaunch describing the result. Never throws — returns
 * `{ started: false, error }` on any failure so the caller can keep
 * going with text-only brainstorming.
 */
export async function startVisualCompanion(
  ctx: SkillContext,
): Promise<VisualCompanionLaunch> {
  const script = await findVisualStartScript(ctx);
  if (!script) {
    return {
      started: false,
      error:
        'Visual companion scripts not found. The vendored superpowers/brainstorming/scripts/ directory is not installed.',
    };
  }
  try {
    const { stdout } = await execFileP(
      'bash',
      [script, '--project-dir', ctx.cwd, '--background'],
      { timeout: 15_000, maxBuffer: 1024 * 1024 },
    );
    const parsed = parseVisualStartOutput(stdout);
    if (!parsed) {
      return {
        started: false,
        error: 'start-server.sh did not emit a recognizable server-started line.',
      };
    }
    return parsed;
  } catch (err) {
    return {
      started: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
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
  options: [
    {
      flags: '--visual',
      description:
        'Boot the vendored Superpowers visual companion (browser-based mockups/diagrams) and expose the URL to the brainstorming agent.',
    },
  ],

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

    // Optional: boot the visual companion server when --visual is passed.
    const visualFlag = ctx.args.visual === true || ctx.args.visual === 'true';
    let visual: VisualCompanionLaunch | undefined;
    if (visualFlag) {
      visual = await startVisualCompanion(ctx);
      if (visual.started && visual.url) {
        await ctx.state.set('brainstorming.visualCompanion', {
          url: visual.url,
          sessionDir: visual.sessionDir,
          screenDir: visual.screenDir,
          startedAt: new Date().toISOString(),
        });
      }
    }

    const visualBlock = visual
      ? visual.started
        ? `\nVisual companion: ACTIVE. URL: ${visual.url ?? '(unknown)'}. Write HTML fragments to ${visual.screenDir ?? '(screen dir unknown)'} when a visual question warrants it. Remember: per-question decision, not per-session.\n`
        : `\nVisual companion: UNAVAILABLE (${visual.error ?? 'unknown error'}). Continue with text-only brainstorming.\n`
      : '';

    const result = await ctx.agent.run({
      role: 'planning',
      prompt: `Run the following Superpowers brainstorming skill as SUNCO's brainstorming layer.

Hard requirements:
- Treat the Superpowers source below as the behavioral source of truth.
- Do not implement, scaffold, or modify product code.
- Produce the approved design/spec content in your output. If tool permissions prevent writing the file directly, include the recommended path.
- After the spec is approved, the next step is /sunco:new --from-preflight <spec-path>.
${visualBlock}
User idea:
${idea || '(no idea provided)'}

Vendored Superpowers brainstorming source:
${superpowersSource}`,
      permissions: {
        role: 'planning',
        readPaths: ['**'],
        writePaths: visual?.started && visual.screenDir ? [visual.screenDir + '/**'] : [],
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
      details: [
        ...(result.outputText ? [result.outputText.slice(0, 2000)] : []),
        ...(visual?.started && visual.url
          ? [`Visual companion running at ${visual.url}`]
          : []),
      ],
    });

    return {
      success: true,
      summary,
      data: {
        next: '/sunco:new --from-preflight <spec-path>',
        ...(visual ? { visualCompanion: visual } : {}),
      },
    };
  },
});
