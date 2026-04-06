/**
 * Session Recorder — cross-session progress tracking.
 *
 * Records session lifecycle and activity to .sun/sessions/ directory
 * using the FileStore API. Enables infinite execution by providing
 * context continuity across session boundaries.
 *
 * Requirements: LH-18
 */

import type { FileStoreApi } from '@sunco/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionRecord {
  /** Unique session identifier */
  id: string;
  /** ISO 8601 start timestamp */
  startedAt: string;
  /** ISO 8601 end timestamp (set on close) */
  endedAt?: string;
  /** Current phase number (if in a phase workflow) */
  phase?: number;
  /** Skills invoked during this session */
  skillsRun: string[];
  /** Tasks completed during this session */
  completedTasks: string[];
  /** Decisions made during this session */
  decisions: string[];
  /** Session lifecycle status */
  status: 'active' | 'completed' | 'paused' | 'crashed';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSIONS_CATEGORY = 'sessions';

function sessionFilename(id: string): string {
  return `session-${id}.json`;
}

function generateSessionId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// ---------------------------------------------------------------------------
// Session Lifecycle
// ---------------------------------------------------------------------------

/**
 * Start a new session. Creates a session record file in .sun/sessions/.
 *
 * @param fileStore - FileStore API for persistence
 * @returns The newly created SessionRecord
 */
export async function startSession(fileStore: FileStoreApi): Promise<SessionRecord> {
  const id = generateSessionId();
  const record: SessionRecord = {
    id,
    startedAt: new Date().toISOString(),
    skillsRun: [],
    completedTasks: [],
    decisions: [],
    status: 'active',
  };

  await fileStore.write(SESSIONS_CATEGORY, sessionFilename(id), JSON.stringify(record, null, 2));
  return record;
}

/**
 * End an existing session by setting its status and end timestamp.
 *
 * @param fileStore - FileStore API for persistence
 * @param sessionId - The session ID to close
 * @param status - Final status for the session
 */
export async function endSession(
  fileStore: FileStoreApi,
  sessionId: string,
  status: SessionRecord['status'],
): Promise<void> {
  const filename = sessionFilename(sessionId);
  const raw = await fileStore.read(SESSIONS_CATEGORY, filename);
  if (!raw) return; // session not found, nothing to close

  const record: SessionRecord = JSON.parse(raw);
  record.endedAt = new Date().toISOString();
  record.status = status;

  await fileStore.write(SESSIONS_CATEGORY, filename, JSON.stringify(record, null, 2));
}

/**
 * Get the most recent sessions, sorted by startedAt descending.
 *
 * LH-18 pattern: only load recent N sessions (default 3) to keep
 * context window usage minimal during rotation.
 *
 * @param fileStore - FileStore API for persistence
 * @param limit - Maximum number of sessions to return (default 3)
 * @returns Array of session records, newest first
 */
export async function getRecentSessions(
  fileStore: FileStoreApi,
  limit: number = 3,
): Promise<SessionRecord[]> {
  const filenames = await fileStore.list(SESSIONS_CATEGORY);

  // Read all session files
  const records: SessionRecord[] = [];
  for (const filename of filenames) {
    if (!filename.startsWith('session-') || !filename.endsWith('.json')) continue;
    const raw = await fileStore.read(SESSIONS_CATEGORY, filename);
    if (raw) {
      try {
        records.push(JSON.parse(raw));
      } catch {
        // Skip malformed session files
      }
    }
  }

  // Sort by startedAt descending (newest first)
  records.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return records.slice(0, limit);
}

/**
 * Record activity within an active session.
 *
 * Supports recording skills run, tasks completed, and decisions made.
 * Each call appends to the respective array without duplicates.
 *
 * @param fileStore - FileStore API for persistence
 * @param sessionId - The active session ID
 * @param activity - Activity to record (skill, task, or decision)
 */
export async function recordSessionActivity(
  fileStore: FileStoreApi,
  sessionId: string,
  activity: { skill?: string; task?: string; decision?: string },
): Promise<void> {
  const filename = sessionFilename(sessionId);
  const raw = await fileStore.read(SESSIONS_CATEGORY, filename);
  if (!raw) return; // session not found

  const record: SessionRecord = JSON.parse(raw);

  if (activity.skill && !record.skillsRun.includes(activity.skill)) {
    record.skillsRun.push(activity.skill);
  }
  if (activity.task && !record.completedTasks.includes(activity.task)) {
    record.completedTasks.push(activity.task);
  }
  if (activity.decision && !record.decisions.includes(activity.decision)) {
    record.decisions.push(activity.decision);
  }

  await fileStore.write(SESSIONS_CATEGORY, filename, JSON.stringify(record, null, 2));
}
