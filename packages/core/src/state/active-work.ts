/**
 * Read/write `.sun/active-work.json` — dashboard source for status/next (Phase 27 Plan A).
 */

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  ActiveWorkSchema,
  type ActiveWork,
  type ActiveWorkPatch,
  type BackgroundWorkItem,
  type RoutingMiss,
} from './active-work.types.js';

export const ACTIVE_WORK_PATH = '.sun/active-work.json';

const MAX_BACKGROUND = 100;
const MAX_RECENT_SKILLS = 50;
const MAX_ROUTING_MISSES = 100;

/** Empty document; `updated_at` at epoch 0 until first write */
export const DEFAULT_ACTIVE_WORK: ActiveWork = {
  updated_at: '1970-01-01T00:00:00.000Z',
  active_phase: null,
  background_work: [],
  blocked_on: null,
  next_recommended_action: null,
  recent_skill_calls: [],
  routing_misses: [],
};

function activeWorkFilePath(cwd: string): string {
  return join(cwd, ACTIVE_WORK_PATH);
}

function logActiveWorkReadError(message: string): void {
  process.stderr.write(`[sunco:active-work] ${message}\n`);
}

/**
 * Read active-work.json; missing or invalid file yields DEFAULT_ACTIVE_WORK (never throws).
 */
export async function readActiveWork(cwd: string): Promise<ActiveWork> {
  const filePath = activeWorkFilePath(cwd);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === 'ENOENT') {
      return { ...DEFAULT_ACTIVE_WORK };
    }
    logActiveWorkReadError(`read failed: ${String(err)}`);
    return { ...DEFAULT_ACTIVE_WORK };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (e) {
    logActiveWorkReadError(`invalid JSON: ${String(e)}`);
    return { ...DEFAULT_ACTIVE_WORK };
  }

  const result = ActiveWorkSchema.safeParse(parsed);
  if (!result.success) {
    logActiveWorkReadError(`schema validation failed: ${result.error.message}`);
    return { ...DEFAULT_ACTIVE_WORK };
  }

  return result.data;
}

function truncateArrays(work: ActiveWork): ActiveWork {
  return {
    ...work,
    background_work: work.background_work.slice(-MAX_BACKGROUND),
    recent_skill_calls: work.recent_skill_calls.slice(-MAX_RECENT_SKILLS),
    routing_misses: work.routing_misses.slice(-MAX_ROUTING_MISSES),
  };
}

/**
 * Merge patch into current state, set `updated_at`, validate, atomic write.
 */
export async function writeActiveWork(cwd: string, patch: ActiveWorkPatch): Promise<void> {
  const current = await readActiveWork(cwd);
  const merged: ActiveWork = truncateArrays({
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  });

  const validated = ActiveWorkSchema.parse(merged);

  const finalPath = activeWorkFilePath(cwd);
  await mkdir(dirname(finalPath), { recursive: true });

  const tmpName = `.active-work.${randomBytes(8).toString('hex')}.tmp`;
  const tmpPath = join(dirname(finalPath), tmpName);

  const payload = `${JSON.stringify(validated, null, 2)}\n`;
  await writeFile(tmpPath, payload, 'utf-8');
  await rename(tmpPath, finalPath);
}

/**
 * Append one background work item (keeps last 100).
 */
export async function appendBackgroundWork(cwd: string, item: BackgroundWorkItem): Promise<void> {
  const current = await readActiveWork(cwd);
  await writeActiveWork(cwd, {
    background_work: [...current.background_work, item],
  });
}

/**
 * Append one routing miss row (Plan B); keeps last 100.
 */
export async function appendRoutingMiss(cwd: string, miss: RoutingMiss): Promise<void> {
  const current = await readActiveWork(cwd);
  await writeActiveWork(cwd, {
    routing_misses: [...current.routing_misses, miss],
  });
}
