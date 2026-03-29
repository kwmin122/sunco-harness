/**
 * AutoLock — crash detection and recovery for sunco auto mode.
 *
 * Writes a lock file at {sunDir}/auto.lock (JSON) on acquisition.
 * On next startup, checks if the process that held the lock is still alive.
 * If the PID is dead, returns crashed=true so the caller can recover.
 *
 * Also maintains an invocation history (capped at 20) used by StuckDetector.
 *
 * Requirements: OPS-01
 */

import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LockState {
  pid: number;
  phase: number;
  step: string;
  startedAt: string;
  history: Array<{ skillId: string; success: boolean; timestamp: string }>;
}

export interface LockCheckResult {
  exists: boolean;
  crashed: boolean;
  state: LockState | null;
}

// ---------------------------------------------------------------------------
// AutoLock
// ---------------------------------------------------------------------------

/**
 * Manages a JSON lock file at {sunDir}/auto.lock.
 * Provides acquire/release/check lifecycle with PID liveness detection.
 */
export class AutoLock {
  private readonly lockPath: string;

  /** Maximum history entries stored in the lock file (circular buffer). */
  static readonly HISTORY_LIMIT = 20;

  constructor(private readonly sunDir: string) {
    this.lockPath = join(sunDir, 'auto.lock');
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Write lock file with current PID, phase, step, and timestamp.
   * If a lock already exists it is overwritten.
   */
  async acquire(phase: number, step: string): Promise<void> {
    const state: LockState = {
      pid: process.pid,
      phase,
      step,
      startedAt: new Date().toISOString(),
      history: [],
    };
    await writeFile(this.lockPath, JSON.stringify(state, null, 2), 'utf8');
  }

  /**
   * Overwrite the step field in the existing lock.
   * Creates a fresh lock (with empty history) if none exists yet.
   */
  async updateStep(phase: number, step: string): Promise<void> {
    const existing = await this._readLock();
    const state: LockState = existing
      ? { ...existing, phase, step }
      : { pid: process.pid, phase, step, startedAt: new Date().toISOString(), history: [] };
    await writeFile(this.lockPath, JSON.stringify(state, null, 2), 'utf8');
  }

  /**
   * Delete the lock file on clean exit.
   * No-ops silently if the file does not exist.
   */
  async release(): Promise<void> {
    try {
      await unlink(this.lockPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Crash detection
  // ---------------------------------------------------------------------------

  /**
   * Check whether a stale lock from a dead process exists.
   *
   * - exists=false  → no lock file
   * - crashed=true  → lock exists, PID is dead
   * - crashed=false → lock exists, PID is still alive
   */
  async check(): Promise<LockCheckResult> {
    const state = await this._readLock();

    if (state === null) {
      return { exists: false, crashed: false, state: null };
    }

    const alive = this._isPidAlive(state.pid);
    return { exists: true, crashed: !alive, state };
  }

  // ---------------------------------------------------------------------------
  // History (used by StuckDetector)
  // ---------------------------------------------------------------------------

  /**
   * Append a skill invocation record to the history array.
   * Caps at HISTORY_LIMIT entries (oldest dropped first).
   * Creates a lock entry if none exists (phase=0, step='unknown').
   */
  async recordInvocation(skillId: string, success: boolean): Promise<void> {
    const existing = await this._readLock();
    const state: LockState = existing ?? {
      pid: process.pid,
      phase: 0,
      step: 'unknown',
      startedAt: new Date().toISOString(),
      history: [],
    };

    state.history.push({ skillId, success, timestamp: new Date().toISOString() });

    // Enforce circular buffer cap
    if (state.history.length > AutoLock.HISTORY_LIMIT) {
      state.history.splice(0, state.history.length - AutoLock.HISTORY_LIMIT);
    }

    await writeFile(this.lockPath, JSON.stringify(state, null, 2), 'utf8');
  }

  /**
   * Return the history array from the current lock, or [] if no lock.
   */
  async getHistory(): Promise<LockState['history']> {
    const state = await this._readLock();
    return state?.history ?? [];
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Read and parse the lock file. Returns null on any error (not found, corrupt).
   */
  private async _readLock(): Promise<LockState | null> {
    try {
      const raw = await readFile(this.lockPath, 'utf8');
      return JSON.parse(raw) as LockState;
    } catch {
      return null;
    }
  }

  /**
   * Check PID liveness using signal 0.
   * `process.kill(pid, 0)` throws when the process does not exist.
   */
  private _isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
