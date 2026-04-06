/**
 * Model Selector — deterministic model tier selection.
 *
 * Selects optimal model tier (fast/balanced/quality) based on
 * task complexity, budget utilization, and intent type.
 *
 * Rules:
 *   - simple tasks → fast (Haiku-class)
 *   - standard tasks → balanced (Sonnet-class)
 *   - complex tasks → quality (Opus-class)
 *   - Budget >= 75% → downgrade one tier
 *   - Intent overrides: lookup=fast, plan/review=quality
 *
 * Zero LLM cost. Pure calculation.
 *
 * Requirements: LH-07, LH-08
 */

import type { IntentType } from './intent-classifier.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelTier = 'fast' | 'balanced' | 'quality';

export type SkillComplexity = 'simple' | 'standard' | 'complex';

export interface ModelSelectionInput {
  complexity?: SkillComplexity;
  budgetPercent: number;
  intentType?: IntentType;
}

export interface ModelSelectionResult {
  tier: ModelTier;
  downgraded: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Selection Logic
// ---------------------------------------------------------------------------

/**
 * Select the optimal model tier based on complexity, budget, and intent.
 *
 * @param opts - Selection inputs
 * @returns Selected tier with downgrade info
 */
export function selectModelTier(opts: ModelSelectionInput): ModelSelectionResult {
  const { complexity = 'standard', budgetPercent, intentType } = opts;

  // Intent overrides take precedence
  if (intentType === 'lookup') {
    return { tier: 'fast', downgraded: false, reason: 'lookup intent → fast' };
  }
  if (intentType === 'plan' || intentType === 'review') {
    // Even plan/review can be downgraded at extreme budget
    if (budgetPercent >= 90) {
      return { tier: 'balanced', downgraded: true, reason: `${intentType} intent downgraded (budget ${budgetPercent}%)` };
    }
    return { tier: 'quality', downgraded: false, reason: `${intentType} intent → quality` };
  }

  // Complexity-based selection
  const baseTier: ModelTier =
    complexity === 'simple' ? 'fast' :
    complexity === 'complex' ? 'quality' :
    'balanced';

  // Budget-aware downgrade
  if (budgetPercent >= 75) {
    const downgraded = downgrade(baseTier);
    if (downgraded !== baseTier) {
      return {
        tier: downgraded,
        downgraded: true,
        reason: `${complexity} complexity downgraded from ${baseTier} → ${downgraded} (budget ${budgetPercent}%)`,
      };
    }
  }

  return { tier: baseTier, downgraded: false, reason: `${complexity} complexity → ${baseTier}` };
}

/**
 * Downgrade a model tier by one level.
 * fast stays fast (can't go lower).
 */
function downgrade(tier: ModelTier): ModelTier {
  if (tier === 'quality') return 'balanced';
  if (tier === 'balanced') return 'fast';
  return 'fast';
}
