/**
 * @sunco/skills-workflow - Design Review Skill
 *
 * Designer's eye review of a plan or implementation. Scores 6 UX
 * dimensions from 0-10, identifies the gap to 10, and gives a
 * specific fix for each dimension.
 *
 * Supports --lite for a quick check without full dimensional scoring.
 * Writes DESIGN-REVIEW.md to the phase directory.
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

const UI_FILE_EXTENSIONS = ['.tsx', '.jsx', '.css', '.scss', '.less', '.ink.ts', '.ink.tsx'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Scan a directory recursively for UI-related files (surface-level scan).
 * Returns a list of relative paths, capped at 20 to avoid context bloat.
 */
async function scanUiFiles(cwd: string): Promise<string[]> {
  const uiFiles: string[] = [];
  const scanDirs = ['src', 'packages', 'components', 'ui'];

  for (const dir of scanDirs) {
    try {
      const entries = await readdir(join(cwd, dir), { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const hasUiExt = UI_FILE_EXTENSIONS.some((ext) => entry.name.endsWith(ext));
          if (hasUiExt) {
            uiFiles.push(join(dir, entry.name));
          }
        }
      }
    } catch { /* dir doesn't exist */ }

    if (uiFiles.length >= 20) break;
  }

  return uiFiles.slice(0, 20);
}

function buildDesignReviewPrompt(params: {
  phaseNumber: number;
  phaseName: string;
  phaseDescription: string;
  planContent: string | null;
  uiFiles: string[];
  lite: boolean;
}): string {
  const { phaseNumber, phaseName, phaseDescription, planContent, uiFiles, lite } = params;
  const padded = String(phaseNumber).padStart(2, '0');

  if (lite) {
    return `You are a senior product designer doing a quick UX check on Phase ${padded} (${phaseName}).

PHASE GOAL:
${phaseDescription}

PLAN:
${planContent ?? '(no plan written yet)'}

${uiFiles.length > 0 ? `UI FILES FOUND:\n${uiFiles.join('\n')}\n` : ''}

---
Do a quick design check. For each of the 6 dimensions, give a one-line status and one action item if needed:

1. **Information Hierarchy** — Can users find what they need without thinking?
2. **Interaction Design** — Do interactions feel natural and predictable?
3. **Error & Edge States** — Are errors handled gracefully and informatively?
4. **Visual Consistency** — Does this fit the existing design language?
5. **Accessibility (WCAG AA)** — Any obvious accessibility failures?
6. **CLI/Terminal UX** — Is the terminal output readable, scannable, and helpful?

End with: **Quick Verdict** — PASS / NEEDS WORK / BLOCK (one sentence reason).`;
  }

  return `You are a senior product designer reviewing Phase ${padded} (${phaseName}).
Your job is to score the UX quality of this plan and tell us exactly how to make it better.
Be specific. Vague design feedback is useless.

---
PHASE GOAL:
${phaseDescription}

---
PLAN:
${planContent ?? '(no plan written yet)'}

${uiFiles.length > 0 ? `---\nUI FILES IN PROJECT:\n${uiFiles.join('\n')}\n` : ''}

---
Score each of the 6 UX dimensions from 0-10. For each dimension:
- Current score with a one-sentence justification
- What the 10/10 version would look like (be specific, not abstract)
- One concrete fix to raise the score (file/component/copy change where relevant)

## Dimension 1: Information Hierarchy (0-10)
Users should be able to parse the output hierarchy in under 3 seconds.
Consider: heading levels, spacing, emphasis, progressive disclosure.

**Score:** X/10
**Justification:** [one sentence]
**10/10 version:** [what perfect looks like]
**Fix:** [specific actionable change]

## Dimension 2: Interaction Design (0-10)
Every action should feel obvious, reversible, and fast.
Consider: command discoverability, confirmation flows, keyboard shortcuts, undo.

**Score:** X/10
**Justification:** [one sentence]
**10/10 version:** [what perfect looks like]
**Fix:** [specific actionable change]

## Dimension 3: Error & Edge States (0-10)
Errors should tell users what happened, why, and what to do next.
Consider: empty states, validation errors, network failures, partial success.

**Score:** X/10
**Justification:** [one sentence]
**10/10 version:** [what perfect looks like]
**Fix:** [specific actionable change]

## Dimension 4: Visual Consistency (0-10)
The UI should feel like it belongs to the same product.
Consider: color usage, typography, spacing system, iconography.

**Score:** X/10
**Justification:** [one sentence]
**10/10 version:** [what perfect looks like]
**Fix:** [specific actionable change]

## Dimension 5: Accessibility — WCAG AA (0-10)
Every user should be able to use the product regardless of ability.
Consider: color contrast ratios, keyboard navigation, screen reader support, focus management.

**Score:** X/10
**Justification:** [one sentence]
**10/10 version:** [what perfect looks like]
**Fix:** [specific actionable change]

## Dimension 6: CLI/Terminal UX (0-10)
Terminal output should be scannable at a glance, not a wall of text.
Consider: progress feedback, success/error formatting, output density, color use, loading states.

**Score:** X/10
**Justification:** [one sentence]
**10/10 version:** [what perfect looks like]
**Fix:** [specific actionable change]

---
## Overall UX Score
Average the 6 dimensions. Round to one decimal.

**Total: X.X/10**

**Priority Fixes (top 3, ranked by impact):**
1. [fix 1]
2. [fix 2]
3. [fix 3]

**Design Verdict:** SHIP / SHIP WITH FIXES / REDESIGN (one sentence)`;
}

/**
 * Extract dimension scores from agent output (best-effort).
 * Returns an object with dimension names and scores.
 */
function extractScores(output: string): Record<string, number> {
  const scores: Record<string, number> = {};
  const scorePattern = /\*\*Score:\*\*\s*(\d+(?:\.\d+)?)\/10/g;
  const dimensionPattern = /##\s+Dimension\s+\d+:\s+([^\n(]+)/g;

  const dimensions: string[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = dimensionPattern.exec(output)) !== null) {
    dimensions.push(dm[1].trim());
  }

  let i = 0;
  let sm: RegExpExecArray | null;
  while ((sm = scorePattern.exec(output)) !== null) {
    const key = dimensions[i] ?? `dimension_${i + 1}`;
    scores[key] = parseFloat(sm[1]);
    i++;
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.design-review',
  command: 'design-review',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  complexity: 'standard',
  description: 'Designer-mode review — dimensional scoring and gap analysis',
  options: [
    { flags: '-p, --phase <number>', description: 'Phase number' },
    { flags: '--lite', description: 'Quick check without full dimensional scoring' },
  ],

  async execute(ctx) {
    const lite = Boolean(ctx.args.lite);

    await ctx.ui.entry({
      title: 'Design Review',
      description: lite ? 'Quick UX check' : '6-dimension UX scoring and gap analysis',
    });

    // --- Step 0: Check provider ---
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      const msg = 'No AI provider available. Set ANTHROPIC_API_KEY or install Claude Code CLI.';
      await ctx.ui.result({ success: false, title: 'Design Review', summary: msg });
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
          await ctx.ui.result({ success: false, title: 'Design Review', summary: msg });
          return { success: false, summary: msg };
        }
        phaseNumber = state.phase;
      } catch {
        const msg = 'STATE.md not found. Use --phase to specify the target phase.';
        await ctx.ui.result({ success: false, title: 'Design Review', summary: msg });
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
      await ctx.ui.result({ success: false, title: 'Design Review', summary: msg });
      return { success: false, summary: msg };
    }

    const roadmap = parseRoadmap(roadmapContent);
    const targetPhase = roadmap.phases.find((p) => Number(p.number) === phaseNumber);
    if (!targetPhase) {
      const msg = `Phase ${phaseNumber} not found in ROADMAP.md.`;
      await ctx.ui.result({ success: false, title: 'Design Review', summary: msg });
      return { success: false, summary: msg };
    }

    // --- Step 3: Gather artifacts ---
    const gatherProgress = ctx.ui.progress({ title: 'Scanning for UI files and plan' });

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
    const uiFiles = await scanUiFiles(ctx.cwd);

    gatherProgress.done({ summary: `Plan loaded, ${uiFiles.length} UI file(s) found` });

    // --- Step 4: Run agent ---
    const reviewProgress = ctx.ui.progress({
      title: lite ? 'Running quick design check...' : 'Running 6-dimension design review...',
    });

    const agentResult = await ctx.agent.run({
      role: 'planning',
      prompt: buildDesignReviewPrompt({
        phaseNumber,
        phaseName: targetPhase.name,
        phaseDescription: targetPhase.description,
        planContent,
        uiFiles,
        lite,
      }),
      permissions: PLANNING_PERMISSIONS,
      timeout: 120_000,
    });

    reviewProgress.done({ summary: 'Design review complete' });

    const reviewContent = agentResult.outputText;

    // Extract scores (full mode only)
    const scores = lite ? {} : extractScores(reviewContent);
    const scoreEntries = Object.entries(scores);
    const avgScore =
      scoreEntries.length > 0
        ? scoreEntries.reduce((sum, [, v]) => sum + v, 0) / scoreEntries.length
        : null;

    // Extract verdict (best-effort)
    const verdictMatch = /(?:Design|Quick)\s+Verdict[:\s]+(REDESIGN|SHIP WITH FIXES|SHIP|NEEDS WORK|PASS|BLOCK)/i.exec(reviewContent);
    const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'UNKNOWN';

    // --- Step 5: Write output ---
    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);
    const slug = phaseDir
      ? phaseDir.split('/').pop()!.replace(/^\d+-/, '')
      : targetPhase.name.toLowerCase().replace(/\s+/g, '-');

    const header = lite
      ? `# Phase ${padded}: Design Review (Lite)\n\n**Verdict:** ${verdict}\n**Date:** ${new Date().toISOString().split('T')[0]}\n\n`
      : `# Phase ${padded}: Design Review\n\n**Overall Score:** ${avgScore !== null ? `${avgScore.toFixed(1)}/10` : 'N/A'}\n**Verdict:** ${verdict}\n**Date:** ${new Date().toISOString().split('T')[0]}\n\n`;

    const outputPath = await writePhaseArtifact(
      ctx.cwd,
      phaseNumber,
      slug,
      `${padded}-DESIGN-REVIEW.md`,
      `${header}${reviewContent}\n`,
    );

    ctx.log.info('DESIGN-REVIEW.md written', { path: outputPath, verdict, avgScore });

    // --- Step 6: Return result ---
    const scoreSummary = avgScore !== null ? ` — overall ${avgScore.toFixed(1)}/10` : '';
    const summary = `Design review complete${scoreSummary}, verdict: ${verdict}`;

    const details = [
      `Output: ${outputPath}`,
      `Phase: ${phaseNumber} — ${targetPhase.name}`,
      `Verdict: ${verdict}`,
    ];

    if (!lite && scoreEntries.length > 0) {
      details.push(
        ...scoreEntries.map(([dim, score]) => `  ${dim}: ${score}/10`),
      );
    }

    await ctx.ui.result({
      success: true,
      title: 'Design Review',
      summary,
      details,
    });

    return {
      success: true,
      summary,
      data: {
        outputPath,
        phaseNumber,
        verdict,
        scores: scoreEntries.length > 0 ? scores : undefined,
        avgScore,
        lite,
      },
    };
  },
});
