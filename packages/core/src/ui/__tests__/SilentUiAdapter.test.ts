/**
 * @sunco/core - SilentUiAdapter Tests
 *
 * Verifies the no-op UI adapter for CI/test/--json mode.
 * Also tests createSkillUi bridge and createUiAdapter factory.
 */

import { describe, it, expect, vi } from 'vitest';
import { SilentUiAdapter } from '../adapters/SilentUiAdapter.js';
import { InkUiAdapter } from '../adapters/InkUiAdapter.js';
import { createSkillUi, createUiAdapter } from '../adapters/index.js';
import type { UiPattern, UiOutcome } from '../adapters/UiAdapter.js';

// ---------------------------------------------------------------------------
// SilentUiAdapter
// ---------------------------------------------------------------------------

describe('SilentUiAdapter', () => {
  it('mountPattern("entry") resolves immediately with no output', async () => {
    const adapter = new SilentUiAdapter();
    const pattern: UiPattern = { handleId: 'h1', kind: 'entry', data: { title: 'Test' } };
    const outcome = await adapter.mountPattern(pattern);
    expect(outcome.kind).toBe('entry');
    expect(outcome.data).toBeUndefined();
  });

  it('mountPattern("ask") with defaultId resolves with matching option', async () => {
    const adapter = new SilentUiAdapter();
    const pattern: UiPattern = {
      handleId: 'h2',
      kind: 'ask',
      data: {
        message: 'Pick one',
        options: [
          { id: 'opt-a', label: 'Option A' },
          { id: 'opt-b', label: 'Option B' },
        ],
        defaultId: 'opt-b',
      },
    };
    const outcome = await adapter.mountPattern(pattern);
    expect(outcome.kind).toBe('ask');
    expect(outcome.data).toEqual({
      selectedId: 'opt-b',
      selectedLabel: 'Option B',
      source: 'noninteractive',
    });
  });

  it('mountPattern("ask") without defaultId resolves with first option', async () => {
    const adapter = new SilentUiAdapter();
    const pattern: UiPattern = {
      handleId: 'h3',
      kind: 'ask',
      data: {
        message: 'Pick one',
        options: [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ],
      },
    };
    const outcome = await adapter.mountPattern(pattern);
    expect(outcome.kind).toBe('ask');
    expect(outcome.data).toEqual({
      selectedId: 'a',
      selectedLabel: 'Alpha',
      source: 'noninteractive',
    });
  });

  it('mountPattern("result") resolves with no output', async () => {
    const adapter = new SilentUiAdapter();
    const pattern: UiPattern = {
      handleId: 'h4',
      kind: 'result',
      data: { success: true, title: 'Done' },
    };
    const outcome = await adapter.mountPattern(pattern);
    expect(outcome.kind).toBe('result');
    expect(outcome.data).toBeUndefined();
  });

  it('mountPattern("progress") resolves with no output', async () => {
    const adapter = new SilentUiAdapter();
    const pattern: UiPattern = {
      handleId: 'h5',
      kind: 'progress',
      data: { title: 'Working...' },
    };
    const outcome = await adapter.mountPattern(pattern);
    expect(outcome.kind).toBe('progress');
    expect(outcome.data).toBeUndefined();
  });

  it('update() is a no-op (does not throw)', () => {
    const adapter = new SilentUiAdapter();
    expect(() => adapter.update('h1', { data: { completed: 5 } })).not.toThrow();
  });

  it('dispose() is a no-op (does not throw)', () => {
    const adapter = new SilentUiAdapter();
    expect(() => adapter.dispose('h1')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createSkillUi
// ---------------------------------------------------------------------------

describe('createSkillUi', () => {
  it('returns an object with entry, ask, progress, result methods', () => {
    const adapter = new SilentUiAdapter();
    const ui = createSkillUi(adapter);
    expect(typeof ui.entry).toBe('function');
    expect(typeof ui.ask).toBe('function');
    expect(typeof ui.progress).toBe('function');
    expect(typeof ui.result).toBe('function');
  });

  it('entry() delegates to adapter.mountPattern with kind "entry"', async () => {
    const adapter = new SilentUiAdapter();
    const spy = vi.spyOn(adapter, 'mountPattern');
    const ui = createSkillUi(adapter);
    await ui.entry({ title: 'Settings' });
    expect(spy).toHaveBeenCalledOnce();
    const call = spy.mock.calls[0]![0];
    expect(call.kind).toBe('entry');
    expect(call.data).toEqual({ title: 'Settings' });
  });

  it('ask() returns UiChoiceResult from adapter outcome', async () => {
    const adapter = new SilentUiAdapter();
    const ui = createSkillUi(adapter);
    const result = await ui.ask({
      message: 'Choose',
      options: [
        { id: 'x', label: 'X' },
        { id: 'y', label: 'Y' },
      ],
      defaultId: 'y',
    });
    expect(result.selectedId).toBe('y');
    expect(result.selectedLabel).toBe('Y');
    expect(result.source).toBe('noninteractive');
  });

  it('progress() returns a ProgressHandle where update/done are no-ops', () => {
    const adapter = new SilentUiAdapter();
    const ui = createSkillUi(adapter);
    const handle = ui.progress({ title: 'test' });
    expect(typeof handle.update).toBe('function');
    expect(typeof handle.done).toBe('function');
    // Should not throw
    expect(() => handle.update({ completed: 1 })).not.toThrow();
    expect(() => handle.done({ summary: 'done' })).not.toThrow();
  });

  it('result() delegates to adapter.mountPattern with kind "result"', async () => {
    const adapter = new SilentUiAdapter();
    const spy = vi.spyOn(adapter, 'mountPattern');
    const ui = createSkillUi(adapter);
    await ui.result({ success: true, title: 'Complete' });
    expect(spy).toHaveBeenCalledOnce();
    const call = spy.mock.calls[0]![0];
    expect(call.kind).toBe('result');
  });
});

// ---------------------------------------------------------------------------
// createUiAdapter
// ---------------------------------------------------------------------------

describe('createUiAdapter', () => {
  it('returns SilentUiAdapter when json=true', () => {
    const adapter = createUiAdapter({ json: true });
    expect(adapter).toBeInstanceOf(SilentUiAdapter);
  });

  it('returns SilentUiAdapter when silent=true', () => {
    const adapter = createUiAdapter({ silent: true });
    expect(adapter).toBeInstanceOf(SilentUiAdapter);
  });

  it('returns InkUiAdapter when not silent and not json (default)', () => {
    // Note: In non-TTY test environment, may fall back to SilentUiAdapter
    // depending on TTY detection logic. We test the explicit non-silent path.
    const adapter = createUiAdapter({ silent: false, json: false });
    // In test (non-TTY) environment, InkUiAdapter should still be returned
    // because flags explicitly say interactive mode.
    expect(adapter).toBeInstanceOf(InkUiAdapter);
  });
});
