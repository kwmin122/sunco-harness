/**
 * @sunco/core - UI Interaction Patterns Tests
 *
 * Tests all 4 lifecycle pattern behaviors through createSkillUi(SilentUiAdapter).
 * Exercises the full pipeline: SkillUi -> createSkillUi bridge -> SilentUiAdapter.
 *
 * Also verifies InkUiAdapter imports all pattern components
 * and dispatches to correct patterns.
 */

import { describe, it, expect } from 'vitest';
import { SilentUiAdapter } from '../adapters/SilentUiAdapter.js';
import { InkUiAdapter } from '../adapters/InkUiAdapter.js';
import { createSkillUi } from '../adapters/index.js';
import type { Recommendation } from '../../recommend/types.js';

// ---------------------------------------------------------------------------
// Behavioral Tests via SilentUiAdapter (full pipeline)
// ---------------------------------------------------------------------------

describe('Lifecycle Patterns via createSkillUi(SilentUiAdapter)', () => {
  const ui = createSkillUi(new SilentUiAdapter());

  describe('entry()', () => {
    it('resolves without error', async () => {
      await expect(ui.entry({ title: 'Test' })).resolves.toBeUndefined();
    });

    it('resolves with description', async () => {
      await expect(
        ui.entry({ title: 'Test', description: 'A test skill' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('ask()', () => {
    it('returns default option when defaultId is provided', async () => {
      const result = await ui.ask({
        message: 'Pick',
        options: [
          { id: 'a', label: 'A', isRecommended: true },
          { id: 'b', label: 'B' },
        ],
        defaultId: 'a',
      });
      expect(result).toEqual({
        selectedId: 'a',
        selectedLabel: 'A',
        source: 'noninteractive',
      });
    });

    it('returns first option when no defaultId', async () => {
      const result = await ui.ask({
        message: 'Pick',
        options: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      });
      expect(result).toEqual({
        selectedId: 'a',
        selectedLabel: 'A',
        source: 'noninteractive',
      });
    });

    it('returns correct option from 3+ choices', async () => {
      const result = await ui.ask({
        message: 'Choose mode',
        options: [
          { id: 'fast', label: 'Fast' },
          { id: 'balanced', label: 'Balanced', isRecommended: true },
          { id: 'thorough', label: 'Thorough' },
        ],
        defaultId: 'balanced',
      });
      expect(result.selectedId).toBe('balanced');
      expect(result.selectedLabel).toBe('Balanced');
    });
  });

  describe('progress()', () => {
    it('update() does not throw', () => {
      const handle = ui.progress({ title: 'Working' });
      expect(() => handle.update({ completed: 5 })).not.toThrow();
    });

    it('update() with message does not throw', () => {
      const handle = ui.progress({ title: 'Scanning', total: 100 });
      expect(() => handle.update({ completed: 50, message: 'halfway' })).not.toThrow();
    });

    it('done() does not throw', () => {
      const handle = ui.progress({ title: 'Working' });
      expect(() => handle.done({ summary: 'Done' })).not.toThrow();
    });

    it('full lifecycle: update then done', () => {
      const handle = ui.progress({ title: 'Building', total: 10 });
      expect(() => {
        handle.update({ completed: 3 });
        handle.update({ completed: 7, message: 'almost there' });
        handle.done({ summary: 'Build complete' });
      }).not.toThrow();
    });
  });

  describe('result()', () => {
    it('resolves without error for success', async () => {
      await expect(
        ui.result({ success: true, title: 'Done', summary: 'Passed' }),
      ).resolves.toBeUndefined();
    });

    it('resolves without error for failure', async () => {
      await expect(
        ui.result({ success: false, title: 'Failed', summary: 'Error occurred' }),
      ).resolves.toBeUndefined();
    });

    it('resolves with recommendations', async () => {
      const recommendations: Recommendation[] = [
        {
          skillId: 'verify',
          title: 'Run verification',
          reason: 'Check results',
          priority: 'high',
          isDefault: true,
        },
      ];
      await expect(
        ui.result({
          success: true,
          title: 'Done',
          summary: 'Passed',
          recommendations,
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves with details and warnings', async () => {
      await expect(
        ui.result({
          success: true,
          title: 'Lint Complete',
          summary: '12 files checked',
          details: ['src/index.ts: clean', 'src/config.ts: clean'],
          warnings: ['src/utils.ts: unused import'],
        }),
      ).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// InkUiAdapter Structural Tests
// ---------------------------------------------------------------------------

describe('InkUiAdapter structural verification', () => {
  it('imports and dispatches to all 4 pattern kinds', async () => {
    const adapter = new InkUiAdapter();

    // entry
    const entryOutcome = await adapter.mountPattern({
      handleId: 'test-1',
      kind: 'entry',
      data: { title: 'Test Entry' },
    });
    expect(entryOutcome.kind).toBe('entry');

    // ask
    const askOutcome = await adapter.mountPattern({
      handleId: 'test-2',
      kind: 'ask',
      data: {
        message: 'Pick',
        options: [{ id: 'a', label: 'A' }],
        defaultId: 'a',
      },
    });
    expect(askOutcome.kind).toBe('ask');
    expect(askOutcome.data).toBeDefined();

    // progress
    const progressOutcome = await adapter.mountPattern({
      handleId: 'test-3',
      kind: 'progress',
      data: { title: 'Working' },
    });
    expect(progressOutcome.kind).toBe('progress');

    // result
    const resultOutcome = await adapter.mountPattern({
      handleId: 'test-4',
      kind: 'result',
      data: { success: true, title: 'Done' },
    });
    expect(resultOutcome.kind).toBe('result');
  });

  it('update() does not throw for active progress', () => {
    const adapter = new InkUiAdapter();
    // Mount progress first
    void adapter.mountPattern({
      handleId: 'prog-1',
      kind: 'progress',
      data: { title: 'Working' },
    });
    expect(() => adapter.update('prog-1', { data: { completed: 5 } })).not.toThrow();
  });

  it('dispose() does not throw', () => {
    const adapter = new InkUiAdapter();
    void adapter.mountPattern({
      handleId: 'prog-2',
      kind: 'progress',
      data: { title: 'Working' },
    });
    expect(() => adapter.dispose('prog-2')).not.toThrow();
  });
});
