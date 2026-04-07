import { describe, it, expect } from 'vitest';
import {
  createIronLawGate,
  createIronLawState,
  confirmRootCause,
  rejectHypothesis,
  addHypothesis,
  isEditBlocked,
  HookAbortError,
} from '../shared/iron-law-gate.js';

describe('iron-law-gate', () => {
  describe('createIronLawState', () => {
    it('creates initial state with edits blocked', () => {
      const state = createIronLawState(23);
      expect(state.rootCauseConfirmed).toBe(false);
      expect(state.editBlocked).toBe(true);
      expect(state.hypotheses).toEqual([]);
      expect(state.phase).toBe(23);
    });
  });

  describe('isEditBlocked', () => {
    it('returns true when root cause not confirmed and edits blocked', () => {
      const state = createIronLawState(1);
      expect(isEditBlocked(state)).toBe(true);
    });

    it('returns false after root cause is confirmed', () => {
      let state = createIronLawState(1);
      state = addHypothesis(state, 'Missing import');
      state = confirmRootCause(state, 'Missing import');
      expect(isEditBlocked(state)).toBe(false);
    });
  });

  describe('addHypothesis', () => {
    it('adds a pending hypothesis', () => {
      let state = createIronLawState(1);
      state = addHypothesis(state, 'Type mismatch in handler');
      expect(state.hypotheses).toHaveLength(1);
      expect(state.hypotheses[0].description).toBe('Type mismatch in handler');
      expect(state.hypotheses[0].tested).toBe(false);
      expect(state.hypotheses[0].result).toBe('pending');
    });
  });

  describe('confirmRootCause', () => {
    it('unblocks edits and marks hypothesis as confirmed', () => {
      let state = createIronLawState(1);
      state = addHypothesis(state, 'Wrong API');
      state = confirmRootCause(state, 'Wrong API');
      expect(state.rootCauseConfirmed).toBe(true);
      expect(state.editBlocked).toBe(false);
      expect(state.hypotheses[0].result).toBe('confirmed');
    });
  });

  describe('rejectHypothesis', () => {
    it('marks hypothesis as rejected, keeps edits blocked', () => {
      let state = createIronLawState(1);
      state = addHypothesis(state, 'Cache issue');
      state = rejectHypothesis(state, 'Cache issue');
      expect(state.hypotheses[0].result).toBe('rejected');
      expect(state.editBlocked).toBe(true);
      expect(state.rootCauseConfirmed).toBe(false);
    });
  });

  describe('createIronLawGate (hook)', () => {
    it('creates a hook with PreToolUse event and canAbort', () => {
      const hook = createIronLawGate(() => createIronLawState(1));
      expect(hook.event).toBe('PreToolUse');
      expect(hook.name).toBe('iron-law-gate');
      expect(hook.enabled).toBe(true);
      expect(hook.canAbort).toBe(true);
    });

    it('throws HookAbortError when Edit is called without root cause', async () => {
      const state = createIronLawState(1);
      const hook = createIronLawGate(() => state);

      await expect(
        hook.handler({ toolName: 'Edit', timestamp: new Date().toISOString() }),
      ).rejects.toThrow(HookAbortError);
    });

    it('throws HookAbortError when Write is called without root cause', async () => {
      const state = createIronLawState(1);
      const hook = createIronLawGate(() => state);

      await expect(
        hook.handler({ toolName: 'Write', timestamp: new Date().toISOString() }),
      ).rejects.toThrow(HookAbortError);
    });

    it('allows Edit after root cause is confirmed', async () => {
      let state = createIronLawState(1);
      state = addHypothesis(state, 'Wrong import');
      state = confirmRootCause(state, 'Wrong import');

      const hook = createIronLawGate(() => state);
      await expect(
        hook.handler({ toolName: 'Edit', timestamp: new Date().toISOString() }),
      ).resolves.toBeUndefined();
    });

    it('allows non-Edit/Write tools even when blocked', async () => {
      const state = createIronLawState(1);
      const hook = createIronLawGate(() => state);

      await expect(
        hook.handler({ toolName: 'Read', timestamp: new Date().toISOString() }),
      ).resolves.toBeUndefined();
    });

    it('allows when no toolName provided', async () => {
      const state = createIronLawState(1);
      const hook = createIronLawGate(() => state);

      await expect(
        hook.handler({ timestamp: new Date().toISOString() }),
      ).resolves.toBeUndefined();
    });
  });
});
