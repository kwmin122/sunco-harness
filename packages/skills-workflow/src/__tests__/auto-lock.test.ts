/**
 * Unit tests for AutoLock — crash detection and recovery.
 *
 * Uses a real temporary directory via Node's os.tmpdir() so tests
 * exercise actual file I/O without mocking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AutoLock } from '../shared/auto-lock.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let lock: AutoLock;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'sunco-auto-lock-test-'));
  lock = new AutoLock(tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutoLock', () => {
  it('acquire() writes lock file with current PID and correct fields', async () => {
    await lock.acquire(3, 'execute');

    const result = await lock.check();
    expect(result.exists).toBe(true);
    expect(result.state).not.toBeNull();
    expect(result.state!.pid).toBe(process.pid);
    expect(result.state!.phase).toBe(3);
    expect(result.state!.step).toBe('execute');
    expect(typeof result.state!.startedAt).toBe('string');
    expect(Array.isArray(result.state!.history)).toBe(true);
  });

  it('updateStep() changes the step field without losing other data', async () => {
    await lock.acquire(1, 'init');
    await lock.updateStep(1, 'verify');

    const result = await lock.check();
    expect(result.state!.step).toBe('verify');
    expect(result.state!.phase).toBe(1);
    // PID should still be present
    expect(result.state!.pid).toBe(process.pid);
  });

  it('release() deletes the lock file', async () => {
    await lock.acquire(2, 'plan');
    await lock.release();

    const result = await lock.check();
    expect(result.exists).toBe(false);
    expect(result.state).toBeNull();
  });

  it('release() is a no-op when no lock file exists', async () => {
    // Should not throw
    await expect(lock.release()).resolves.toBeUndefined();
  });

  it('check() returns crashed=true for a dead PID (999999)', async () => {
    // Manually create a lock with a PID that is almost certainly dead
    await lock.acquire(1, 'test');
    // Overwrite with dead PID by writing directly
    const { writeFile } = await import('node:fs/promises');
    const lockPath = join(tmpDir, 'auto.lock');
    await writeFile(
      lockPath,
      JSON.stringify({ pid: 999999, phase: 1, step: 'test', startedAt: new Date().toISOString(), history: [] }),
      'utf8',
    );

    const result = await lock.check();
    expect(result.exists).toBe(true);
    expect(result.crashed).toBe(true);
  });

  it('check() returns crashed=false for the current process PID', async () => {
    await lock.acquire(2, 'running');

    const result = await lock.check();
    expect(result.exists).toBe(true);
    expect(result.crashed).toBe(false);
  });

  it('check() returns exists=false when no lock file is present', async () => {
    const result = await lock.check();
    expect(result.exists).toBe(false);
    expect(result.crashed).toBe(false);
    expect(result.state).toBeNull();
  });

  it('recordInvocation() appends entries to history', async () => {
    await lock.acquire(1, 'start');

    await lock.recordInvocation('workflow.execute', true);
    await lock.recordInvocation('workflow.verify', false);

    const history = await lock.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].skillId).toBe('workflow.execute');
    expect(history[0].success).toBe(true);
    expect(history[1].skillId).toBe('workflow.verify');
    expect(history[1].success).toBe(false);
  });

  it('history is capped at 20 entries (circular buffer)', async () => {
    await lock.acquire(1, 'start');

    // Record 25 entries
    for (let i = 0; i < 25; i++) {
      await lock.recordInvocation(`skill-${i}`, true);
    }

    const history = await lock.getHistory();
    expect(history).toHaveLength(AutoLock.HISTORY_LIMIT);
    // Oldest entries (0-4) should be gone; latest should be skill-24
    expect(history[history.length - 1].skillId).toBe('skill-24');
    expect(history[0].skillId).toBe('skill-5');
  });

  it('getHistory() returns empty array when no lock exists', async () => {
    const history = await lock.getHistory();
    expect(history).toEqual([]);
  });
});
