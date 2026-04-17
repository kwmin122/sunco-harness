/**
 * @sunco/skills-workflow - Review Skill (Smart Front-Door)
 *
 * Auto-routing front-door for the review arsenal. Detects review type
 * from diff/file signals and delegates to the appropriate specialist:
 *   - workflow.ceo-review  (PRODUCT-SPEC/ROADMAP/REQUIREMENTS changes)
 *   - workflow.eng-review  (implementation diff, plan files)
 *   - workflow.design-review (UI/UX/frontend changes)
 *
 * --type ceo|eng|design overrides auto-detection (D-07).
 * One-line auto-selection message always printed (D-09).
 *
 * Requirements: WF-13
 * Decisions: D-07 (auto-routing), D-08 (user tier), D-09 (selection message)
 */

import { defineSkill, readActiveWork, DEFAULT_ACTIVE_WORK } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { simpleGit } from 'simple-git';

// ---------------------------------------------------------------------------
// Review type detection (D-07)
// Priority: UI signals > implementation diff > strategy/scope
// ---------------------------------------------------------------------------

type ReviewType = 'ceo' | 'eng' | 'design';

/** File patterns that signal UI/UX/frontend work → design-review */
const UI_SIGNALS = ['.tsx', '.jsx', '.css', '.scss', '.sass', '.ink.ts', 'screenshot', 'figma', 'design-system'];

/** File/content patterns that signal strategic/scope changes → ceo-review */
const STRATEGY_SIGNALS = ['PRODUCT-SPEC', 'ROADMAP', 'REQUIREMENTS', 'VISION', 'STRATEGY', 'OKR'];

/**
 * Detect review type from git diff + active-work phase state.
 * Priority: explicit active-work category > UI signals > strategy signals > default eng
 */
function detectReviewType(diff: string, activePhaseCategory?: string, activePhaseStep?: string): { type: ReviewType; reason: string } {
  if (activePhaseCategory === 'visual') {
    return { type: 'design', reason: 'active phase category is visual' };
  }

  if (activePhaseStep === 'plan' || activePhaseStep === 'discuss' || activePhaseStep === 'execute') {
    return { type: 'eng', reason: `active phase step is ${activePhaseStep}` };
  }

  if (activePhaseStep === 'ship' || activePhaseStep === 'verify' || activePhaseStep === 'milestone') {
    return { type: 'ceo', reason: `active phase step is ${activePhaseStep}` };
  }

  if (UI_SIGNALS.some((sig) => diff.includes(sig))) {
    return { type: 'design', reason: 'UI/frontend changes detected' };
  }

  if (STRATEGY_SIGNALS.some((sig) => diff.includes(sig))) {
    return { type: 'ceo', reason: 'strategic document changes detected' };
  }

  return { type: 'eng', reason: 'implementation diff detected' };
}

/** Map review type to skill ID */
const SKILL_ID_MAP: Record<ReviewType, string> = {
  ceo:    'workflow.ceo-review',
  eng:    'workflow.eng-review',
  design: 'workflow.design-review',
};

// ---------------------------------------------------------------------------
// Auto-revise loop (Superpowers receiving-code-review parity)
// ---------------------------------------------------------------------------

export interface ReviewIssue {
  file?: string;
  line?: number;
  severity?: string;
  message: string;
  agreement?: 'agreed' | 'solo';
}

export interface FixLoopSummary {
  attempted: number;
  succeeded: number;
  skipped: number;
  reVerifyRan: boolean;
  reVerifyPassed?: boolean;
  shortSummary: string;
}

/**
 * Extract review issues from a delegated review result. Looks in
 * result.data.findings, result.data.issues, and result.data.agreed_issues.
 * Returns only issues labelled as agreed (≥2 reviewers) — solo opinions
 * are surfaced to the user, not auto-fixed.
 */
export function extractAgreedIssues(result: SkillResult): ReviewIssue[] {
  const data = (result.data ?? {}) as Record<string, unknown>;
  const buckets: unknown[] = [
    data.agreed_issues,
    data.agreedIssues,
    data.findings,
    data.issues,
  ];

  const out: ReviewIssue[] = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const raw of bucket) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const agreement = typeof item.agreement === 'string' ? item.agreement : undefined;
      // Only consider agreed issues (multi-reviewer consensus).
      // If agreement is missing, fall back to items explicitly present
      // in the agreed_issues/agreedIssues buckets.
      const fromAgreedBucket = bucket === data.agreed_issues || bucket === data.agreedIssues;
      if (agreement !== 'agreed' && !fromAgreedBucket) continue;

      const message = typeof item.message === 'string'
        ? item.message
        : typeof item.description === 'string'
          ? item.description
          : '';
      if (!message) continue;

      out.push({
        file: typeof item.file === 'string' ? item.file : undefined,
        line: typeof item.line === 'number' ? item.line : undefined,
        severity: typeof item.severity === 'string' ? item.severity : undefined,
        message,
        agreement: agreement === 'solo' ? 'solo' : 'agreed',
      });
    }
  }

  // Dedupe by (file, line, message).
  const seen = new Set<string>();
  return out.filter((i) => {
    const key = `${i.file ?? ''}:${i.line ?? ''}:${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Build a one-liner task description for /sunco:quick. */
export function buildFixTaskText(issue: ReviewIssue): string {
  const loc = issue.file
    ? issue.line
      ? `${issue.file}:${issue.line}`
      : issue.file
    : '(unknown location)';
  return `fix review finding at ${loc} — ${issue.message}`;
}

async function runFixLoop(
  ctx: SkillContext,
  reviewResult: SkillResult,
  maxFix: number,
): Promise<FixLoopSummary> {
  const agreed = extractAgreedIssues(reviewResult);
  const scope = agreed.slice(0, Math.max(0, maxFix));
  const skipped = agreed.length - scope.length;

  let succeeded = 0;
  for (const issue of scope) {
    const taskText = buildFixTaskText(issue);
    try {
      const result = await ctx.run('workflow.quick', { _: [taskText] });
      if (result.success) succeeded++;
    } catch (err) {
      ctx.log.warn('review --fix: workflow.quick failed for issue', {
        error: err instanceof Error ? err.message : String(err),
        issue,
      });
    }
  }

  let reVerifyRan = false;
  let reVerifyPassed: boolean | undefined;
  if (succeeded > 0) {
    try {
      const phaseArg = ctx.args.phase !== undefined ? { phase: ctx.args.phase } : {};
      const verifyResult = await ctx.run('workflow.verify', phaseArg);
      reVerifyRan = true;
      reVerifyPassed = verifyResult.success;
    } catch (err) {
      ctx.log.warn('review --fix: re-verify failed to start', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const shortSummary = `${succeeded}/${scope.length} fixed${
    skipped > 0 ? ` (${skipped} over --max-fix cap)` : ''
  }${reVerifyRan ? `, re-verify ${reVerifyPassed ? 'PASS' : 'FAIL'}` : ''}`;

  return {
    attempted: scope.length,
    succeeded,
    skipped,
    reVerifyRan,
    reVerifyPassed,
    shortSummary,
  };
}

/** Validate user-supplied --type value */
function parseTypeArg(arg: unknown): ReviewType | null {
  if (arg === 'ceo' || arg === 'eng' || arg === 'design') return arg;
  return null;
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.review',
  command: 'review',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'standard',
  tier: 'user',
  description: 'Auto-routed review front-door: delegates to ceo/eng/design-review based on diff signals',
  options: [
    { flags: '-p, --phase <number>', description: 'Pass phase number to the delegated review skill' },
    { flags: '--type <type>', description: 'Force review type: ceo | eng | design (overrides auto-detection)' },
    { flags: '--fix', description: 'After review, auto-route agreed issues through /sunco:quick, then re-verify (Superpowers receiving-code-review loop)' },
    { flags: '--max-fix <n>', description: 'Maximum number of agreed issues to auto-fix in one run (default 5)' },
  ],

  async execute(ctx) {
    await ctx.ui.entry({
      title: 'Review',
      description: 'Detecting review type and delegating...',
    });

    // --- Step 1: Resolve explicit --type override or auto-detect ---
    const typeArg = parseTypeArg(ctx.args.type);
    let selectedType: ReviewType;
    let selectionReason: string;

    if (typeArg) {
      selectedType = typeArg;
      selectionReason = `--type flag`;
    } else {
      // Get diff for signal detection
      let diff = '';
      try {
        const git = simpleGit(ctx.cwd);
        const staged   = await git.diff(['--cached', '--name-only']);
        const unstaged = await git.diff(['--name-only']);
        diff = [staged, unstaged].filter(Boolean).join('\n');

        // Also get a brief content diff for STRATEGY_SIGNALS keyword matching
        const contentDiff = await git.diff(['--cached']).catch(() => '');
        diff += '\n' + contentDiff;
      } catch {
        // Fallback: if git fails, default to eng-review
        ctx.log.warn('Git diff failed — defaulting to eng-review');
      }

      const activeWork = await readActiveWork(ctx.cwd);
      const hasActiveWork = activeWork.updated_at !== DEFAULT_ACTIVE_WORK.updated_at;
      const detection = detectReviewType(
        diff,
        hasActiveWork ? activeWork.active_phase?.category : undefined,
        hasActiveWork ? activeWork.active_phase?.current_step : undefined,
      );
      selectedType  = detection.type;
      selectionReason = detection.reason;
    }

    const skillId = SKILL_ID_MAP[selectedType];

    // D-09: one-line auto-selection message
    const selectionMsg = `Auto-selected: ${selectedType}-review (${selectionReason})`;
    // eslint-disable-next-line no-console
    console.log(`\n  ${selectionMsg}\n`);
    ctx.log.info(selectionMsg, { selectedType, selectionReason });

    // --- Step 2: Build delegated args ---
    const delegatedArgs: Record<string, unknown> = {};
    if (ctx.args.phase !== undefined) {
      delegatedArgs['phase'] = ctx.args.phase;
    }

    // --- Step 3: Delegate to specialist skill ---
    try {
      const result = await ctx.run(skillId, delegatedArgs);

      // --- Step 4 (optional): auto-revise loop (Superpowers receiving-code-review) ---
      const fixFlag = ctx.args.fix === true || ctx.args.fix === 'true';
      const maxFix = Number(ctx.args['max-fix'] ?? ctx.args.maxFix ?? 5);

      let fixSummary: FixLoopSummary | undefined;
      if (fixFlag) {
        fixSummary = await runFixLoop(ctx, result, maxFix);
      }

      // Propagate the specialist's result, adding routing metadata
      return {
        ...result,
        summary: fixSummary ? `${result.summary ?? ''} | fix-loop: ${fixSummary.shortSummary}` : result.summary,
        data: {
          ...(result.data as Record<string, unknown> | undefined ?? {}),
          routedTo: skillId,
          selectionReason,
          ...(fixSummary ? { fixLoop: fixSummary } : {}),
        },
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      ctx.log.error('Delegated review skill failed', { skillId, error: errMsg });

      await ctx.ui.result({
        success: false,
        title: 'Review',
        summary: `${selectedType}-review failed: ${errMsg}`,
        details: [
          `Tried to delegate to: ${skillId}`,
          `Run 'sunco ${selectedType}-review' directly for full output.`,
        ],
      });

      return {
        success: false,
        summary: `${selectedType}-review failed: ${errMsg}`,
        data: { routedTo: skillId, selectionReason },
      };
    }
  },
});
