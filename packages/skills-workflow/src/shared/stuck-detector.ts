/**
 * StuckDetector — sliding window pattern detection for auto mode.
 *
 * Analyzes an invocation history (from AutoLock) and detects two stuck patterns:
 *   1. Same skill fails N consecutive times (default N=3).
 *   2. Oscillation — two distinct skills alternating failures 4+ times
 *      (e.g., A fail → B fail → A fail → B fail).
 *
 * Also provides debug-session analysis (Phase 23a) for Iron Law escalation.
 *
 * Pure function: no state, no side effects, no I/O.
 *
 * Requirements: OPS-02
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { IronLawState, DebugStuckResult } from './debug-types.js';

export interface InvocationRecord {
  skillId: string;
  success: boolean;
  timestamp: string;
}

export interface StuckResult {
  stuck: boolean;
  reason: string | null;
  failedSkillId: string | null;
  consecutiveFailures: number;
}

// ---------------------------------------------------------------------------
// StuckDetector
// ---------------------------------------------------------------------------

/**
 * Stateless analyzer for detecting stuck patterns in invocation history.
 * Instantiate once and call analyze() repeatedly with fresh history slices.
 */
export class StuckDetector {
  constructor(private readonly maxConsecutiveFailures: number = 3) {}

  /**
   * Analyze history for stuck patterns.
   *
   * Returns `stuck: true` if any pattern is detected.
   * Returns `stuck: false` with null reason/failedSkillId otherwise.
   */
  analyze(history: InvocationRecord[]): StuckResult {
    if (history.length === 0) {
      return { stuck: false, reason: null, failedSkillId: null, consecutiveFailures: 0 };
    }

    // --- Pattern 1: Same skill fails N consecutive times ---
    const consecutiveResult = this._checkConsecutiveFailures(history);
    if (consecutiveResult.stuck) {
      return consecutiveResult;
    }

    // --- Pattern 2: Oscillation (A fail, B fail, A fail, B fail...) ---
    const oscillationResult = this._checkOscillation(history);
    if (oscillationResult.stuck) {
      return oscillationResult;
    }

    // Return the partial count from the consecutive check so callers can inspect progress
    return {
      stuck: false,
      reason: null,
      failedSkillId: null,
      consecutiveFailures: consecutiveResult.consecutiveFailures,
    };
  }

  // ---------------------------------------------------------------------------
  // Private pattern detectors
  // ---------------------------------------------------------------------------

  /**
   * Check for N consecutive failures of the same skillId at the tail of history.
   */
  private _checkConsecutiveFailures(history: InvocationRecord[]): StuckResult {
    let count = 0;
    let lastFailedSkill: string | null = null;

    // Walk backwards from the most recent entry
    for (let i = history.length - 1; i >= 0; i--) {
      const record = history[i];

      if (record.success) break; // Chain broken by success

      if (lastFailedSkill === null) {
        // First failure in the streak
        lastFailedSkill = record.skillId;
        count = 1;
      } else if (record.skillId === lastFailedSkill) {
        count++;
      } else {
        // Different skill failed — reset streak to just this one
        // (This handles interleaved skills; only same-skill streak matters here)
        break;
      }

      if (count >= this.maxConsecutiveFailures) {
        return {
          stuck: true,
          reason: `Skill "${lastFailedSkill}" failed ${count} consecutive times`,
          failedSkillId: lastFailedSkill,
          consecutiveFailures: count,
        };
      }
    }

    return { stuck: false, reason: null, failedSkillId: null, consecutiveFailures: count };
  }

  /**
   * Check for oscillation pattern: two distinct skills alternating in failures.
   * Minimum 4 alternating failure entries required at the tail of history.
   *
   * Pattern: [..., A-fail, B-fail, A-fail, B-fail]
   */
  private _checkOscillation(history: InvocationRecord[]): StuckResult {
    // Collect trailing failure records only
    const failures: InvocationRecord[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i].success) {
        failures.unshift(history[i]);
      } else {
        // Stop at any success — oscillation only applies to an unbroken failure run
        break;
      }
    }

    // Need at least 4 entries to form an oscillation pattern
    if (failures.length < 4) {
      return { stuck: false, reason: null, failedSkillId: null, consecutiveFailures: 0 };
    }

    // The last 4 should be: A, B, A, B (two distinct IDs alternating)
    const tail = failures.slice(-4);
    const [a, b, c, d] = tail;

    if (
      a.skillId !== b.skillId && // A != B
      a.skillId === c.skillId && // A == C
      b.skillId === d.skillId // B == D
    ) {
      return {
        stuck: true,
        reason: `Oscillation detected between "${a.skillId}" and "${b.skillId}"`,
        failedSkillId: a.skillId,
        consecutiveFailures: 4,
      };
    }

    return { stuck: false, reason: null, failedSkillId: null, consecutiveFailures: 0 };
  }

  // ---------------------------------------------------------------------------
  // Debug session analysis (Phase 23a — Iron Law)
  // ---------------------------------------------------------------------------

  /**
   * Analyze an Iron Law debug session for escalation.
   *
   * Escalation triggers:
   * - All hypotheses tested and rejected → escalate
   * - 3+ consecutive rejections → escalate (max_retries)
   * - Same hypothesis tested twice → oscillation warning
   */
  analyzeDebugSession(state: IronLawState): DebugStuckResult {
    const tested = state.hypotheses.filter((h) => h.tested);
    const rejected = state.hypotheses.filter((h) => h.result === 'rejected');
    const pending = state.hypotheses.filter((h) => !h.tested);

    // Check for duplicate hypotheses (oscillation)
    const descriptions = state.hypotheses.map((h) => h.description);
    const hasDuplicates = descriptions.length !== new Set(descriptions).size;

    if (hasDuplicates) {
      return {
        stuck: true,
        reason: 'Same hypothesis tested multiple times — oscillation detected',
        hypothesesTested: tested.length,
        hypothesesRejected: rejected.length,
        escalationReason: 'oscillation',
      };
    }

    // All hypotheses rejected, none pending
    if (tested.length > 0 && rejected.length === tested.length && pending.length === 0) {
      return {
        stuck: true,
        reason: `All ${rejected.length} hypotheses rejected — no viable root cause identified`,
        hypothesesTested: tested.length,
        hypothesesRejected: rejected.length,
        escalationReason: 'all_hypotheses_rejected',
      };
    }

    // 3+ consecutive rejections
    if (rejected.length >= this.maxConsecutiveFailures) {
      return {
        stuck: true,
        reason: `${rejected.length} hypotheses rejected (threshold: ${this.maxConsecutiveFailures})`,
        hypothesesTested: tested.length,
        hypothesesRejected: rejected.length,
        escalationReason: 'max_retries',
      };
    }

    return {
      stuck: false,
      reason: null,
      hypothesesTested: tested.length,
      hypothesesRejected: rejected.length,
      escalationReason: null,
    };
  }
}
