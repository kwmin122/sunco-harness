/**
 * @sunco/core - Usage Tracker
 *
 * Accumulates token/cost usage across all agent provider calls.
 * Handles partial data from CLI providers that don't report exact tokens.
 *
 * Decision: D-21 (accurate + estimated cost tracking)
 */

import type { AgentResult, AgentUsage, UsageEntry } from './types.js';

/**
 * Token and cost accumulator for agent operations.
 * Records usage from each provider call and provides session totals.
 */
export class UsageTracker {
  /** Maximum number of detailed history entries kept (circular buffer). */
  static readonly MAX_HISTORY = 1000;

  private _inputTokens = 0;
  private _outputTokens = 0;
  private _estimatedCostUsd = 0;
  private _wallTimeMs = 0;
  private _estimated = false;
  private _callCount = 0;
  private _history: UsageEntry[] = [];

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
    this._history = [];
  }

  /**
   * Record a detailed per-call entry for cost breakdown queries.
   * Caps at MAX_HISTORY entries — oldest are dropped when the limit is reached.
   */
  recordDetailed(entry: UsageEntry): void {
    this._history.push(entry);
    if (this._history.length > UsageTracker.MAX_HISTORY) {
      this._history.splice(0, this._history.length - UsageTracker.MAX_HISTORY);
    }
  }

  /**
   * Return a copy of the detailed usage history.
   */
  getHistory(): UsageEntry[] {
    return [...this._history];
  }

  /**
   * Return the accumulated estimated cost in USD.
   */
  getTotalCostUsd(): number {
    return this._estimatedCostUsd;
  }
}
