#!/usr/bin/env node

// Phase 52b/M6 — SUNCO Workflow Router confidence module.
// Pure deterministic frozen-weight confidence math. NO LLM SDK imports.
// Contract source: packages/cli/references/router/CONFIDENCE-CALIBRATION.md (Phase 52a).
// Enforcement invariants I1-I4 (Determinism / Bounds / Monotonicity / No-LLM)
// asserted in tests + smoke Section 28.

const WEIGHTS = Object.freeze({
  phase_artifacts_complete: 0.25,
  git_state_matches_stage: 0.20,
  state_md_alignment: 0.15,
  test_state_known: 0.15,
  precondition_coverage: 0.15,
  recent_user_intent_match: 0.10,
});

const SIGNAL_KEYS = Object.freeze(Object.keys(WEIGHTS));

/**
 * Compute a deterministic confidence score in [0, 1] from evidence signals.
 *
 * Pure function. Same `signals` input yields byte-identical output across
 * repeated calls. No timestamp, random, or provider-roundtrip in the path.
 *
 * Contract:
 * - `signals` must be a plain object whose keys are a subset of SIGNAL_KEYS.
 *   Missing keys are treated as explicit 0 (no heuristic fill).
 * - Each signal value must be a finite number in [0, 1].
 * - Out-of-range or non-finite values throw `ConfidenceSignalError`.
 *
 * Formula: Σ (w_i × signal_i) / Σ (w_i). Σ (w_i) = 1.0 by construction,
 * so output equals Σ (w_i × signal_i). Guaranteed bounds:
 *   confidence(empty) === 0
 *   confidence(all signals === 1) === 1
 *
 * @param {Record<string, number>} signals
 * @returns {number}
 */
export function computeConfidence(signals) {
  if (signals === null || typeof signals !== 'object' || Array.isArray(signals)) {
    throw new ConfidenceSignalError('signals must be a plain object');
  }
  for (const key of Object.keys(signals)) {
    if (!SIGNAL_KEYS.includes(key)) {
      throw new ConfidenceSignalError(`unknown signal: ${key}`);
    }
    const v = signals[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
      throw new ConfidenceSignalError(`signal ${key} must be a finite number in [0, 1]; got ${v}`);
    }
  }
  let acc = 0;
  for (const key of SIGNAL_KEYS) {
    const v = signals[key];
    if (typeof v === 'number') {
      acc += WEIGHTS[key] * v;
    }
  }
  // Guard against floating-point drift above 1.0.
  if (acc > 1) acc = 1;
  if (acc < 0) acc = 0;
  return acc;
}

/**
 * Classify a confidence number into a band per CONFIDENCE-CALIBRATION.md §Bands.
 * `UNKNOWN` is NOT returned here — it belongs to the freshness layer, not the
 * band math. See EVIDENCE-MODEL.md §Freshness verdict.
 *
 * @param {number} confidence
 * @returns {'HIGH'|'MEDIUM'|'LOW'}
 */
export function classifyBand(confidence) {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    throw new ConfidenceSignalError(`confidence must be a finite number; got ${confidence}`);
  }
  if (confidence >= 0.80) return 'HIGH';
  if (confidence >= 0.50) return 'MEDIUM';
  return 'LOW';
}

export class ConfidenceSignalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfidenceSignalError';
  }
}

// Frozen weights exported for inspection + invariant assertions.
export { WEIGHTS, SIGNAL_KEYS };

// ─── Self-tests (I1-I4 invariants) ───────────────────────────────────────────

function runSelfTests() {
  let passed = 0;
  let failed = 0;
  const tally = (name, cond) => {
    if (cond) {
      passed++;
      console.log(`  PASS  ${name}`);
    } else {
      failed++;
      console.log(`  FAIL  ${name}`);
    }
  };

  // Weight sanity.
  const weightSum = SIGNAL_KEYS.reduce((s, k) => s + WEIGHTS[k], 0);
  tally('weight sum === 1.0', Math.abs(weightSum - 1.0) < 1e-9);
  tally('weights are frozen', Object.isFrozen(WEIGHTS));
  tally('SIGNAL_KEYS is frozen', Object.isFrozen(SIGNAL_KEYS));
  tally('SIGNAL_KEYS length === 6', SIGNAL_KEYS.length === 6);

  // I2 — Bounds.
  tally('I2 computeConfidence({}) === 0', computeConfidence({}) === 0);
  const allPositive = Object.fromEntries(SIGNAL_KEYS.map(k => [k, 1]));
  tally('I2 computeConfidence(all-positive) === 1.0', computeConfidence(allPositive) === 1.0);

  // I1 — Determinism (100 iterations byte-identical).
  const midFixture = {
    phase_artifacts_complete: 0.75,
    git_state_matches_stage: 0.50,
    state_md_alignment: 1.0,
    test_state_known: 0.25,
    precondition_coverage: 0.60,
    recent_user_intent_match: 0.90,
  };
  const expected = computeConfidence(midFixture);
  let allMatch = true;
  for (let i = 0; i < 100; i++) {
    if (computeConfidence(midFixture) !== expected) { allMatch = false; break; }
  }
  tally('I1 determinism: 100 iterations byte-identical', allMatch);

  // I3 — Monotonicity: removing each positive signal yields non-increasing.
  let monotone = true;
  const baseScore = computeConfidence(allPositive);
  for (const key of SIGNAL_KEYS) {
    const stripped = { ...allPositive };
    delete stripped[key];
    const newScore = computeConfidence(stripped);
    if (newScore > baseScore) { monotone = false; break; }
  }
  tally('I3 monotonicity: removing any positive signal does not increase score', monotone);

  // Setting a positive signal to 0 must also be non-increasing.
  let zeroMonotone = true;
  for (const key of SIGNAL_KEYS) {
    const zeroed = { ...allPositive, [key]: 0 };
    if (computeConfidence(zeroed) > baseScore) { zeroMonotone = false; break; }
  }
  tally('I3 monotonicity: zeroing any positive signal does not increase score', zeroMonotone);

  // Band classification boundaries.
  tally('classifyBand(0.0) === LOW', classifyBand(0.0) === 'LOW');
  tally('classifyBand(0.499) === LOW', classifyBand(0.499) === 'LOW');
  tally('classifyBand(0.50) === MEDIUM', classifyBand(0.50) === 'MEDIUM');
  tally('classifyBand(0.799) === MEDIUM', classifyBand(0.799) === 'MEDIUM');
  tally('classifyBand(0.80) === HIGH', classifyBand(0.80) === 'HIGH');
  tally('classifyBand(1.0) === HIGH', classifyBand(1.0) === 'HIGH');

  // Input validation.
  let threwUnknown = false;
  try { computeConfidence({ unknown_signal: 0.5 }); } catch { threwUnknown = true; }
  tally('rejects unknown signal key', threwUnknown);

  let threwOutOfRange = false;
  try { computeConfidence({ phase_artifacts_complete: 1.5 }); } catch { threwOutOfRange = true; }
  tally('rejects signal > 1', threwOutOfRange);

  let threwNegative = false;
  try { computeConfidence({ phase_artifacts_complete: -0.1 }); } catch { threwNegative = true; }
  tally('rejects negative signal', threwNegative);

  let threwNaN = false;
  try { computeConfidence({ phase_artifacts_complete: NaN }); } catch { threwNaN = true; }
  tally('rejects NaN signal', threwNaN);

  let threwNonObject = false;
  try { computeConfidence(null); } catch { threwNonObject = true; }
  tally('rejects null input', threwNonObject);

  // Partial signals (explicit 0 for missing, no heuristic fill).
  const partialOnlyArtifacts = { phase_artifacts_complete: 1.0 };
  const partialScore = computeConfidence(partialOnlyArtifacts);
  tally('partial signals: missing keys treated as 0',
    Math.abs(partialScore - WEIGHTS.phase_artifacts_complete) < 1e-9);

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Only run self-tests when this file is the entry point, not when imported.
if (process.argv.includes('--test') && import.meta.url === `file://${process.argv[1]}`) {
  runSelfTests();
}
