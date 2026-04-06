/**
 * Skill Profile — user skill usage pattern analysis.
 *
 * Records every skill invocation (ID + duration) and computes
 * aggregate statistics: invocation counts, average duration,
 * top-5 most-used skills.
 *
 * Data is stored in SQLite state under the `skill.profile` key.
 *
 * Requirements: LH-23
 */

import type { StateApi } from '@sunco/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillUsageEntry {
  skillId: string;
  count: number;
  lastUsed: string;
  avgDurationMs: number;
}

export interface SkillProfile {
  entries: SkillUsageEntry[];
  totalInvocations: number;
  topSkills: string[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// State Key
// ---------------------------------------------------------------------------

const STATE_KEY = 'skill.profile';

// ---------------------------------------------------------------------------
// Internal stored format (accumulates totals for average calculation)
// ---------------------------------------------------------------------------

interface StoredEntry {
  skillId: string;
  count: number;
  lastUsed: string;
  totalDurationMs: number;
}

interface StoredProfile {
  entries: StoredEntry[];
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/**
 * Record a single skill invocation.
 * Updates the running count and duration total for the skill.
 */
export async function recordSkillUsage(
  state: StateApi,
  skillId: string,
  durationMs: number,
): Promise<void> {
  const stored = (await state.get<StoredProfile>(STATE_KEY)) ?? { entries: [] };
  const now = new Date().toISOString();

  let entry = stored.entries.find((e) => e.skillId === skillId);
  if (!entry) {
    entry = { skillId, count: 0, lastUsed: now, totalDurationMs: 0 };
    stored.entries.push(entry);
  }

  entry.count++;
  entry.totalDurationMs += durationMs;
  entry.lastUsed = now;

  await state.set(STATE_KEY, stored);
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

/**
 * Compute the full skill profile from stored data.
 * Top skills are the 5 most-invoked skills, ordered by count descending.
 */
export async function getSkillProfile(state: StateApi): Promise<SkillProfile> {
  const stored = (await state.get<StoredProfile>(STATE_KEY)) ?? { entries: [] };
  const now = new Date().toISOString();

  const entries: SkillUsageEntry[] = stored.entries.map((e) => ({
    skillId: e.skillId,
    count: e.count,
    lastUsed: e.lastUsed,
    avgDurationMs: e.count > 0 ? Math.round(e.totalDurationMs / e.count) : 0,
  }));

  const totalInvocations = entries.reduce((sum, e) => sum + e.count, 0);

  // Top 5 by count, descending
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const topSkills = sorted.slice(0, 5).map((e) => e.skillId);

  return {
    entries,
    totalInvocations,
    topSkills,
    updatedAt: now,
  };
}
