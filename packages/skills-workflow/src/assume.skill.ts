/**
 * @sunco/skills-workflow - Assume Skill
 *
 * Agent-powered approach preview: reads CONTEXT.md + ROADMAP.md,
 * dispatches a single planning agent to produce structured assumptions,
 * presents them for user correction, and appends corrections to CONTEXT.md.
 *
 * Command: sunco assume
 *
 * Requirements: WF-10
 * Decisions: D-05 (approach preview), D-06 (corrections to CONTEXT.md), D-07 (single agent)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import type { PermissionSet } from '@sunco/core';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { buildAssumePrompt } from './prompts/assume.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Read-only permissions for the planning agent (D-07) */
const ASSUME_PERMISSIONS: PermissionSet = {
  role: 'planning',
  readPaths: ['**'],
  writePaths: [],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Assumption {
  id: string;
  area: string;
  assumption: string;
  confidence: string;
  rationale: string;
  alternative: string;
}

interface Correction {
  assumptionId: string;
  area: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Helpers: Phase directory resolution (inline, per plan note about 05-01)
// ---------------------------------------------------------------------------

/**
 * Find the phase directory matching a phase number.
 * Scans .planning/phases/ for a directory starting with the zero-padded number.
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
 * Read an artifact file from a phase directory.
 */
async function readPhaseArtifact(
  cwd: string,
  phaseNumber: number,
  filename: string,
): Promise<string | null> {
  const dir = await resolvePhaseDir(cwd, phaseNumber);
  if (!dir) return null;
  try {
    return await readFile(join(dir, filename), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Write an artifact file to a phase directory.
 * Creates the directory if needed.
 */
async function writePhaseArtifact(
  cwd: string,
  phaseNumber: number,
  filename: string,
  content: string,
): Promise<string> {
  const dir = await resolvePhaseDir(cwd, phaseNumber);
  if (!dir) {
    throw new Error(`Phase directory not found for phase ${phaseNumber}`);
  }
  await mkdir(dir, { recursive: true });
  const targetPath = join(dir, filename);
  // Path traversal guard
  const rel = relative(dir, resolve(dir, filename));
  if (rel.startsWith('..') || rel.includes('..')) {
    throw new Error(`Path traversal detected: ${filename}`);
  }
  await writeFile(targetPath, content, 'utf-8');
  return targetPath;
}

// ---------------------------------------------------------------------------
// Helpers: STATE.md phase extraction
// ---------------------------------------------------------------------------

/**
 * Extract current phase number from STATE.md.
 */
function extractPhaseFromState(stateMd: string): number | null {
  const match = /^Phase:\s*(\d+)/m.exec(stateMd);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers: Assumption parsing
// ---------------------------------------------------------------------------

/**
 * Parse agent output into Assumption objects.
 * Splits on ---ASSUMPTION--- separator and extracts fields.
 */
function parseAssumptions(agentOutput: string): Assumption[] {
  const blocks = agentOutput.split('---ASSUMPTION---').filter((b) => b.trim());
  const assumptions: Assumption[] = [];

  for (const block of blocks) {
    const id = extractField(block, 'ID');
    const area = extractField(block, 'AREA');
    const assumption = extractField(block, 'ASSUMPTION');
    const confidence = extractField(block, 'CONFIDENCE');
    const rationale = extractField(block, 'RATIONALE');
    const alternative = extractField(block, 'ALTERNATIVE');

    // Skip blocks missing required fields
    if (!id || !assumption) continue;

    assumptions.push({
      id,
      area: area || 'General',
      assumption,
      confidence: confidence || 'MEDIUM',
      rationale: rationale || '',
      alternative: alternative || '',
    });
  }

  return assumptions;
}

/**
 * Extract a field value from an assumption block.
 * Matches "FIELD: value" pattern (value can span to next field line).
 */
function extractField(block: string, fieldName: string): string {
  const re = new RegExp(`^${fieldName}:\\s*(.+?)(?=\\n[A-Z]+:|$)`, 'ms');
  const match = re.exec(block);
  return match ? match[1].trim() : '';
}

// ---------------------------------------------------------------------------
// Helpers: CONTEXT.md append
// ---------------------------------------------------------------------------

/**
 * Find the highest decision number in CONTEXT.md.
 * Looks for "D-{N}:" patterns.
 */
function findLastDecisionNumber(contextMd: string): number {
  const re = /\bD-(\d+):/g;
  let max = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(contextMd)) !== null) {
    const num = parseInt(match[1], 10);
    if (num > max) max = num;
  }
  return max;
}

/**
 * Append corrections as new locked decisions to CONTEXT.md.
 * Inserts before </decisions> tag or before "### Claude's Discretion" if present.
 * CRITICAL: Read-modify-write pattern (Pitfall 6 from RESEARCH.md).
 */
function appendCorrections(contextMd: string, corrections: Correction[]): string {
  if (corrections.length === 0) return contextMd;

  const lastNum = findLastDecisionNumber(contextMd);
  const newDecisions: string[] = [];

  for (let i = 0; i < corrections.length; i++) {
    const c = corrections[i]!;
    const decNum = lastNum + i + 1;
    newDecisions.push(
      `- **D-${String(decNum).padStart(2, '0')}:** [CORRECTION from assume] ${c.text} (corrects assumption ${c.assumptionId})`,
    );
  }

  const insertBlock = '\n' + newDecisions.join('\n') + '\n';

  // Try to insert before "### Claude's Discretion" first
  const discretionIdx = contextMd.indexOf("### Claude's Discretion");
  if (discretionIdx !== -1) {
    return contextMd.slice(0, discretionIdx) + insertBlock + '\n' + contextMd.slice(discretionIdx);
  }

  // Otherwise insert before </decisions> tag
  const closingTag = '</decisions>';
  const closingIdx = contextMd.indexOf(closingTag);
  if (closingIdx !== -1) {
    return contextMd.slice(0, closingIdx) + insertBlock + contextMd.slice(closingIdx);
  }

  // Fallback: append at end
  return contextMd + insertBlock;
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.assume',
  command: 'assume',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Preview what the agent would do before execution',
  options: [
    { flags: '-p, --phase <number>', description: 'Phase number (default: current from STATE.md)' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'Assume',
      description: 'Agent-powered approach preview',
    });

    // -----------------------------------------------------------------------
    // Step 0: Provider check
    // -----------------------------------------------------------------------
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      const msg = 'No AI provider available. Install Claude Code CLI or set ANTHROPIC_API_KEY to use sunco assume.';
      await ctx.ui.result({ success: false, title: 'Assume', summary: msg });
      return { success: false, summary: msg };
    }

    // -----------------------------------------------------------------------
    // Step 1: Determine phase number
    // -----------------------------------------------------------------------
    let phaseNumber: number | null = null;

    if (ctx.args.phase !== undefined) {
      phaseNumber = Number(ctx.args.phase);
    } else {
      // Read from STATE.md
      const stateMdPath = join(ctx.cwd, '.planning', 'STATE.md');
      try {
        const stateMd = await readFile(stateMdPath, 'utf-8');
        phaseNumber = extractPhaseFromState(stateMd);
      } catch {
        // STATE.md not found, will fail at CONTEXT.md read
      }
    }

    if (phaseNumber === null) {
      const msg = 'Cannot determine phase number. Provide --phase or ensure STATE.md exists.';
      await ctx.ui.result({ success: false, title: 'Assume', summary: msg });
      return { success: false, summary: msg };
    }

    // -----------------------------------------------------------------------
    // Step 2: Read CONTEXT.md + ROADMAP.md
    // -----------------------------------------------------------------------
    const padded = String(phaseNumber).padStart(2, '0');
    const contextMd = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-CONTEXT.md`);

    if (!contextMd) {
      const msg = 'No CONTEXT.md found. Run sunco discuss first.';
      await ctx.ui.result({ success: false, title: 'Assume', summary: msg });
      return { success: false, summary: msg };
    }

    const roadmapMd = await readFile(join(ctx.cwd, '.planning', 'ROADMAP.md'), 'utf-8').catch(
      () => 'ROADMAP.md not available.',
    );

    // Extract phase goal from ROADMAP.md
    const goalRe = new RegExp(`Phase\\s+${phaseNumber}[^\\n]*\\n([^\\n]+)`, 'i');
    const goalMatch = goalRe.exec(roadmapMd);
    const phaseGoal = goalMatch ? goalMatch[1].trim() : `Phase ${phaseNumber} implementation`;

    // -----------------------------------------------------------------------
    // Step 3: Dispatch single planning agent (D-07)
    // -----------------------------------------------------------------------
    const agentProgress = ctx.ui.progress({ title: 'Analyzing approach' });

    const agentResult = await ctx.agent.run({
      role: 'planning',
      prompt: buildAssumePrompt({
        contextMd,
        roadmapMd,
        phaseGoal,
        requirements: [],
        codebaseContext: '',
      }),
      permissions: ASSUME_PERMISSIONS,
      timeout: 120_000,
    });

    agentProgress.done({ summary: 'Analysis complete' });

    if (!agentResult.success) {
      const msg = 'Assume agent failed. Check agent logs for details.';
      await ctx.ui.result({ success: false, title: 'Assume', summary: msg });
      return { success: false, summary: msg };
    }

    // -----------------------------------------------------------------------
    // Step 4: Parse assumptions
    // -----------------------------------------------------------------------
    const assumptions = parseAssumptions(agentResult.outputText);

    // -----------------------------------------------------------------------
    // Step 5: Present assumptions to user for review
    // -----------------------------------------------------------------------
    const corrections: Correction[] = [];

    for (const assumption of assumptions) {
      const result = await ctx.ui.ask({
        message: `[${assumption.confidence}] ${assumption.area}: ${assumption.assumption}`,
        options: [
          { id: 'approve', label: 'Correct', isRecommended: true },
          { id: 'correct', label: 'Needs correction' },
        ],
      });

      if (result.selectedId === 'correct') {
        const textResult = await ctx.ui.askText({
          message: 'What should be done instead?',
        });
        if (textResult.text) {
          corrections.push({
            assumptionId: assumption.id,
            area: assumption.area,
            text: textResult.text,
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 6: Append corrections to CONTEXT.md (D-06)
    // -----------------------------------------------------------------------
    if (corrections.length > 0) {
      // Re-read CONTEXT.md for read-modify-write safety (Pitfall 6)
      const freshContextMd = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-CONTEXT.md`);
      if (freshContextMd) {
        const updated = appendCorrections(freshContextMd, corrections);
        await writePhaseArtifact(ctx.cwd, phaseNumber, `${padded}-CONTEXT.md`, updated);
      }
    }

    // -----------------------------------------------------------------------
    // Step 7: Return result
    // -----------------------------------------------------------------------
    const approved = assumptions.length - corrections.length;
    const summary = `Reviewed ${assumptions.length} assumptions. ${approved} approved, ${corrections.length} corrected.`;

    await ctx.ui.result({
      success: true,
      title: 'Assume',
      summary,
      details: corrections.map(
        (c) => `Corrected ${c.assumptionId} (${c.area}): ${c.text}`,
      ),
    });

    return {
      success: true,
      summary,
      data: {
        totalAssumptions: assumptions.length,
        approved,
        corrected: corrections.length,
        corrections: corrections.map((c) => ({
          assumptionId: c.assumptionId,
          area: c.area,
          correction: c.text,
        })),
      },
    };
  },
});
