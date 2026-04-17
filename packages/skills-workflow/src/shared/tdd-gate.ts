/**
 * TDD Gate — test-first discipline check for plans tagged `type: tdd`.
 *
 * Superpowers' test-driven-development skill enforces Red-Green-Refactor.
 * SUNCO already accepts `type: tdd` in plan frontmatter; this gate turns
 * that tag into an actual guardrail by checking, for each tdd-tagged plan:
 *
 *   1. The plan's `files_modified` includes at least one test file
 *      (matches `.test.{ts,tsx,js,jsx}` or a `__tests__/` segment).
 *   2. Every non-test file in `files_modified` has a matching test file
 *      in the same plan. A test-less production file in a tdd plan is a
 *      violation.
 *   3. Where git history is available, the first commit touching a test
 *      file for a given production file MUST precede (or equal) the first
 *      commit touching the production file itself (test-first order).
 *
 * Findings are soft (medium severity) if only the filename shape is
 * wrong and hard (high severity) if the production file shipped before
 * its test.
 *
 * This module is intentionally free of SkillContext coupling on the
 * analysis side so it can be unit-tested with plain inputs. The wrapper
 * `runTddGate` integrates with ctx for I/O.
 */

import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SkillContext } from '@sunco/core';
import type { ParsedPlan } from './plan-parser.js';
import { parsePlanMd } from './plan-parser.js';

const exec = promisify(execFile);

export type TddFindingSeverity = 'medium' | 'high';

export interface TddFinding {
  plan: string;
  file: string;
  severity: TddFindingSeverity;
  kind:
    | 'missing-test-file'
    | 'production-before-test'
    | 'no-tests-listed';
  message: string;
  suggestion?: string;
}

export interface TddGateResult {
  ran: boolean;
  tddPlansScanned: number;
  findings: TddFinding[];
  passed: boolean;
  skippedReason?: string;
}

const TEST_PATTERN = /(\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs))$|(^|\/)__tests__\//;

export function isTestFile(path: string): boolean {
  return TEST_PATTERN.test(path);
}

/**
 * Map a production file path to a plausible colocated test file path.
 * Returns the first pattern that matches a test file actually present
 * in the provided `candidateTests` list; otherwise null.
 *
 * Heuristics (checked in order):
 *   - same dir: `<name>.test.ts` / `<name>.spec.ts`
 *   - `__tests__/` sibling dir with `<name>.test.ts`
 *
 * We don't require the production file to map to a specific test path —
 * if any test file in the plan mentions the production file's basename,
 * that is accepted.
 */
export function findMatchingTest(
  productionFile: string,
  candidateTests: string[],
): string | null {
  const m = productionFile.match(/([^/]+)\.(ts|tsx|js|jsx|mjs|cjs)$/);
  if (!m) return null;
  const base = m[1];
  const lower = base.toLowerCase();
  for (const t of candidateTests) {
    const tLower = t.toLowerCase();
    if (tLower.includes(`/${lower}.`) || tLower.endsWith(`${lower}.test.ts`) || tLower.endsWith(`${lower}.spec.ts`)) {
      return t;
    }
  }
  return null;
}

/**
 * Pure analysis: given a parsed plan, return findings that do NOT depend
 * on git history (steps 1 & 2 of the gate).
 *
 * Callers add step 3 (git test-first order) separately because it needs
 * repo I/O.
 */
export function analyzePlanForTddShape(plan: ParsedPlan): TddFinding[] {
  const findings: TddFinding[] = [];
  if (plan.frontmatter.type !== 'tdd') return findings;

  const files = plan.frontmatter.files_modified ?? [];
  if (files.length === 0) {
    findings.push({
      plan: String(plan.frontmatter.plan),
      file: '(plan)',
      severity: 'medium',
      kind: 'no-tests-listed',
      message: 'TDD plan has no files_modified — cannot verify test-first discipline.',
      suggestion: 'Add both the production file and its test file to files_modified.',
    });
    return findings;
  }

  const testFiles = files.filter(isTestFile);
  const prodFiles = files.filter((f) => !isTestFile(f));

  if (testFiles.length === 0) {
    findings.push({
      plan: String(plan.frontmatter.plan),
      file: '(plan)',
      severity: 'high',
      kind: 'no-tests-listed',
      message: 'TDD plan lists no test files in files_modified.',
      suggestion:
        'Add a test file colocated with the production file (e.g. `src/x.test.ts`) before execution.',
    });
  }

  for (const prod of prodFiles) {
    const match = findMatchingTest(prod, testFiles);
    if (!match) {
      findings.push({
        plan: String(plan.frontmatter.plan),
        file: prod,
        severity: 'medium',
        kind: 'missing-test-file',
        message: `TDD plan modifies ${prod} without a colocated test in files_modified.`,
        suggestion: `Add a test file like ${prod.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1')} to files_modified.`,
      });
    }
  }

  return findings;
}

/**
 * Ask git for the Unix-timestamp of a file's first commit. Returns null
 * when the file has never been committed or git is unavailable.
 */
async function firstCommitTimestamp(cwd: string, file: string): Promise<number | null> {
  try {
    const { stdout } = await exec(
      'git',
      ['log', '--diff-filter=A', '--follow', '--format=%ct', '--', file],
      { cwd },
    );
    const lines = stdout.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    const earliest = lines[lines.length - 1];
    const n = Number(earliest);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Step 3: for each production→test pair in this tdd plan, verify the
 * test file's first commit is not strictly AFTER the production file's.
 * Missing git history is silently skipped (no finding).
 */
export async function analyzeCommitOrder(
  cwd: string,
  plan: ParsedPlan,
): Promise<TddFinding[]> {
  const findings: TddFinding[] = [];
  if (plan.frontmatter.type !== 'tdd') return findings;

  const files = plan.frontmatter.files_modified ?? [];
  const testFiles = files.filter(isTestFile);
  const prodFiles = files.filter((f) => !isTestFile(f));

  for (const prod of prodFiles) {
    const match = findMatchingTest(prod, testFiles);
    if (!match) continue;

    const [prodTs, testTs] = await Promise.all([
      firstCommitTimestamp(cwd, prod),
      firstCommitTimestamp(cwd, match),
    ]);
    if (prodTs === null || testTs === null) continue;

    if (testTs > prodTs) {
      findings.push({
        plan: String(plan.frontmatter.plan),
        file: prod,
        severity: 'high',
        kind: 'production-before-test',
        message: `TDD violation: ${prod} was first committed before its test ${match} (Δ ${testTs - prodTs}s).`,
        suggestion:
          'Red-Green-Refactor requires the test to land before the implementation. Rewrite the sequence or drop the `type: tdd` tag if this plan is not test-driven.',
      });
    }
  }

  return findings;
}

/**
 * Discover plan files under `.planning/phases/<phase-dir>/` that look like
 * PLAN.md files. Returns absolute paths.
 */
export async function findPlanFiles(cwd: string, phase?: string): Promise<string[]> {
  const phasesDir = join(cwd, '.planning', 'phases');
  try {
    await access(phasesDir);
  } catch {
    return [];
  }
  const entries = await readdir(phasesDir, { withFileTypes: true });
  const plans: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (phase && !entry.name.startsWith(phase + '-') && entry.name !== phase) continue;
    const phaseDir = join(phasesDir, entry.name);
    const files = await readdir(phaseDir);
    for (const f of files) {
      if (/-PLAN\.md$/.test(f)) plans.push(join(phaseDir, f));
    }
  }
  return plans;
}

/**
 * Run the full TDD gate over a given phase (or all phases if omitted).
 * This is the function verify-layers.ts calls from Layer 2.
 */
export async function runTddGate(
  ctx: SkillContext,
  phase?: string,
): Promise<TddGateResult> {
  const cwd = ctx.cwd;
  const planFiles = await findPlanFiles(cwd, phase);
  if (planFiles.length === 0) {
    return { ran: false, tddPlansScanned: 0, findings: [], passed: true, skippedReason: 'no plan files found' };
  }

  const findings: TddFinding[] = [];
  let tddPlansScanned = 0;

  for (const planPath of planFiles) {
    const raw = await readFile(planPath, 'utf8');
    let parsed: ParsedPlan;
    try {
      parsed = parsePlanMd(raw);
    } catch {
      continue;
    }
    if (parsed.frontmatter.type !== 'tdd') continue;
    tddPlansScanned++;

    findings.push(...analyzePlanForTddShape(parsed));
    findings.push(...(await analyzeCommitOrder(cwd, parsed)));
  }

  const hasHigh = findings.some((f) => f.severity === 'high');
  return {
    ran: true,
    tddPlansScanned,
    findings,
    passed: !hasHigh,
  };
}

/** Helper to translate TDD findings into verify-layer findings. */
export function tddFindingToVerify(
  finding: TddFinding,
): {
  layer: 2;
  source: 'tdd';
  severity: 'high' | 'medium';
  description: string;
  file?: string;
  suggestion?: string;
} {
  return {
    layer: 2,
    source: 'tdd',
    severity: finding.severity,
    description: `[tdd:${finding.kind}] plan ${finding.plan}: ${finding.message}`,
    file: finding.file !== '(plan)' ? finding.file : undefined,
    suggestion: finding.suggestion,
  };
}

/** For absolute → relative file normalization used in tests. */
export function toRelative(cwd: string, abs: string): string {
  return relative(cwd, abs);
}
