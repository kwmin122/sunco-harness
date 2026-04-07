/**
 * Universal learnings system — persist cross-session knowledge with typed categories.
 *
 * Extends debug-learnings to support 6 learning types across all skills,
 * with confidence decay, deduplication, and cross-project search.
 *
 * Storage: JSONL in `.sun/learnings.jsonl` (append-only, one learning per line)
 *
 * Phase 24a — Learnings + Timeline
 */

import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Learning categories (inspired by gstack's 6-type system) */
export type LearningType =
  | 'pitfall'       // What NOT to do
  | 'pattern'       // Reusable approach
  | 'preference'    // User-stated preference
  | 'architecture'  // Structural decision
  | 'tool'          // Library/framework insight
  | 'operational';  // Project environment/CLI/workflow

/** Source of the learning */
export type LearningSource =
  | 'observed'      // Discovered during session
  | 'user-stated'   // User explicitly said
  | 'inferred'      // Derived from context
  | 'cross-model';  // From multi-model review

export interface Learning {
  id: string;
  skill: string;
  type: LearningType;
  key: string;
  insight: string;
  confidence: number; // 1-10
  source: LearningSource;
  files?: string[];
  createdAt: string;
  hitCount: number;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function learningsPath(cwd: string): string {
  return join(cwd, '.sun', 'learnings.jsonl');
}

// ---------------------------------------------------------------------------
// Confidence Decay
// ---------------------------------------------------------------------------

const DECAY_INTERVAL_DAYS = 30;

/**
 * Apply confidence decay based on age.
 * Observed and inferred learnings lose 1 point per 30 days.
 * User-stated and cross-model stay stable.
 */
function applyDecay(learning: Learning, now: Date): Learning {
  if (learning.source === 'user-stated' || learning.source === 'cross-model') {
    return learning;
  }

  const age = now.getTime() - new Date(learning.createdAt).getTime();
  const decayPoints = Math.floor(age / (DECAY_INTERVAL_DAYS * 24 * 60 * 60 * 1000));

  if (decayPoints <= 0) return learning;

  return {
    ...learning,
    confidence: Math.max(1, learning.confidence - decayPoints),
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Append a learning to the JSONL file.
 * Deduplicates by key+type: if existing entry found, replaces it (latest wins).
 */
export async function logLearning(
  cwd: string,
  learning: Omit<Learning, 'id' | 'createdAt' | 'hitCount'>,
): Promise<Learning> {
  const entry: Learning = {
    ...learning,
    id: `learn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    hitCount: 0,
  };

  // Check for dedup (same key+type)
  const all = await readAllLearnings(cwd);
  const existing = all.find((l) => l.key === entry.key && l.type === entry.type);

  if (existing) {
    // Replace: rewrite entire file without the old entry, append new
    const filtered = all.filter((l) => !(l.key === entry.key && l.type === entry.type));
    filtered.push(entry);
    await writeAllLearnings(cwd, filtered);
  } else {
    const path = learningsPath(cwd);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, JSON.stringify(entry) + '\n', 'utf-8');
  }

  return entry;
}

/**
 * Read all learnings from the JSONL file.
 */
export async function readAllLearnings(cwd: string): Promise<Learning[]> {
  const path = learningsPath(cwd);
  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch {
    return [];
  }

  const learnings: Learning[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      learnings.push(JSON.parse(line) as Learning);
    } catch {
      // Skip corrupted lines
    }
  }
  return learnings;
}

/**
 * Rewrite the entire learnings file (used by dedup).
 */
async function writeAllLearnings(cwd: string, learnings: Learning[]): Promise<void> {
  const path = learningsPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  const content = learnings.map((l) => JSON.stringify(l)).join('\n') + '\n';
  await writeFile(path, content, 'utf-8');
}

/**
 * Search learnings with optional filters, applying confidence decay.
 */
export async function searchLearnings(
  cwd: string,
  query?: {
    type?: LearningType;
    skill?: string;
    key?: string;
    minConfidence?: number;
  },
): Promise<Learning[]> {
  const now = new Date();
  let all = await readAllLearnings(cwd);

  // Apply decay
  all = all.map((l) => applyDecay(l, now));

  // Filter
  if (query) {
    if (query.type) all = all.filter((l) => l.type === query.type);
    if (query.skill) all = all.filter((l) => l.skill === query.skill);
    const key = query.key;
    if (key) all = all.filter((l) => l.key.includes(key));
    const minConfidence = query.minConfidence;
    if (minConfidence !== undefined) all = all.filter((l) => l.confidence >= minConfidence);
  }

  // Sort by confidence descending
  all.sort((a, b) => b.confidence - a.confidence);

  return all;
}

/**
 * Get count of learnings.
 */
export async function getLearningsCount(cwd: string): Promise<number> {
  return (await readAllLearnings(cwd)).length;
}
