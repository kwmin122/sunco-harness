/**
 * @sunco/core - UsageTracker Tests
 *
 * Tests for token/cost accumulation across provider calls.
 * Handles partial data (CLI may not report tokens).
 */

import { describe, it, expect } from 'vitest';
import { UsageTracker } from '../tracker.js';
import type { AgentResult, AgentUsage } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(usage: Partial<AgentUsage> = {}): AgentResult {
  return {
    providerId: 'test-provider',
    success: true,
    outputText: 'test output',
    artifacts: [],
    warnings: [],
    usage: {
      estimated: false,
      wallTimeMs: 100,
      ...usage,
    },
  };
}

// ---------------------------------------------------------------------------
// UsageTracker
// ---------------------------------------------------------------------------

describe('UsageTracker', () => {
  it('starts with zero totals', () => {
    const tracker = new UsageTracker();
    const summary = tracker.getSummary();
    expect(summary.inputTokens).toBe(0);
    expect(summary.outputTokens).toBe(0);
    expect(summary.estimatedCostUsd).toBe(0);
    expect(summary.wallTimeMs).toBe(0);
    expect(summary.estimated).toBe(false);
  });

  it('accumulates exact token counts', () => {
    const tracker = new UsageTracker();
    tracker.record(makeResult({
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostUsd: 0.01,
      wallTimeMs: 200,
      estimated: false,
    }));
    tracker.record(makeResult({
      inputTokens: 200,
      outputTokens: 75,
      estimatedCostUsd: 0.02,
      wallTimeMs: 300,
      estimated: false,
    }));

    const summary = tracker.getSummary();
    expect(summary.inputTokens).toBe(300);
    expect(summary.outputTokens).toBe(125);
    expect(summary.estimatedCostUsd).toBe(0.03);
    expect(summary.wallTimeMs).toBe(500);
    expect(summary.estimated).toBe(false);
  });

  it('handles undefined token counts with zero fallback', () => {
    const tracker = new UsageTracker();
    tracker.record(makeResult({
      inputTokens: undefined,
      outputTokens: undefined,
      estimatedCostUsd: undefined,
      wallTimeMs: 150,
    }));

    const summary = tracker.getSummary();
    expect(summary.inputTokens).toBe(0);
    expect(summary.outputTokens).toBe(0);
    expect(summary.estimatedCostUsd).toBe(0);
    expect(summary.wallTimeMs).toBe(150);
  });

  it('marks summary as estimated when any result has estimated: true', () => {
    const tracker = new UsageTracker();
    tracker.record(makeResult({
      inputTokens: 100,
      outputTokens: 50,
      estimated: false,
    }));
    tracker.record(makeResult({
      inputTokens: 200,
      outputTokens: 75,
      estimated: true, // CLI result
    }));

    const summary = tracker.getSummary();
    expect(summary.estimated).toBe(true);
  });

  it('accumulates mixed exact and estimated results', () => {
    const tracker = new UsageTracker();
    // SDK result with exact counts
    tracker.record(makeResult({
      inputTokens: 500,
      outputTokens: 200,
      estimatedCostUsd: 0.05,
      wallTimeMs: 1000,
      estimated: false,
    }));
    // CLI result with partial data
    tracker.record(makeResult({
      inputTokens: undefined,
      outputTokens: undefined,
      estimatedCostUsd: undefined,
      wallTimeMs: 2000,
      estimated: true,
    }));

    const summary = tracker.getSummary();
    expect(summary.inputTokens).toBe(500);
    expect(summary.outputTokens).toBe(200);
    expect(summary.estimatedCostUsd).toBe(0.05);
    expect(summary.wallTimeMs).toBe(3000);
    expect(summary.estimated).toBe(true);
  });

  it('tracks call count', () => {
    const tracker = new UsageTracker();
    expect(tracker.callCount).toBe(0);
    tracker.record(makeResult());
    tracker.record(makeResult());
    tracker.record(makeResult());
    expect(tracker.callCount).toBe(3);
  });

  it('resets all accumulators', () => {
    const tracker = new UsageTracker();
    tracker.record(makeResult({
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostUsd: 0.01,
      wallTimeMs: 200,
      estimated: true,
    }));
    tracker.reset();

    const summary = tracker.getSummary();
    expect(summary.inputTokens).toBe(0);
    expect(summary.outputTokens).toBe(0);
    expect(summary.estimatedCostUsd).toBe(0);
    expect(summary.wallTimeMs).toBe(0);
    expect(summary.estimated).toBe(false);
    expect(tracker.callCount).toBe(0);
  });
});
