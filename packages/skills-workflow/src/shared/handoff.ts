/**
 * Handoff module - HANDOFF.json Zod schema, read/write via FileStoreApi
 */

import { z } from 'zod';
import type { FileStoreApi } from '@sunco/core';

export const HandoffSchema = z.object({
  version: z.literal(1),
  timestamp: z.string(),
  currentPhase: z.number().nullable(),
  currentPhaseName: z.string().nullable(),
  currentPlan: z.string().nullable(),
  completedTasks: z.array(z.string()),
  inProgressTask: z.string().nullable(),
  pendingDecisions: z.array(z.string()),
  blockers: z.array(z.string()),
  branch: z.string(),
  uncommittedChanges: z.boolean(),
  uncommittedFiles: z.array(z.string()),
  lastSkillId: z.string().nullable(),
  lastSkillResult: z.enum(['success', 'failure']).nullable(),
});

export type Handoff = z.infer<typeof HandoffSchema>;

/**
 * Write a handoff object to .sun/HANDOFF.json
 */
export async function writeHandoff(fileStore: FileStoreApi, handoff: Handoff): Promise<void> {
  const content = JSON.stringify(handoff, null, 2);
  await fileStore.write('', 'HANDOFF.json', content);
}

/**
 * Read and validate HANDOFF.json from .sun/. Returns null if not found or invalid.
 */
export async function readHandoff(fileStore: FileStoreApi): Promise<Handoff | null> {
  const raw = await fileStore.read('', 'HANDOFF.json');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const result = HandoffSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
