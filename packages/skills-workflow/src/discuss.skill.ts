/**
 * @sunco/skills-workflow - Discuss Skill
 *
 * Agent-guided conversation that extracts design decisions
 * and acceptance criteria for a development phase. The most
 * interactive skill in the spec-driven planning chain.
 *
 * Flow (WF-09, D-01 through D-04):
 *   1. Read phase goal from ROADMAP.md
 *   2. Agent identifies gray areas
 *   3. User selects options via ctx.ui.ask()
 *   4. Agent deep-dives each selected area
 *   5. Agent generates BDD holdout scenarios
 *   6. Write CONTEXT.md + scenarios
 *
 * Requirements: WF-09 (discuss command)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult, PermissionSet } from '@sunco/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolvePhaseDir, writePhaseArtifact } from './shared/phase-reader.js';
import { parseRoadmap } from './shared/roadmap-parser.js';
import { parseStateMd } from './shared/state-reader.js';
import { buildDiscussAnalyzePrompt } from './prompts/discuss-analyze.js';
import { buildDiscussDeepDivePrompt } from './prompts/discuss-deepdive.js';
import { buildDiscussScenarioPrompt } from './prompts/discuss-scenario.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Read-only permissions for planning agents */
const PLANNING_READ_PERMISSIONS: PermissionSet = {
  role: 'planning',
  readPaths: ['**'],
  writePaths: [],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

/** Delimiter for gray area sections in agent output */
const GRAY_AREA_SEPARATOR = '---GRAY_AREA---';

/** Delimiter for scenario sections in agent output */
const SCENARIO_SEPARATOR = '---SCENARIO---';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrayArea {
  id: string;
  question: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
    recommended?: boolean;
  }>;
  defaultId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse gray areas from agent output.
 * Expects JSON blocks separated by GRAY_AREA_SEPARATOR.
 * Returns null if parsing fails (fallback to text mode).
 */
function parseGrayAreas(output: string): GrayArea[] | null {
  const sections = output.split(GRAY_AREA_SEPARATOR).map((s) => s.trim()).filter(Boolean);

  if (sections.length === 0) return null;

  const areas: GrayArea[] = [];

  for (const section of sections) {
    try {
      // Extract JSON from potential code fences
      const jsonMatch = section.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : section.trim();

      const parsed = JSON.parse(jsonStr) as GrayArea;

      // Validate minimum structure
      if (parsed.id && parsed.question && Array.isArray(parsed.options) && parsed.options.length > 0) {
        areas.push(parsed);
      }
    } catch {
      // Skip unparseable sections
    }
  }

  return areas.length > 0 ? areas : null;
}

/**
 * Parse deep-dive response to extract decision, follow-up, and conflicts.
 */
function parseDeepDiveResponse(output: string): {
  decision: string;
  followUp: string | null;
  conflicts: string | null;
} {
  const decisionMatch = /^DECISION:\s*(.+)$/m.exec(output);
  const followUpMatch = /^FOLLOW_UP:\s*(.+)$/m.exec(output);
  const conflictsMatch = /^CONFLICTS:\s*(.+)$/m.exec(output);

  return {
    decision: decisionMatch ? decisionMatch[1].trim() : output.trim().slice(0, 200),
    followUp: followUpMatch && followUpMatch[1].trim().toLowerCase() !== 'none'
      ? followUpMatch[1].trim()
      : null,
    conflicts: conflictsMatch && conflictsMatch[1].trim().toLowerCase() !== 'none'
      ? conflictsMatch[1].trim()
      : null,
  };
}

/**
 * Parse scenario output into individual scenarios.
 */
function parseScenarios(output: string): string[] {
  return output
    .split(SCENARIO_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Build the CONTEXT.md content from gathered decisions and context.
 */
function buildContextMd(
  phaseNumber: number,
  phaseName: string,
  phaseDescription: string,
  decisions: Record<string, string>,
  discretionary: string[],
): string {
  const padded = String(phaseNumber).padStart(2, '0');
  const date = new Date().toISOString().split('T')[0];

  const decisionEntries = Object.entries(decisions);
  const decisionLines = decisionEntries.length > 0
    ? decisionEntries.map(([id, text], i) => `D-${String(i + 1).padStart(2, '0')}: ${text}`).join('\n\n')
    : '(no decisions locked)';

  const discretionaryText = discretionary.length > 0
    ? discretionary.join('\n')
    : 'Implementation details not covered by explicit decisions are left to Claude\'s discretion.';

  return `# Phase ${padded}: ${phaseName} - Context

**Gathered:** ${date}
**Status:** Ready for planning

<domain>
${phaseDescription}
</domain>

<decisions>
## Implementation Decisions

${decisionLines}

### Claude's Discretion

${discretionaryText}
</decisions>

<canonical_refs>
## Canonical References

References to be populated during planning phase.
</canonical_refs>

<code_context>
## Code Context

Code patterns to be identified during planning phase.
</code_context>

<specifics>
## Implementation Specifics

Specific implementation ideas gathered during discussion.
</specifics>

<deferred>
## Deferred Items

Items identified but deferred for future phases.
</deferred>
`;
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.discuss',
  command: 'discuss',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Extract vision, design decisions, and acceptance criteria',
  options: [
    { flags: '-p, --phase <number>', description: 'Phase number (default: current from STATE.md)' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Discuss',
      description: 'Agent-guided design discussion',
    });

    // --- Step 0: Check provider availability ---
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      const msg = 'No AI provider available. Install Claude Code CLI or set ANTHROPIC_API_KEY to use sunco discuss.';
      await ctx.ui.result({
        success: false,
        title: 'Discuss',
        summary: msg,
      });
      return { success: false, summary: msg };
    }

    // --- Step 1: Determine phase number ---
    let phaseNumber: number;

    if (typeof ctx.args.phase === 'number') {
      phaseNumber = ctx.args.phase;
    } else {
      try {
        const stateContent = await readFile(
          join(ctx.cwd, '.planning', 'STATE.md'),
          'utf-8',
        );
        const state = parseStateMd(stateContent as string);
        if (state.phase === null) {
          const msg = 'Cannot determine current phase from STATE.md. Use --phase to specify.';
          await ctx.ui.result({ success: false, title: 'Discuss', summary: msg });
          return { success: false, summary: msg };
        }
        phaseNumber = state.phase;
      } catch {
        const msg = 'STATE.md not found. Use --phase to specify the target phase.';
        await ctx.ui.result({ success: false, title: 'Discuss', summary: msg });
        return { success: false, summary: msg };
      }
    }

    // Resolve phase directory
    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseNumber);

    // --- Step 2: Read ROADMAP.md ---
    let roadmapContent: string;
    try {
      roadmapContent = await readFile(
        join(ctx.cwd, '.planning', 'ROADMAP.md'),
        'utf-8',
      ) as string;
    } catch {
      const msg = 'ROADMAP.md not found. Run sunco new first to create planning artifacts.';
      await ctx.ui.result({ success: false, title: 'Discuss', summary: msg });
      return { success: false, summary: msg };
    }

    const roadmap = parseRoadmap(roadmapContent);
    const targetPhase = roadmap.phases.find(
      (p) => Number(p.number) === phaseNumber,
    );

    if (!targetPhase) {
      const msg = `Phase ${phaseNumber} not found in ROADMAP.md.`;
      await ctx.ui.result({ success: false, title: 'Discuss', summary: msg });
      return { success: false, summary: msg };
    }

    const phaseGoal = `${targetPhase.name}: ${targetPhase.description}`;
    const requirements = targetPhase.requirements ?? [];
    const padded = String(phaseNumber).padStart(2, '0');
    const slug = phaseDir
      ? phaseDir.split('/').pop()!.replace(/^\d+-/, '')
      : targetPhase.name.toLowerCase().replace(/\s+/g, '-');

    // --- Step 3: Agent identifies gray areas ---
    const analyzeProgress = ctx.ui.progress({
      title: 'Analyzing phase for gray areas',
    });

    const analyzeResult = await ctx.agent.run({
      role: 'planning',
      prompt: buildDiscussAnalyzePrompt(phaseGoal, requirements, ''),
      permissions: PLANNING_READ_PERMISSIONS,
      timeout: 120_000,
    });

    analyzeProgress.done({ summary: 'Analysis complete' });

    // --- Step 4: Present gray areas to user ---
    const decisions: Record<string, string> = {};
    const warnings: string[] = [];
    const grayAreas = parseGrayAreas(analyzeResult.outputText);

    if (grayAreas) {
      // Structured mode: present each gray area with options
      const askProgress = ctx.ui.progress({
        title: 'Gathering your input',
        total: grayAreas.length,
      });

      for (let i = 0; i < grayAreas.length; i++) {
        const area = grayAreas[i];
        const userChoice = await ctx.ui.ask({
          message: area.question,
          options: area.options.map((opt) => ({
            id: opt.id,
            label: opt.label,
            description: opt.description,
            recommended: opt.recommended,
          })),
          defaultId: area.defaultId,
        });

        // --- Step 5: Deep-dive ---
        const deepDiveResult = await ctx.agent.run({
          role: 'planning',
          prompt: buildDiscussDeepDivePrompt(
            { id: area.id, question: area.question, userAnswer: userChoice.selectedLabel },
            decisions,
            phaseGoal,
          ),
          permissions: PLANNING_READ_PERMISSIONS,
          timeout: 60_000,
        });

        const parsed = parseDeepDiveResponse(deepDiveResult.outputText);
        decisions[area.id] = parsed.decision;

        if (parsed.conflicts) {
          warnings.push(`Potential conflict for ${area.id}: ${parsed.conflicts}`);
        }

        askProgress.update({ completed: i + 1 });
      }

      askProgress.done({ summary: `${grayAreas.length} decisions gathered` });
    } else {
      // Fallback: agent output not parseable, use text mode
      ctx.log.warn('Could not parse gray areas from agent output. Falling back to text mode.');

      const textResponse = await ctx.ui.askText({
        message: 'The agent identified areas for discussion. Please share your thoughts on the key design decisions for this phase:',
        placeholder: 'Your design preferences and constraints...',
      });

      // Deep-dive on text response
      const deepDiveResult = await ctx.agent.run({
        role: 'planning',
        prompt: buildDiscussDeepDivePrompt(
          { id: 'text-input', question: 'Design preferences', userAnswer: textResponse.text },
          decisions,
          phaseGoal,
        ),
        permissions: PLANNING_READ_PERMISSIONS,
        timeout: 60_000,
      });

      const parsed = parseDeepDiveResponse(deepDiveResult.outputText);
      decisions['text-input'] = parsed.decision;
    }

    // --- Step 6: Generate holdout scenarios ---
    const scenarioProgress = ctx.ui.progress({
      title: 'Generating holdout scenarios',
    });

    let scenariosWritten = 0;
    try {
      const scenarioResult = await ctx.agent.run({
        role: 'planning',
        prompt: buildDiscussScenarioPrompt(decisions, phaseGoal, requirements),
        permissions: PLANNING_READ_PERMISSIONS,
        timeout: 120_000,
      });

      scenarioProgress.done({ summary: 'Scenarios generated' });

      const scenarios = parseScenarios(scenarioResult.outputText);
      for (let i = 0; i < scenarios.length; i++) {
        await ctx.fileStore.write(
          'scenarios',
          `scenario-${padded}-${i + 1}.md`,
          scenarios[i],
        );
        scenariosWritten++;
      }
    } catch (err) {
      scenarioProgress.done({ summary: 'Scenario generation failed' });
      const errMsg = err instanceof Error ? err.message : String(err);
      warnings.push(`Scenario generation failed: ${errMsg}. CONTEXT.md will still be written.`);
      ctx.log.warn('Scenario generation failed', { error: errMsg });
    }

    // --- Step 7: Write CONTEXT.md ---
    const writeProgress = ctx.ui.progress({
      title: 'Writing CONTEXT.md',
    });

    const contextContent = buildContextMd(
      phaseNumber,
      targetPhase.name,
      targetPhase.description,
      decisions,
      [],
    );

    const contextPath = await writePhaseArtifact(
      ctx.cwd,
      phaseNumber,
      slug,
      `${padded}-CONTEXT.md`,
      contextContent,
    );

    writeProgress.done({ summary: 'CONTEXT.md written' });

    // --- Step 8: Return result ---
    const writtenFiles = [contextPath];
    if (scenariosWritten > 0) {
      writtenFiles.push(`.sun/scenarios/ (${scenariosWritten} files)`);
    }

    const summary = `Discussion complete. ${Object.keys(decisions).length} decisions locked, CONTEXT.md written${scenariosWritten > 0 ? `, ${scenariosWritten} scenarios generated` : ''}`;

    await ctx.ui.result({
      success: true,
      title: 'Discuss',
      summary,
      details: writtenFiles,
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    return {
      success: true,
      summary,
      data: { contextPath, decisionsCount: Object.keys(decisions).length, scenariosWritten },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
});
