/**
 * @sunco/skills-workflow - Debug Skill: Agent-powered failure classification
 *
 * Gathers git history, diagnostic output, and state context, then dispatches
 * to an analysis agent that classifies failures and suggests fixes.
 *
 * Requirements: DBG-01
 * Decisions: D-01 (failure classification), D-02 (context gathering),
 *   D-03 (structured output), D-04 (verification permissions)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult, PermissionSet } from '@sunco/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildDebugAnalyzePrompt } from './prompts/debug-analyze.js';
import { resolvePhaseDir } from './shared/phase-reader.js';
import type { DebugAnalysis, DiagnoseResult } from './shared/debug-types.js';

// ---------------------------------------------------------------------------
// Permissions (D-04: read + test only)
// ---------------------------------------------------------------------------

const DEBUG_PERMISSIONS: PermissionSet = {
  role: 'verification',
  readPaths: ['**'],
  writePaths: [],
  allowTests: true,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: ['npx vitest', 'npx tsc'],
};

// ---------------------------------------------------------------------------
// JSON parser helper (exported for testability)
// ---------------------------------------------------------------------------

/**
 * Parse agent output into DebugAnalysis.
 *
 * Tries extracting from the last JSON code block first (```json ... ```).
 * Falls back to parsing the entire output as JSON.
 * Returns null if parsing fails.
 *
 * @param output - Raw agent output text
 * @returns Parsed DebugAnalysis or null
 */
export function parseDebugOutput(output: string): DebugAnalysis | null {
  if (!output || !output.trim()) return null;

  // Try extracting JSON from the last code block
  const codeBlockMatches = [...output.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)];
  if (codeBlockMatches.length > 0) {
    const lastMatch = codeBlockMatches[codeBlockMatches.length - 1]!;
    try {
      return JSON.parse(lastMatch[1]!) as DebugAnalysis;
    } catch {
      // Fall through to raw parse
    }
  }

  // Try parsing the entire output as JSON
  try {
    return JSON.parse(output.trim()) as DebugAnalysis;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.debug',
  command: 'debug',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Classify build/test failures and suggest actionable fixes',
  options: [
    { flags: '-p, --phase <number>', description: 'Scope analysis to a specific phase' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Debug',
      description: 'Analyzing failure...',
    });

    const progress = ctx.ui.progress({
      title: 'Gathering context',
      total: 4,
    });

    // --- Step 1: Gather git context (D-02) ---
    let gitLog = '';
    try {
      const git = simpleGit(ctx.cwd);
      const log = await git.log({ maxCount: 30 });
      gitLog = log.all
        .map((c) => `${c.hash.slice(0, 7)} ${c.date} ${c.message}`)
        .join('\n');

      const diff = await git.diff();
      if (diff) {
        gitLog += '\n\n--- Uncommitted changes ---\n' + diff;
      }
    } catch {
      gitLog = '[git state unavailable]';
    }
    progress.update({ completed: 1, message: 'Git context gathered' });

    // --- Step 2: Gather diagnostic output ---
    let testOutput = '';
    let buildOutput = '';
    let recentErrors = '';
    try {
      const diagnoseResult = await ctx.run('workflow.diagnose');
      if (diagnoseResult.success !== undefined && diagnoseResult.data) {
        const data = diagnoseResult.data as DiagnoseResult;
        testOutput = data.raw_output.test ?? '';
        buildOutput = data.raw_output.tsc ?? '';

        // Format recent errors for the prompt
        const errorLines: string[] = [];
        for (const e of data.test_failures) {
          errorLines.push(`[test] ${e.file}:${e.line ?? '?'} - ${e.message}`);
        }
        for (const e of data.type_errors) {
          errorLines.push(`[tsc] ${e.file}:${e.line ?? '?'} - ${e.code}: ${e.message}`);
        }
        for (const e of data.lint_errors) {
          errorLines.push(`[lint] ${e.file}:${e.line ?? '?'} - ${e.code}: ${e.message}`);
        }
        recentErrors = errorLines.join('\n');
      }
    } catch (err) {
      ctx.log.warn('Diagnose skill failed, using empty diagnostics', { error: String(err) });
    }
    progress.update({ completed: 2, message: 'Diagnostics gathered' });

    // --- Step 3: Gather state snapshot (D-02) ---
    let stateSnapshot = '';
    try {
      stateSnapshot = await readFile(join(ctx.cwd, '.planning', 'STATE.md'), 'utf-8');
    } catch {
      stateSnapshot = '[STATE.md not found]';
    }

    // If --phase provided, also read phase context
    const phaseArg = ctx.args.phase as number | undefined;
    if (phaseArg !== undefined) {
      const phaseDir = await resolvePhaseDir(ctx.cwd, phaseArg);
      if (phaseDir) {
        try {
          const contextMd = await readFile(join(phaseDir, `${String(phaseArg).padStart(2, '0')}-CONTEXT.md`), 'utf-8');
          stateSnapshot += '\n\n--- Phase CONTEXT.md ---\n' + contextMd;
        } catch {
          // Phase context not available, continue
        }

        try {
          const verificationMd = await readFile(join(phaseDir, 'VERIFICATION.md'), 'utf-8');
          stateSnapshot += '\n\n--- Phase VERIFICATION.md ---\n' + verificationMd;
        } catch {
          // Verification report not available, continue
        }
      }
    }
    progress.update({ completed: 3, message: 'State snapshot gathered' });

    // --- Step 4: Build prompt and dispatch agent ---
    const prompt = buildDebugAnalyzePrompt({
      gitLog,
      testOutput,
      buildOutput,
      stateSnapshot,
      recentErrors,
    });

    const result = await ctx.agent.run({
      role: 'verification',
      prompt,
      permissions: DEBUG_PERMISSIONS,
      timeout: 120_000,
    });

    progress.update({ completed: 4, message: 'Agent analysis complete' });
    progress.done({ summary: 'Analysis complete' });

    // --- Parse result ---
    const analysis = parseDebugOutput(result.outputText);

    if (!analysis) {
      // Graceful degradation: return raw output as summary
      const summary = `Debug analysis completed (unstructured): ${result.outputText.slice(0, 300)}`;
      await ctx.state.set('debug.lastResult', { raw: result.outputText });

      await ctx.ui.result({
        success: true,
        title: 'Debug',
        summary,
        details: ['Agent output could not be parsed as structured JSON', 'Raw output stored in state'],
      });

      return {
        success: true,
        summary,
        data: { raw: result.outputText },
        warnings: ['Agent output was not parseable as DebugAnalysis JSON'],
      };
    }

    // --- Store in state ---
    await ctx.state.set('debug.lastResult', analysis);

    // --- Format output ---
    const topSuggestions = analysis.fix_suggestions
      .slice(0, 3)
      .map((s) => `[${s.priority}] ${s.action}${s.file ? ` (${s.file})` : ''}`);

    const summary = `${analysis.failure_type}: ${analysis.root_cause} (confidence: ${analysis.confidence}%)`;

    await ctx.ui.result({
      success: true,
      title: 'Debug',
      summary,
      details: [
        `Failure type: ${analysis.failure_type}`,
        `Root cause: ${analysis.root_cause}`,
        `Affected files: ${analysis.affected_files.length}`,
        `Confidence: ${analysis.confidence}%`,
        '',
        'Top fix suggestions:',
        ...topSuggestions,
      ],
    });

    return {
      success: true,
      summary,
      data: analysis,
    };
  },
});
