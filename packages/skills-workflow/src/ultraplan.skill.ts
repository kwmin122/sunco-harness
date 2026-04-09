/**
 * @sunco/skills-workflow - Ultraplan Skill
 *
 * Bridges SUNCO planning pipeline with Claude Code's /ultraplan
 * browser-based visual review. Two modes:
 *
 * - Prepare (default): Reads existing PLAN.md files + context,
 *   writes NN-ULTRAPLAN-PROMPT.md to phase dir, prints path.
 *   User then invokes /ultraplan with the prompt.
 *
 * - Prepare --draft: Creates new plans from CONTEXT/RESEARCH
 *   (when no PLAN.md exists yet).
 *
 * - Import (--import): Parses ultraplan output back into
 *   SUNCO PLAN.md files with parsePlanMd validation.
 *
 * Stage: experimental (Claude /ultraplan is research preview)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { readFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { buildUltraplanReviewPrompt, buildUltraplanDraftPrompt, parseUltraplanOutput } from './prompts/ultraplan.js';
import { parsePlanMd } from './shared/plan-parser.js';
import { resolvePhaseDir, readPhaseArtifact, writePhaseArtifact } from './shared/phase-reader.js';
import { parseRoadmap } from './shared/roadmap-parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract phase slug from directory name (e.g., "05-context-planning" → "context-planning") */
function extractSlug(dirName: string): string {
  const match = dirName.match(/^\d+-(.+)$/);
  return match?.[1] ?? dirName;
}

/** Extract phase info from ROADMAP.md */
interface PhaseInfo {
  goal: string;
  requirements: string[];
  slug: string;
}

function extractPhaseInfo(roadmapContent: string, phaseNumber: number): PhaseInfo {
  const { phases } = parseRoadmap(roadmapContent);
  const phase = phases.find((p) => p.number === phaseNumber);

  return {
    goal: phase ? `${phase.name} - ${phase.description}` : `Phase ${phaseNumber}`,
    requirements: phase?.requirements ?? [],
    slug: phase?.name ?? `phase-${phaseNumber}`,
  };
}

/** Determine phase number from args or STATE.md */
async function determinePhaseNumber(ctx: SkillContext): Promise<number | null> {
  const phaseArg = ctx.args['phase'] as string | number | undefined;
  if (phaseArg !== undefined) {
    const num = Number(phaseArg);
    if (isNaN(num) || num <= 0) return null;
    return num;
  }

  const statePath = join(ctx.cwd, '.planning', 'STATE.md');
  try {
    const stateContent = await readFile(statePath, 'utf-8');
    const match = /^Phase:\s*(\d+)/m.exec(stateContent);
    if (match) return parseInt(match[1], 10);
  } catch {
    // STATE.md doesn't exist
  }

  return null;
}

/** Read all *-PLAN.md files from phase directory */
async function readPlanFiles(
  phaseDir: string,
  padded: string,
): Promise<Array<{ filename: string; content: string }>> {
  const entries = await readdir(phaseDir);
  const planFiles = entries
    .filter((f) => f.match(new RegExp(`^${padded}-\\d+-PLAN\\.md$`)))
    .sort();

  const results: Array<{ filename: string; content: string }> = [];
  for (const filename of planFiles) {
    const content = await readFile(join(phaseDir, filename), 'utf-8');
    results.push({ filename, content });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.ultraplan',
  command: 'ultraplan',
  kind: 'deterministic',
  stage: 'experimental',
  category: 'workflow',
  routing: 'routable',
  complexity: 'simple',
  tier: 'expert',
  description: 'Bridge to Claude Code /ultraplan — browser-based visual plan review',
  options: [
    { flags: '-p, --phase <number>', description: 'Target phase number' },
    { flags: '--import', description: 'Import mode: parse ultraplan output into PLAN.md files' },
    { flags: '--draft', description: 'Draft mode: create new plans from context (no existing PLAN.md required)' },
    { flags: '-f, --file <path>', description: 'File path for import mode input' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const isImport = !!ctx.args['import'];
    const isDraft = !!ctx.args['draft'];

    if (isImport) {
      return await handleImport(ctx);
    }

    return isDraft ? await handlePrepareDraft(ctx) : await handlePrepareReview(ctx);
  },
});

// ---------------------------------------------------------------------------
// Prepare Review Mode (default)
// ---------------------------------------------------------------------------

async function handlePrepareReview(ctx: SkillContext): Promise<SkillResult> {
  await ctx.ui.entry({ title: 'Ultraplan', description: 'Preparing plan review prompt...' });

  const phaseNumber = await determinePhaseNumber(ctx);
  if (phaseNumber === null) {
    const msg = 'No phase number provided. Use --phase <N> or ensure STATE.md has current phase.';
    await ctx.ui.result({ success: false, title: 'Ultraplan', summary: msg });
    return { success: false, summary: msg };
  }

  const padded = String(phaseNumber).padStart(2, '0');
  const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);
  if (!phaseDir) {
    const msg = `Phase ${phaseNumber} directory not found in .planning/phases/`;
    await ctx.ui.result({ success: false, title: 'Ultraplan', summary: msg });
    return { success: false, summary: msg };
  }

  // Read existing PLAN.md files (required for review mode)
  const planFiles = await readPlanFiles(phaseDir, padded);
  if (planFiles.length === 0) {
    const msg = `No PLAN.md files found for Phase ${phaseNumber}. Run \`sunco plan --phase ${phaseNumber}\` first, or use \`sunco ultraplan --draft\` to create new plans.`;
    await ctx.ui.result({ success: false, title: 'Ultraplan', summary: msg });
    return { success: false, summary: msg };
  }

  // Read context artifacts (optional)
  const contextMd = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-CONTEXT.md`) ?? '';
  const researchMd = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-RESEARCH.md`) ?? '';

  // Read roadmap for phase info
  const slug = extractSlug(basename(phaseDir));
  let phaseGoal = `Phase ${phaseNumber}`;
  let requirements: string[] = [];

  try {
    const roadmapContent = await readFile(join(ctx.cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    const info = extractPhaseInfo(roadmapContent, phaseNumber);
    phaseGoal = info.goal;
    requirements = info.requirements;
  } catch {
    // ROADMAP.md not available
  }

  // Build prompt
  const prompt = buildUltraplanReviewPrompt({
    planFiles,
    contextMd,
    researchMd,
    phaseGoal,
    requirements,
    phaseSlug: slug,
    paddedPhase: padded,
  });

  // Write to phase directory
  const outputFilename = `${padded}-ULTRAPLAN-PROMPT.md`;
  const outputPath = await writePhaseArtifact(ctx.cwd, phaseNumber, slug, outputFilename, prompt);

  const summary = `Ultraplan review prompt written to ${outputFilename} (${planFiles.length} plans included)`;
  await ctx.ui.result({
    success: true,
    title: 'Ultraplan',
    summary,
    details: [
      `Plans included: ${planFiles.map((p) => p.filename).join(', ')}`,
      `Output: ${outputPath}`,
      '',
      'Next: Copy the prompt and run /ultraplan in Claude Code,',
      'or include "ultraplan" in your prompt with the file content.',
    ],
  });

  return {
    success: true,
    summary,
    data: { outputPath, planCount: planFiles.length },
  };
}

// ---------------------------------------------------------------------------
// Prepare Draft Mode (--draft)
// ---------------------------------------------------------------------------

async function handlePrepareDraft(ctx: SkillContext): Promise<SkillResult> {
  await ctx.ui.entry({ title: 'Ultraplan', description: 'Preparing draft plan prompt...' });

  const phaseNumber = await determinePhaseNumber(ctx);
  if (phaseNumber === null) {
    const msg = 'No phase number provided. Use --phase <N> or ensure STATE.md has current phase.';
    await ctx.ui.result({ success: false, title: 'Ultraplan', summary: msg });
    return { success: false, summary: msg };
  }

  const padded = String(phaseNumber).padStart(2, '0');

  // CONTEXT.md is required for draft mode
  const contextMd = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-CONTEXT.md`);
  if (!contextMd) {
    const msg = `CONTEXT.md not found for Phase ${phaseNumber}. Run \`sunco discuss --phase ${phaseNumber}\` first.`;
    await ctx.ui.result({ success: false, title: 'Ultraplan', summary: msg });
    return { success: false, summary: msg };
  }

  const researchMd = await readPhaseArtifact(ctx.cwd, phaseNumber, `${padded}-RESEARCH.md`) ?? '';
  let requirementsMd = '';
  let roadmapMd = '';
  let phaseGoal = `Phase ${phaseNumber}`;
  let requirements: string[] = [];
  let slug = `phase-${phaseNumber}`;

  try {
    requirementsMd = await readFile(join(ctx.cwd, '.planning', 'REQUIREMENTS.md'), 'utf-8');
  } catch { /* optional */ }

  try {
    roadmapMd = await readFile(join(ctx.cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    const info = extractPhaseInfo(roadmapMd, phaseNumber);
    phaseGoal = info.goal;
    requirements = info.requirements;
    slug = info.slug;
  } catch { /* optional */ }

  // Resolve actual slug from phase dir if it exists
  const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);
  if (phaseDir) {
    slug = extractSlug(basename(phaseDir));
  }

  const prompt = buildUltraplanDraftPrompt({
    contextMd,
    researchMd,
    requirementsMd,
    roadmapMd,
    phaseGoal,
    requirements,
    phaseSlug: slug,
    paddedPhase: padded,
  });

  const outputFilename = `${padded}-ULTRAPLAN-PROMPT.md`;
  const outputPath = await writePhaseArtifact(ctx.cwd, phaseNumber, slug, outputFilename, prompt);

  const summary = `Ultraplan draft prompt written to ${outputFilename}`;
  await ctx.ui.result({
    success: true,
    title: 'Ultraplan',
    summary,
    details: [
      `Output: ${outputPath}`,
      '',
      'Next: Copy the prompt and run /ultraplan in Claude Code.',
    ],
  });

  return {
    success: true,
    summary,
    data: { outputPath, mode: 'draft' },
  };
}

// ---------------------------------------------------------------------------
// Import Mode (--import)
// ---------------------------------------------------------------------------

async function handleImport(ctx: SkillContext): Promise<SkillResult> {
  await ctx.ui.entry({ title: 'Ultraplan Import', description: 'Importing ultraplan output...' });

  const phaseNumber = await determinePhaseNumber(ctx);
  if (phaseNumber === null) {
    const msg = 'No phase number provided. Use --phase <N>.';
    await ctx.ui.result({ success: false, title: 'Ultraplan Import', summary: msg });
    return { success: false, summary: msg };
  }

  // Read ultraplan output from file or interactive input
  let rawContent: string;
  const filePath = ctx.args['file'] as string | undefined;

  if (filePath) {
    try {
      rawContent = await readFile(filePath, 'utf-8');
    } catch {
      const msg = `Cannot read file: ${filePath}`;
      await ctx.ui.result({ success: false, title: 'Ultraplan Import', summary: msg });
      return { success: false, summary: msg };
    }
  } else {
    const response = await ctx.ui.askText({
      message: 'Paste the ultraplan output (or provide --file <path>):',
      placeholder: 'Paste ultraplan result here...',
    });
    rawContent = response.text;
  }

  if (!rawContent.trim()) {
    const msg = 'Empty ultraplan output provided.';
    await ctx.ui.result({ success: false, title: 'Ultraplan Import', summary: msg });
    return { success: false, summary: msg };
  }

  // Resolve phase slug
  const padded = String(phaseNumber).padStart(2, '0');
  let slug = `phase-${phaseNumber}`;

  const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);
  if (phaseDir) {
    slug = extractSlug(basename(phaseDir));
  } else {
    // Try roadmap for slug
    try {
      const roadmapContent = await readFile(join(ctx.cwd, '.planning', 'ROADMAP.md'), 'utf-8');
      const info = extractPhaseInfo(roadmapContent, phaseNumber);
      slug = info.slug;
    } catch { /* use default */ }
  }

  // Parse ultraplan output into plan segments
  const planSegments = parseUltraplanOutput(rawContent, phaseNumber, slug);
  if (planSegments.length === 0) {
    const msg = 'Could not parse any plans from ultraplan output.';
    await ctx.ui.result({ success: false, title: 'Ultraplan Import', summary: msg });
    return { success: false, summary: msg };
  }

  // Validate each segment with parsePlanMd and write valid ones
  const written: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < planSegments.length; i++) {
    const segment = planSegments[i];
    const planNum = String(i + 1).padStart(2, '0');
    const filename = `${padded}-${planNum}-PLAN.md`;

    // Validate with parsePlanMd
    try {
      parsePlanMd(segment);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      warnings.push(`${filename}: validation failed — ${errMsg}`);
      continue;
    }

    // Write to phase directory
    await writePhaseArtifact(ctx.cwd, phaseNumber, slug, filename, segment);
    written.push(filename);
  }

  if (written.length === 0) {
    const msg = `All ${planSegments.length} plans failed validation.`;
    await ctx.ui.result({
      success: false,
      title: 'Ultraplan Import',
      summary: msg,
      details: warnings,
    });
    return { success: false, summary: msg, warnings };
  }

  const summary = `Imported ${written.length}/${planSegments.length} plans for Phase ${phaseNumber}`;
  await ctx.ui.result({
    success: true,
    title: 'Ultraplan Import',
    summary,
    details: [
      `Written: ${written.join(', ')}`,
      ...(warnings.length > 0 ? ['', 'Warnings:', ...warnings] : []),
      '',
      `Next: Run \`sunco execute --phase ${phaseNumber}\` to execute.`,
    ],
  });

  return {
    success: true,
    summary,
    data: { written, planCount: written.length },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
