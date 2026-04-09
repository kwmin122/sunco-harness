/** @sunco/skills-workflow - Compound Skill — Phase 24d */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult, PermissionSet } from '@sunco/core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { resolvePhaseDir, writePhaseArtifact } from './shared/phase-reader.js';
import { parseStateMd } from './shared/state-reader.js';
import { readAllLearnings, logLearning } from './shared/learnings.js';

// --- Types + Constants ---

type LearningClassification = 'rule' | 'pattern' | 'anti-pattern' | 'skill-gap';

interface ParsedLearning {
  type: LearningClassification;
  title: string;
  description: string;
  action: string;
  target?: string;
}

const LEARNING_SEPARATOR = '---LEARNING---';

const COMPOUND_PERMISSIONS: PermissionSet = {
  role: 'planning',
  readPaths: ['**'],
  writePaths: ['.planning/**', '.sun/**'],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

const VALID_TYPES: LearningClassification[] = ['rule', 'pattern', 'anti-pattern', 'skill-gap'];

// --- Helpers ---

function parseLearnings(output: string): ParsedLearning[] {
  const sections = output.split(LEARNING_SEPARATOR).map((s) => s.trim()).filter(Boolean);
  const learnings: ParsedLearning[] = [];
  for (const section of sections) {
    try {
      const typeMatch = /^TYPE:\s*(.+)$/m.exec(section);
      const titleMatch = /^TITLE:\s*(.+)$/m.exec(section);
      const descMatch = /^DESCRIPTION:\s*([\s\S]+?)(?=^ACTION:|^TARGET:|$)/m.exec(section);
      const actionMatch = /^ACTION:\s*([\s\S]+?)(?=^TARGET:|$)/m.exec(section);
      const targetMatch = /^TARGET:\s*(.+)$/m.exec(section);
      const rawType = typeMatch?.[1]?.trim().toLowerCase();
      const type = VALID_TYPES.includes(rawType as LearningClassification)
        ? (rawType as LearningClassification)
        : null;
      const title = titleMatch?.[1]?.trim();
      const description = descMatch?.[1]?.trim();
      const action = actionMatch?.[1]?.trim();
      if (type && title && description && action) {
        learnings.push({ type, title, description, action, target: targetMatch?.[1]?.trim() });
      }
    } catch { /* skip unparseable sections */ }
  }
  return learnings;
}

function buildCompoundMd(phaseNumber: number, learnings: ParsedLearning[], promoted: string[]): string {
  const padded = String(phaseNumber).padStart(2, '0');
  const date = new Date().toISOString().split('T')[0];
  const section = (t: LearningClassification) => {
    const items = learnings.filter((l) => l.type === t);
    if (items.length === 0) return `## ${t.charAt(0).toUpperCase() + t.slice(1)}s (0)\n\n_None identified._`;
    return `## ${t.charAt(0).toUpperCase() + t.slice(1)}s (${items.length})\n\n` +
      items.map((l) => `### ${l.title}\n\n${l.description}\n\n**Action:** ${l.action}${l.target ? `\n\n**Target:** \`${l.target}\`` : ''}`).join('\n\n');
  };
  const promotedBlock = promoted.length > 0
    ? `\n## Promoted Rules\n\n${promoted.map((p) => `- \`${p}\``).join('\n')}\n`
    : '';
  return `# Phase ${padded}: Compound Learnings\n\n**Captured:** ${date}\n**Total findings:** ${learnings.length}\n\n---\n\n${section('rule')}\n\n${section('pattern')}\n\n${section('anti-pattern')}\n\n${section('skill-gap')}\n${promotedBlock}`;
}

function buildCompoundPrompt(phaseNumber: number, artifacts: string[]): string {
  return `You are a compound engineering analyst reviewing phase ${String(phaseNumber).padStart(2, '0')} execution artifacts.
Identify durable learnings that should change how future work is done.

## Artifacts

${artifacts.join('\n\n---\n\n')}

---

Analyze and output learnings in these categories:
1. **rule** — Should become a lint rule or .claude/rules/ directive
2. **pattern** — Successful approach worth repeating
3. **anti-pattern** — What went wrong with a prevention strategy
4. **skill-gap** — Missing capability in the toolset

For each learning, output a block in EXACT format:

---LEARNING---
TYPE: <rule|pattern|anti-pattern|skill-gap>
TITLE: <short title, max 60 chars>
DESCRIPTION: <what was observed, 1-3 sentences>
ACTION: <concrete next step>
TARGET: <.claude/rules/filename.md — only for rule type>

Output ONLY the ---LEARNING--- blocks. No preamble, no summary.`;
}

async function safeRead(path: string): Promise<string | null> {
  try { return await readFile(path, 'utf-8'); } catch { return null; }
}

// --- --refresh execution path ---

async function runRefresh(ctx: SkillContext): Promise<SkillResult> {
  const progress = ctx.ui.progress({ title: 'Loading learnings for refresh' });
  const allLearnings = await readAllLearnings(ctx.cwd);

  if (allLearnings.length === 0) {
    progress.done({ summary: 'No learnings found' });
    await ctx.ui.result({ success: true, title: 'Compound (refresh)', summary: 'No learnings to evaluate.' });
    return { success: true, summary: 'No learnings to evaluate' };
  }

  progress.done({ summary: `${allLearnings.length} learning(s) loaded` });
  const evalProgress = ctx.ui.progress({ title: 'Evaluating learning relevance' });
  const learningsSummary = allLearnings.map((l, i) =>
    `[${i}] type=${l.type} key="${l.key}" confidence=${l.confidence} age=${Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000)}d\n    insight: ${l.insight.slice(0, 120)}`
  ).join('\n\n');

  const evalResult = await ctx.agent.run({
    role: 'planning',
    prompt: `Evaluate these project learnings for staleness. Output PRUNE lines for stale/outdated entries:\nPRUNE: <index> REASON: <short reason>\n\n---LEARNINGS---\n${learningsSummary}\n---END---`,
    permissions: COMPOUND_PERMISSIONS,
    timeout: 60_000,
  });

  evalProgress.done({ summary: 'Evaluation complete' });

  const pruneMatches = [...evalResult.outputText.matchAll(/^PRUNE:\s*(\d+)\s+REASON:\s*(.+)$/gm)];
  const pruneIndices = new Set(pruneMatches.map((m) => parseInt(m[1]!, 10)));

  if (pruneIndices.size === 0) {
    await ctx.ui.result({ success: true, title: 'Compound (refresh)', summary: `All ${allLearnings.length} learnings are still relevant.` });
    return { success: true, summary: 'No learnings pruned' };
  }

  const kept = allLearnings.filter((_, i) => !pruneIndices.has(i));
  const pruned = allLearnings.filter((_, i) => pruneIndices.has(i));
  const warnings: string[] = [];

  try {
    const learningsPath = join(ctx.cwd, '.sun', 'learnings.jsonl');
    await mkdir(join(ctx.cwd, '.sun'), { recursive: true });
    await writeFile(learningsPath, kept.map((l) => JSON.stringify(l)).join('\n') + (kept.length > 0 ? '\n' : ''), 'utf-8');
  } catch (err) {
    warnings.push(`Failed to rewrite learnings.jsonl: ${err instanceof Error ? err.message : String(err)}`);
  }

  const summary = `Pruned ${pruned.length} stale learning(s), kept ${kept.length}`;
  await ctx.ui.result({
    success: true, title: 'Compound (refresh)', summary,
    details: pruned.map((l) => {
      const idx = allLearnings.indexOf(l);
      const match = pruneMatches.find((m) => parseInt(m[1]!, 10) === idx);
      return `- ${l.key}: ${match?.[2] ?? 'stale'}`;
    }),
    warnings: warnings.length > 0 ? warnings : undefined,
  });
  return { success: true, summary, data: { pruned: pruned.length, kept: kept.length }, warnings: warnings.length > 0 ? warnings : undefined };
}

// --- Skill Definition ---

export default defineSkill({
  id: 'workflow.compound',
  command: 'compound',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  complexity: 'standard',
  tier: 'expert',
  description: 'Capture execution learnings and promote to durable improvements',
  options: [
    { flags: '-p, --phase <number>', description: 'Phase number (default: current from STATE.md)' },
    { flags: '--promote', description: 'Actually write suggested rules (default: report only)' },
    { flags: '--refresh', description: 'Prune stale learnings from .sun/learnings.jsonl' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({ title: 'Compound', description: 'Capturing execution learnings...' });

    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      await ctx.ui.result({ success: false, title: 'Compound', summary: 'No AI provider available. Install Claude Code CLI or set ANTHROPIC_API_KEY.' });
      return { success: false, summary: 'No AI provider available' };
    }

    if (ctx.args.refresh) return runRefresh(ctx);

    // --- Resolve phase ---
    let phaseNumber: number;
    if (typeof ctx.args.phase === 'number') {
      phaseNumber = ctx.args.phase;
    } else {
      try {
        const stateContent = await readFile(join(ctx.cwd, '.planning', 'STATE.md'), 'utf-8');
        const state = parseStateMd(stateContent);
        if (state.phase === null) {
          const msg = 'Cannot determine current phase from STATE.md. Use --phase to specify.';
          await ctx.ui.result({ success: false, title: 'Compound', summary: msg });
          return { success: false, summary: msg };
        }
        phaseNumber = state.phase;
      } catch {
        const msg = 'STATE.md not found. Use --phase to specify the target phase.';
        await ctx.ui.result({ success: false, title: 'Compound', summary: msg });
        return { success: false, summary: msg };
      }
    }

    const padded = String(phaseNumber).padStart(2, '0');
    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);

    // --- Gather artifacts ---
    const gatherProgress = ctx.ui.progress({ title: 'Gathering phase artifacts' });
    const artifacts: string[] = [];

    if (phaseDir) {
      const summaryMd = await safeRead(join(phaseDir, `${padded}-SUMMARY.md`));
      if (summaryMd) artifacts.push(`## SUMMARY.md\n\n${summaryMd}`);
      const reviewsMd = await safeRead(join(phaseDir, 'REVIEWS.md'));
      if (reviewsMd) artifacts.push(`## REVIEWS.md\n\n${reviewsMd}`);
      const verifyMd = await safeRead(join(phaseDir, `${padded}-VERIFY.md`));
      if (verifyMd) artifacts.push(`## VERIFY.md\n\n${verifyMd}`);
    }

    const existingLearnings = await readAllLearnings(ctx.cwd);
    if (existingLearnings.length > 0) {
      const recent = existingLearnings.slice(-20);
      artifacts.push(`## Existing Learnings (recent ${recent.length})\n\n${recent.map((l) => `- [${l.type}] ${l.key}: ${l.insight.slice(0, 100)}`).join('\n')}`);
    }

    try {
      const git = simpleGit(ctx.cwd);
      const log = await git.log({ maxCount: 20 });
      artifacts.push(`## Recent Git Log\n\n${log.all.map((c) => `- ${c.hash.slice(0, 7)} ${c.message}`).join('\n')}`);
    } catch { /* best-effort */ }

    gatherProgress.done({ summary: `${artifacts.length} artifact(s) gathered` });

    if (artifacts.length === 0) {
      await ctx.ui.result({ success: false, title: 'Compound', summary: `No artifacts found for phase ${phaseNumber}. Run execute/verify first.` });
      return { success: false, summary: 'No artifacts found' };
    }

    // --- Agent analysis ---
    const analyzeProgress = ctx.ui.progress({ title: 'Analyzing learnings with agent' });
    const agentResult = await ctx.agent.run({
      role: 'planning',
      prompt: buildCompoundPrompt(phaseNumber, artifacts),
      permissions: COMPOUND_PERMISSIONS,
      timeout: 120_000,
    });
    analyzeProgress.done({ summary: 'Analysis complete' });

    const learnings = parseLearnings(agentResult.outputText);
    const warnings: string[] = [];
    if (learnings.length === 0) warnings.push('Agent output could not be parsed into structured learnings.');

    // --- Promote rules (--promote only) ---
    const promoted: string[] = [];
    if (ctx.args.promote && learnings.length > 0) {
      const ruleTargets = learnings.filter((l) => l.type === 'rule' && l.target);
      const promoteProgress = ctx.ui.progress({ title: 'Promoting rules to .claude/rules/', total: ruleTargets.length });
      const rulesDir = join(ctx.cwd, '.claude', 'rules');
      await mkdir(rulesDir, { recursive: true });
      let count = 0;
      for (const learning of ruleTargets) {
        const rawTarget = learning.target!;
        const resolvedTarget = rawTarget.startsWith('.claude/rules/')
          ? join(ctx.cwd, rawTarget)
          : join(rulesDir, rawTarget.replace(/^\.?\//, ''));
        if (!resolvedTarget.startsWith(rulesDir)) {
          warnings.push(`Skipped unsafe target: ${rawTarget}`);
          continue;
        }
        try {
          await writeFile(resolvedTarget, `## ${learning.title}\n\n${learning.description}\n\n**Action:** ${learning.action}\n`, 'utf-8');
          promoted.push(resolvedTarget);
          count++;
        } catch (err) {
          warnings.push(`Failed to write rule to ${resolvedTarget}: ${err instanceof Error ? err.message : String(err)}`);
        }
        promoteProgress.update({ completed: count });
      }
      promoteProgress.done({ summary: `${promoted.length} rule(s) promoted` });
    }

    // --- Write COMPOUND.md ---
    let outputPath: string;
    if (phaseDir) {
      const slug = phaseDir.split('/').pop()!.replace(/^\d+-/, '');
      outputPath = await writePhaseArtifact(ctx.cwd, phaseNumber, slug, `${padded}-COMPOUND.md`, buildCompoundMd(phaseNumber, learnings, promoted));
    } else {
      const planningDir = join(ctx.cwd, '.planning');
      await mkdir(planningDir, { recursive: true });
      outputPath = join(planningDir, 'COMPOUND.md');
      await writeFile(outputPath, buildCompoundMd(phaseNumber, learnings, promoted), 'utf-8');
    }

    // --- Persist to universal learnings store ---
    const typeMap = { 'rule': 'operational', 'pattern': 'pattern', 'anti-pattern': 'pitfall', 'skill-gap': 'operational' } as const;
    for (const learning of learnings) {
      await logLearning(ctx.cwd, {
        skill: 'compound',
        type: typeMap[learning.type],
        key: learning.title.toLowerCase().replace(/\s+/g, '-').slice(0, 60),
        insight: learning.description.slice(0, 200),
        confidence: 7,
        source: 'observed',
      });
    }

    // --- Return result ---
    const rules = learnings.filter((l) => l.type === 'rule').length;
    const patterns = learnings.filter((l) => l.type === 'pattern').length;
    const antiPatterns = learnings.filter((l) => l.type === 'anti-pattern').length;
    const skillGaps = learnings.filter((l) => l.type === 'skill-gap').length;
    const summary = `${learnings.length} learning(s) — ${rules} rule(s), ${patterns} pattern(s), ${antiPatterns} anti-pattern(s), ${skillGaps} skill gap(s)`;

    await ctx.ui.result({
      success: true, title: 'Compound', summary,
      details: [
        `Output: ${outputPath}`,
        ...(promoted.length > 0 ? [`Promoted ${promoted.length} rule(s) to .claude/rules/`] : []),
        ...(ctx.args.promote && promoted.length === 0 ? ['No rules had a target path — nothing promoted'] : []),
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    ctx.state.set('compound.lastResult', { phaseNumber, learningsCount: learnings.length, outputPath, promoted });

    return {
      success: true, summary,
      data: { phaseNumber, learnings, outputPath, promoted },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
});
