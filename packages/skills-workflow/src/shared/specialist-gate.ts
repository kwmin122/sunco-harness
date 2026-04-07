/**
 * Adaptive specialist gating — disable low-yield specialists to save tokens.
 *
 * Tracks specialist hit rates (findings per invocation) using routing-tracker stats.
 * After N consecutive zero-finding runs, a specialist is auto-disabled.
 * Re-enabled when context changes significantly (new phase, different file types).
 *
 * Phase 23b — Review Army
 */

import type { RoutingStats } from './routing-tracker.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpecialistId =
  | 'security'
  | 'performance'
  | 'architecture'
  | 'correctness'
  | 'testing'
  | 'api-design'
  | 'migration'
  | 'maintainability';

export interface SpecialistGateResult {
  /** Specialists that should run */
  enabled: SpecialistId[];
  /** Specialists that are gated (skipped) */
  gated: SpecialistId[];
  /** Estimated token savings from gating */
  estimatedTokensSaved: number;
}

export interface SpecialistRecord {
  specialistId: SpecialistId;
  consecutiveZeroFindings: number;
  totalRuns: number;
  totalFindings: number;
  lastFindingAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default: gate after 10 consecutive zero-finding runs */
const DEFAULT_GATE_THRESHOLD = 10;

/** Estimated tokens per specialist invocation */
const TOKENS_PER_SPECIALIST = 4000;

/** All 8 specialists */
export const ALL_SPECIALISTS: SpecialistId[] = [
  'security',
  'performance',
  'architecture',
  'correctness',
  'testing',
  'api-design',
  'migration',
  'maintainability',
];

/** Core 4 specialists that are never gated */
const CORE_SPECIALISTS = new Set<SpecialistId>([
  'security',
  'correctness',
]);

// ---------------------------------------------------------------------------
// Gate logic
// ---------------------------------------------------------------------------

/**
 * Determine which specialists should run based on their historical hit rate.
 *
 * @param records - Per-specialist invocation history
 * @param threshold - Consecutive zero-finding runs before gating (default: 10)
 * @returns Which specialists to enable/gate and estimated savings
 */
export function evaluateSpecialistGate(
  records: SpecialistRecord[],
  threshold: number = DEFAULT_GATE_THRESHOLD,
): SpecialistGateResult {
  const recordMap = new Map(records.map((r) => [r.specialistId, r]));

  const enabled: SpecialistId[] = [];
  const gated: SpecialistId[] = [];

  for (const id of ALL_SPECIALISTS) {
    // Core specialists are never gated
    if (CORE_SPECIALISTS.has(id)) {
      enabled.push(id);
      continue;
    }

    const record = recordMap.get(id);
    if (!record) {
      // No history — enable by default
      enabled.push(id);
      continue;
    }

    if (record.consecutiveZeroFindings >= threshold) {
      gated.push(id);
    } else {
      enabled.push(id);
    }
  }

  return {
    enabled,
    gated,
    estimatedTokensSaved: gated.length * TOKENS_PER_SPECIALIST,
  };
}

/**
 * Update a specialist record after a run.
 */
export function updateSpecialistRecord(
  record: SpecialistRecord,
  findingsCount: number,
): SpecialistRecord {
  return {
    ...record,
    totalRuns: record.totalRuns + 1,
    totalFindings: record.totalFindings + findingsCount,
    consecutiveZeroFindings:
      findingsCount === 0
        ? record.consecutiveZeroFindings + 1
        : 0,
    lastFindingAt:
      findingsCount > 0
        ? new Date().toISOString()
        : record.lastFindingAt,
  };
}

/**
 * Create a fresh specialist record.
 */
export function createSpecialistRecord(
  specialistId: SpecialistId,
): SpecialistRecord {
  return {
    specialistId,
    consecutiveZeroFindings: 0,
    totalRuns: 0,
    totalFindings: 0,
    lastFindingAt: null,
  };
}

/**
 * Convert routing stats to specialist records for gating evaluation.
 */
export function routingStatsToRecords(
  stats: RoutingStats[],
): SpecialistRecord[] {
  return stats
    .filter((s) => ALL_SPECIALISTS.includes(s.skillId as SpecialistId))
    .map((s) => ({
      specialistId: s.skillId as SpecialistId,
      consecutiveZeroFindings: 0, // Approximation: reset on any data
      totalRuns: s.totalRuns,
      totalFindings: 0, // Not tracked in routing stats
      lastFindingAt: null,
    }));
}
