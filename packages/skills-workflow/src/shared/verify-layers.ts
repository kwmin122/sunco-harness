/**
 * Verification layer execution functions for sunco verify.
 *
 * Implements the 7-layer Swiss cheese verification model:
 * - Layer 1: Multi-Agent Generation (4 experts + coordinator)
 * - Layer 2: Deterministic Guardrails (lint + guard via ctx.run())
 * - Layer 3: BDD Acceptance Criteria (done criteria + holdout scenarios)
 * - Layer 4: Permission Scoping (git diff vs declared files_modified)
 * - Layer 5: Adversarial Verification (adversarial + intent reconstruction)
 * - Layer 6: Cross-Model Verification (different model blind spot detection)
 * - Layer 7: Human Eval Gate (final human sign-off)
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
import { readPhaseArtifactSmart } from './phase-reader.js';
import { readContextZone } from './context-zones.js';
import { buildVerifySecurityPrompt } from '../prompts/verify-security.js';
import { buildVerifyPerformancePrompt } from '../prompts/verify-performance.js';
import { buildVerifyArchitecturePrompt } from '../prompts/verify-architecture.js';
import { buildVerifyCorrectnessPrompt } from '../prompts/verify-correctness.js';
import { buildVerifyTestingPrompt } from '../prompts/verify-testing.js';
import { buildVerifyApiPrompt } from '../prompts/verify-api.js';
import { buildVerifyMigrationPrompt } from '../prompts/verify-migration.js';
import { buildVerifyMaintainabilityPrompt } from '../prompts/verify-maintainability.js';
import { buildVerifyCoordinatorPrompt } from '../prompts/verify-coordinator.js';
import { buildVerifyAdversarialPrompt } from '../prompts/verify-adversarial.js';
import { buildVerifyIntentPrompt } from '../prompts/verify-intent.js';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Acceptance criteria patterns (Task 2: acceptance_criteria auto-link)
// ---------------------------------------------------------------------------

/** Pattern: "{file} contains {string}" */
const GREPPABLE = /^(.+?)\s+contains\s+['"]?(.+?)['"]?$/i;

/** Pattern: "{file} exports {symbol}" */
const EXPORTABLE = /^(.+?)\s+exports?\s+(.+)$/i;

/**
 * Extract <acceptance_criteria> block content from raw PLAN.md text.
 * Returns an array of non-empty criterion lines.
 */
function extractAcceptanceCriteria(rawPlan: string): string[] {
  const match = rawPlan.match(/<acceptance_criteria>([\s\S]*?)<\/acceptance_criteria>/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((l) => l.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Run deterministic grep-verifiable acceptance criteria checks.
 * For each criterion:
 *   - Pattern "file contains string" → readFile + includes()
 *   - Pattern "file exports symbol" → readFile + regex match for export.*symbol
 *   - Otherwise: skip (non-greppable, let agent handle)
 * Returns findings for failed checks.
 */
async function checkAcceptanceCriteria(
  cwd: string,
  criteria: string[],
  planId: string,
): Promise<VerifyFinding[]> {
  const findings: VerifyFinding[] = [];

  for (const criterion of criteria) {
    // Try "contains" pattern first
    const containsMatch = criterion.match(GREPPABLE);
    if (containsMatch) {
      const [, filePart, needle] = containsMatch;
      const filePath = join(cwd, filePart.trim());
      try {
        const content = await readFile(filePath, 'utf-8');
        if (!content.includes(needle.trim())) {
          findings.push({
            layer: 3,
            source: 'acceptance',
            severity: 'high',
            description: `Acceptance criterion not met (${planId}): "${criterion}"`,
            file: filePart.trim(),
            suggestion: `Ensure ${filePart.trim()} contains the string: "${needle.trim()}"`,
          });
        }
      } catch {
        findings.push({
          layer: 3,
          source: 'acceptance',
          severity: 'high',
          description: `Acceptance criterion file not found (${planId}): ${filePart.trim()}`,
          file: filePart.trim(),
          suggestion: `Create the file: ${filePart.trim()}`,
        });
      }
      continue;
    }

    // Try "exports" pattern
    const exportsMatch = criterion.match(EXPORTABLE);
    if (exportsMatch) {
      const [, filePart, symbol] = exportsMatch;
      const filePath = join(cwd, filePart.trim());
      try {
        const content = await readFile(filePath, 'utf-8');
        const exportPattern = new RegExp(`export[^\\n]*${symbol.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        if (!exportPattern.test(content)) {
          findings.push({
            layer: 3,
            source: 'acceptance',
            severity: 'high',
            description: `Acceptance criterion not met (${planId}): "${criterion}"`,
            file: filePart.trim(),
            suggestion: `Ensure ${filePart.trim()} exports the symbol: "${symbol.trim()}"`,
          });
        }
      } catch {
        findings.push({
          layer: 3,
          source: 'acceptance',
          severity: 'high',
          description: `Acceptance criterion file not found (${planId}): ${filePart.trim()}`,
          file: filePart.trim(),
          suggestion: `Create the file: ${filePart.trim()}`,
        });
      }
      continue;
    }

    // Non-greppable criterion — skip deterministic check, will be handled by agent
  }

  return findings;
}

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

/** Layer 6 timeout — higher due to multi-turn agent execution */
const CROSS_MODEL_TIMEOUT = 180_000;

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
    // Build prompts for all 8 specialist experts (Phase 23b — Review Army)
    const experts = [
      // Core 4 (Phase 7)
      { source: 'security' as const, prompt: buildVerifySecurityPrompt(diff) },
      { source: 'performance' as const, prompt: buildVerifyPerformancePrompt(diff) },
      { source: 'architecture' as const, prompt: buildVerifyArchitecturePrompt(diff) },
      { source: 'correctness' as const, prompt: buildVerifyCorrectnessPrompt(diff) },
      // Extended 4 (Phase 23b)
      { source: 'testing' as const, prompt: buildVerifyTestingPrompt(diff) },
      { source: 'api-design' as const, prompt: buildVerifyApiPrompt(diff) },
      { source: 'migration' as const, prompt: buildVerifyMigrationPrompt(diff) },
      { source: 'maintainability' as const, prompt: buildVerifyMaintainabilityPrompt(diff) },
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

      const coordFindings = parseExpertFindings(coordResult.outputText, 'coordinator', 1);
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
      source: 'coordinator',
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
 * When changedFiles is provided and non-empty, passes a files filter to lint and
 * guard so only phase-changed files are scanned (eliminates dist/ false positives).
 * When changedFiles is undefined or empty, falls back to full project scan.
 *
 * Handles ctx.run() failures gracefully -- if skills are not available,
 * logs warning and returns empty findings.
 */
export async function runLayer2Deterministic(
  ctx: SkillContext,
  changedFiles?: string[],
): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  // Build file filter for phase-local scope
  const hasFilter = changedFiles !== undefined && changedFiles.length > 0;
  const filesArg = hasFilter ? changedFiles : undefined;

  // Call lint skill
  try {
    const lintResult = await ctx.run('harness.lint', { json: true, ...(filesArg ? { files: filesArg } : {}) });
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
    const guardResult = await ctx.run('harness.guard', { json: true, ...(filesArg ? { files: filesArg } : {}) });
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
    const planId = `${plan.frontmatter.phase}-${plan.frontmatter.plan}`;

    // Step A: Check <acceptance_criteria> blocks (Task 2: acceptance_criteria auto-link)
    // Extract from raw plan text — deterministic grep-verifiable checks
    const acceptanceCriteria = extractAcceptanceCriteria(plan.raw);
    if (acceptanceCriteria.length > 0) {
      const acFindings = await checkAcceptanceCriteria(ctx.cwd, acceptanceCriteria, planId);
      findings.push(...acFindings);
    }

    // Step A2: Delivery-slice plans — extract verification intent
    // These are human-testable criteria, not grep-verifiable. Check for
    // file-path references and command patterns that CAN be checked deterministically.
    if (plan.frontmatter.isDeliverySlice && plan.verificationIntent) {
      const intentLines = plan.verificationIntent
        .split('\n')
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);

      // Extract any "contains" or "exports" patterns from verification intent
      const greppableIntents = intentLines.filter(
        (l) => GREPPABLE.test(l) || EXPORTABLE.test(l),
      );
      if (greppableIntents.length > 0) {
        const intentFindings = await checkAcceptanceCriteria(ctx.cwd, greppableIntents, planId);
        findings.push(...intentFindings);
      }

      // Check command-like patterns (e.g., "sunco X --flag" or "npm test")
      const commandIntents = intentLines.filter((l) => /^`[^`]+`/.test(l) || /`[^`]+`\s+(exits|returns|outputs|shows)/.test(l));
      if (commandIntents.length > 0) {
        findings.push({
          layer: 3,
          source: 'acceptance',
          severity: 'low',
          description: `Delivery-slice plan ${planId} has ${commandIntents.length} command-based verification(s) requiring manual check`,
          suggestion: 'Run the commands listed in Verification intent to validate',
        });
      }

      if (intentLines.length > 0 && greppableIntents.length === 0 && commandIntents.length === 0) {
        findings.push({
          layer: 3,
          source: 'acceptance',
          severity: 'low',
          description: `Delivery-slice plan ${planId} has ${intentLines.length} human-testable verification(s) — cannot auto-verify`,
          suggestion: 'Review Verification intent section manually or via UAT',
        });
      }
    }

    // Step B: Check task done criteria (file existence checks)
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
      for (const filePath of (plan.frontmatter.files_modified ?? [])) {
        declaredPaths.add(filePath);
      }
    }

    if (declaredPaths.size === 0) {
      // No declared scope (e.g., delivery-slice plans) -- skip permission check
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

    const zoneData = await readContextZone(ctx.cwd);
    const smartResult = await readPhaseArtifactSmart(
      ctx.cwd, phaseNumber,
      `${phaseDirName.split('-').slice(0, 1).join('-')}-CONTEXT.md`,
      { currentPhase: phaseNumber, contextZone: zoneData?.zone ?? 'green' },
    );
    const contextContent = smartResult.content;

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
  // Supports both legacy (frontmatter truths) and delivery-slice (## Verification intent)
  const mustHaves: string[] = [];
  try {
    const entries = await readdir(phaseDir);
    const planFiles = entries.filter((e) => e.match(/-PLAN\.md$/));
    for (const file of planFiles) {
      const content = await readFile(join(phaseDir, file), 'utf-8');

      // Try legacy format: extract must_haves.truths from frontmatter
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

      // Try delivery-slice format: extract ## Verification intent lines
      const verifyMatch = content.match(/^## Verification intent\s*\n([\s\S]*?)(?=^## |$)/m);
      if (verifyMatch) {
        const lines = verifyMatch[1]!
          .split('\n')
          .map((l) => l.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean);
        mustHaves.push(...lines);
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

// ---------------------------------------------------------------------------
// Layer 6: Cross-Model Verification (VRF-06, D-22)
// ---------------------------------------------------------------------------

/** System prompt for skeptical reviewer fallback (same model, different perspective) */
const SKEPTICAL_REVIEWER_SYSTEM = `You are a skeptical code reviewer from a completely different engineering culture. You distrust the primary reviewer's conclusions and actively look for:
1. Assumptions that were accepted without evidence
2. Edge cases that "optimistic" reviewers always miss
3. Structural problems that are hard to see when you wrote the code yourself
4. Security issues that get hand-waved as "we'll fix it later"
5. Performance cliffs that only appear at scale

You are NOT trying to be helpful. You are trying to find what others missed.`;

/**
 * Build the cross-model verification prompt.
 * Includes the diff and a summary of previous layer findings for context.
 */
function buildCrossModelPrompt(diff: string, previousFindings: VerifyFinding[]): string {
  const findingSummary = previousFindings.length > 0
    ? previousFindings
        .slice(0, 20)
        .map((f) => `- [${f.severity}] Layer ${f.layer} (${f.source}): ${f.description}`)
        .join('\n')
    : 'No findings from previous layers.';

  return `You are reviewing code changes that have already been reviewed by another AI model. Your job is to find what the first reviewer missed.

## Previous Reviewer's Findings

${findingSummary}

## Code Diff

\`\`\`diff
${diff.slice(0, 50_000)}
\`\`\`

## Instructions

1. Do NOT repeat findings already listed above. Focus on what was MISSED.
2. Look for: structural blind spots, implicit assumptions, missing error paths, subtle type issues, unhandled state transitions, incorrect abstractions.
3. Consider: would this code survive a production incident? A malicious user? A junior developer maintaining it?

## Output Format

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "what was missed and why it matters",
      "file": "path/to/file (if identifiable)",
      "suggestion": "how to fix"
    }
  ]
}
\`\`\`

If the previous review was thorough and you find nothing new: output an empty findings array.
Only output the JSON. No explanation before or after.`;
}

/**
 * Layer 6: Cross-Model Verification.
 *
 * Runs the verification prompt through a different model/provider to detect
 * same-model blind spots. Strategy:
 *
 * 1. If multiple providers are available, use crossVerify() to run through
 *    a different provider than the primary one.
 * 2. If only one provider is available, use the same model with a skeptical
 *    reviewer system prompt to shift perspective.
 *
 * Compares findings between the primary review (Layers 1-5) and this layer,
 * flagging any disagreements or new issues.
 */
export async function runLayer6CrossModel(
  ctx: SkillContext,
  diff: string,
  previousFindings: VerifyFinding[],
): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  try {
    const providers = await ctx.agent.listProviders();
    const prompt = buildCrossModelPrompt(diff, previousFindings);

    if (providers.length >= 2) {
      // Multiple providers available -- use crossVerify for true cross-model check
      ctx.log.info('Cross-model verification: using crossVerify with multiple providers');

      try {
        const results = await ctx.agent.crossVerify(
          {
            role: 'verification',
            prompt,
            permissions: VERIFICATION_PERMISSIONS,
            timeout: CROSS_MODEL_TIMEOUT,
            maxTurns: 3,
          },
          providers.slice(0, 2), // Use first two different providers
        );

        for (const result of results) {
          const parsed = parseExpertFindings(result.outputText, 'cross-model', 6);
          findings.push(...parsed);
        }
      } catch (err) {
        ctx.log.warn('crossVerify failed, falling back to skeptical reviewer', { error: err });
        // Fall through to single-model fallback below
        await runSkepticalReviewer(ctx, prompt, findings);
      }
    } else {
      // Single provider -- use skeptical reviewer system prompt
      ctx.log.info('Cross-model verification: single provider, using skeptical reviewer persona');
      await runSkepticalReviewer(ctx, prompt, findings);
    }
  } catch (err) {
    findings.push({
      layer: 6,
      source: 'cross-model',
      severity: 'low',
      description: `Layer 6 execution error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const hasCriticalOrHigh = findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );

  return {
    layer: 6,
    name: 'Cross-Model Verification',
    findings,
    passed: !hasCriticalOrHigh,
    durationMs: Date.now() - start,
  };
}

/**
 * Fallback: run the same model with a skeptical reviewer system prompt.
 */
async function runSkepticalReviewer(
  ctx: SkillContext,
  prompt: string,
  findings: VerifyFinding[],
): Promise<void> {
  try {
    const result = await ctx.agent.run({
      role: 'verification',
      prompt,
      systemPrompt: SKEPTICAL_REVIEWER_SYSTEM,
      permissions: VERIFICATION_PERMISSIONS,
      timeout: CROSS_MODEL_TIMEOUT,
      maxTurns: 3,
    });

    const parsed = parseExpertFindings(result.outputText, 'cross-model', 6);
    findings.push(...parsed);
  } catch (err) {
    ctx.log.warn('Skeptical reviewer agent failed', { error: err });
    findings.push({
      layer: 6,
      source: 'cross-model',
      severity: 'low',
      description: `Skeptical reviewer failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Layer 7: Human Eval Gate (VRF-09)
// ---------------------------------------------------------------------------

/**
 * Format a human-readable summary of all automated layer results.
 */
function formatLayerSummaryForHuman(layerResults: LayerResult[]): string {
  const lines: string[] = ['## Automated Verification Summary', ''];

  for (const layer of layerResults) {
    const status = layer.passed ? 'PASS' : 'FAIL';
    const findingCount = layer.findings.length;
    const criticals = layer.findings.filter((f) => f.severity === 'critical').length;
    const highs = layer.findings.filter((f) => f.severity === 'high').length;

    lines.push(`**Layer ${layer.layer}: ${layer.name}** -- ${status} (${findingCount} findings${criticals > 0 ? `, ${criticals} critical` : ''}${highs > 0 ? `, ${highs} high` : ''})`);

    // Show critical/high findings inline
    const importantFindings = layer.findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high',
    );
    for (const f of importantFindings) {
      lines.push(`  - [${f.severity.toUpperCase()}] ${f.description.slice(0, 150)}`);
    }
  }

  lines.push('');
  const totalFindings = layerResults.reduce((sum, l) => sum + l.findings.length, 0);
  const anyFail = layerResults.some((l) => !l.passed);
  lines.push(`**Total findings:** ${totalFindings}`);
  lines.push(`**Automated verdict:** ${anyFail ? 'FAIL' : totalFindings > 0 ? 'WARN' : 'PASS'}`);

  return lines.join('\n');
}

/**
 * Layer 7: Human Eval Gate.
 *
 * Presents a summary of all automated layer results (Layers 1-6) to the user
 * and asks for final sign-off. The user can:
 *
 * - **Approve**: verification passes (PASS)
 * - **Block**: verification fails with user-provided reason (FAIL)
 * - **Skip**: human eval is skipped, automated verdict stands
 *
 * If --auto or --skip-human-eval is set, this layer is automatically skipped
 * with a PASS result.
 */
export async function runLayer7HumanEval(
  ctx: SkillContext,
  layerResults: LayerResult[],
  options: { skipHumanEval: boolean; isAuto: boolean },
): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  // Skip if --auto or --skip-human-eval
  if (options.skipHumanEval || options.isAuto) {
    ctx.log.info(`Human eval skipped (${options.isAuto ? '--auto' : '--skip-human-eval'})`);
    return {
      layer: 7,
      name: 'Human Eval Gate',
      findings: [],
      passed: true,
      durationMs: Date.now() - start,
    };
  }

  try {
    const summary = formatLayerSummaryForHuman(layerResults);

    const choice = await ctx.ui.ask({
      message: `${summary}\n\nDo you approve these verification results?`,
      options: [
        { id: 'approve', label: 'Approve -- verification passes' },
        { id: 'block', label: 'Block -- override verdict to FAIL' },
        { id: 'skip', label: 'Skip human eval -- use automated verdict' },
      ],
    });

    if (choice.selectedId === 'block') {
      // Ask for reason
      let reason = 'User blocked without providing reason';
      try {
        const reasonResponse = await ctx.ui.askText({
          message: 'Why are you blocking? (Enter reason)',
        });
        if (reasonResponse.text && reasonResponse.text.trim()) {
          reason = reasonResponse.text.trim();
        }
      } catch {
        // If askText fails (e.g. non-interactive), use default reason
      }

      findings.push({
        layer: 7,
        source: 'human-eval',
        severity: 'critical',
        description: `Human eval BLOCKED: ${reason}`,
        humanRequired: true,
      });

      return {
        layer: 7,
        name: 'Human Eval Gate',
        findings,
        passed: false,
        durationMs: Date.now() - start,
      };
    }

    if (choice.selectedId === 'skip') {
      ctx.log.info('Human eval skipped by user choice');
      return {
        layer: 7,
        name: 'Human Eval Gate',
        findings: [],
        passed: true,
        durationMs: Date.now() - start,
      };
    }

    // Approved
    ctx.log.info('Human eval approved');
    return {
      layer: 7,
      name: 'Human Eval Gate',
      findings: [],
      passed: true,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    // If UI interaction fails (non-interactive context), skip gracefully
    ctx.log.warn('Human eval gate UI failed -- skipping', { error: err });
    findings.push({
      layer: 7,
      source: 'human-eval',
      severity: 'low',
      description: `Human eval skipped (UI unavailable): ${err instanceof Error ? err.message : String(err)}`,
    });

    return {
      layer: 7,
      name: 'Human Eval Gate',
      findings,
      passed: true,
      durationMs: Date.now() - start,
    };
  }
}
