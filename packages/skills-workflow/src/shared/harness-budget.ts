/**
 * Harness Budget — self-budget enforcement for harness overhead.
 *
 * Ensures that harness tokens (CLAUDE.md + hooks + state loading)
 * remain within a strict percentage of the total context window.
 * Pure calculation — no I/O, no state.
 *
 * Requirements: LH-24
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum percentage of total context that harness tokens may consume. */
export const HARNESS_BUDGET_PERCENT = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HarnessBudgetResult {
  withinBudget: boolean;
  harnessTokens: number;
  totalTokens: number;
  harnessPercent: number;
  message: string | null;
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

/**
 * Check whether harness tokens are within the budget ceiling.
 *
 * @param harnessTokens - Tokens consumed by harness artifacts (CLAUDE.md, hooks, state)
 * @param totalContextTokens - Total context window tokens available
 * @returns Budget check result with percentage and optional warning message
 */
export function checkHarnessBudget(
  harnessTokens: number,
  totalContextTokens: number,
): HarnessBudgetResult {
  // Guard against division by zero or nonsensical inputs
  if (totalContextTokens <= 0) {
    return {
      withinBudget: false,
      harnessTokens,
      totalTokens: totalContextTokens,
      harnessPercent: 100,
      message: 'Total context tokens must be greater than 0',
    };
  }

  const harnessPercent = (harnessTokens / totalContextTokens) * 100;
  const withinBudget = harnessPercent <= HARNESS_BUDGET_PERCENT;

  return {
    withinBudget,
    harnessTokens,
    totalTokens: totalContextTokens,
    harnessPercent: Math.round(harnessPercent * 100) / 100,
    message: withinBudget
      ? null
      : `Harness budget exceeded: ${harnessPercent.toFixed(1)}% of context used by harness (limit: ${HARNESS_BUDGET_PERCENT}%)`,
  };
}
