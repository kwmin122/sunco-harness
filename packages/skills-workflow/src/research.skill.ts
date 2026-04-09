/**
 * @sunco/skills-workflow - Research Skill
 *
 * Agent-powered domain research that produces a synthesized RESEARCH.md.
 * Dispatches 3-5 parallel research agents to investigate topics derived
 * from CONTEXT.md decisions and phase scope. Results are synthesized into
 * a single RESEARCH.md in the phase directory.
 *
 * This is the same parallel dispatch pattern as `sunco scan` but with
 * research-focused prompts and synthesis. Output feeds into `sunco plan`.
 *
 * Requirements: WF-11
 * Decisions: D-08 (parallel dispatch), D-09 (read-only research),
 *   D-10 (synthesis with validation architecture), D-11 (topic auto-derivation)
 */

import { defineSkill } from '@sunco/core';
import type { PermissionSet } from '@sunco/core';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildResearchDomainPrompt } from './prompts/research-domain.js';
import { buildResearchSynthesizePrompt } from './prompts/research-synthesize.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of research topics to dispatch */
const MAX_TOPICS = 5;

/** Read-only permissions for research agents (D-08, D-09) */
const RESEARCH_PERMISSIONS: PermissionSet = {
  role: 'research',
  readPaths: ['**'],
  writePaths: [],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

/** Permissions for planning/synthesis agent (D-10) */
const PLANNING_PERMISSIONS: PermissionSet = {
  role: 'planning',
  readPaths: ['**'],
  writePaths: ['.planning/**'],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the phase directory path from the phases/ directory.
 * Scans .planning/phases/ for a directory starting with the padded phase number.
 */
async function resolvePhaseDir(cwd: string, phaseNumber: number): Promise<string | null> {
  const phasesDir = join(cwd, '.planning', 'phases');
  try {
    const entries = await readdir(phasesDir);
    const padded = String(phaseNumber).padStart(2, '0');
    const match = entries.find((e) => e.startsWith(`${padded}-`));
    if (match) {
      return join(phasesDir, match);
    }
  } catch {
    // phases directory doesn't exist
  }
  return null;
}

/**
 * Extract phase number from STATE.md content.
 * Looks for "Phase: NN" in body text.
 */
function extractPhaseNumber(stateContent: string): number | null {
  const match = /^Phase:\s*(\d+)/m.exec(stateContent);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract phase goal from ROADMAP.md for a given phase number.
 * Looks for "### Phase N: Name" header and returns the description.
 */
function extractPhaseGoal(roadmapContent: string, phaseNumber: number): string {
  const padded = String(phaseNumber).padStart(2, '0');
  // Try "### Phase N:" or "### Phase 0N:"
  const re = new RegExp(`### Phase (?:${phaseNumber}|${padded}): (.+)`, 'm');
  const match = re.exec(roadmapContent);
  return match ? match[1].trim() : `Phase ${phaseNumber}`;
}

/**
 * Extract requirements from ROADMAP.md for a given phase number.
 * Looks for "**Requirements**: REQ-01, REQ-02" under the phase section.
 */
function extractRequirements(roadmapContent: string, phaseNumber: number): string[] {
  const padded = String(phaseNumber).padStart(2, '0');
  const sectionRe = new RegExp(`### Phase (?:${phaseNumber}|${padded}): .+([\\s\\S]*?)(?=### Phase|$)`, 'm');
  const section = sectionRe.exec(roadmapContent);
  if (!section) return [];

  const reqRe = /\*\*Requirements\*\*:\s*(.+)/;
  const reqMatch = reqRe.exec(section[1]);
  if (!reqMatch) return [];

  return reqMatch[1]
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
}

/**
 * Parse topic lines from agent output.
 * Handles: plain lines, numbered lists (1. Topic), bullet lists (- Topic).
 * Filters empty lines and caps at MAX_TOPICS.
 */
function parseTopics(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 0 && line.length < 200)
    .slice(0, MAX_TOPICS);
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.research',
  command: 'research',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  complexity: 'complex',
  tier: 'expert',
  description: 'Parallel agent domain research for current phase',
  options: [
    { flags: '-p, --phase <number>', description: 'Phase number (default: current from STATE.md)' },
    { flags: '-t, --topics <topics>', description: 'Comma-separated research topics (overrides auto-derivation)' },
  ],

  async execute(ctx) {
    // --- Step 0: Entry + provider check ---
    await ctx.ui.entry({
      title: 'Research',
      description: 'Starting domain research...',
    });

    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Research',
        summary: 'No AI provider available',
        details: [
          'sunco research requires an AI provider to dispatch research agents.',
          'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
          'Or set ANTHROPIC_API_KEY for the SDK provider.',
        ],
      });
      return { success: false, summary: 'No AI provider available' };
    }

    // --- Step 1: Determine phase number ---
    const phaseArg = ctx.args.phase as number | undefined;
    let phaseNumber: number;

    if (phaseArg) {
      phaseNumber = phaseArg;
    } else {
      const statePath = join(ctx.cwd, '.planning', 'STATE.md');
      const stateContent = await readFile(statePath, 'utf-8').catch(() => null);
      const parsed = stateContent ? extractPhaseNumber(stateContent) : null;
      if (!parsed) {
        await ctx.ui.result({
          success: false,
          title: 'Research',
          summary: 'Cannot determine current phase. Use --phase to specify.',
        });
        return { success: false, summary: 'Cannot determine current phase' };
      }
      phaseNumber = parsed;
    }

    // --- Step 2: Read CONTEXT.md and ROADMAP.md ---
    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);
    if (!phaseDir) {
      await ctx.ui.result({
        success: false,
        title: 'Research',
        summary: `Phase ${phaseNumber} directory not found. Run sunco discuss first.`,
      });
      return { success: false, summary: `Phase ${phaseNumber} directory not found` };
    }

    const padded = String(phaseNumber).padStart(2, '0');
    const contextPath = join(phaseDir, `${padded}-CONTEXT.md`);
    const contextContent = await readFile(contextPath, 'utf-8').catch(() => null);

    if (!contextContent) {
      await ctx.ui.result({
        success: false,
        title: 'Research',
        summary: `CONTEXT.md not found for phase ${phaseNumber}. Run sunco discuss first.`,
      });
      return {
        success: false,
        summary: `CONTEXT.md not found for phase ${phaseNumber}. Run sunco discuss first.`,
      };
    }

    const roadmapPath = join(ctx.cwd, '.planning', 'ROADMAP.md');
    const roadmapContent = await readFile(roadmapPath, 'utf-8').catch(() => '');
    const phaseGoal = extractPhaseGoal(roadmapContent, phaseNumber);
    const requirements = extractRequirements(roadmapContent, phaseNumber);

    ctx.log.info('Research context loaded', { phaseNumber, phaseGoal, requirements });

    // --- Step 3: Determine research topics (D-11) ---
    let topics: string[];
    const topicsArg = ctx.args.topics as string | undefined;

    if (topicsArg) {
      topics = topicsArg
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      ctx.log.info('Using user-provided topics', { topics });
    } else {
      // Auto-derive topics via planning agent
      const topicProgress = ctx.ui.progress({ title: 'Deriving research topics...', total: 1 });

      const topicResult = await ctx.agent.run({
        role: 'planning',
        prompt: `Given these locked decisions and phase goal, what are the 3-5 most important technical topics to research?

## Phase Goal
${phaseGoal}

## Locked Decisions (from CONTEXT.md)
${contextContent}

## Requirements
${requirements.join(', ')}

Output one topic per line, no numbering, no bullets. Each topic should be a concise phrase (3-8 words). Focus on topics that need external research -- do not list topics already fully decided in CONTEXT.md.`,
        permissions: PLANNING_PERMISSIONS,
        timeout: 60_000,
      });

      topicProgress.update({ completed: 1, message: 'Topics derived' });
      topicProgress.done({ summary: 'Topics derived' });

      topics = parseTopics(topicResult.outputText);
      if (topics.length === 0) {
        // Fallback: generate generic topics from phase goal
        topics = [`${phaseGoal} implementation patterns`, `${phaseGoal} standard libraries`];
      }
      ctx.log.info('Auto-derived topics', { topics });
    }

    // --- Step 4: Parallel research dispatch (D-08, D-09) ---
    const researchProgress = ctx.ui.progress({
      title: 'Researching topics',
      total: topics.length,
    });

    let completed = 0;

    const researchResults = await Promise.allSettled(
      topics.map(async (topic) => {
        const result = await ctx.agent.run({
          role: 'research',
          prompt: buildResearchDomainPrompt({
            topic,
            phaseGoal,
            contextDecisions: contextContent,
            requirements,
            codebaseContext: '',
          }),
          permissions: RESEARCH_PERMISSIONS,
          timeout: 120_000,
        });
        completed++;
        researchProgress.update({ completed, message: `Completed: ${topic}` });
        return { topic, result };
      }),
    );

    researchProgress.done({
      summary: `${researchResults.filter((r) => r.status === 'fulfilled').length}/${topics.length} topics researched`,
    });

    // Collect successful results and warnings
    const successfulResults: Array<{ topic: string; content: string }> = [];
    const warnings: string[] = [];

    for (let i = 0; i < researchResults.length; i++) {
      const result = researchResults[i]!;
      const topic = topics[i]!;

      if (result.status === 'fulfilled' && result.value.result.success) {
        successfulResults.push({
          topic: result.value.topic,
          content: result.value.result.outputText,
        });
      } else {
        const reason =
          result.status === 'rejected'
            ? result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
            : 'Agent returned unsuccessful result';
        warnings.push(`Research agent failed for "${topic}": ${reason}`);
        ctx.log.warn(`Research agent failed for "${topic}"`, { reason });
      }
    }

    // If all research agents failed, return error
    if (successfulResults.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Research',
        summary: 'All research agents failed',
        warnings,
      });
      return {
        success: false,
        summary: 'All research agents failed. Check AI provider connectivity.',
        warnings,
      };
    }

    // --- Step 5: Synthesis (D-10) ---
    const synthProgress = ctx.ui.progress({ title: 'Synthesizing research...', total: 1 });

    let researchContent: string;
    let synthesisFailed = false;

    try {
      const synthesisResult = await ctx.agent.run({
        role: 'planning',
        prompt: buildResearchSynthesizePrompt({
          topicResults: successfulResults,
          phaseGoal,
          requirements,
        }),
        permissions: PLANNING_PERMISSIONS,
        timeout: 180_000,
      });

      researchContent = synthesisResult.outputText;
      synthProgress.update({ completed: 1, message: 'Synthesis complete' });
    } catch (err) {
      // Synthesis failed -- write raw results as fallback
      synthesisFailed = true;
      const message = err instanceof Error ? err.message : 'Unknown synthesis error';
      warnings.push(`Synthesis failed: ${message}. Writing raw research results as fallback.`);
      ctx.log.warn('Synthesis failed, using raw results fallback', { error: message });

      researchContent = `# Phase ${phaseNumber}: Research (Raw Results)\n\n> Synthesis failed. Raw per-topic results below.\n\n`;
      for (const tr of successfulResults) {
        researchContent += `## Topic: ${tr.topic}\n\n${tr.content}\n\n---\n\n`;
      }
    }

    synthProgress.done({ summary: synthesisFailed ? 'Synthesis failed (fallback)' : 'Synthesis complete' });

    // --- Step 6: Write RESEARCH.md ---
    await mkdir(phaseDir, { recursive: true });
    const researchPath = join(phaseDir, `${padded}-RESEARCH.md`);
    await writeFile(researchPath, researchContent, 'utf-8');

    ctx.log.info('RESEARCH.md written', { path: researchPath });

    // --- Step 7: Return result ---
    const summary = `${successfulResults.length}/${topics.length} topics researched, RESEARCH.md written to ${padded}-RESEARCH.md`;

    await ctx.ui.result({
      success: true,
      title: 'Research',
      summary,
      details: [
        `Phase: ${phaseNumber}`,
        `Topics researched: ${successfulResults.map((r) => r.topic).join(', ')}`,
        `Output: ${researchPath}`,
        ...(synthesisFailed ? ['Note: Synthesis failed, raw results written as fallback'] : []),
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    return {
      success: true,
      summary,
      data: {
        phaseNumber,
        topics: successfulResults.map((r) => r.topic),
        topicsFailed: topics.filter(
          (t) => !successfulResults.some((r) => r.topic === t),
        ),
        researchPath,
        synthesisFailed,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
});
