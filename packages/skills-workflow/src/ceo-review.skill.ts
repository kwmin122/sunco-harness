/**
 * @sunco/skills-workflow - CEO Review Skill
 *
 * CEO/founder-mode plan review. Steps back from implementation
 * details to ask: are we solving the right problem? Is the scope
 * ambitious enough? What assumptions are we making?
 *
 * Reads the active plan + ROADMAP.md + CLAUDE.md, then produces
 * a structured CEO_REVIEW with star rating, premise challenges,
 * and a scope decision.
 */

import { defineSkill } from '@sunco/core';
import type { PermissionSet } from '@sunco/core';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { resolvePhaseDir, readPhaseArtifact, writePhaseArtifact } from './shared/phase-reader.js';
import { parseRoadmap } from './shared/roadmap-parser.js';
import { parseStateMd } from './shared/state-reader.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

function buildCeoReviewPrompt(params: {
  phaseNumber: number;
  phaseName: string;
  phaseDescription: string;
  planContent: string | null;
  roadmapContent: string;
  claudeMd: string | null;
  designContent: string | null;
  scopeMode: 'expand' | 'hold' | 'selective';
}): string {
  const {
    phaseNumber,
    phaseName,
    phaseDescription,
    planContent,
    roadmapContent,
    claudeMd,
    designContent,
    scopeMode,
  } = params;

  const padded = String(phaseNumber).padStart(2, '0');

  const scopeInstruction =
    scopeMode === 'expand'
      ? 'SCOPE MODE: Expansion — push the scope harder. What are we leaving on the table?'
      : scopeMode === 'hold'
        ? 'SCOPE MODE: Hold — defend current scope. Where might we be overbuilding?'
        : 'SCOPE MODE: Selective — identify the 1-2 items worth expanding and cut the rest.';

  return `You are a founder reviewing Phase ${padded} (${phaseName}) of a product with the eyes of a CEO.
Your job is not to rubber-stamp the plan. Your job is to stress-test it.

${scopeInstruction}

---
PROJECT CONTEXT (CLAUDE.md):
${claudeMd ?? '(not available)'}

---
ROADMAP:
${roadmapContent}

---
PHASE GOAL:
${phaseDescription}

---
CURRENT PLAN:
${planContent ?? '(no plan written yet)'}

${designContent ? `---\nDESIGN DOC:\n${designContent}\n` : ''}

---
Your review MUST cover these 5 sections in order:

## 1. The Real Problem
In 2-3 sentences: what problem are we ACTUALLY solving for users? Strip away the implementation language. Restate it in outcome terms.

## 2. The 10-Star Version
Describe the dream version of this feature/phase with no feasibility constraints. What would make this genuinely legendary? Be specific about what the experience would feel like, not just what it would do.

## 3. Premise Challenges
Identify 3-5 assumptions baked into the current plan. For each:
- State the assumption clearly
- Challenge it: what if this assumption is wrong?
- Rate the risk: HIGH / MEDIUM / LOW

## 4. Scope Decision
Given the scope mode (${scopeMode}), make a concrete recommendation:
- What to add / cut / hold based on the 10-star vision
- Which premises need validation before proceeding
- One sentence summary of the scope verdict

## 5. Star Rating
Rate the current plan on a 1-10 scale:
- 1-3: Solving the wrong problem or fundamentally misscoped
- 4-6: Right direction but missing key insight
- 7-8: Solid but not differentiated
- 9-10: Genuinely exceptional

Format: "X/10 — [one sentence reason]"

---
Write the review now. Be direct. Founders don't hedge.`;
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.ceo-review',
  command: 'ceo-review',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  complexity: 'standard',
  tier: 'expert',
  description: 'CEO/founder-mode plan review — product vision and scope',
  options: [
    { flags: '-p, --phase <number>', description: 'Phase number' },
    { flags: '--expand', description: 'Scope expansion mode' },
    { flags: '--hold', description: 'Hold scope mode' },
    { flags: '--selective', description: 'Selective expansion mode' },
  ],

  async execute(ctx) {
    await ctx.ui.entry({
      title: 'CEO Review',
      description: 'Founder-mode plan review — vision, premises, scope',
    });

    // --- Step 0: Check provider ---
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      const msg = 'No AI provider available. Set ANTHROPIC_API_KEY or install Claude Code CLI.';
      await ctx.ui.result({ success: false, title: 'CEO Review', summary: msg });
      return { success: false, summary: msg };
    }

    // --- Step 1: Resolve phase number ---
    let phaseNumber: number;

    if (typeof ctx.args.phase === 'number') {
      phaseNumber = ctx.args.phase;
    } else {
      try {
        const stateContent = await readFile(join(ctx.cwd, '.planning', 'STATE.md'), 'utf-8');
        const state = parseStateMd(stateContent as string);
        if (state.phase === null) {
          const msg = 'Cannot determine phase from STATE.md. Use --phase to specify.';
          await ctx.ui.result({ success: false, title: 'CEO Review', summary: msg });
          return { success: false, summary: msg };
        }
        phaseNumber = state.phase;
      } catch {
        const msg = 'STATE.md not found. Use --phase to specify the target phase.';
        await ctx.ui.result({ success: false, title: 'CEO Review', summary: msg });
        return { success: false, summary: msg };
      }
    }

    const padded = String(phaseNumber).padStart(2, '0');

    // --- Step 2: Read ROADMAP.md ---
    let roadmapContent: string;
    try {
      roadmapContent = await readFile(join(ctx.cwd, '.planning', 'ROADMAP.md'), 'utf-8') as string;
    } catch {
      const msg = 'ROADMAP.md not found. Run sunco new first.';
      await ctx.ui.result({ success: false, title: 'CEO Review', summary: msg });
      return { success: false, summary: msg };
    }

    const roadmap = parseRoadmap(roadmapContent);
    const targetPhase = roadmap.phases.find((p) => Number(p.number) === phaseNumber);
    if (!targetPhase) {
      const msg = `Phase ${phaseNumber} not found in ROADMAP.md.`;
      await ctx.ui.result({ success: false, title: 'CEO Review', summary: msg });
      return { success: false, summary: msg };
    }

    // --- Step 3: Read optional artifacts ---
    const gatherProgress = ctx.ui.progress({ title: 'Gathering context' });

    // Read all PLAN.md files (plan.skill writes NN-01-PLAN.md, NN-02-PLAN.md, etc.)
    let planContent: string | null = null;
    const phaseDir2 = await resolvePhaseDir(ctx.cwd, phaseNumber);
    if (phaseDir2) {
      try {
        const entries = await readdir(phaseDir2);
        const planFiles = entries.filter((e: string) => e.match(/-PLAN\.md$/) && !e.includes('SUMMARY'));
        if (planFiles.length > 0) {
          const plans: string[] = [];
          for (const f of planFiles.sort()) {
            plans.push(await readFile(join(phaseDir2, f), 'utf-8'));
          }
          planContent = plans.join('\n\n---\n\n');
        }
      } catch { /* no plans available */ }
    }
    // Fallback to single file pattern
    if (!planContent) {
      planContent = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-PLAN.md`);
    }

    let claudeMd: string | null = null;
    try {
      claudeMd = await readFile(join(ctx.cwd, 'CLAUDE.md'), 'utf-8') as string;
    } catch { /* optional */ }

    // Read design doc from .sun/designs/ if it exists
    let designContent: string | null = null;
    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);
    const slug = phaseDir
      ? phaseDir.split('/').pop()!.replace(/^\d+-/, '')
      : targetPhase.name.toLowerCase().replace(/\s+/g, '-');

    try {
      designContent = await readFile(
        join(ctx.cwd, '.sun', 'designs', `${padded}-${slug}.md`),
        'utf-8',
      ) as string;
    } catch { /* optional */ }

    gatherProgress.done({ summary: 'Context gathered' });

    // --- Step 4: Determine scope mode ---
    const scopeMode: 'expand' | 'hold' | 'selective' =
      ctx.args.expand ? 'expand' : ctx.args.hold ? 'hold' : 'selective';

    // --- Step 5: Run agent ---
    const reviewProgress = ctx.ui.progress({ title: 'Running CEO review...' });

    const agentResult = await ctx.agent.run({
      role: 'planning',
      prompt: buildCeoReviewPrompt({
        phaseNumber,
        phaseName: targetPhase.name,
        phaseDescription: targetPhase.description,
        planContent,
        roadmapContent,
        claudeMd,
        designContent,
        scopeMode,
      }),
      permissions: PLANNING_PERMISSIONS,
      timeout: 120_000,
    });

    reviewProgress.done({ summary: 'CEO review complete' });

    const reviewContent = agentResult.outputText;

    // --- Step 6: Write output ---
    const outputPath = await writePhaseArtifact(
      ctx.cwd,
      phaseNumber,
      slug,
      `${padded}-CEO-REVIEW.md`,
      `# Phase ${padded}: CEO Review\n\n**Scope mode:** ${scopeMode}\n**Date:** ${new Date().toISOString().split('T')[0]}\n\n${reviewContent}\n`,
    );

    ctx.log.info('CEO-REVIEW.md written', { path: outputPath });

    // --- Step 7: Return result ---
    const summary = `CEO review complete (${scopeMode} mode) — written to ${padded}-CEO-REVIEW.md`;

    await ctx.ui.result({
      success: true,
      title: 'CEO Review',
      summary,
      details: [`Output: ${outputPath}`, `Phase: ${phaseNumber} — ${targetPhase.name}`],
    });

    return {
      success: true,
      summary,
      data: { outputPath, phaseNumber, scopeMode },
    };
  },
});
