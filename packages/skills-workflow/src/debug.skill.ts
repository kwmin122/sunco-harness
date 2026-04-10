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
import { join, dirname } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildDebugAnalyzePrompt } from './prompts/debug-analyze.js';
import { resolvePhaseDir } from './shared/phase-reader.js';
import type { DebugAnalysis, DiagnoseResult, IronLawDebugAnalysis, FailureType } from './shared/debug-types.js';
import { classifyBug, getBugPattern } from './shared/bug-patterns.js';
import { sanitizeForSearch } from './shared/error-sanitizer.js';
import { searchLearnings, saveLearning } from './shared/debug-learnings.js';
import { createIronLawState } from './shared/iron-law-gate.js';

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
  complexity: 'standard',
  description: 'Classify build/test failures and suggest actionable fixes',
  options: [
    { flags: '-p, --phase <number>', description: 'Scope analysis to a specific phase' },
    { flags: '-q, --quick', description: 'Quick mode: skip Iron Law for fast diagnosis' },
    { flags: '--parse', description: 'Deterministic error parsing (delegates to diagnose)' },
    { flags: '--postmortem', description: 'Workflow post-mortem analysis (delegates to forensics)' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    if (ctx.args.parse === true) {
      return ctx.run('workflow.diagnose', ctx.args);
    }
    if (ctx.args.postmortem === true) {
      return ctx.run('workflow.forensics', ctx.args);
    }

    const quickMode = ctx.args.quick === true;

    // --- Entry ---
    await ctx.ui.entry({
      title: quickMode ? 'Debug (quick)' : 'Debug (Iron Law)',
      description: quickMode ? 'Quick failure analysis...' : 'Iron Law analysis — root cause first, then fix...',
    });

    const totalSteps = quickMode ? 4 : 7;
    const progress = ctx.ui.progress({
      title: 'Gathering context',
      total: totalSteps,
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
    let diagnoseData: DiagnoseResult | null = null;
    try {
      const diagnoseResult = await ctx.run('workflow.diagnose');
      if (diagnoseResult.success !== undefined && diagnoseResult.data) {
        diagnoseData = diagnoseResult.data as DiagnoseResult;
        testOutput = diagnoseData.raw_output.test ?? '';
        buildOutput = diagnoseData.raw_output.tsc ?? '';

        // Format recent errors for the prompt
        const errorLines: string[] = [];
        for (const e of diagnoseData.test_failures) {
          errorLines.push(`[test] ${e.file}:${e.line ?? '?'} - ${e.message}`);
        }
        for (const e of diagnoseData.type_errors) {
          errorLines.push(`[tsc] ${e.file}:${e.line ?? '?'} - ${e.code}: ${e.message}`);
        }
        for (const e of diagnoseData.lint_errors) {
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

    // --- Iron Law steps (skipped in quick mode) ---
    let bugClassification: FailureType = 'context_shortage';
    let priorLearningsContext = '';
    let sanitizedErrors = recentErrors;
    let freezeScopeDirs: string[] = [];

    if (!quickMode) {
      // --- Step 4: Classify bug pattern (9-type) ---
      const allErrors = diagnoseData
        ? [...diagnoseData.test_failures, ...diagnoseData.type_errors, ...diagnoseData.lint_errors]
        : [];
      bugClassification = classifyBug(allErrors, `${testOutput}\n${buildOutput}`);
      const pattern = getBugPattern(bugClassification);
      progress.update({ completed: 4, message: `Classified: ${bugClassification} (${pattern?.category ?? 'unknown'})` });

      // --- Step 5: Search prior learnings ---
      const errorFiles = allErrors.map((e) => e.file).filter(Boolean);
      const learnings = await searchLearnings(ctx.cwd, {
        pattern: bugClassification,
        files: errorFiles.slice(0, 5),
      });
      if (learnings.length > 0) {
        priorLearningsContext = '\n\n## Prior Learnings (from previous debug sessions)\n\n' +
          learnings.slice(0, 3).map((l) =>
            `- **${l.pattern}**: ${l.symptom}\n  Root cause: ${l.rootCause}\n  Fix: ${l.fix}\n  Hit count: ${l.hitCount}`,
          ).join('\n');
      }
      progress.update({ completed: 5, message: `Prior learnings: ${learnings.length} found` });

      // --- Step 6: Sanitize errors for safe context ---
      const sanitized = sanitizeForSearch(recentErrors);
      sanitizedErrors = sanitized.text;
      if (sanitized.totalRedacted > 0) {
        ctx.log.info(`Sanitized ${sanitized.totalRedacted} PII items from error output`);
      }
      progress.update({ completed: 6, message: 'Errors sanitized' });

      // --- Compute freeze scope (narrow writePaths) ---
      const uniqueDirs = new Set<string>();
      for (const e of allErrors) {
        if (e.file) {
          uniqueDirs.add(dirname(e.file));
        }
      }
      freezeScopeDirs = [...uniqueDirs];
    }

    // --- Permissions stay read-only (verification role cannot have writePaths) ---
    // Freeze scope is communicated via prompt, not permissions.
    const permissions: PermissionSet = DEBUG_PERMISSIONS;

    // --- Build prompt and dispatch agent ---
    let prompt: string;
    if (quickMode) {
      prompt = buildDebugAnalyzePrompt({
        gitLog,
        testOutput,
        buildOutput,
        stateSnapshot,
        recentErrors,
      });
    } else {
      // Iron Law enhanced prompt
      const pattern = getBugPattern(bugClassification);
      const ironLawState = createIronLawState(phaseArg ?? 0);
      const { buildDebugIronLawPrompt } = await import('./prompts/debug-ironlaw.js');
      prompt = buildDebugIronLawPrompt({
        gitLog,
        testOutput,
        buildOutput,
        stateSnapshot,
        recentErrors: sanitizedErrors,
        bugClassification,
        bugPattern: pattern ?? { type: bugClassification, category: 'structural', description: '', indicators: [], commonFixes: [] },
        priorLearnings: priorLearningsContext,
        ironLawState,
        freezeScope: freezeScopeDirs,
      });
    }

    const result = await ctx.agent.run({
      role: 'verification',
      prompt,
      permissions,
      timeout: 120_000,
    });

    progress.update({ completed: totalSteps, message: 'Agent analysis complete' });
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

    // --- Save learning (Iron Law mode only) ---
    if (!quickMode && analysis.root_cause) {
      try {
        const id = `learn-${Date.now().toString(36)}`;
        await saveLearning(ctx.cwd, {
          id,
          pattern: analysis.failure_type as FailureType,
          symptom: recentErrors.slice(0, 200),
          rootCause: analysis.root_cause,
          fix: analysis.fix_suggestions[0]?.action ?? '',
          files: analysis.affected_files.map((f) => f.file),
          createdAt: new Date().toISOString(),
          hitCount: 0,
        });
      } catch {
        // Learning save is best-effort
      }
    }

    // --- Store in state ---
    await ctx.state.set('debug.lastResult', analysis);

    // --- Format output ---
    const topSuggestions = analysis.fix_suggestions
      .slice(0, 3)
      .map((s) => `[${s.priority}] ${s.action}${s.file ? ` (${s.file})` : ''}`);

    const summary = `${analysis.failure_type}: ${analysis.root_cause} (confidence: ${analysis.confidence}%)`;

    const details = [
      `Failure type: ${analysis.failure_type}`,
      `Root cause: ${analysis.root_cause}`,
      `Affected files: ${analysis.affected_files.length}`,
      `Confidence: ${analysis.confidence}%`,
    ];

    if (!quickMode) {
      details.push(
        `Bug classification: ${bugClassification}`,
        `Freeze scope: ${freezeScopeDirs.length > 0 ? freezeScopeDirs.join(', ') : 'none'}`,
      );
    }

    details.push('', 'Top fix suggestions:', ...topSuggestions);

    await ctx.ui.result({
      success: true,
      title: 'Debug',
      summary,
      details,
    });

    return {
      success: true,
      summary,
      data: analysis,
    };
  },
});
