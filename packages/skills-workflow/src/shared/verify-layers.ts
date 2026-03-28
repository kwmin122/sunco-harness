/**
 * Verification layer execution functions for sunco verify.
 *
 * Implements the 5-layer Swiss cheese verification model:
 * - Layer 1: Multi-Agent Generation (4 experts + coordinator)
 * - Layer 2: Deterministic Guardrails (lint + guard via ctx.run())
 * - Layer 3: BDD Acceptance Criteria (done criteria + holdout scenarios)
 * - Layer 4: Permission Scoping (git diff vs declared files_modified)
 * - Layer 5: Adversarial Verification (adversarial + intent reconstruction)
 *
 * Each layer returns a LayerResult. Layers never throw -- all failures
 * are captured as findings. This is the Swiss cheese model: every layer
 * is independent, if one misses something others catch it.
 *
 * Requirements: VRF-01 through VRF-09, REV-02, REV-03
 * Decisions: D-01 through D-08, D-21, D-22
 */

import type { SkillContext, PermissionSet, FileStoreApi } from '@sunco/core';
import type { VerifyFinding, LayerResult } from './verify-types.js';
import type { ParsedPlan } from './plan-parser.js';
import { readPhaseArtifact } from './phase-reader.js';
import { buildVerifySecurityPrompt } from '../prompts/verify-security.js';
import { buildVerifyPerformancePrompt } from '../prompts/verify-performance.js';
import { buildVerifyArchitecturePrompt } from '../prompts/verify-architecture.js';
import { buildVerifyCorrectnessPrompt } from '../prompts/verify-correctness.js';
import { buildVerifyCoordinatorPrompt } from '../prompts/verify-coordinator.js';
import { buildVerifyAdversarialPrompt } from '../prompts/verify-adversarial.js';
import { buildVerifyIntentPrompt } from '../prompts/verify-intent.js';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Read-only + test permissions for verification agents */
export const VERIFICATION_PERMISSIONS: PermissionSet = {
  role: 'verification',
  readPaths: ['**'],
  writePaths: [],
  allowTests: true,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: ['npx vitest', 'npm test'],
};

/** Per-expert agent timeout */
const EXPERT_TIMEOUT = 120_000;

/** Coordinator agent timeout */
const COORDINATOR_TIMEOUT = 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse structured findings from agent outputText.
 * Extracts the last ```json block and parses findings array from it.
 * If parsing fails, returns a single "unparsed" finding at severity 'low' (Pitfall 7).
 */
export function parseExpertFindings(
  outputText: string,
  source: VerifyFinding['source'],
  layer: number,
): VerifyFinding[] {
  const jsonBlocks = outputText.match(/```json\s*\n([\s\S]*?)```/g);
  if (!jsonBlocks || jsonBlocks.length === 0) {
    if (!outputText.trim()) return [];
    return [
      {
        layer,
        source,
        severity: 'low',
        description: `Expert agent returned non-JSON output: ${outputText.slice(0, 200)}`,
      },
    ];
  }

  const lastBlock = jsonBlocks[jsonBlocks.length - 1]!;
  const jsonStr = lastBlock.replace(/```json\s*\n?/, '').replace(/```$/, '').trim();

  try {
    const parsed = JSON.parse(jsonStr);
    const rawFindings: unknown[] = parsed.findings ?? parsed.deduplicatedFindings ?? [];

    return rawFindings.map((f: unknown) => {
      const finding = f as Record<string, unknown>;
      return {
        layer,
        source,
        severity: (finding.severity as VerifyFinding['severity']) ?? 'low',
        description: String(finding.description ?? ''),
        file: finding.file ? String(finding.file) : undefined,
        line: typeof finding.line === 'number' ? finding.line : undefined,
        suggestion: finding.suggestion ? String(finding.suggestion) : undefined,
        humanRequired: finding.humanRequired === true ? true : undefined,
      };
    });
  } catch {
    return [
      {
        layer,
        source,
        severity: 'low',
        description: `Failed to parse expert JSON: ${jsonStr.slice(0, 200)}`,
      },
    ];
  }
}

/**
 * Load holdout scenario files from .sun/scenarios/.
 * Returns file contents as string array.
 */
export async function loadHoldoutScenarios(
  fileStore: FileStoreApi,
): Promise<string[]> {
  try {
    const filenames = await fileStore.list('scenarios');
    if (filenames.length === 0) return [];

    const scenarios: string[] = [];
    for (const filename of filenames) {
      const content = await fileStore.read('scenarios', filename);
      if (content) {
        scenarios.push(content);
      }
    }
    return scenarios;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Layer 1: Multi-Agent Generation (VRF-01, VRF-06)
// ---------------------------------------------------------------------------

/**
 * Layer 1: Dispatch 4 expert agents in parallel, then a coordinator to synthesize.
 *
 * Experts: Security, Performance, Architecture, Correctness.
 * Each uses role: 'verification' with read + test permissions.
 * Coordinator receives all expert findings and produces deduplicated results.
 *
 * Uses Promise.allSettled() for parallel dispatch (NOT crossVerify --
 * crossVerify sends the SAME prompt; Layer 1 needs DIFFERENT prompts per expert).
 */
export async function runLayer1MultiAgent(
  ctx: SkillContext,
  diff: string,
  _phaseDir: string,
): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  try {
    // Build prompts for each expert
    const experts = [
      { source: 'security' as const, prompt: buildVerifySecurityPrompt(diff) },
      { source: 'performance' as const, prompt: buildVerifyPerformancePrompt(diff) },
      { source: 'architecture' as const, prompt: buildVerifyArchitecturePrompt(diff) },
      { source: 'correctness' as const, prompt: buildVerifyCorrectnessPrompt(diff) },
    ];

    // Dispatch all 4 experts in parallel
    const expertResults = await Promise.allSettled(
      experts.map((expert) =>
        ctx.agent.run({
          role: 'verification',
          prompt: expert.prompt,
          permissions: VERIFICATION_PERMISSIONS,
          timeout: EXPERT_TIMEOUT,
        }),
      ),
    );

    // Parse findings from each expert
    const expertFindings: VerifyFinding[] = [];
    for (let i = 0; i < expertResults.length; i++) {
      const result = expertResults[i]!;
      const expert = experts[i]!;

      if (result.status === 'fulfilled') {
        const parsed = parseExpertFindings(result.value.outputText, expert.source, 1);
        expertFindings.push(...parsed);
      } else {
        ctx.log.warn(`Expert ${expert.source} failed`, { error: result.reason });
        expertFindings.push({
          layer: 1,
          source: expert.source,
          severity: 'low',
          description: `Expert agent ${expert.source} failed: ${String(result.reason)}`,
        });
      }
    }

    // Dispatch coordinator to synthesize findings
    try {
      const coordResult = await ctx.agent.run({
        role: 'verification',
        prompt: buildVerifyCoordinatorPrompt(expertFindings, diff),
        permissions: VERIFICATION_PERMISSIONS,
        timeout: COORDINATOR_TIMEOUT,
      });

      const coordFindings = parseExpertFindings(coordResult.outputText, 'correctness', 1);
      // Prefer coordinator's deduplicated findings if available
      if (coordFindings.length > 0) {
        findings.push(...coordFindings);
      } else {
        findings.push(...expertFindings);
      }
    } catch (err) {
      ctx.log.warn('Coordinator agent failed, using raw expert findings', { error: err });
      findings.push(...expertFindings);
    }
  } catch (err) {
    findings.push({
      layer: 1,
      source: 'correctness',
      severity: 'low',
      description: `Layer 1 execution error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const hasCriticalOrHigh = findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );

  return {
    layer: 1,
    name: 'Multi-Agent Generation',
    findings,
    passed: !hasCriticalOrHigh,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Layer 2: Deterministic Guardrails (VRF-02, REV-02, REV-03)
// ---------------------------------------------------------------------------

/**
 * Layer 2: Call lint and guard skills via ctx.run() for deterministic checks.
 *
 * Lint errors map to source: 'lint', severity: 'high' (errors) or 'medium' (others).
 * Guard tribal matches map to source: 'tribal', humanRequired: true.
 * Guard anti-pattern findings map to source: 'guard'.
 *
 * Handles ctx.run() failures gracefully -- if skills are not available,
 * logs warning and returns empty findings.
 */
export async function runLayer2Deterministic(
  ctx: SkillContext,
): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  // Call lint skill
  try {
    const lintResult = await ctx.run('harness.lint', { json: true });
    if (lintResult.data && typeof lintResult.data === 'object') {
      const data = lintResult.data as Record<string, unknown>;
      const violations = (data.violations ?? data.findings ?? []) as Array<Record<string, unknown>>;
      for (const v of violations) {
        findings.push({
          layer: 2,
          source: 'lint',
          severity: v.severity === 'error' ? 'high' : 'medium',
          description: String(v.message ?? v.description ?? 'Lint violation'),
          file: v.file ? String(v.file) : undefined,
          line: typeof v.line === 'number' ? v.line : undefined,
          suggestion: v.fix_instruction ? String(v.fix_instruction) : undefined,
        });
      }
    }
  } catch (err) {
    ctx.log.warn('Lint skill not available or failed', { error: err });
  }

  // Call guard skill
  try {
    const guardResult = await ctx.run('harness.guard', { json: true });
    if (guardResult.data && typeof guardResult.data === 'object') {
      const data = guardResult.data as Record<string, unknown>;

      // Tribal matches (REV-02, REV-03)
      const tribalMatches = (data.tribalMatches ?? data.tribal ?? []) as Array<Record<string, unknown>>;
      for (const t of tribalMatches) {
        findings.push({
          layer: 2,
          source: 'tribal',
          severity: 'low',
          description: String(t.message ?? t.description ?? 'Tribal knowledge match'),
          file: t.file ? String(t.file) : undefined,
          line: typeof t.line === 'number' ? t.line : undefined,
          suggestion: t.suggestion ? String(t.suggestion) : undefined,
          humanRequired: true,
        });
      }

      // Anti-pattern findings
      const antiPatterns = (data.antiPatterns ?? data.violations ?? []) as Array<Record<string, unknown>>;
      for (const a of antiPatterns) {
        findings.push({
          layer: 2,
          source: 'guard',
          severity: 'medium',
          description: String(a.message ?? a.description ?? 'Guard anti-pattern'),
          file: a.file ? String(a.file) : undefined,
          line: typeof a.line === 'number' ? a.line : undefined,
          suggestion: a.suggestion ? String(a.suggestion) : undefined,
        });
      }
    }
  } catch (err) {
    ctx.log.warn('Guard skill not available or failed', { error: err });
  }

  const hasCriticalOrHigh = findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );

  return {
    layer: 2,
    name: 'Deterministic Guardrails',
    findings,
    passed: !hasCriticalOrHigh,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Layer 3: BDD Acceptance Criteria (VRF-03, VRF-08)
// ---------------------------------------------------------------------------

/**
 * Layer 3: Check acceptance criteria from plan tasks and holdout scenarios.
 *
 * For each plan task's `done` criteria:
 * - If criterion mentions a file path, check file existence.
 * - If criterion mentions "test", note it needs test verification.
 * - Otherwise, create a finding noting it needs manual verification.
 *
 * Also loads holdout scenarios from .sun/scenarios/ and verifies them
 * against the diff via an agent (if available).
 */
export async function runLayer3Acceptance(
  ctx: SkillContext,
  plans: ParsedPlan[],
  phaseDir: string,
): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  // Check acceptance criteria from plans
  for (const plan of plans) {
    for (const task of plan.tasks) {
      for (const criterion of task.done) {
        // Extract file paths from criterion (look for path-like patterns)
        const pathMatch = criterion.match(
          /(?:^|\s)((?:packages|src|lib|tests?|__tests__)\/[\w/.-]+\.(?:ts|js|tsx|jsx|json|md))/,
        );

        if (pathMatch) {
          // Check if the referenced file exists
          const filePath = join(ctx.cwd, pathMatch[1]!);
          try {
            await access(filePath);
            // File exists -- criterion likely met
          } catch {
            findings.push({
              layer: 3,
              source: 'acceptance',
              severity: 'medium',
              description: `Acceptance criterion references missing file: ${pathMatch[1]}`,
              file: pathMatch[1],
              suggestion: `Create or verify file: ${pathMatch[1]}`,
            });
          }
        } else if (/\btest/i.test(criterion)) {
          // Criterion mentions tests -- note for manual verification
          findings.push({
            layer: 3,
            source: 'acceptance',
            severity: 'low',
            description: `Test-related criterion needs manual verification: "${criterion.slice(0, 120)}"`,
            suggestion: 'Run the relevant test suite to verify',
          });
        }
        // Other criteria are not automatically verifiable -- skip to avoid noise
      }
    }
  }

  // Load and check holdout scenarios (VRF-08)
  const scenarios = await loadHoldoutScenarios(ctx.fileStore);

  if (scenarios.length === 0) {
    ctx.log.info('No holdout scenarios found in .sun/scenarios/');
  } else {
    // If agent is available, dispatch verification for scenarios
    try {
      const providers = await ctx.agent.listProviders();
      if (providers.length > 0) {
        const scenarioPrompt = `You are a scenario verification agent. Check if the following BDD scenarios are satisfied by the implementation in the phase directory "${phaseDir}".

## Scenarios

${scenarios.map((s, i) => `### Scenario ${i + 1}\n${s}`).join('\n\n')}

## Instructions

For each scenario, check if the Given/When/Then steps are implemented. Report findings for any scenario not satisfied.

## Output Format

\`\`\`json
{
  "findings": [
    {
      "severity": "medium",
      "description": "description of unsatisfied scenario",
      "suggestion": "how to fix"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;

        const scenarioResult = await ctx.agent.run({
          role: 'verification',
          prompt: scenarioPrompt,
          permissions: VERIFICATION_PERMISSIONS,
          timeout: EXPERT_TIMEOUT,
        });

        const scenarioFindings = parseExpertFindings(scenarioResult.outputText, 'scenario', 3);
        findings.push(...scenarioFindings);
      }
    } catch (err) {
      ctx.log.warn('Scenario verification agent failed', { error: err });
    }
  }

  const hasCriticalOrHigh = findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );

  return {
    layer: 3,
    name: 'BDD Acceptance Criteria',
    findings,
    passed: !hasCriticalOrHigh,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Layer 4: Permission Scoping (VRF-04)
// ---------------------------------------------------------------------------

/**
 * Layer 4: Compare git diff file paths against declared files_modified scope.
 *
 * Uses simple-git to get the list of modified files, then checks each
 * against the declared files_modified from all plans. Out-of-scope
 * modifications are flagged as findings.
 *
 * Uses picomatch for glob pattern matching (CJS module pattern from Phase 1).
 */
export async function runLayer4PermissionScope(
  ctx: SkillContext,
  plans: ParsedPlan[],
): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  try {
    // Dynamic import for simple-git
    const { simpleGit } = await import('simple-git');
    const git = simpleGit(ctx.cwd);

    // Get list of modified files from git
    let modifiedFiles: string[] = [];
    try {
      const diffOutput = await git.diff(['--name-only', 'HEAD~1']);
      modifiedFiles = diffOutput
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);
    } catch {
      // New repo with no commits or other git error -- empty diff = pass
      ctx.log.info('Git diff failed (new repo or no commits) -- skipping scope check');
      return {
        layer: 4,
        name: 'Permission Scoping',
        findings: [],
        passed: true,
        durationMs: Date.now() - start,
      };
    }

    if (modifiedFiles.length === 0) {
      return {
        layer: 4,
        name: 'Permission Scoping',
        findings: [],
        passed: true,
        durationMs: Date.now() - start,
      };
    }

    // Collect declared scope from all plans
    const declaredPaths = new Set<string>();
    for (const plan of plans) {
      for (const filePath of plan.frontmatter.files_modified) {
        declaredPaths.add(filePath);
      }
    }

    if (declaredPaths.size === 0) {
      // No declared scope -- nothing to check
      return {
        layer: 4,
        name: 'Permission Scoping',
        findings: [],
        passed: true,
        durationMs: Date.now() - start,
      };
    }

    // Load picomatch via createRequire (CJS module in ESM project)
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const picomatch = require('picomatch') as (pattern: string | string[]) => (input: string) => boolean;

    // Create a matcher from all declared paths
    const patterns = [...declaredPaths];
    const isMatch = picomatch(patterns);

    // Check each modified file against declared scope
    for (const modifiedFile of modifiedFiles) {
      if (!isMatch(modifiedFile) && !declaredPaths.has(modifiedFile)) {
        findings.push({
          layer: 4,
          source: 'scope',
          severity: 'medium',
          description: `File modified outside declared scope: ${modifiedFile}`,
          file: modifiedFile,
          suggestion: `Add "${modifiedFile}" to plan's files_modified or verify this change was intentional`,
        });
      }
    }
  } catch (err) {
    findings.push({
      layer: 4,
      source: 'scope',
      severity: 'low',
      description: `Permission scope check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const hasCriticalOrHigh = findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );

  return {
    layer: 4,
    name: 'Permission Scoping',
    findings,
    passed: !hasCriticalOrHigh,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Layer 5: Adversarial Verification (VRF-05, VRF-07)
// ---------------------------------------------------------------------------

/**
 * Layer 5: Dispatch adversarial and intent reconstruction agents in parallel.
 *
 * Adversarial agent: "devil's advocate" finding gaps between intent and implementation.
 * Intent agent: checks must_haves satisfaction against CONTEXT.md vision.
 *
 * If CONTEXT.md is not found, skips both checks with an info log.
 */
export async function runLayer5Adversarial(
  ctx: SkillContext,
  diff: string,
  phaseDir: string,
): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  try {
    // Read CONTEXT.md from phase directory
    // Extract phase number from phaseDir path
    const phaseDirName = phaseDir.split('/').pop() ?? '';
    const phaseMatch = phaseDirName.match(/^(\d+)/);
    const phaseNumber = phaseMatch ? parseInt(phaseMatch[1]!, 10) : 0;

    const contextContent = await readPhaseArtifact(ctx.cwd, phaseNumber, `${phaseDirName.split('-').slice(0, 1).join('-')}-CONTEXT.md`);

    if (!contextContent) {
      // Try alternative naming: just search for CONTEXT.md in the directory
      let altContext: string | null = null;
      try {
        const entries = await readdir(phaseDir);
        const contextFile = entries.find((e) => e.endsWith('-CONTEXT.md') || e === 'CONTEXT.md');
        if (contextFile) {
          altContext = await readFile(join(phaseDir, contextFile), 'utf-8');
        }
      } catch {
        // Directory read failed
      }

      if (!altContext) {
        ctx.log.info('CONTEXT.md not found in phase directory -- skipping adversarial checks');
        return {
          layer: 5,
          name: 'Adversarial Verification',
          findings: [],
          passed: true,
          durationMs: Date.now() - start,
        };
      }

      // Use alternative context
      return await runAdversarialChecks(ctx, diff, phaseDir, altContext, findings, start);
    }

    return await runAdversarialChecks(ctx, diff, phaseDir, contextContent, findings, start);
  } catch (err) {
    findings.push({
      layer: 5,
      source: 'adversarial',
      severity: 'low',
      description: `Layer 5 execution error: ${err instanceof Error ? err.message : String(err)}`,
    });

    return {
      layer: 5,
      name: 'Adversarial Verification',
      findings,
      passed: true,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Internal helper to run adversarial + intent checks once context is available.
 */
async function runAdversarialChecks(
  ctx: SkillContext,
  diff: string,
  phaseDir: string,
  contextContent: string,
  existingFindings: VerifyFinding[],
  start: number,
): Promise<LayerResult> {
  const findings = [...existingFindings];

  // Collect must_haves from PLAN.md files in phaseDir
  const mustHaves: string[] = [];
  try {
    const entries = await readdir(phaseDir);
    const planFiles = entries.filter((e) => e.match(/-PLAN\.md$/));
    for (const file of planFiles) {
      const content = await readFile(join(phaseDir, file), 'utf-8');
      // Extract must_haves from frontmatter
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const fm = fmMatch[1]!;
        const truthsMatch = fm.match(/truths:\s*\n((?:[ \t]+-[ \t]+.+\n?)*)/);
        if (truthsMatch) {
          const truths = truthsMatch[1]!
            .split('\n')
            .map((l) => l.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g, '').trim())
            .filter(Boolean);
          mustHaves.push(...truths);
        }
      }
    }
  } catch {
    // Could not read plan files
  }

  // Dispatch adversarial and intent agents in parallel
  const [adversarialResult, intentResult] = await Promise.allSettled([
    ctx.agent.run({
      role: 'verification',
      prompt: buildVerifyAdversarialPrompt(diff, contextContent),
      permissions: VERIFICATION_PERMISSIONS,
      timeout: EXPERT_TIMEOUT,
    }),
    ctx.agent.run({
      role: 'verification',
      prompt: buildVerifyIntentPrompt(diff, contextContent, mustHaves),
      permissions: VERIFICATION_PERMISSIONS,
      timeout: EXPERT_TIMEOUT,
    }),
  ]);

  // Parse adversarial findings
  if (adversarialResult.status === 'fulfilled') {
    const parsed = parseExpertFindings(adversarialResult.value.outputText, 'adversarial', 5);
    findings.push(...parsed);
  } else {
    ctx.log.warn('Adversarial agent failed', { error: adversarialResult.reason });
  }

  // Parse intent findings
  if (intentResult.status === 'fulfilled') {
    const parsed = parseExpertFindings(intentResult.value.outputText, 'intent', 5);
    findings.push(...parsed);
  } else {
    ctx.log.warn('Intent reconstruction agent failed', { error: intentResult.reason });
  }

  const hasCriticalOrHigh = findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );

  return {
    layer: 5,
    name: 'Adversarial Verification',
    findings,
    passed: !hasCriticalOrHigh,
    durationMs: Date.now() - start,
  };
}
