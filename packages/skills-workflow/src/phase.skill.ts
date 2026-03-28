/**
 * @sunco/skills-workflow - Phase Management Skill
 *
 * Manage project phases in ROADMAP.md:
 *   sunco phase add "Name"           -- append with next sequential number
 *   sunco phase insert "Name" --after 3 -- insert as decimal (3.1) without renumbering
 *   sunco phase remove 5             -- remove if not started, renumber subsequent
 *
 * Requirements: PHZ-01 (add), PHZ-02 (insert), PHZ-03 (remove)
 * Decisions: D-10 (add), D-11 (insert/decimal), D-12 (remove/safety), D-13 (regex parsing)
 */

import { defineSkill } from '@sunco/core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { addPhase, insertPhase, removePhase } from './shared/roadmap-writer.js';
import { parseRoadmap } from './shared/roadmap-parser.js';

/**
 * Convert a name to kebab-case for directory slugs.
 * "Phase Name Here" -> "phase-name-here"
 */
function kebabCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Pad a phase number to 2 digits for directory naming.
 * 4 -> "04", 12 -> "12"
 */
function padPhaseNumber(num: number): string {
  return String(num).padStart(2, '0');
}

export default defineSkill({
  id: 'workflow.phase',
  command: 'phase',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Manage project phases: add, insert, and remove phases in ROADMAP.md',
  options: [
    { flags: '--after <n>', description: 'Insert after phase number (for insert subcommand)' },
  ],

  async execute(ctx) {
    const positionalArgs = (ctx.args._ as string[] | undefined) ?? [];
    const subcommand = positionalArgs[0];

    // No subcommand: show usage
    if (!subcommand) {
      await ctx.ui.result({
        success: true,
        title: 'Phase Management',
        summary: 'Usage: sunco phase <add|insert|remove> [args] [options]',
        details: [
          'Subcommands:',
          '  add "Phase Name"             Append a new phase with next sequential number',
          '  insert "Name" --after <n>    Insert as decimal phase (e.g., 3.1) after phase n',
          '  remove <n>                   Remove a not-started phase and renumber subsequent',
        ],
      });
      return { success: true, summary: 'Usage: sunco phase <add|insert|remove> [args] [options]' };
    }

    const roadmapPath = join(ctx.cwd, '.planning', 'ROADMAP.md');

    switch (subcommand) {
      case 'add':
        return handleAdd(ctx, positionalArgs, roadmapPath);
      case 'insert':
        return handleInsert(ctx, positionalArgs, roadmapPath);
      case 'remove':
        return handleRemove(ctx, positionalArgs, roadmapPath);
      default:
        return {
          success: false,
          summary: `Unknown subcommand: ${subcommand}. Use add, insert, or remove.`,
        };
    }
  },
});

async function handleAdd(
  ctx: Parameters<Parameters<typeof defineSkill>[0]['execute']>[0],
  args: string[],
  roadmapPath: string,
) {
  const name = args.slice(1).join(' ');
  if (!name) {
    return { success: false, summary: 'Usage: sunco phase add "Phase Name"' };
  }

  const content = await readFile(roadmapPath, 'utf-8');
  const slug = kebabCase(name);

  // Determine next phase number from current content
  const { phases } = parseRoadmap(content);
  let maxNum = 0;
  for (const p of phases) {
    const num = typeof p.number === 'number' ? p.number : parseInt(String(p.number), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
  const newNum = maxNum + 1;

  const description = name;
  const updated = addPhase(content, name, description);
  await writeFile(roadmapPath, updated, 'utf-8');

  // Create phase directory
  const dirName = `${padPhaseNumber(newNum)}-${slug}`;
  const dirPath = join(ctx.cwd, '.planning', 'phases', dirName);
  await mkdir(dirPath, { recursive: true });

  ctx.log.info(`Added Phase ${newNum}: ${name}`);
  await ctx.ui.result({
    success: true,
    title: 'Phase Added',
    summary: `Phase ${newNum}: ${name} added to ROADMAP.md`,
    details: [`Directory created: .planning/phases/${dirName}`],
  });

  return {
    success: true,
    summary: `Phase ${newNum}: ${name} added to ROADMAP.md`,
    data: { phaseNumber: newNum, directory: dirPath },
  };
}

async function handleInsert(
  ctx: Parameters<Parameters<typeof defineSkill>[0]['execute']>[0],
  args: string[],
  roadmapPath: string,
) {
  const name = args.slice(1).join(' ');
  if (!name) {
    return { success: false, summary: 'Usage: sunco phase insert "Phase Name" --after <n>' };
  }

  const afterStr = ctx.args.after as string | undefined;
  if (!afterStr) {
    return { success: false, summary: 'Missing --after option. Usage: sunco phase insert "Name" --after <n>' };
  }

  const afterPhase = parseInt(afterStr, 10);
  if (isNaN(afterPhase)) {
    return { success: false, summary: `Invalid phase number: ${afterStr}` };
  }

  const content = await readFile(roadmapPath, 'utf-8');
  const slug = kebabCase(name);
  const description = name;

  const updated = insertPhase(content, name, description, afterPhase);

  // Determine the decimal number that was assigned
  // Find existing decimal phases for this base number to compute the decimal
  const decimalRe = new RegExp(
    `\\*\\*Phase ${afterPhase}\\.(\\d+): ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*`,
  );
  const decimalMatch = decimalRe.exec(updated);
  const decimal = decimalMatch ? decimalMatch[1] : '1';
  const phaseNum = `${afterPhase}.${decimal}`;

  await writeFile(roadmapPath, updated, 'utf-8');

  // Create phase directory with decimal number
  const paddedBase = padPhaseNumber(afterPhase);
  const dirName = `${paddedBase}.${decimal}-${slug}`;
  const dirPath = join(ctx.cwd, '.planning', 'phases', dirName);
  await mkdir(dirPath, { recursive: true });

  ctx.log.info(`Inserted Phase ${phaseNum}: ${name}`);
  await ctx.ui.result({
    success: true,
    title: 'Phase Inserted',
    summary: `Phase ${phaseNum}: ${name} inserted after Phase ${afterPhase}`,
    details: [`Directory created: .planning/phases/${dirName}`],
  });

  return {
    success: true,
    summary: `Phase ${phaseNum}: ${name} inserted after Phase ${afterPhase}`,
    data: { phaseNumber: phaseNum, directory: dirPath },
  };
}

async function handleRemove(
  ctx: Parameters<Parameters<typeof defineSkill>[0]['execute']>[0],
  args: string[],
  roadmapPath: string,
) {
  const phaseArg = args[1];
  if (!phaseArg) {
    return { success: false, summary: 'Usage: sunco phase remove <phase-number>' };
  }

  const phaseNumber = phaseArg.includes('.') ? phaseArg : parseInt(phaseArg, 10);
  if (typeof phaseNumber === 'number' && isNaN(phaseNumber)) {
    return { success: false, summary: `Invalid phase number: ${phaseArg}` };
  }

  const content = await readFile(roadmapPath, 'utf-8');

  // Check if phase is in progress via progress table before calling removePhase
  const { progress } = parseRoadmap(content);
  const progressEntry = progress.find((p) => String(p.phaseNumber) === String(phaseNumber));
  if (progressEntry && progressEntry.plansComplete > 0) {
    const reason = `Phase ${phaseNumber} has completed plans and cannot be removed`;
    await ctx.ui.result({
      success: false,
      title: 'Phase Remove Failed',
      summary: reason,
    });
    return { success: false, summary: reason };
  }

  const result = removePhase(content, phaseNumber);

  if (!result.removed) {
    const reason = result.reason ?? `Phase ${phaseNumber} could not be removed`;
    await ctx.ui.result({
      success: false,
      title: 'Phase Remove Failed',
      summary: reason,
    });
    return { success: false, summary: reason };
  }

  await writeFile(roadmapPath, result.content, 'utf-8');

  ctx.log.info(`Removed Phase ${phaseNumber}`);
  await ctx.ui.result({
    success: true,
    title: 'Phase Removed',
    summary: `Phase ${phaseNumber} removed from ROADMAP.md`,
  });

  return {
    success: true,
    summary: `Phase ${phaseNumber} removed from ROADMAP.md`,
    data: { phaseNumber },
  };
}
