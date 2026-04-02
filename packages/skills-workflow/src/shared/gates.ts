/**
 * @sunco/skills-workflow - Shared Gate Functions
 *
 * Stop-the-line gates used by ship, release, and plan skills.
 * Each gate returns { passed, verdict, reason, findings } — callers block on !passed.
 *
 * Common semantics:
 *   - verdict: PASS | BLOCKED | CHANGES_REQUIRED
 *   - passed: true only when verdict === 'PASS'
 *   - reason: human-readable explanation
 *   - findings: optional list of specific issues
 *
 * Gates:
 *   - proceedGate: verify PASS with zero findings (ship pre-check)
 *   - artifactGate: tarball + install tree validation (release pre-check)
 *   - planGate: discuss + context readiness (plan pre-check)
 */

import type { SkillContext } from '@sunco/core';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

export type GateVerdict = 'PASS' | 'BLOCKED' | 'CHANGES_REQUIRED';

export interface GateResult {
  passed: boolean;
  verdict: GateVerdict;
  reason: string;
  findings?: string[];
}

// ---------------------------------------------------------------------------
// Proceed Gate
// ---------------------------------------------------------------------------

/**
 * Proceed Gate — checks last verify PASS with zero findings.
 * For ship: uses cached result. For release: caller should run fresh verify first.
 */
export async function proceedGate(ctx: SkillContext): Promise<GateResult> {
  const lastVerify = await ctx.state.get<{
    verdict?: string;
    findingsCount?: number;
    timestamp?: string;
  }>('verify.lastResult');

  if (!lastVerify) {
    return { passed: false, verdict: 'BLOCKED', reason: 'proceed-gate BLOCKED: No verify result found. Run /sunco:verify first.' };
  }

  if (lastVerify.verdict !== 'PASS') {
    return {
      passed: false,
      verdict: 'BLOCKED',
      reason: `proceed-gate BLOCKED: Last verify verdict is "${lastVerify.verdict}" (${lastVerify.findingsCount ?? '?'} findings). Resolve all findings.`,
    };
  }

  return { passed: true, verdict: 'PASS', reason: 'proceed-gate PASSED' };
}

// ---------------------------------------------------------------------------
// Plan Gate
// ---------------------------------------------------------------------------

/**
 * Plan Gate — checks discuss was run + CONTEXT.md exists for the target phase.
 */
export async function planGate(ctx: SkillContext): Promise<GateResult> {
  const findings: string[] = [];

  // Check discuss result in state
  const lastDiscuss = await ctx.state.get<{
    phaseNumber?: number;
    timestamp?: string;
  }>('discuss.lastResult');

  if (!lastDiscuss) {
    findings.push('No discuss result in state. Run /sunco:discuss first.');
  }

  // Check CONTEXT.md exists for current phase if we know the phase
  if (lastDiscuss?.phaseNumber) {
    const padded = String(lastDiscuss.phaseNumber).padStart(2, '0');
    const phasesDir = join(ctx.cwd, '.planning', 'phases');
    try {
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(phasesDir);
      const phaseDir = entries.find((e: string) => e.startsWith(`${padded}-`));
      if (phaseDir) {
        const contextPath = join(phasesDir, phaseDir, `${padded}-CONTEXT.md`);
        try {
          await access(contextPath);
        } catch {
          findings.push(`CONTEXT.md not found at ${contextPath}`);
        }
      }
    } catch {
      // phases dir doesn't exist yet — that's ok, discuss creates it
    }
  }

  if (findings.length > 0) {
    return {
      passed: false,
      verdict: 'BLOCKED',
      reason: `plan-gate BLOCKED: ${findings.join('; ')}`,
      findings,
    };
  }

  return { passed: true, verdict: 'PASS', reason: 'plan-gate PASSED' };
}

// ---------------------------------------------------------------------------
// Artifact Gate
// ---------------------------------------------------------------------------

/**
 * Artifact Gate — validates tarball + install tree completeness.
 */
export async function artifactGate(ctx: SkillContext): Promise<GateResult> {
  const findings: string[] = [];

  // Check tarball contents
  try {
    const { execa } = await import('execa');
    const packResult = await execa('npm', ['pack', '--dry-run'], {
      cwd: ctx.cwd,
      reject: false,
    });

    const packOutput = packResult.stdout || '';
    const requiredFiles = [
      'bin/sunco-tools.cjs',
      'bin/install.cjs',
      'bin/smoke-test.cjs',
      'bin/contract-lint.cjs',
      'dist/cli.js',
      'references/product-contract.md',
    ];

    for (const f of requiredFiles) {
      if (!packOutput.includes(f)) {
        findings.push(`Missing in tarball: ${f}`);
      }
    }
  } catch (err) {
    findings.push(`Tarball check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Check install tree if installed (Claude as reference)
  const os = await import('node:os');
  const path = await import('node:path');
  const installDir = path.join(os.homedir(), '.claude', 'sunco', 'bin');
  const installFiles = ['cli.js', 'sunco-tools.cjs', 'package.json'];
  for (const f of installFiles) {
    try {
      await access(path.join(installDir, f));
    } catch {
      findings.push(`Missing in install tree: ${installDir}/${f}`);
    }
  }

  if (findings.length > 0) {
    return {
      passed: false,
      verdict: 'BLOCKED',
      reason: `artifact-gate BLOCKED: ${findings.length} issue(s)`,
      findings,
    };
  }

  return { passed: true, verdict: 'PASS', reason: 'artifact-gate PASSED: all required files present' };
}
