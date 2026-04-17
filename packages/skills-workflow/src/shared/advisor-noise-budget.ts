/**
 * Noise budget — keeps the advisor from becoming spam.
 *
 * Rules (from DEFAULT_SUPPRESSION_POLICY):
 *   1. Same suppressionKey re-surfaced only after N minutes.
 *   2. Hard cap on visible surfaces per session.
 *   3. At most 1 advisor block injected into any single user prompt.
 *   4. Confidence below the configured minimum is logged only.
 *
 * State is in-memory for the current process. Persistence (so multiple
 * Claude Code sessions share a budget) is a Phase 5 concern — for now
 * we just export a functional shape so hooks can keep budget per-session.
 */

import type {
  AdvisorConfidence,
  AdvisorDecision,
  SuppressionPolicy,
} from './advisor-types.js';

export interface NoiseBudgetState {
  /** suppressionKey → lastSurfacedAt ISO. */
  lastSurfaced: Record<string, string>;
  /** Count of surfaces in the current session. */
  visibleCount: number;
  /** Configured policy. */
  policy: SuppressionPolicy;
}

export function makeBudget(policy: SuppressionPolicy): NoiseBudgetState {
  return {
    lastSurfaced: {},
    visibleCount: 0,
    policy,
  };
}

// ---------------------------------------------------------------------------
// Decision: show or suppress?
// ---------------------------------------------------------------------------

export type SuppressionReason =
  | 'level-silent'
  | 'confidence-too-low'
  | 'recently-surfaced'
  | 'session-cap-reached';

export interface SurfaceDecision {
  show: boolean;
  reason?: SuppressionReason;
}

const CONFIDENCE_ORDER: AdvisorConfidence[] = ['low', 'medium', 'high'];

function meetsMinConfidence(
  actual: AdvisorConfidence,
  min: AdvisorConfidence,
): boolean {
  return CONFIDENCE_ORDER.indexOf(actual) >= CONFIDENCE_ORDER.indexOf(min);
}

function isRecentlySurfaced(
  state: NoiseBudgetState,
  key: string,
  now: Date,
): boolean {
  const last = state.lastSurfaced[key];
  if (!last) return false;
  const elapsedMin = (now.getTime() - new Date(last).getTime()) / 60000;
  return elapsedMin < state.policy.sameKeyMinutes;
}

/**
 * Should this decision surface to the user? Deterministic. Does NOT
 * mutate state — callers call `recordSurfaced` separately once they
 * actually surface.
 */
export function shouldSurface(
  state: NoiseBudgetState,
  decision: AdvisorDecision,
  now: Date = new Date(),
): SurfaceDecision {
  if (decision.level === 'silent') {
    return { show: false, reason: 'level-silent' };
  }
  if (!meetsMinConfidence(decision.confidence, state.policy.minVisibleConfidence)) {
    return { show: false, reason: 'confidence-too-low' };
  }
  if (isRecentlySurfaced(state, decision.suppressionKey, now)) {
    return { show: false, reason: 'recently-surfaced' };
  }
  if (state.visibleCount >= state.policy.maxVisiblePerSession) {
    return { show: false, reason: 'session-cap-reached' };
  }
  return { show: true };
}

/**
 * Record a surface event in the budget. Mutates state. Call only when
 * the advisor block was actually shown to the user.
 */
export function recordSurfaced(
  state: NoiseBudgetState,
  decision: AdvisorDecision,
  now: Date = new Date(),
): void {
  state.lastSurfaced[decision.suppressionKey] = now.toISOString();
  state.visibleCount += 1;
}

/**
 * How many advisor blocks can still be injected into THIS user prompt?
 * Always respects policy.maxPerPrompt (1 by default).
 */
export function maxBlocksInCurrentPrompt(state: NoiseBudgetState): number {
  return state.policy.maxPerPrompt;
}
