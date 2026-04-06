/**
 * @sunco/skills-workflow - Verify Skill
 *
 * 7-layer Swiss cheese verification pipeline orchestrator.
 * Executes all 7 verification layers sequentially, aggregates findings,
 * computes verdict, handles human gates, and writes VERIFICATION.md.
 *
 * Layers:
 * 1. Multi-Agent Generation (4 experts + coordinator)
 * 2. Deterministic Guardrails (lint + guard)
 * 3. BDD Acceptance Criteria (done criteria + holdout scenarios)
 * 4. Permission Scoping (git diff vs declared scope)
 * 5. Adversarial Verification (adversarial + intent reconstruction)
 * 6. Cross-Model Verification (different model blind spot detection)
 * 7. Human Eval Gate (final human sign-off)
 *
 * Each layer runs independently -- a layer failure does NOT stop subsequent
 * layers. This is the Swiss cheese model: every layer catches what others miss.
 *
 * Requirements: VRF-01 through VRF-09, REV-02, REV-03
 * Decisions: D-01 (sequential 7-layer), D-02 through D-08, D-21, D-22
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { resolvePhaseDir } from './shared/phase-reader.js';
import { parsePlanMd } from './shared/plan-parser.js';
import type { ParsedPlan } from './shared/plan-parser.js';
import type { VerifyFinding, VerifyReport, VerifyVerdict, LayerResult } from './shared/verify-types.js';
import {
  runLayer1MultiAgent,
  runLayer2Deterministic,
  runLayer3Acceptance,
  runLayer4PermissionScope,
  runLayer5Adversarial,
  runLayer6CrossModel,
  runLayer7HumanEval,
} from './shared/verify-layers.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Layer names for error capture */
const LAYER_NAMES = [
  'Multi-Agent Generation',
  'Deterministic Guardrails',
  'BDD Acceptance Criteria',
  'Permission Scoping',
  'Adversarial Verification',
  'Cross-Model Verification',
  'Human Eval Gate',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Quality Gate: configurable multi-dimensional thresholds
// ---------------------------------------------------------------------------

interface QualityGate {
  maxCritical: number;
  maxHigh: number;
  maxMedium: number;
}

/**
 * Default quality gate — STOP-THE-LINE philosophy.
 * Zero tolerance for ALL severities. No carry-forward allowed.
 * Use --lenient to temporarily relax medium threshold (for development only).
 */
const DEFAULT_QUALITY_GATE: QualityGate = {
  maxCritical: 0,
  maxHigh: 0,
  maxMedium: 0,
};

/** Lenient gate for development — still blocks critical/high */
const LENIENT_QUALITY_GATE: QualityGate = {
  maxCritical: 0,
  maxHigh: 0,
  maxMedium: 5,
};

/**
 * Compute verdict from findings against quality gate thresholds.
 *
 * FAIL: any threshold exceeded.
 * WARN: findings exist but within thresholds.
 * PASS: no findings.
 *
 * This is a deterministic, configurable gate — not an LLM judgment call.
 * Inspired by SonarQube's Quality Gate model.
 */
function computeVerdict(
  findings: VerifyFinding[],
  gate: QualityGate = DEFAULT_QUALITY_GATE,
): VerifyVerdict {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;

  if (criticalCount > gate.maxCritical) return 'FAIL';
  if (highCount > gate.maxHigh) return 'FAIL';
  if (mediumCount > gate.maxMedium) return 'FAIL';

  // Stop-the-line: ANY remaining findings (including low) = FAIL
  // No carry-forward allowed. Use --lenient only during development.
  if (findings.length > 0) return 'FAIL';
  return 'PASS';
}

/**
 * Format the VERIFICATION.md report content.
 */
function formatVerificationMd(report: VerifyReport): string {
  const lines: string[] = [];

  lines.push('# Verification Report');
  lines.push('');
  lines.push(`**Verdict:** ${report.verdict}`);
  lines.push(`**Timestamp:** ${report.timestamp}`);
  lines.push(`**Total findings:** ${report.findings.length}`);
  lines.push(`**Human gate required:** ${report.humanGateRequired ? 'Yes' : 'No'}`);
  lines.push('');

  for (const layer of report.layers) {
    lines.push(`## Layer ${layer.layer}: ${layer.name}`);
    lines.push('');
    lines.push(`**Status:** ${layer.passed ? 'PASS' : 'FAIL'}`);
    lines.push(`**Duration:** ${layer.durationMs}ms`);
    lines.push(`**Findings:** ${layer.findings.length}`);
    lines.push('');

    if (layer.findings.length > 0) {
      for (const finding of layer.findings) {
        const humanTag = finding.humanRequired ? ' [HUMAN REQUIRED]' : '';
        lines.push(`- **[${finding.severity.toUpperCase()}]** (${finding.source})${humanTag}: ${finding.description}`);
        if (finding.file) {
          lines.push(`  - File: ${finding.file}${finding.line ? `:${finding.line}` : ''}`);
        }
        if (finding.suggestion) {
          lines.push(`  - Suggestion: ${finding.suggestion}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`*Generated by sunco verify at ${report.timestamp}*`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.verify',
  command: 'verify',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'complex',
  description: 'Run 7-layer Swiss cheese verification pipeline',

  options: [
    { flags: '-p, --phase <number>', description: 'Which phase to verify' },
    { flags: '--auto', description: 'Skip human gate prompts (for CI)' },
    { flags: '--strict', description: 'Fail on humanRequired findings' },
    { flags: '--lenient', description: 'Allow up to 5 medium findings (development only, blocked for release)' },
    { flags: '--skip-cross-model', description: 'Skip Layer 6 (cross-model verification)' },
    { flags: '--skip-human-eval', description: 'Skip Layer 7 (human eval gate)' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Verify',
      description: 'Starting 7-layer Swiss cheese verification...',
    });

    // --- Step 1: Resolve phase ---
    const phaseArg = ctx.args.phase as number | undefined;
    if (phaseArg === undefined) {
      const msg = 'Usage: sunco verify --phase <number>';
      await ctx.ui.result({ success: false, title: 'Verify', summary: msg });
      return { success: false, summary: msg };
    }

    const phaseDir = await resolvePhaseDir(ctx.cwd, phaseArg);
    if (!phaseDir) {
      const msg = `Phase ${phaseArg} directory not found`;
      await ctx.ui.result({ success: false, title: 'Verify', summary: msg });
      return { success: false, summary: msg };
    }

    // --- Step 2: Read PLAN.md files ---
    let entries: string[];
    try {
      entries = await readdir(phaseDir);
    } catch {
      const msg = `Cannot read phase directory: ${phaseDir}`;
      await ctx.ui.result({ success: false, title: 'Verify', summary: msg });
      return { success: false, summary: msg };
    }

    const planFiles = entries.filter(
      (e: string) => e.match(/-PLAN\.md$/) && !e.includes('SUMMARY'),
    );

    const plans: ParsedPlan[] = [];
    for (const file of planFiles) {
      try {
        const content = await readFile(join(phaseDir, file), 'utf-8');
        plans.push(parsePlanMd(content));
      } catch (err) {
        ctx.log.warn(`Failed to parse plan ${file}`, { error: err });
      }
    }

    // --- Step 3: Get git diff ---
    let diff = '';
    try {
      const git = simpleGit(ctx.cwd);
      const log = await git.log({ maxCount: 50 });
      const padded = String(phaseArg).padStart(2, '0');

      const phaseCommits = log.all.filter(
        (c) => c.message.includes(`(${padded}-`) || c.message.includes(`Phase ${phaseArg}`),
      );

      if (phaseCommits.length > 0) {
        const oldestCommit = phaseCommits[phaseCommits.length - 1]!;
        diff = await git.diff([`${oldestCommit.hash}^..HEAD`]);
      } else {
        const staged = await git.diff(['--cached']);
        const unstaged = await git.diff();
        diff = [staged, unstaged].filter(Boolean).join('\n');
      }
    } catch {
      ctx.log.warn('Git diff failed -- using empty diff');
    }

    // --- Step 4: Execute all 7 layers sequentially (D-01) ---
    const isAuto = ctx.args.auto === true;
    const isStrict = ctx.args.strict === true;
    // In strict mode, skip flags are IGNORED — all layers must run
    const skipCrossModel = isStrict ? false : (ctx.args['skip-cross-model'] === true || ctx.args.skipCrossModel === true);
    const skipHumanEval = isStrict ? false : (ctx.args['skip-human-eval'] === true || ctx.args.skipHumanEval === true);
    const layerProgress = ctx.ui.progress({
      title: 'Verification layers',
      total: 7,
    });

    // Execute Layers 1-5 (core automated layers)
    const layerFunctions = [
      () => runLayer1MultiAgent(ctx, diff, phaseDir),
      () => runLayer2Deterministic(ctx),
      () => runLayer3Acceptance(ctx, plans, phaseDir),
      () => runLayer4PermissionScope(ctx, plans),
      () => runLayer5Adversarial(ctx, diff, phaseDir),
    ];

    const layerResults: LayerResult[] = [];

    for (let i = 0; i < layerFunctions.length; i++) {
      const fn = layerFunctions[i]!;
      const layerName = LAYER_NAMES[i]!;

      layerProgress.update({
        completed: i,
        message: `Layer ${i + 1}: ${layerName}`,
      });

      try {
        const result = await fn();
        layerResults.push(result);
      } catch (err) {
        // Layer failure does NOT stop subsequent layers (Swiss cheese model)
        ctx.log.warn(`Layer ${i + 1} (${layerName}) threw`, { error: err });
        layerResults.push({
          layer: i + 1,
          name: layerName,
          findings: [
            {
              layer: i + 1,
              source: 'correctness' as VerifyFinding['source'],
              severity: 'low',
              description: `Layer ${i + 1} error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          passed: true,
          durationMs: 0,
        });
      }
    }

    // Layer 6: Cross-Model Verification
    layerProgress.update({ completed: 5, message: 'Layer 6: Cross-Model Verification' });

    if (skipCrossModel) {
      ctx.log.info('Layer 6 (Cross-Model) skipped via --skip-cross-model');
      layerResults.push({
        layer: 6,
        name: 'Cross-Model Verification',
        findings: [],
        passed: true,
        durationMs: 0,
      });
    } else {
      try {
        // Collect all findings from Layers 1-5 for cross-model context
        const previousFindings: VerifyFinding[] = [];
        for (const lr of layerResults) {
          previousFindings.push(...lr.findings);
        }

        const layer6Result = await runLayer6CrossModel(ctx, diff, previousFindings);
        layerResults.push(layer6Result);
      } catch (err) {
        ctx.log.warn('Layer 6 (Cross-Model) threw', { error: err });
        layerResults.push({
          layer: 6,
          name: 'Cross-Model Verification',
          findings: [
            {
              layer: 6,
              source: 'cross-model' as VerifyFinding['source'],
              severity: 'low',
              description: `Layer 6 error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          passed: true,
          durationMs: 0,
        });
      }
    }

    // Layer 7: Human Eval Gate
    layerProgress.update({ completed: 6, message: 'Layer 7: Human Eval Gate' });

    try {
      const layer7Result = await runLayer7HumanEval(ctx, layerResults, {
        skipHumanEval,
        isAuto,
      });
      layerResults.push(layer7Result);
    } catch (err) {
      ctx.log.warn('Layer 7 (Human Eval) threw', { error: err });
      layerResults.push({
        layer: 7,
        name: 'Human Eval Gate',
        findings: [
          {
            layer: 7,
            source: 'human-eval' as VerifyFinding['source'],
            severity: 'low',
            description: `Layer 7 error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        passed: true,
        durationMs: 0,
      });
    }

    layerProgress.update({ completed: 7, message: 'All layers complete' });
    layerProgress.done({ summary: 'All 7 layers executed' });

    // --- Step 5: Aggregate findings ---
    const allFindings: VerifyFinding[] = [];
    for (const layer of layerResults) {
      allFindings.push(...layer.findings);
    }

    // --- Step 6: Compute verdict against quality gate ---
    // Default: STOP-THE-LINE (zero tolerance). --lenient: allow some mediums for development.
    const isLenient = ctx.args.lenient === true;
    const baseGate = isLenient ? LENIENT_QUALITY_GATE : DEFAULT_QUALITY_GATE;
    const gateConfig = await ctx.state.get<Partial<QualityGate>>('verify.qualityGate');
    const gate: QualityGate = {
      maxCritical: gateConfig?.maxCritical ?? baseGate.maxCritical,
      maxHigh: gateConfig?.maxHigh ?? baseGate.maxHigh,
      maxMedium: gateConfig?.maxMedium ?? baseGate.maxMedium,
    };
    let verdict = computeVerdict(allFindings, gate);

    // --- Step 7: Human gate (legacy -- retained for humanRequired findings from Layers 1-5) ---
    const humanGateRequired = allFindings.some((f) => f.humanRequired === true);

    // --strict: humanRequired findings = FAIL
    if (isStrict && humanGateRequired) {
      verdict = 'FAIL';
    }

    // Human gate prompt (unless --auto)
    if (humanGateRequired && !isAuto && !isStrict) {
      const humanFindings = allFindings.filter((f) => f.humanRequired);
      const humanSummary = humanFindings
        .map((f) => `- [${f.severity}] ${f.source}: ${f.description}`)
        .join('\n');

      const gateChoice = await ctx.ui.ask({
        message: `${humanFindings.length} finding(s) require human review:\n${humanSummary}\n\nApprove?`,
        options: [
          { id: 'approve', label: 'Approve' },
          { id: 'reject', label: 'Reject — override verdict to FAIL' },
        ],
      });

      if (gateChoice.selectedId === 'reject') {
        verdict = 'FAIL';
        ctx.log.warn('Human gate rejected — verdict overridden to FAIL');
      }
    }

    // --- Step 8: Build report ---
    const report: VerifyReport = {
      verdict,
      layers: layerResults,
      findings: allFindings,
      humanGateRequired,
      timestamp: new Date().toISOString(),
    };

    // --- Step 9: Write VERIFICATION.md ---
    const verificationContent = formatVerificationMd(report);
    const verificationPath = join(phaseDir, 'VERIFICATION.md');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(verificationPath, verificationContent, 'utf-8');
    ctx.log.info('VERIFICATION.md written', { path: verificationPath });

    // --- Step 10: Store result in state ---
    await ctx.state.set('verify.lastResult', {
      verdict: report.verdict,
      findingCount: allFindings.length,
      timestamp: report.timestamp,
    });

    // --- Step 11: Return result ---
    const success = verdict !== 'FAIL';
    const summary = `Verification ${verdict}: ${allFindings.length} finding(s) across 7 layers`;

    // Verdict-aware output: succeed silently, fail loudly
    const details: string[] = [];
    if (verdict === 'PASS') {
      // Single line — succeed silently
      details.push(`${allFindings.length} findings across 7 layers — all within quality gate`);
    } else if (verdict === 'WARN') {
      // Brief summary + warning list
      details.push(`${allFindings.length} finding(s) — within quality gate thresholds`);
      for (const f of allFindings.slice(0, 10)) {
        details.push(`  [${f.severity}] ${f.source}: ${f.description.slice(0, 120)}`);
      }
      if (allFindings.length > 10) details.push(`  ... and ${allFindings.length - 10} more`);
    } else {
      // FAIL — full detailed report with fix suggestions
      details.push(`${allFindings.length} finding(s) — QUALITY GATE FAILED`);
      details.push('');
      for (const f of allFindings) {
        details.push(`[${f.severity.toUpperCase()}] Layer ${f.layer} (${f.source})`);
        details.push(`  ${f.description}`);
        if (f.file) details.push(`  File: ${f.file}${f.line ? `:${f.line}` : ''}`);
        if (f.suggestion) details.push(`  Fix: ${f.suggestion}`);
        details.push('');
      }
    }
    details.push(`Output: ${verificationPath}`);

    await ctx.ui.result({
      success,
      title: 'Verify',
      summary,
      details,
    });

    return {
      success,
      summary,
      data: report,
    };
  },
});
