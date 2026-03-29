/**
 * BudgetGuard — cost ceiling enforcement for auto mode.
 *
 * Checks current agent spend against a configured ceiling and returns
 * a status enum used by auto.skill.ts to warn, pause, or stop execution.
 *
 * No state, no I/O — pure calculation.
 *
 * Requirements: OPS-04
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Ordered severity tiers for budget consumption */
export type BudgetStatus = 'ok' | 'warning_50' | 'warning_75' | 'warning_90' | 'exceeded';

export interface BudgetCheckResult {
  status: BudgetStatus;
  currentCostUsd: number;
  ceilingUsd: number | null;
  percentUsed: number;
  message: string | null;
}

// ---------------------------------------------------------------------------
// BudgetGuard
// ---------------------------------------------------------------------------

/**
 * Evaluates current agent cost against an optional ceiling.
 * When ceilingUsd is null (no ceiling configured) every call returns 'ok'.
 */
export class BudgetGuard {
  constructor(private readonly ceilingUsd: number | null) {}

  /**
   * Check current cost against the ceiling.
   *
   * Threshold precedence (highest first):
   *   >= 100% → exceeded
   *   >=  90% → warning_90
   *   >=  75% → warning_75
   *   >=  50% → warning_50
   *   otherwise → ok
   *
   * When no ceiling is set, always returns ok.
   */
  check(currentCostUsd: number): BudgetCheckResult {
    if (this.ceilingUsd === null) {
      return {
        status: 'ok',
        currentCostUsd,
        ceilingUsd: null,
        percentUsed: 0,
        message: null,
      };
    }

    const ceiling = this.ceilingUsd;
    const percentUsed = ceiling > 0 ? (currentCostUsd / ceiling) * 100 : 100;

    if (currentCostUsd >= ceiling) {
      return {
        status: 'exceeded',
        currentCostUsd,
        ceilingUsd: ceiling,
        percentUsed,
        message: `Budget ceiling reached ($${currentCostUsd.toFixed(2)} / $${ceiling.toFixed(2)}) — stopping auto mode`,
      };
    }

    if (currentCostUsd >= ceiling * 0.9) {
      return {
        status: 'warning_90',
        currentCostUsd,
        ceilingUsd: ceiling,
        percentUsed,
        message: `Budget 90% used — approaching ceiling`,
      };
    }

    if (currentCostUsd >= ceiling * 0.75) {
      return {
        status: 'warning_75',
        currentCostUsd,
        ceilingUsd: ceiling,
        percentUsed,
        message: `Budget 75% used ($${currentCostUsd.toFixed(2)} / $${ceiling.toFixed(2)})`,
      };
    }

    if (currentCostUsd >= ceiling * 0.5) {
      return {
        status: 'warning_50',
        currentCostUsd,
        ceilingUsd: ceiling,
        percentUsed,
        message: `Budget 50% used ($${currentCostUsd.toFixed(2)} / $${ceiling.toFixed(2)})`,
      };
    }

    return {
      status: 'ok',
      currentCostUsd,
      ceilingUsd: ceiling,
      percentUsed,
      message: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  /**
   * Create a BudgetGuard from a config object.
   * Returns a guard with null ceiling when budget_ceiling is missing or falsy.
   */
  static fromConfig(config: { budget_ceiling?: number }): BudgetGuard {
    const ceiling =
      typeof config.budget_ceiling === 'number' && config.budget_ceiling > 0
        ? config.budget_ceiling
        : null;
    return new BudgetGuard(ceiling);
  }
}
