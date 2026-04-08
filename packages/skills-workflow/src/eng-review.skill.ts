/**
 * @sunco/skills-workflow - Engineering Review Skill
 *
 * Engineering manager-mode plan review. Looks at architecture,
 * code quality, test coverage, and performance concerns before
 * execution begins. Catches over-engineering, missing edge cases,
 * and structural debt before it gets baked in.
 *
 * Reads plan files, CONTEXT.md, and RESEARCH.md for the phase,
 * then produces a structured ENG-REVIEW.md.
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

function buildEngReviewPrompt(params: {
  phaseNumber: number;
  phaseName: string;
  phaseDescription: string;
  planContent: string | null;
  contextContent: string | null;
  researchContent: string | null;
}): string {
  const {
    phaseNumber,
    phaseName,
    phaseDescription,
    planContent,
    contextContent,
    researchContent,
  } = params;

  const padded = String(phaseNumber).padStart(2, '0');

  return `You are an engineering manager reviewing Phase ${padded} (${phaseName}) before the team starts coding.
Your job is to catch structural problems, scope creep, and quality risks before they become expensive.
Be direct. Name specific files, functions, and patterns where relevant.

---
PHASE GOAL:
${phaseDescription}

---
PLAN:
${planContent ?? '(no plan written yet)'}

${contextContent ? `---\nCONTEXT:\n${contextContent}\n` : ''}
${researchContent ? `---\nRESEARCH:\n${researchContent}\n` : ''}

---
Your review MUST cover these 5 sections:

## 1. Scope Challenge
- How much of this can be done with EXISTING code? List specific reuse opportunities.
- Count the new files this plan will create. If >8, explain why each one is truly necessary (smell threshold: 8 files).
- Where is complexity hiding that looks simple in the plan?

## 2. Architecture Review
For each major component in the plan:
- What are the dependencies? Is the dependency graph clean (no cycles)?
- What is the data flow? Where are the boundaries?
- What are the failure modes? What happens when X fails?
- Flag any components that will be hard to change later.

## 3. Code Quality
- DRY violations: what will get duplicated if we follow this plan as written?
- Error handling: where are the missing try/catch or null checks?
- Edge cases: list 3-5 specific inputs or states this plan doesn't handle.
- TypeScript: where will types get weak (any, unknown, type assertions)?

## 4. Test Coverage Diagram
Draw an ASCII diagram showing the test coverage plan:

\`\`\`
[Unit: X%] ─── [Integration: Y%] ─── [E2E: Z%]
     │                │                   │
[component A]   [scenario B]         [flow C]
\`\`\`

Then list:
- What is NOT being tested and why that's acceptable (or not)
- The 3 test cases most likely to catch real bugs

## 5. Performance Review
- N+1 query risks: where will we call the same data multiple times in a loop?
- Memory: any unbounded data structures (arrays that grow, caches without eviction)?
- Caching: what should be cached that isn't planned to be?
- Startup cost: will this slow down the CLI's first-run time?

---
End with a one-line **Engineering Verdict**: GO / GO WITH CONDITIONS / HOLD
If GO WITH CONDITIONS: list the conditions (max 3).
If HOLD: state the blocking issue.`;
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.eng-review',
  command: 'eng-review',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  complexity: 'standard',
  description: 'Engineering manager-mode plan review — architecture, tests, performance',
  options: [
    { flags: '-p, --phase <number>', description: 'Phase number' },
  ],

  async execute(ctx) {
    await ctx.ui.entry({
      title: 'Eng Review',
      description: 'Engineering manager review — architecture, quality, tests, performance',
    });

    // --- Step 0: Check provider ---
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      const msg = 'No AI provider available. Set ANTHROPIC_API_KEY or install Claude Code CLI.';
      await ctx.ui.result({ success: false, title: 'Eng Review', summary: msg });
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
          await ctx.ui.result({ success: false, title: 'Eng Review', summary: msg });
          return { success: false, summary: msg };
        }
        phaseNumber = state.phase;
      } catch {
        const msg = 'STATE.md not found. Use --phase to specify the target phase.';
        await ctx.ui.result({ success: false, title: 'Eng Review', summary: msg });
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
      await ctx.ui.result({ success: false, title: 'Eng Review', summary: msg });
      return { success: false, summary: msg };
    }

    const roadmap = parseRoadmap(roadmapContent);
    const targetPhase = roadmap.phases.find((p) => Number(p.number) === phaseNumber);
    if (!targetPhase) {
      const msg = `Phase ${phaseNumber} not found in ROADMAP.md.`;
      await ctx.ui.result({ success: false, title: 'Eng Review', summary: msg });
      return { success: false, summary: msg };
    }

    // --- Step 3: Read phase artifacts ---
    const gatherProgress = ctx.ui.progress({ title: 'Reading phase artifacts' });

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
    if (!planContent) {
      planContent = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-PLAN.md`);
    }
    const contextContent = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-CONTEXT.md`);
    const researchContent = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-RESEARCH.md`);

    gatherProgress.done({ summary: 'Artifacts loaded' });

    // --- Step 4: Run agent ---
    const reviewProgress = ctx.ui.progress({ title: 'Running engineering review...' });

    const agentResult = await ctx.agent.run({
      role: 'planning',
      prompt: buildEngReviewPrompt({
        phaseNumber,
        phaseName: targetPhase.name,
        phaseDescription: targetPhase.description,
        planContent,
        contextContent,
        researchContent,
      }),
      permissions: PLANNING_PERMISSIONS,
      timeout: 120_000,
    });

    reviewProgress.done({ summary: 'Engineering review complete' });

    const reviewContent = agentResult.outputText;

    // Detect verdict from output (best-effort)
    const verdictMatch = /Engineering Verdict[:\s]+(GO WITH CONDITIONS|GO|HOLD)/i.exec(reviewContent);
    const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'UNKNOWN';

    // --- Step 5: Write output ---
    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);
    const slug = phaseDir
      ? phaseDir.split('/').pop()!.replace(/^\d+-/, '')
      : targetPhase.name.toLowerCase().replace(/\s+/g, '-');

    const outputPath = await writePhaseArtifact(
      ctx.cwd,
      phaseNumber,
      slug,
      `${padded}-ENG-REVIEW.md`,
      `# Phase ${padded}: Engineering Review\n\n**Verdict:** ${verdict}\n**Date:** ${new Date().toISOString().split('T')[0]}\n\n${reviewContent}\n`,
    );

    ctx.log.info('ENG-REVIEW.md written', { path: outputPath, verdict });

    // --- Step 6: Return result ---
    const summary = `Engineering review complete — verdict: ${verdict}`;

    await ctx.ui.result({
      success: true,
      title: 'Eng Review',
      summary,
      details: [`Output: ${outputPath}`, `Phase: ${phaseNumber} — ${targetPhase.name}`, `Verdict: ${verdict}`],
    });

    return {
      success: true,
      summary,
      data: { outputPath, phaseNumber, verdict },
    };
  },
});
