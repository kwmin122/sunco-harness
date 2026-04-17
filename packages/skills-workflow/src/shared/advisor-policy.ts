/**
 * Advisor policy — maps (risk bucket + intent + state) into an
 * AdvisorDecision. Deterministic decision table, no LLM calls.
 *
 * Input:
 *   - RiskClassification (from risk-classifier)
 *   - optional route hint (from /sunco:do category)
 *   - current config (to apply blocking=false downgrade, etc.)
 *
 * Output:
 *   - AdvisorDecision honoring the contract in advisor-types.ts
 *
 * Policy invariants (enforced by tests):
 *   1. autoExecuteSkills is NEVER required by the policy. Policy only
 *      names gates and recommends routes; execution is the caller's call.
 *   2. When config.blocking === false, blocker level downgrades to guarded
 *      at the final AdvisorDecision. The reasonCodes still contain the
 *      blocker signals so the agent can see the severity.
 *   3. suppressionKey is stable for the same signal set regardless of
 *      call order (so dedupe works across sessions).
 *   4. expiresAt is now + suppressSameKeyMinutes by default.
 */

import type {
  AdvisorConfig,
  AdvisorDecision,
  ConfirmationReason,
  GateRef,
  InterventionLevel,
  RecommendedRoute,
} from './advisor-types.js';
import type { RiskBucket, RiskClassification, RiskSignal } from './risk-classifier.js';

export interface PolicyInput {
  risk: RiskClassification;
  /** Optional intent category from /sunco:do or category-classifier. */
  intentCategory?: string;
  /** Optional: user's raw intent, used to tune confirmationReason. */
  rawIntent?: string;
  /** Active advisor config. */
  config: AdvisorConfig;
}

// ---------------------------------------------------------------------------
// Gate recipes per bucket
// ---------------------------------------------------------------------------

function gatesForBucket(bucket: RiskBucket, signals: RiskSignal[]): {
  preGates: GateRef[];
  postGates: GateRef[];
} {
  const preGates: GateRef[] = [];
  const postGates: GateRef[] = [];

  if (bucket === 'silent') {
    return { preGates, postGates };
  }

  if (bucket === 'notice') {
    postGates.push({ gate: 'lint', scope: 'changed' });
    if (signals.includes('testFailures') || signals.includes('buildFailing')) {
      postGates.push({ gate: 'test', scope: 'targeted' });
    }
    return { preGates, postGates };
  }

  if (bucket === 'guarded') {
    preGates.push({ gate: 'spec-approval' });
    postGates.push({ gate: 'lint', scope: 'changed' });
    postGates.push({ gate: 'test', scope: 'targeted' });
    if (signals.includes('touchesAuth') || signals.includes('touchesPermissions') || signals.includes('touchesPayments')) {
      postGates.push({ gate: 'review', scope: 'security' });
    }
    if (signals.includes('touchesSchema') || signals.includes('touchesMigration')) {
      postGates.push({ gate: 'verify', scope: 'full' });
    }
    return { preGates, postGates };
  }

  // blocker
  preGates.push({ gate: 'spec-approval' });
  preGates.push({ gate: 'plan' });
  postGates.push({ gate: 'verify', scope: 'full' });
  postGates.push({ gate: 'review', scope: 'security' });
  postGates.push({ gate: 'proceed' });
  return { preGates, postGates };
}

// ---------------------------------------------------------------------------
// Route recommendation
// ---------------------------------------------------------------------------

function routeForBucket(
  bucket: RiskBucket,
  signals: RiskSignal[],
  intentCategory?: string,
): RecommendedRoute {
  if (intentCategory === 'debug') return 'debug';
  if (intentCategory === 'review') return 'review';
  if (signals.includes('deploymentIntent')) return 'ship';
  if (signals.includes('testFailures') || signals.includes('buildFailing')) return 'debug';

  switch (bucket) {
    case 'silent':
      return 'fast';
    case 'notice':
      return 'quick';
    case 'guarded':
    case 'blocker':
      return 'plan-execute-verify';
  }
}

// ---------------------------------------------------------------------------
// Confirmation reason
// ---------------------------------------------------------------------------

function confirmationReasonFor(signals: RiskSignal[]): ConfirmationReason {
  if (signals.includes('destructiveIntent')) return 'destructive';
  if (signals.includes('deploymentIntent')) return 'deployment';
  if (signals.includes('moneyMovementIntent')) return 'external_cost';
  if (signals.includes('touchesMigration')) return 'schema_migration';
  if (signals.includes('touchesSecrets') || signals.includes('touchesAuth')) return 'security_sensitive';
  return null;
}

// ---------------------------------------------------------------------------
// Suppression key
// ---------------------------------------------------------------------------

export function buildSuppressionKey(bucket: RiskBucket, signals: RiskSignal[]): string {
  // Stable across call order: dedup via sorted unique list.
  const unique = Array.from(new Set(signals)).sort();
  return `${bucket}:${unique.join('+') || 'none'}`;
}

// ---------------------------------------------------------------------------
// Intervention level (with blocking=false downgrade)
// ---------------------------------------------------------------------------

function resolveLevel(bucket: RiskBucket, blocking: boolean): InterventionLevel {
  if (bucket === 'blocker' && !blocking) return 'guarded';
  return bucket as InterventionLevel;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function decideAdvice(input: PolicyInput): AdvisorDecision {
  const { risk, intentCategory, config } = input;

  const level = resolveLevel(risk.bucket, config.blocking);
  const { preGates, postGates } = gatesForBucket(risk.bucket, risk.signals);
  const recommendedRoute = routeForBucket(risk.bucket, risk.signals, intentCategory);
  const confirmationReason =
    risk.bucket === 'blocker' || risk.bucket === 'guarded'
      ? confirmationReasonFor(risk.signals)
      : null;

  const expiresAt = new Date(
    Date.now() + config.suppressSameKeyMinutes * 60 * 1000,
  ).toISOString();

  return {
    level,
    confidence: risk.confidence,
    reasonCodes: risk.signals,
    preGates,
    postGates,
    recommendedRoute,
    // Policy does NOT fill userVisibleMessage / systemInjection — that's
    // advisor-message's job so the shape of the note stays in one place.
    confirmationReason,
    suppressionKey: buildSuppressionKey(risk.bucket, risk.signals),
    expiresAt,
  };
}
