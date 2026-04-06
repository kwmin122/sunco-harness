/**
 * Tests for session-recorder.ts — cross-session progress tracking.
 * Requirements: LH-18
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileStoreApi } from '@sunco/core';
import {
  startSession,
  endSession,
  getRecentSessions,
  recordSessionActivity,
} from '../shared/session-recorder.js';

// ---------------------------------------------------------------------------
// Mock FileStore
// ---------------------------------------------------------------------------

function createMockFileStore(initialStore: Record<string, Record<string, string>> = {}): FileStoreApi {
  // Deep-clone initial data: category -> filename -> content
  const store: Record<string, Record<string, string>> = {};
  for (const [cat, files] of Object.entries(initialStore)) {
    store[cat] = { ...files };
  }

  return {
    read: vi.fn(async (category: string, filename: string) => {
      return store[category]?.[filename] ?? undefined;
    }),
    write: vi.fn(async (category: string, filename: string, content: string) => {
      if (!store[category]) store[category] = {};
      store[category][filename] = content;
    }),
    delete: vi.fn(async (category: string, filename: string) => {
      const existed = !!store[category]?.[filename];
      if (store[category]) delete store[category][filename];
      return existed;
    }),
    list: vi.fn(async (category: string) => {
      return Object.keys(store[category] ?? {});
    }),
    exists: vi.fn(async (category: string, filename: string) => {
      return !!store[category]?.[filename];
    }),
  };
}

// ---------------------------------------------------------------------------
// startSession
// ---------------------------------------------------------------------------

describe('startSession', () => {
  it('creates a new session record', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    expect(session.id).toBeTruthy();
    expect(session.status).toBe('active');
    expect(session.startedAt).toBeTruthy();
    expect(session.skillsRun).toEqual([]);
    expect(session.completedTasks).toEqual([]);
    expect(session.decisions).toEqual([]);
    expect(session.endedAt).toBeUndefined();
  });

  it('writes session file to sessions category', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    expect(fs.write).toHaveBeenCalledWith(
      'sessions',
      expect.stringMatching(/^session-.*\.json$/),
      expect.any(String),
    );

    // Verify the written content is valid JSON matching the session
    const writtenContent = vi.mocked(fs.write).mock.calls[0][2];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.id).toBe(session.id);
    expect(parsed.status).toBe('active');
  });

  it('generates unique session IDs', async () => {
    const fs = createMockFileStore();
    const s1 = await startSession(fs);
    // Ensure a tiny time gap for unique timestamps
    await new Promise((r) => setTimeout(r, 2));
    const s2 = await startSession(fs);
    expect(s1.id).not.toBe(s2.id);
  });
});

// ---------------------------------------------------------------------------
// endSession
// ---------------------------------------------------------------------------

describe('endSession', () => {
  it('sets status and endedAt on an active session', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    await endSession(fs, session.id, 'completed');

    // Read back the session file
    const raw = await fs.read('sessions', `session-${session.id}.json`);
    expect(raw).toBeTruthy();
    const updated = JSON.parse(raw!);
    expect(updated.status).toBe('completed');
    expect(updated.endedAt).toBeTruthy();
  });

  it('handles paused status', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    await endSession(fs, session.id, 'paused');

    const raw = await fs.read('sessions', `session-${session.id}.json`);
    const updated = JSON.parse(raw!);
    expect(updated.status).toBe('paused');
  });

  it('handles crashed status', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    await endSession(fs, session.id, 'crashed');

    const raw = await fs.read('sessions', `session-${session.id}.json`);
    const updated = JSON.parse(raw!);
    expect(updated.status).toBe('crashed');
  });

  it('does nothing for non-existent session', async () => {
    const fs = createMockFileStore();
    // Should not throw
    await endSession(fs, 'nonexistent-id', 'completed');
    expect(fs.write).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// recordSessionActivity
// ---------------------------------------------------------------------------

describe('recordSessionActivity', () => {
  it('records a skill run', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    await recordSessionActivity(fs, session.id, { skill: 'workflow.status' });

    const raw = await fs.read('sessions', `session-${session.id}.json`);
    const updated = JSON.parse(raw!);
    expect(updated.skillsRun).toContain('workflow.status');
  });

  it('records a completed task', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    await recordSessionActivity(fs, session.id, { task: 'implement-auth' });

    const raw = await fs.read('sessions', `session-${session.id}.json`);
    const updated = JSON.parse(raw!);
    expect(updated.completedTasks).toContain('implement-auth');
  });

  it('records a decision', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    await recordSessionActivity(fs, session.id, { decision: 'Use JWT for auth' });

    const raw = await fs.read('sessions', `session-${session.id}.json`);
    const updated = JSON.parse(raw!);
    expect(updated.decisions).toContain('Use JWT for auth');
  });

  it('records multiple activity types in one call', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    await recordSessionActivity(fs, session.id, {
      skill: 'workflow.execute',
      task: 'setup-db',
      decision: 'Use PostgreSQL',
    });

    const raw = await fs.read('sessions', `session-${session.id}.json`);
    const updated = JSON.parse(raw!);
    expect(updated.skillsRun).toContain('workflow.execute');
    expect(updated.completedTasks).toContain('setup-db');
    expect(updated.decisions).toContain('Use PostgreSQL');
  });

  it('does not duplicate entries', async () => {
    const fs = createMockFileStore();
    const session = await startSession(fs);

    await recordSessionActivity(fs, session.id, { skill: 'workflow.status' });
    await recordSessionActivity(fs, session.id, { skill: 'workflow.status' });

    const raw = await fs.read('sessions', `session-${session.id}.json`);
    const updated = JSON.parse(raw!);
    expect(updated.skillsRun.filter((s: string) => s === 'workflow.status')).toHaveLength(1);
  });

  it('does nothing for non-existent session', async () => {
    const fs = createMockFileStore();
    await recordSessionActivity(fs, 'nonexistent', { skill: 'test' });
    // Should not throw, write should not be called (no session to update)
    expect(fs.write).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getRecentSessions
// ---------------------------------------------------------------------------

describe('getRecentSessions', () => {
  it('returns empty array when no sessions exist', async () => {
    const fs = createMockFileStore();
    const sessions = await getRecentSessions(fs);
    expect(sessions).toEqual([]);
  });

  it('returns sessions sorted by startedAt descending', async () => {
    const fs = createMockFileStore({
      sessions: {
        'session-2026-01-01T00-00-00-000Z.json': JSON.stringify({
          id: '2026-01-01T00-00-00-000Z',
          startedAt: '2026-01-01T00:00:00.000Z',
          skillsRun: [],
          completedTasks: [],
          decisions: [],
          status: 'completed',
        }),
        'session-2026-01-03T00-00-00-000Z.json': JSON.stringify({
          id: '2026-01-03T00-00-00-000Z',
          startedAt: '2026-01-03T00:00:00.000Z',
          skillsRun: [],
          completedTasks: [],
          decisions: [],
          status: 'active',
        }),
        'session-2026-01-02T00-00-00-000Z.json': JSON.stringify({
          id: '2026-01-02T00-00-00-000Z',
          startedAt: '2026-01-02T00:00:00.000Z',
          skillsRun: [],
          completedTasks: [],
          decisions: [],
          status: 'paused',
        }),
      },
    });

    const sessions = await getRecentSessions(fs);
    expect(sessions).toHaveLength(3);
    expect(sessions[0].id).toBe('2026-01-03T00-00-00-000Z');
    expect(sessions[1].id).toBe('2026-01-02T00-00-00-000Z');
    expect(sessions[2].id).toBe('2026-01-01T00-00-00-000Z');
  });

  it('limits results to specified count (default 3)', async () => {
    const fs = createMockFileStore({
      sessions: {
        'session-s1.json': JSON.stringify({
          id: 's1', startedAt: '2026-01-01T00:00:00Z',
          skillsRun: [], completedTasks: [], decisions: [], status: 'completed',
        }),
        'session-s2.json': JSON.stringify({
          id: 's2', startedAt: '2026-01-02T00:00:00Z',
          skillsRun: [], completedTasks: [], decisions: [], status: 'completed',
        }),
        'session-s3.json': JSON.stringify({
          id: 's3', startedAt: '2026-01-03T00:00:00Z',
          skillsRun: [], completedTasks: [], decisions: [], status: 'completed',
        }),
        'session-s4.json': JSON.stringify({
          id: 's4', startedAt: '2026-01-04T00:00:00Z',
          skillsRun: [], completedTasks: [], decisions: [], status: 'active',
        }),
      },
    });

    const sessions = await getRecentSessions(fs);
    expect(sessions).toHaveLength(3);
    expect(sessions[0].id).toBe('s4'); // newest first
  });

  it('respects custom limit', async () => {
    const fs = createMockFileStore({
      sessions: {
        'session-s1.json': JSON.stringify({
          id: 's1', startedAt: '2026-01-01T00:00:00Z',
          skillsRun: [], completedTasks: [], decisions: [], status: 'completed',
        }),
        'session-s2.json': JSON.stringify({
          id: 's2', startedAt: '2026-01-02T00:00:00Z',
          skillsRun: [], completedTasks: [], decisions: [], status: 'completed',
        }),
      },
    });

    const sessions = await getRecentSessions(fs, 1);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('s2');
  });

  it('skips non-session files in the directory', async () => {
    const fs = createMockFileStore({
      sessions: {
        'session-s1.json': JSON.stringify({
          id: 's1', startedAt: '2026-01-01T00:00:00Z',
          skillsRun: [], completedTasks: [], decisions: [], status: 'completed',
        }),
        'README.md': '# Sessions',
        'config.json': '{}',
      },
    });

    const sessions = await getRecentSessions(fs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('s1');
  });

  it('skips malformed JSON files gracefully', async () => {
    const fs = createMockFileStore({
      sessions: {
        'session-good.json': JSON.stringify({
          id: 'good', startedAt: '2026-01-01T00:00:00Z',
          skillsRun: [], completedTasks: [], decisions: [], status: 'completed',
        }),
        'session-bad.json': '{ invalid json',
      },
    });

    const sessions = await getRecentSessions(fs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('good');
  });
});
