/**
 * @sunco/skills-workflow - Milestone Lifecycle Skill
 *
 * Manage milestone lifecycle with 5 subcommands:
 *   sunco milestone new       -- prompt for name/goal, create milestone artifacts
 *   sunco milestone audit     -- compare intent against delivery evidence, produce score
 *   sunco milestone complete  -- archive planning artifacts, create git tag
 *   sunco milestone summary   -- generate comprehensive onboarding report via agent
 *   sunco milestone gaps      -- read audit, auto-generate catch-up phases in ROADMAP.md
 *
 * Requirements: WF-03, WF-04, WF-05, WF-06, WF-07
 * Decisions: D-08 (new), D-09 (audit), D-10 (complete), D-11 (summary), D-12 (gaps),
 *   D-13 (positional arg routing), D-14 (agent vs deterministic), D-15 (state), D-17 (kind: prompt)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';

import { archiveMilestone, resetStateForNewMilestone, parseMilestoneAudit, buildGapPhases } from './shared/milestone-helpers.js';
import { buildMilestoneAuditPrompt } from './prompts/milestone-audit.js';
import { buildMilestoneSummaryPrompt } from './prompts/milestone-summary.js';
import { buildMilestoneNewPrompt } from './prompts/milestone-new.js';
import { writePlanningArtifact } from './shared/planning-writer.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Document separator used in synthesis output (same as new.skill.ts) */
const DOCUMENT_SEPARATOR = '---DOCUMENT_SEPARATOR---';

/** Fail threshold for audit score (D-09) */
const AUDIT_FAIL_THRESHOLD = 70;

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.milestone',
  command: 'milestone',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'standard',
  description: 'Manage milestone lifecycle: new, audit, complete, summary, gaps',
  options: [
    { flags: '--force', description: 'Force complete even with low audit score' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const positionalArgs = (ctx.args._ as string[] | undefined) ?? [];
    const subcommand = positionalArgs[0];

    // No subcommand: show usage
    if (!subcommand) {
      await ctx.ui.result({
        success: true,
        title: 'Milestone Management',
        summary: 'Usage: sunco milestone <new|audit|complete|summary|gaps> [options]',
        details: [
          'Subcommands:',
          '  new        Start a new milestone (prompts for name, goal, and scoping questions)',
          '  audit      Compare milestone intent against delivery evidence and produce score',
          '  complete   Archive planning artifacts and create a git tag',
          '  summary    Generate comprehensive onboarding report via agent',
          '  gaps       Read audit report and auto-generate catch-up phases in ROADMAP.md',
        ],
      });
      return { success: true, summary: 'Usage: sunco milestone <new|audit|complete|summary|gaps> [options]' };
    }

    switch (subcommand) {
      case 'new':
        return handleNew(ctx);
      case 'audit':
        return handleAudit(ctx);
      case 'complete':
        return handleComplete(ctx);
      case 'summary':
        return handleSummary(ctx);
      case 'gaps':
        return handleGaps(ctx);
      default:
        return {
          success: false,
          summary: `Unknown subcommand: ${subcommand}. Use new, audit, complete, summary, or gaps.`,
        };
    }
  },
});

// ---------------------------------------------------------------------------
// handleNew (D-08, WF-03) -- agent-powered
// ---------------------------------------------------------------------------

async function handleNew(ctx: SkillContext): Promise<SkillResult> {
  // 1. Ask milestone name
  const nameResponse = await ctx.ui.askText({
    message: 'Milestone name:',
    placeholder: 'v2.0',
  });
  const milestoneName = nameResponse.text;

  if (!milestoneName) {
    return { success: false, summary: 'No milestone name provided' };
  }

  // 2. Ask goal
  const goalResponse = await ctx.ui.askText({
    message: 'Milestone goal:',
    placeholder: 'What does this milestone achieve?',
  });
  const goal = goalResponse.text;

  // 3. Ask 3 scoping questions
  const scopeResponse = await ctx.ui.askText({
    message: 'What is in/out of scope?',
    placeholder: 'Core platform + harness skills, not terminal app',
  });
  const timelineResponse = await ctx.ui.askText({
    message: 'Target completion?',
    placeholder: 'End of Q1 2026',
  });
  const risksResponse = await ctx.ui.askText({
    message: 'Known risks or blockers?',
    placeholder: 'None known',
  });

  const answers: Record<string, string> = {
    scope: scopeResponse.text,
    timeline: timelineResponse.text,
    risks: risksResponse.text,
  };

  // 4. Read previous milestone summary from archive if exists
  let previousMilestoneSummary: string | undefined;
  try {
    const archiveDir = join(ctx.cwd, '.planning', 'archive');
    const archiveEntries = await readdir(archiveDir);
    if (archiveEntries.length > 0) {
      // Read the latest archive's MILESTONE-SUMMARY.md
      const latest = archiveEntries.sort().pop()!;
      try {
        previousMilestoneSummary = await readFile(
          join(archiveDir, latest, 'MILESTONE-SUMMARY.md'),
          'utf-8',
        );
      } catch {
        // No summary in archive, that's fine
      }
    }
  } catch {
    // No archive directory, that's fine
  }

  // 5. Build prompt
  const prompt = buildMilestoneNewPrompt({
    milestoneName,
    goal,
    answers,
    previousMilestoneSummary,
  });

  // 6. Dispatch agent
  const agentResult = await ctx.agent.run({
    role: 'planning',
    prompt,
    permissions: {
      role: 'planning',
      readPaths: ['**'],
      writePaths: ['.planning/**'],
      allowTests: false,
      allowNetwork: false,
      allowGitWrite: false,
      allowCommands: [],
    },
  });

  if (!agentResult.success) {
    return { success: false, summary: 'Agent failed to generate milestone artifacts' };
  }

  // 7. Parse output for REQUIREMENTS.md and ROADMAP.md sections
  const outputText = agentResult.outputText;
  const documents = outputText.split(DOCUMENT_SEPARATOR).map((d: string) => d.trim());

  // 8. Write artifacts
  if (documents.length >= 2) {
    await writePlanningArtifact(ctx.cwd, 'REQUIREMENTS.md', documents[0]);
    await writePlanningArtifact(ctx.cwd, 'ROADMAP.md', documents[1]);
  } else {
    // Fallback: write as REQUIREMENTS.md
    await writePlanningArtifact(ctx.cwd, 'REQUIREMENTS.md', outputText);
  }

  // 9. Update STATE.md with new milestone name
  await ctx.state.set('milestone', milestoneName);

  // 10. Return
  return {
    success: true,
    summary: `Milestone "${milestoneName}" created`,
    data: { milestoneName, goal },
  };
}

// ---------------------------------------------------------------------------
// handleAudit (D-09, WF-04) -- agent-powered
// ---------------------------------------------------------------------------

async function handleAudit(ctx: SkillContext): Promise<SkillResult> {
  // 1. Read milestone name from state
  const milestoneName = (await ctx.state.get('milestone')) as string ?? 'unknown';

  // 2. Read planning artifacts
  const planningDir = join(ctx.cwd, '.planning');
  const projectMd = await readFile(join(planningDir, 'PROJECT.md'), 'utf-8');
  const requirementsMd = await readFile(join(planningDir, 'REQUIREMENTS.md'), 'utf-8');

  // 3. Scan phase directories for VERIFICATION and SUMMARY files
  const verificationReports: string[] = [];
  const planSummaries: string[] = [];

  try {
    const phasesDir = join(planningDir, 'phases');
    const phaseDirs = await readdir(phasesDir);

    for (const dir of phaseDirs) {
      // Try reading VERIFICATION files
      try {
        const entries = await readdir(join(phasesDir, dir));
        for (const entry of entries) {
          if (entry.includes('VERIFICATION')) {
            const content = await readFile(join(phasesDir, dir, entry), 'utf-8');
            verificationReports.push(content);
          }
          if (entry.includes('SUMMARY') && !entry.includes('MILESTONE')) {
            const content = await readFile(join(phasesDir, dir, entry), 'utf-8');
            planSummaries.push(content);
          }
        }
      } catch {
        // Phase dir scan failed, skip
      }
    }
  } catch {
    // No phases dir, continue with empty arrays
  }

  // 4. Build audit prompt
  const prompt = buildMilestoneAuditPrompt({
    milestoneName,
    projectMd,
    requirementsMd,
    verificationReports,
    planSummaries,
  });

  // 5. Dispatch agent
  const agentResult = await ctx.agent.run({
    role: 'verification',
    prompt,
    permissions: {
      role: 'verification',
      readPaths: ['.planning/**', '.sun/**'],
      writePaths: [],
      allowTests: false,
      allowNetwork: false,
      allowGitWrite: false,
      allowCommands: [],
    },
  });

  if (!agentResult.success) {
    return { success: false, summary: 'Audit agent failed' };
  }

  // 6. Parse audit result
  const { score, met, unmet } = parseMilestoneAudit(agentResult.outputText);
  const total = met.length + unmet.length;
  const verdict = score > 90 ? 'PASS' : score >= AUDIT_FAIL_THRESHOLD ? 'WARN' : 'FAIL';

  // 7. Write audit report
  await writeFile(
    join(planningDir, 'MILESTONE-AUDIT.md'),
    agentResult.outputText,
    'utf-8',
  );

  // 8. Return
  return {
    success: true,
    summary: `Milestone audit: ${score}% (${verdict})`,
    data: { score, verdict, met, unmet },
  };
}

// ---------------------------------------------------------------------------
// handleComplete (D-10, WF-05) -- deterministic
// ---------------------------------------------------------------------------

async function handleComplete(ctx: SkillContext): Promise<SkillResult> {
  // 1. Read milestone name from state
  const milestoneName = (await ctx.state.get('milestone')) as string ?? 'unknown';

  // 2. Read latest audit report and check score
  const planningDir = join(ctx.cwd, '.planning');
  let auditScore = 100; // Default to passing if no audit exists

  try {
    const auditContent = await readFile(join(planningDir, 'MILESTONE-AUDIT.md'), 'utf-8');
    const { score } = parseMilestoneAudit(auditContent);
    auditScore = score;
  } catch {
    // No audit report, allow completion
  }

  // Block if score < 70 and no --force
  if (auditScore < AUDIT_FAIL_THRESHOLD && !ctx.args.force) {
    return {
      success: false,
      summary: `Audit score too low (${auditScore}%). Use --force to override.`,
    };
  }

  // 3. Archive milestone
  const archivePath = await archiveMilestone(ctx.cwd, milestoneName);

  // 4. Create git tag
  const tagName = `milestone/${milestoneName}`;
  const git = simpleGit(ctx.cwd);
  await git.addAnnotatedTag(tagName, `Milestone: ${milestoneName}`);

  // 5. Reset state for new milestone
  await resetStateForNewMilestone(ctx.cwd, `${milestoneName}-next`);

  // 6. Return
  return {
    success: true,
    summary: `Milestone "${milestoneName}" completed and archived`,
    data: { archivePath, tag: tagName },
  };
}

// ---------------------------------------------------------------------------
// handleSummary (D-11, WF-06) -- agent-powered
// ---------------------------------------------------------------------------

async function handleSummary(ctx: SkillContext): Promise<SkillResult> {
  // 1. Read milestone name from state
  const milestoneName = (await ctx.state.get('milestone')) as string ?? 'unknown';

  // 2. Read planning artifacts
  const planningDir = join(ctx.cwd, '.planning');
  const projectMd = await readFile(join(planningDir, 'PROJECT.md'), 'utf-8');
  const stateMd = await readFile(join(planningDir, 'STATE.md'), 'utf-8');
  const roadmapMd = await readFile(join(planningDir, 'ROADMAP.md'), 'utf-8');

  // 3. Scan phase directories for SUMMARY and VERIFICATION files
  const planSummaries: string[] = [];
  const verificationReports: string[] = [];

  try {
    const phasesDir = join(planningDir, 'phases');
    const phaseDirs = await readdir(phasesDir);

    for (const dir of phaseDirs) {
      try {
        const entries = await readdir(join(phasesDir, dir));
        for (const entry of entries) {
          if (entry.includes('SUMMARY') && !entry.includes('MILESTONE')) {
            const content = await readFile(join(phasesDir, dir, entry), 'utf-8');
            planSummaries.push(content);
          }
          if (entry.includes('VERIFICATION')) {
            const content = await readFile(join(phasesDir, dir, entry), 'utf-8');
            verificationReports.push(content);
          }
        }
      } catch {
        // Skip failed phase dirs
      }
    }
  } catch {
    // No phases dir
  }

  // 4. Extract decisions from STATE.md
  const decisionsMatch = /### Decisions\s*\n([\s\S]*?)(?=\n###|\n## |$)/.exec(stateMd);
  const decisions = decisionsMatch ? decisionsMatch[1].trim() : '';

  // 5. Build prompt
  const prompt = buildMilestoneSummaryPrompt({
    milestoneName,
    projectMd,
    stateMd,
    roadmapMd,
    planSummaries,
    verificationReports,
    decisions,
  });

  // 6. Dispatch agent with read-only permissions
  const agentResult = await ctx.agent.run({
    role: 'research',
    prompt,
    permissions: {
      role: 'research',
      readPaths: ['.planning/**'],
      writePaths: [],
      allowTests: false,
      allowNetwork: false,
      allowGitWrite: false,
      allowCommands: [],
    },
  });

  if (!agentResult.success) {
    return { success: false, summary: 'Summary agent failed' };
  }

  // 7. Write MILESTONE-SUMMARY.md
  const summaryPath = join(planningDir, 'MILESTONE-SUMMARY.md');
  await writeFile(summaryPath, agentResult.outputText, 'utf-8');

  // 8. Return
  return {
    success: true,
    summary: 'Milestone summary written',
    data: { path: '.planning/MILESTONE-SUMMARY.md' },
  };
}

// ---------------------------------------------------------------------------
// handleGaps (D-12, WF-07) -- deterministic
// ---------------------------------------------------------------------------

async function handleGaps(ctx: SkillContext): Promise<SkillResult> {
  const planningDir = join(ctx.cwd, '.planning');

  // 1. Read latest MILESTONE-AUDIT.md
  const auditContent = await readFile(join(planningDir, 'MILESTONE-AUDIT.md'), 'utf-8');
  const { unmet } = parseMilestoneAudit(auditContent);

  // 2. If no unmet requirements, return early
  if (unmet.length === 0) {
    return {
      success: true,
      summary: 'No gaps found -- all requirements met',
    };
  }

  // 3. Read current ROADMAP.md
  const roadmapPath = join(planningDir, 'ROADMAP.md');
  const roadmapContent = await readFile(roadmapPath, 'utf-8');

  // 4. Build gap phases
  const updatedRoadmap = buildGapPhases(unmet, roadmapContent);

  // 5. Write updated ROADMAP.md
  await writeFile(roadmapPath, updatedRoadmap, 'utf-8');

  // 6. Count gap groups to report
  const groups = new Set(unmet.map((req) => req.replace(/-\d+$/, '')));

  return {
    success: true,
    summary: `${groups.size} catch-up phase(s) added for ${unmet.length} unmet requirements`,
    data: { unmetReqs: unmet, phasesAdded: groups.size },
  };
}
