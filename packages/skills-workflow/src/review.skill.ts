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

import { defineSkill } from '@sunco/core';
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
 * Detect review type from git diff content.
 * Priority order (D-07): UI signals > strategy/scope signals > default eng
 */
function detectReviewType(diff: string): { type: ReviewType; reason: string } {
  // 1. UI signals take highest priority
  if (UI_SIGNALS.some((sig) => diff.includes(sig))) {
    return { type: 'design', reason: 'UI/frontend changes detected' };
  }

  // 2. Strategy/scope signals
  if (STRATEGY_SIGNALS.some((sig) => diff.includes(sig))) {
    return { type: 'ceo', reason: 'strategic document changes detected' };
  }

  // 3. Default: implementation diff → eng-review
  return { type: 'eng', reason: 'implementation diff detected' };
}

/** Map review type to skill ID */
const SKILL_ID_MAP: Record<ReviewType, string> = {
  ceo:    'workflow.ceo-review',
  eng:    'workflow.eng-review',
  design: 'workflow.design-review',
};

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

      const detection = detectReviewType(diff);
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

      // Propagate the specialist's result, adding routing metadata
      return {
        ...result,
        data: {
          ...(result.data as Record<string, unknown> | undefined ?? {}),
          routedTo: skillId,
          selectionReason,
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
