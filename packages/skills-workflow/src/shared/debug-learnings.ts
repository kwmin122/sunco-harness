/**
 * Debug learnings — persist and search prior debugging insights across sessions.
 *
 * Storage: JSON files in `.sun/debug/learnings/{id}.json`
 * Search: in-memory scan (expected < 1000 learnings)
 *
 * Phase 23a — Iron Law Engine
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { DebugLearning, FailureType } from './debug-types.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function learningsDir(cwd: string): string {
  return join(cwd, '.sun', 'debug', 'learnings');
}

function learningPath(cwd: string, id: string): string {
  return join(learningsDir(cwd), `${id}.json`);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Save a debug learning to disk.
 * Creates the learnings directory if it doesn't exist.
 */
export async function saveLearning(
  cwd: string,
  learning: DebugLearning,
): Promise<void> {
  const dir = learningsDir(cwd);
  await mkdir(dir, { recursive: true });
  await writeFile(
    learningPath(cwd, learning.id),
    JSON.stringify(learning, null, 2),
    'utf-8',
  );
}

/**
 * Read all learnings from disk.
 * Returns empty array if the directory doesn't exist.
 */
export async function readAllLearnings(cwd: string): Promise<DebugLearning[]> {
  const dir = learningsDir(cwd);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const learnings: DebugLearning[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(dir, entry), 'utf-8');
      learnings.push(JSON.parse(raw) as DebugLearning);
    } catch {
      // Skip corrupted entries
    }
  }
  return learnings;
}

/**
 * Search learnings by pattern, affected files, or symptom substring.
 * All criteria are optional — results must match ALL provided criteria.
 */
export async function searchLearnings(
  cwd: string,
  query: {
    pattern?: FailureType;
    files?: string[];
    symptom?: string;
  },
): Promise<DebugLearning[]> {
  const all = await readAllLearnings(cwd);

  return all.filter((learning) => {
    if (query.pattern && learning.pattern !== query.pattern) return false;

    if (query.files && query.files.length > 0) {
      const hasOverlap = query.files.some((f) =>
        learning.files.some(
          (lf) => lf.includes(f) || f.includes(lf),
        ),
      );
      if (!hasOverlap) return false;
    }

    if (query.symptom) {
      const needle = query.symptom.toLowerCase();
      const haystack = `${learning.symptom} ${learning.rootCause}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

/**
 * Increment hit count for a learning (called when a prior learning matches again).
 */
export async function incrementHitCount(
  cwd: string,
  id: string,
): Promise<void> {
  const path = learningPath(cwd, id);
  try {
    const raw = await readFile(path, 'utf-8');
    const learning = JSON.parse(raw) as DebugLearning;
    learning.hitCount++;
    await writeFile(path, JSON.stringify(learning, null, 2), 'utf-8');
  } catch {
    // Learning not found — ignore
  }
}
