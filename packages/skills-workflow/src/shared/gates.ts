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

// ---------------------------------------------------------------------------
// Spec Approval Gate (Superpowers brainstorming HARD-GATE parity)
// ---------------------------------------------------------------------------

/**
 * Spec Approval Gate — refuses to implement when no approved design/spec
 * exists for the work. Mirrors Superpowers' HARD-GATE: "do not invoke
 * implementation skills until a design has been presented and approved."
 *
 * Passes (skips the gate) when any of these is true:
 *   - `.planning/PROJECT.md` exists (means `/sunco:new` ran at least once)
 *   - `docs/superpowers/specs/` contains at least one approved spec
 *   - `.sun/designs/` contains an `APPROVED` design doc from /sunco:office-hours
 *   - the caller opts out with `bypassSpecApproval=true` (for legitimate
 *     greenfield / trivial ops — recorded in the result reason)
 *
 * Blocks (verdict=BLOCKED) when none of the above is found, with
 * guidance to run /sunco:office-hours → /sunco:brainstorming → /sunco:new
 * (the default project-start chain).
 */
export interface SpecApprovalOptions {
  /** Caller-side opt-out (e.g. /sunco:quick --full for a one-liner). */
  bypassSpecApproval?: boolean;
  /** Human-readable reason for the bypass, recorded in the result. */
  bypassReason?: string;
}

export async function specApprovalGate(
  ctx: SkillContext,
  opts: SpecApprovalOptions = {},
): Promise<GateResult> {
  if (opts.bypassSpecApproval) {
    return {
      passed: true,
      verdict: 'PASS',
      reason: `spec-approval-gate BYPASSED: ${opts.bypassReason ?? 'caller opt-out'}`,
    };
  }

  const { readdir, readFile } = await import('node:fs/promises');

  const projectMd = join(ctx.cwd, '.planning', 'PROJECT.md');
  try {
    await access(projectMd);
    return {
      passed: true,
      verdict: 'PASS',
      reason: 'spec-approval-gate PASSED: .planning/PROJECT.md exists',
    };
  } catch {
    // fall through to deeper checks
  }

  const specsDir = join(ctx.cwd, 'docs', 'superpowers', 'specs');
  try {
    const entries = await readdir(specsDir);
    const md = entries.filter((f) => f.endsWith('.md'));
    if (md.length > 0) {
      return {
        passed: true,
        verdict: 'PASS',
        reason: `spec-approval-gate PASSED: ${md.length} Superpowers spec(s) in ${specsDir}`,
      };
    }
  } catch {
    // specs dir absent → fall through
  }

  const designsDir = join(ctx.cwd, '.sun', 'designs');
  try {
    const entries = await readdir(designsDir);
    for (const name of entries) {
      if (!name.endsWith('.md')) continue;
      try {
        const txt = await readFile(join(designsDir, name), 'utf-8');
        if (/Status:\s*APPROVED/i.test(txt)) {
          return {
            passed: true,
            verdict: 'PASS',
            reason: `spec-approval-gate PASSED: approved office-hours design ${name}`,
          };
        }
      } catch {
        // skip unreadable
      }
    }
  } catch {
    // designs dir absent → fall through
  }

  return {
    passed: false,
    verdict: 'BLOCKED',
    reason:
      'spec-approval-gate BLOCKED: no approved spec found. ' +
      'Run /sunco:office-hours → /sunco:brainstorming → /sunco:new --from-preflight <spec>, ' +
      'or pass --bypass-spec-approval with a reason if this is a trivial op.',
    findings: [
      '.planning/PROJECT.md missing',
      'no *.md in docs/superpowers/specs/',
      'no APPROVED design in .sun/designs/',
    ],
  };
}
