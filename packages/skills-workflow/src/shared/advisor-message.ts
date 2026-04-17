/**
 * Advisor message — turns an AdvisorDecision into a short user-visible
 * message + an XML injection block. Template-based, no LLM.
 *
 * Output contract (Codex-approved Risk/Suggestion/Skip format):
 *
 *   Risk: <one-line risk summary>
 *   Suggestion: <one-line recommended next action>
 *   Skip: <what NOT to spend time on, if anything>  (optional)
 *
 * userVisibleMessage is bounded at 300 chars.
 * systemInjection is a <sunco_advisor> XML block parseable by both
 * Claude Code and Codex CLI adapters.
 */

import type {
  AdvisorDecision,
  RecommendedRoute,
} from './advisor-types.js';

const MAX_USER_VISIBLE_CHARS = 300;

/** Human-facing description of a reason code. */
const REASON_SUMMARIES: Record<string, string> = {
  touchesAuth: 'auth/session code is changing',
  touchesPayments: 'payments code is changing',
  touchesSchema: 'database schema is changing',
  touchesMigration: 'a migration is involved',
  touchesDatabase: 'database layer is changing',
  touchesPublicApi: 'a public API surface is changing',
  touchesSecrets: 'a secrets/credentials file is involved',
  touchesConfig: 'config is changing',
  touchesCI: 'CI/release config is changing',
  touchesPackageManager: 'package.json/requirements is changing',
  touchesLockfile: 'lockfile is changing (dependency resolution)',
  touchesPermissions: 'permissions/roles/IAM is changing',
  largeDeletion: 'large deletion — over half the diff is removals',
  moderateDeletion: 'moderate deletion',
  modifiesManyFiles: 'many files are changing in one go',
  testFailures: 'tests are currently failing',
  buildFailing: 'build is currently failing',
  deploymentIntent: 'user asked to deploy/publish/ship',
  destructiveIntent: 'user asked for a destructive op',
  moneyMovementIntent: 'user asked to move money',
};

function summarizeReasons(codes: string[]): string {
  // Pick up to 2 most-informative codes (we already ordered by severity).
  const picks = codes.slice(0, 2).map((c) => REASON_SUMMARIES[c] ?? c);
  if (picks.length === 0) return 'no specific risk signals';
  if (picks.length === 1) return picks[0]!;
  return `${picks[0]} and ${picks[1]}`;
}

function suggestionFor(route?: RecommendedRoute): string {
  switch (route) {
    case 'fast':
      return 'proceed directly, no extra ceremony needed.';
    case 'quick':
      return "use `/sunco:quick` with a targeted test run when you're done.";
    case 'debug':
      return 'debug first — reproduce, find root cause, then fix.';
    case 'plan-execute-verify':
      return 'write a plan (`/sunco:plan`) before touching code; verify afterwards.';
    case 'review':
      return 'run `/sunco:review` before shipping.';
    case 'ship':
      return 'only ship after `/sunco:proceed-gate` is clean.';
    default:
      return 'think once more before acting.';
  }
}

function skipFor(decision: AdvisorDecision): string | undefined {
  // Suggest skipping redundant work when reasonCodes hint at it.
  if (decision.reasonCodes.includes('touchesDocsOnly')) {
    return 'no code changes here — skip plan/review ceremony.';
  }
  if (decision.reasonCodes.includes('touchesTestsOnly')) {
    return 'tests-only — skip architecture review.';
  }
  return undefined;
}

export interface MessageOverrides {
  /** Caller-supplied risk summary — overrides template if present. */
  riskSummary?: string;
  /** Caller-supplied suggestion — overrides template if present. */
  suggestion?: string;
  /** Caller-supplied skip line — overrides template if present. */
  skip?: string;
}

/**
 * Render a short user-visible message. Always ≤ 300 chars.
 */
export function renderMessage(
  decision: AdvisorDecision,
  overrides?: MessageOverrides,
): string | undefined {
  if (decision.level === 'silent') return undefined;

  const risk = overrides?.riskSummary ?? summarizeReasons(decision.reasonCodes);
  const suggestion = overrides?.suggestion ?? suggestionFor(decision.recommendedRoute);
  const skip = overrides?.skip ?? skipFor(decision);

  const lines: string[] = [`Risk: ${risk}.`, `Suggestion: ${suggestion}`];
  if (skip) lines.push(`Skip: ${skip}`);

  const out = lines.join('\n');
  return out.length > MAX_USER_VISIBLE_CHARS
    ? out.slice(0, MAX_USER_VISIBLE_CHARS - 1).trimEnd() + '…'
    : out;
}

/**
 * Render an XML injection block. Visibility attribute tells the agent
 * adapter how to treat this — `internal` means the agent can honor the
 * guidance without repeating it verbatim to the user.
 */
export function renderInjection(decision: AdvisorDecision, message?: string): string | undefined {
  if (decision.level === 'silent') return undefined;
  const body = message ?? renderMessage(decision);
  if (!body) return undefined;
  const attrs: string[] = [
    'visibility="internal"',
    `level="${decision.level}"`,
    `confidence="${decision.confidence}"`,
  ];
  if (decision.recommendedRoute) attrs.push(`route="${decision.recommendedRoute}"`);
  if (decision.confirmationReason) attrs.push(`confirmation="${decision.confirmationReason}"`);
  return `<sunco_advisor ${attrs.join(' ')}>\n${body}\n</sunco_advisor>`;
}

/**
 * Full annotation — fills userVisibleMessage and systemInjection on the
 * decision without mutating the input. Downstream consumers prefer this
 * single entry point.
 */
export function annotateDecision(
  decision: AdvisorDecision,
  overrides?: MessageOverrides,
): AdvisorDecision {
  const msg = renderMessage(decision, overrides);
  const inj = renderInjection(decision, msg);
  return {
    ...decision,
    userVisibleMessage: msg,
    systemInjection: inj,
  };
}
