/**
 * @sunco/skills-workflow - Plan Skill
 *
 * Agent-powered execution planning with BDD completion criteria
 * and a built-in plan-checker validation loop.
 *
 * Reads all accumulated context (CONTEXT.md, RESEARCH.md, REQUIREMENTS.md,
 * ROADMAP.md) and produces PLAN.md files that agents can execute without
 * interpretation. The plan-checker validation loop (D-13) ensures plan
 * quality before execution begins.
 *
 * Requirements: WF-12
 * Decisions: D-12 (plan format), D-13 (validation loop), D-14 (BDD must_haves),
 *   D-15 (agent dispatch), D-16 (separate verification agent)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { buildPlanCreatePrompt, buildPlanRevisePrompt } from './prompts/plan-create.js';
import { buildPlanCheckerPrompt } from './prompts/plan-checker.js';
import { buildProductSpecPrompt } from './prompts/product-spec.js';
import { parseRoadmap } from './shared/roadmap-parser.js';
import { planGate } from './shared/gates.js';
import { resolvePhaseDir, readPhaseArtifactSmart } from './shared/phase-reader.js';
import { readContextZone } from './shared/context-zones.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum plan-checker iterations before accepting with warnings (D-13) */
const MAX_ITERATIONS = 3;

/** Separator between plans in agent output */
const PLAN_SEPARATOR = '---PLAN_SEPARATOR---';

// ---------------------------------------------------------------------------
// Helper: Parse checker issues from structured output
// ---------------------------------------------------------------------------

interface CheckerIssue {
  plan: string;
  dimension: string;
  severity: string;
  description: string;
  fixHint: string;
}

/**
 * Parse structured ---ISSUE--- blocks from plan-checker output.
 * Returns empty array if no issues found or output is malformed.
 */
function parseCheckerIssues(output: string): CheckerIssue[] {
  return output
    .split('---ISSUE---')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const get = (key: string): string => {
        const match = block.match(new RegExp(`${key}:\\s*(.+)`, 'i'));
        return match?.[1]?.trim() ?? '';
      };
      return {
        plan: get('PLAN'),
        dimension: get('DIMENSION'),
        severity: get('SEVERITY'),
        description: get('DESCRIPTION'),
        fixHint: get('FIX_HINT'),
      };
    })
    .filter((issue) => issue.description);
}

// (Phase directory resolution imported from shared/phase-reader.ts)

/**
 * Extract the phase slug from the directory name (e.g., "05-context-planning" -> "context-planning").
 */
function extractSlug(dirName: string): string {
  const match = dirName.match(/^\d+-(.+)$/);
  return match?.[1] ?? dirName;
}

// ---------------------------------------------------------------------------
// Helper: Extract phase info from ROADMAP.md
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper: Determine phase number
// ---------------------------------------------------------------------------

async function determinePhaseNumber(
  ctx: SkillContext,
): Promise<number | null> {
  // Check --phase option first
  const phaseArg = ctx.args['phase'] as number | undefined;
  if (phaseArg !== undefined) {
    return phaseArg;
  }

  // Read from STATE.md
  const statePath = join(ctx.cwd, '.planning', 'STATE.md');
  try {
    const stateContent = await readFile(statePath, 'utf-8');
    const match = /^Phase:\s*(\d+)/m.exec(stateContent);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch {
    // STATE.md doesn't exist
  }

  return null;
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.plan',
  command: 'plan',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  complexity: 'complex',
  description: 'Create execution plans with BDD completion criteria',

  options: [
    {
      flags: '-p, --phase <number>',
      description: 'Phase number (default: current from STATE.md)',
    },
    {
      flags: '--skip-check',
      description: 'Skip plan-checker validation',
    },
    {
      flags: '--research',
      description: 'Run research before planning (auto if RESEARCH.md missing)',
    },
    {
      flags: '--skip-research',
      description: 'Skip research even if RESEARCH.md missing',
    },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'Plan',
      description: 'Creating execution plans...',
    });

    // ----- Step 0: Provider check -----
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      const msg =
        'No AI provider available. Install Claude Code CLI or set ANTHROPIC_API_KEY to use sunco plan.';
      await ctx.ui.result({
        success: false,
        title: 'Plan',
        summary: msg,
      });
      return { success: false, summary: msg };
    }

    // ----- Step 0b: Plan Gate (shared stop-the-line gate) -----
    const planCheck = await planGate(ctx);
    if (!planCheck.passed) {
      await ctx.ui.result({ success: false, title: 'Plan', summary: planCheck.reason });
      return { success: false, summary: planCheck.reason };
    }

    // ----- Step 1: Determine phase number -----
    const phaseNumber = await determinePhaseNumber(ctx);
    if (phaseNumber === null) {
      const msg =
        'Could not determine phase number. Use --phase option or ensure STATE.md exists.';
      await ctx.ui.result({
        success: false,
        title: 'Plan',
        summary: msg,
      });
      return { success: false, summary: msg };
    }

    const paddedPhase = String(phaseNumber).padStart(2, '0');

    // ----- Step 2: Read input documents (context-zone-aware) -----
    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);
    let phaseDirName = '';

    if (phaseDir) {
      const parts = phaseDir.split('/');
      phaseDirName = parts[parts.length - 1] ?? '';
    }

    const phaseSlug = phaseDirName ? extractSlug(phaseDirName) : `phase-${phaseNumber}`;

    // Context zone for smart artifact loading
    const zoneData = await readContextZone(ctx.cwd);
    const contextZone = zoneData?.zone ?? 'green';

    // CONTEXT.md (required)
    const contextResult = await readPhaseArtifactSmart(ctx.cwd, phaseNumber, `${paddedPhase}-CONTEXT.md`, {
      currentPhase: phaseNumber,
      contextZone,
    });
    const contextMd = contextResult.content;

    if (!contextMd) {
      const msg =
        'CONTEXT.md not found for this phase. Run sunco discuss first to establish phase context.';
      await ctx.ui.result({
        success: false,
        title: 'Plan',
        summary: msg,
      });
      return { success: false, summary: msg };
    }

    // RESEARCH.md (optional, context-zone-aware)
    const researchResult = await readPhaseArtifactSmart(ctx.cwd, phaseNumber, `${paddedPhase}-RESEARCH.md`, {
      currentPhase: phaseNumber,
      contextZone,
    });
    let researchMd = researchResult.content;
    if (!researchMd) {
      ctx.log.warn('RESEARCH.md not found for this phase. Proceeding without it.');
    }

    // Auto-research: if no RESEARCH.md and not --skip-research
    if (!researchMd && !ctx.args['skip-research']) {
      const researchProgress = ctx.ui.progress({ title: 'Running research first...' });
      try {
        const researchResult = await ctx.run('workflow.research', { phase: phaseNumber });
        if (researchResult.success) {
          // Re-read the RESEARCH.md that research skill just created
          try {
            researchMd = await readFile(join(phaseDir!, `${paddedPhase}-RESEARCH.md`), 'utf-8');
          } catch {
            // Research may have written but we can't read it
          }
        }
        researchProgress.done({ summary: researchResult.success ? 'Research complete' : 'Research failed (continuing)' });
      } catch {
        researchProgress.done({ summary: 'Research unavailable (continuing without)' });
        ctx.log.warn('Research skill not available or failed, proceeding without research');
      }
    } else if (ctx.args['research']) {
      // Explicit --research flag: always run even if RESEARCH.md exists
      const researchProgress = ctx.ui.progress({ title: 'Running research (--research flag)...' });
      try {
        const researchResult = await ctx.run('workflow.research', { phase: phaseNumber });
        if (researchResult.success) {
          try {
            researchMd = await readFile(join(phaseDir!, `${paddedPhase}-RESEARCH.md`), 'utf-8');
          } catch { /* continue */ }
        }
        researchProgress.done({ summary: 'Research complete' });
      } catch {
        researchProgress.done({ summary: 'Research failed (continuing)' });
      }
    }

    // REQUIREMENTS.md and ROADMAP.md from .planning/
    let requirementsMd = '';
    let roadmapMd = '';

    try {
      requirementsMd = await readFile(join(ctx.cwd, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    } catch {
      ctx.log.warn('REQUIREMENTS.md not found. Proceeding with empty requirements.');
    }

    try {
      roadmapMd = await readFile(join(ctx.cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    } catch {
      ctx.log.warn('ROADMAP.md not found. Proceeding without roadmap context.');
    }

    // Extract phase goal and requirements from ROADMAP.md
    const phaseInfo = extractPhaseInfo(roadmapMd, phaseNumber);

    // ----- Step 2.5: Generate PRODUCT-SPEC.md -----
    let productSpecMd = '';

    // Check if PRODUCT-SPEC already exists
    try {
      const existingSpec = await readFile(join(phaseDir ?? '', `${paddedPhase}-PRODUCT-SPEC.md`), 'utf-8');
      if (existingSpec) {
        productSpecMd = existingSpec;
        ctx.log.info('Existing PRODUCT-SPEC.md found, reusing');
      }
    } catch {
      // No existing spec — generate one
    }

    if (!productSpecMd) {
      const specProgress = ctx.ui.progress({ title: 'Generating product specification' });

      const specResult = await ctx.agent.run({
        role: 'planning',
        prompt: buildProductSpecPrompt({
          contextMd,
          researchMd: researchMd ?? '',
          requirementsMd,
          roadmapMd,
          phaseGoal: phaseInfo.goal,
          requirements: phaseInfo.requirements,
          phaseSlug: phaseDirName || `${paddedPhase}-${phaseSlug}`,
          paddedPhase,
        }),
        permissions: {
          role: 'planning',
          readPaths: ['**'],
          writePaths: ['.planning/**'],
          allowTests: false,
          allowNetwork: false,
          allowGitWrite: false,
          allowCommands: [],
        },
        timeout: 180_000,
      });

      if (specResult.success && specResult.outputText) {
        productSpecMd = specResult.outputText;

        // Write PRODUCT-SPEC.md
        const specDir = phaseDir ?? join(ctx.cwd, '.planning', 'phases', phaseDirName || `${paddedPhase}-${phaseSlug}`);
        await mkdir(specDir, { recursive: true });
        await writeFile(join(specDir, `${paddedPhase}-PRODUCT-SPEC.md`), productSpecMd, 'utf-8');
        ctx.log.info('PRODUCT-SPEC.md written');
        specProgress.done({ summary: 'Product spec ready' });
      } else {
        specProgress.done({ summary: 'Product spec generation failed (continuing without)' });
        ctx.log.warn('Product spec generation failed, proceeding without');
      }
    }

    // ----- Step 2.6: Generate VALIDATION.md from research (PQP-04) -----
    if (researchMd && researchMd.includes('## Validation Architecture')) {
      try {
        const validationPath = join(phaseDir ?? join(ctx.cwd, '.planning', 'phases', phaseDirName || `${paddedPhase}-${phaseSlug}`), `${paddedPhase}-VALIDATION.md`);
        const validationContent = [
          `# Phase ${phaseNumber}: Validation Strategy`,
          '',
          `**Generated:** ${new Date().toISOString()}`,
          `**Source:** ${paddedPhase}-RESEARCH.md`,
          '',
          '## Validation Dimensions',
          '',
          '1. **Goal Achievement** -- Do observable truths hold?',
          '2. **Artifact Completeness** -- Do all planned files exist with real content?',
          '3. **Wiring Integrity** -- Are all key links connected?',
          '4. **Anti-Pattern Freedom** -- No TODOs, stubs, or placeholders?',
          '5. **Test Coverage** -- Do tests exist and pass?',
          '6. **Deep Work Compliance** -- read_first honored, acceptance_criteria verifiable?',
          '',
          '## Extracted from Research',
          '',
          researchMd.split('## Validation Architecture')[1]?.split(/\n## /)[0] ?? '(No validation architecture found in research)',
          '',
          '---',
          `*Generated from Phase ${phaseNumber} research at ${new Date().toISOString()}*`,
        ].join('\n');
        await writeFile(validationPath, validationContent, 'utf-8');
        ctx.log.info('VALIDATION.md written', { path: validationPath });
      } catch (err) {
        ctx.log.warn('Failed to write VALIDATION.md', { error: String(err) });
      }
    }

    // ----- Step 2.7: Pre-draft advisor call (Phase 28) -----
    const advisorNotes: string[] = [];
    if (ctx.config.agent?.advisor?.enabled) {
      try {
        const { AdvisorRunner } = await import('@sunco/core/advisor');
        const { buildAdvisorPrompt } = await import('./shared/advisor-prompt.js');
        const advisorCfg = ctx.config.agent.advisor;
        const runner = new AdvisorRunner(advisorCfg, ctx.cwd);
        const pre = await runner.run({
          skillId: 'workflow.plan',
          phaseId: String(phaseNumber),
          question: 'Before I draft plans, is there a load-bearing assumption in CONTEXT.md that would invalidate the current scope?',
          context: {
            goal: phaseInfo?.goal ?? 'Unknown',
            evidence: [
              contextMd ? `CONTEXT.md present (${contextMd.length} chars)` : 'CONTEXT.md missing',
              `ROADMAP position: Phase ${phaseNumber}`,
            ],
          },
        }, buildAdvisorPrompt);
        if (pre.advice) {
          advisorNotes.push(`### Advisor (pre-draft)\n${pre.advice}`);
          if (!pre.verified) ctx.log.warn('Advisor signature missing — Opus execution unverified');
        }
      } catch (err) {
        ctx.log.warn('Advisor pre-draft call failed (non-fatal)', { error: String(err) });
      }
    }

    // ----- Step 3: Plan-checker validation loop (D-13) -----
    let planOutput = '';
    let issues: CheckerIssue[] = [];
    const planProgress = ctx.ui.progress({ title: 'Creating execution plans' });

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Generate or revise plan
      planProgress.update({
        message:
          iteration === 0
            ? 'Generating plans...'
            : `Revising (iteration ${iteration + 1})...`,
      });

      const planResult = await ctx.agent.run({
        role: 'planning',
        prompt:
          iteration === 0
            ? buildPlanCreatePrompt({
                contextMd,
                researchMd: researchMd ?? '',
                requirementsMd,
                roadmapMd,
                productSpecMd,
                phaseGoal: phaseInfo.goal,
                requirements: phaseInfo.requirements,
                phaseSlug: phaseDirName || `${paddedPhase}-${phaseSlug}`,
                paddedPhase,
              })
            : buildPlanRevisePrompt({
                currentPlan: planOutput,
                issues: issues.map((i) => i.description),
                contextMd,
                requirementsMd,
                productSpecMd,
              }),
        permissions: {
          role: 'planning',
          readPaths: ['**'],
          writePaths: ['.planning/**'],
          allowTests: false,
          allowNetwork: false,
          allowGitWrite: false,
          allowCommands: [],
        },
        timeout: 180_000,
      });

      if (!planResult.success) {
        planProgress.done({ summary: 'Planning agent failed' });
        await ctx.ui.result({
          success: false,
          title: 'Plan',
          summary: 'Planning agent failed',
        });
        return { success: false, summary: 'Planning agent failed' };
      }

      planOutput = planResult.outputText;

      // Skip checker if --skip-check flag
      if (ctx.args['skip-check']) break;

      // Verify with separate agent (D-16)
      planProgress.update({
        message: `Checking plan quality (iteration ${iteration + 1})...`,
      });

      const plans = planOutput
        .split(PLAN_SEPARATOR)
        .map((p) => p.trim())
        .filter(Boolean);

      try {
        const checkResult = await ctx.agent.run({
          role: 'verification',
          prompt: buildPlanCheckerPrompt({
            plans,
            contextMd,
            requirementsMd,
            productSpecMd,
            phaseRequirements: phaseInfo.requirements,
          }),
          permissions: {
            role: 'verification',
            readPaths: ['**'],
            writePaths: [],
            allowTests: false,
            allowNetwork: false,
            allowGitWrite: false,
            allowCommands: [],
          },
          timeout: 120_000,
        });

        if (checkResult.outputText.includes('NO_ISSUES_FOUND')) {
          issues = [];
          break;
        }

        issues = parseCheckerIssues(checkResult.outputText);
        if (issues.length === 0) break;

        const blockers = issues.filter((i) => i.severity === 'blocker');
        if (blockers.length === 0) break; // Only warnings -- accept
      } catch {
        ctx.log.warn('Plan checker failed, accepting plan without verification');
        issues = [];
        break;
      }
    }

    planProgress.done({ summary: 'Plans ready' });

    // ----- Step 4: Parse and write PLAN.md files -----
    const planTexts = planOutput
      .split(PLAN_SEPARATOR)
      .map((p) => p.trim())
      .filter(Boolean);

    const writeDir = phaseDir ?? join(ctx.cwd, '.planning', 'phases', phaseDirName || `${paddedPhase}-${phaseSlug}`);
    await mkdir(writeDir, { recursive: true });

    const writtenFiles: string[] = [];
    for (let i = 0; i < planTexts.length; i++) {
      const planNum = String(i + 1).padStart(2, '0');
      const filename = `${paddedPhase}-${planNum}-PLAN.md`;
      const targetPath = resolve(writeDir, filename);

      // Path traversal guard
      const rel = relative(writeDir, targetPath);
      if (rel.startsWith('..') || rel.includes('..')) {
        ctx.log.error(`Path traversal detected for plan ${planNum}, skipping`);
        continue;
      }

      await writeFile(targetPath, planTexts[i], 'utf-8');
      writtenFiles.push(targetPath);
    }

    // ----- Step 4.5a: Post-draft advisor call (Phase 28) -----
    if (ctx.config.agent?.advisor?.enabled) {
      try {
        const { AdvisorRunner } = await import('@sunco/core/advisor');
        const { buildAdvisorPrompt } = await import('./shared/advisor-prompt.js');
        const advisorCfg = ctx.config.agent.advisor;
        const runner = new AdvisorRunner(advisorCfg, ctx.cwd);
        const post = await runner.run({
          skillId: 'workflow.plan',
          phaseId: String(phaseNumber),
          question: 'Given the plan draft, which task is most likely to fail its done_when criterion?',
          context: {
            goal: phaseInfo?.goal ?? 'Unknown',
            decision: 'Plan draft created',
            evidence: [
              `Plans written: ${writtenFiles.length}`,
              `Task count: ${planTexts.length}`,
            ],
          },
        }, buildAdvisorPrompt);
        if (post.advice) {
          advisorNotes.push(`### Advisor (post-draft)\n${post.advice}`);
          if (!post.verified) ctx.log.warn('Advisor signature missing — Opus execution unverified');
        }
      } catch (err) {
        ctx.log.warn('Advisor post-draft call failed (non-fatal)', { error: String(err) });
      }

      if (advisorNotes.length > 0) {
        const notesPath = join(phaseDir, 'ADVISOR-NOTES.md');
        await writeFile(notesPath, `# Advisor Notes\n\n${advisorNotes.join('\n\n')}\n`, 'utf-8');
        ctx.log.info('ADVISOR-NOTES.md written', { path: notesPath });
      }
    }

    // ----- Step 4.5: Requirements coverage gate (PQP-03) -----
    const coveredReqs = new Set<string>();
    for (const planText of planTexts) {
      // Parse requirements from YAML frontmatter
      const reqMatch = planText.match(/requirements:\s*\[([^\]]*)\]/);
      if (reqMatch) {
        reqMatch[1]!
          .split(',')
          .map((r) => r.trim().replace(/['"]/g, ''))
          .filter(Boolean)
          .forEach((r) => coveredReqs.add(r));
      }
      // Also try line-by-line YAML format
      const lineMatches = [...planText.matchAll(/^\s*-\s*([\w-]+\d+)/gm)];
      for (const m of lineMatches) {
        if (phaseInfo.requirements.includes(m[1]!)) {
          coveredReqs.add(m[1]!);
        }
      }
    }

    const uncoveredReqs = phaseInfo.requirements.filter((r) => !coveredReqs.has(r));

    // ----- Step 5: Build result -----
    const remainingWarnings: string[] = [];
    if (uncoveredReqs.length > 0) {
      remainingWarnings.push(
        `Requirements coverage gap: ${uncoveredReqs.join(', ')} not found in any plan's requirements field`,
      );
    }
    if (issues.length > 0) {
      remainingWarnings.push(
        `${issues.length} issue(s) remaining after ${MAX_ITERATIONS} iterations:`,
      );
      for (const issue of issues) {
        remainingWarnings.push(
          `  [${issue.severity}] Plan ${issue.plan} - ${issue.dimension}: ${issue.description}`,
        );
      }
    }

    const checkerStatus =
      issues.length > 0
        ? `${issues.length} issues remaining`
        : ctx.args['skip-check']
          ? 'skipped'
          : 'passed';

    const specStatus = productSpecMd ? 'generated' : 'skipped';
    const summary = `Created ${writtenFiles.length} plan${writtenFiles.length !== 1 ? 's' : ''} for Phase ${phaseNumber}. Product spec: ${specStatus}. Checker: ${checkerStatus}.`;

    await ctx.ui.result({
      success: true,
      title: 'Plan',
      summary,
      details: writtenFiles.map((f) => `Written: ${f}`),
      warnings: remainingWarnings.length > 0 ? remainingWarnings : undefined,
    });

    return {
      success: true,
      summary,
      data: { writtenFiles, planCount: writtenFiles.length },
      warnings: remainingWarnings.length > 0 ? remainingWarnings : undefined,
    };
  },
});
