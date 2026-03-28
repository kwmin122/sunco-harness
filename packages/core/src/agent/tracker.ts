/**
 * @sunco/core - Usage Tracker
 *
 * Accumulates token/cost usage across all agent provider calls.
 * Handles partial data from CLI providers that don't report exact tokens.
 *
 * Decision: D-21 (accurate + estimated cost tracking)
 */

import type { AgentResult, AgentUsage } from './types.js';

/**
 * Token and cost accumulator for agent operations.
 * Records usage from each provider call and provides session totals.
 */
export class UsageTracker {
  private _inputTokens = 0;
  private _outputTokens = 0;
  private _estimatedCostUsd = 0;
  private _wallTimeMs = 0;
  private _estimated = false;
  private _callCount = 0;

  /** Number of recorded calls */
  get callCount(): number {
    return this._callCount;
  }

  /**
   * Record usage from an agent result.
   * Handles undefined token counts (CLI may not report them).
   */
  record(result: AgentResult): void {
    const usage = result.usage;
    this._inputTokens += usage.inputTokens ?? 0;
    this._outputTokens += usage.outputTokens ?? 0;
    this._estimatedCostUsd += usage.estimatedCostUsd ?? 0;
    this._wallTimeMs += usage.wallTimeMs;
    if (usage.estimated) {
      this._estimated = true;
    }
    this._callCount++;
  }

  /**
   * Get accumulated usage summary.
   */
  getSummary(): AgentUsage {
    return {
      inputTokens: this._inputTokens,
      outputTokens: this._outputTokens,
      estimatedCostUsd: this._estimatedCostUsd,
      wallTimeMs: this._wallTimeMs,
      estimated: this._estimated,
    };
  }

  /**
   * Reset all accumulators to zero.
   */
  reset(): void {
    this._inputTokens = 0;
    this._outputTokens = 0;
    this._estimatedCostUsd = 0;
    this._wallTimeMs = 0;
    this._estimated = false;
    this._callCount = 0;
  }
}
