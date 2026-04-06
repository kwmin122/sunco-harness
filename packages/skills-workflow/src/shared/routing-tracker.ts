/**
 * Routing Tracker — skill×model success rate recording.
 *
 * Records which provider succeeded/failed for each skill invocation.
 * Data is stored in SQLite state for lightweight persistence.
 * Used by recommender to improve routing accuracy over time.
 *
 * Requirements: LH-10
 */

import type { StateApi } from '@sunco/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoutingRecord {
  skillId: string;
  providerId: string;
  success: boolean;
  timestamp: string;
  durationMs?: number;
}

export interface RoutingStats {
  skillId: string;
  providerId: string;
  totalRuns: number;
  successCount: number;
  successRate: number;
}

// ---------------------------------------------------------------------------
// State Key
// ---------------------------------------------------------------------------

const STATE_KEY = 'routing.history';
const MAX_HISTORY = 500;

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/**
 * Record a routing outcome to state.
 * Maintains a rolling window of MAX_HISTORY entries.
 */
export async function recordRouting(
  state: StateApi,
  record: RoutingRecord,
): Promise<void> {
  const history = (await state.get<RoutingRecord[]>(STATE_KEY)) ?? [];
  history.push(record);

  // Trim oldest entries if over limit
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  await state.set(STATE_KEY, history);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Get routing success statistics, optionally filtered by skillId.
 *
 * @param state - State API
 * @param skillId - Optional skill ID filter
 * @returns Array of stats per skill×provider combination
 */
export async function getRoutingStats(
  state: StateApi,
  skillId?: string,
): Promise<RoutingStats[]> {
  const history = (await state.get<RoutingRecord[]>(STATE_KEY)) ?? [];

  // Group by skill×provider
  const groups = new Map<string, { total: number; success: number; skillId: string; providerId: string }>();

  for (const record of history) {
    if (skillId && record.skillId !== skillId) continue;

    const key = `${record.skillId}:${record.providerId}`;
    const group = groups.get(key) ?? { total: 0, success: 0, skillId: record.skillId, providerId: record.providerId };
    group.total++;
    if (record.success) group.success++;
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((g) => ({
    skillId: g.skillId,
    providerId: g.providerId,
    totalRuns: g.total,
    successCount: g.success,
    successRate: g.total > 0 ? g.success / g.total : 0,
  }));
}
