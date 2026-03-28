/**
 * @sunco/core - askText() UI Tests
 *
 * Tests for the askText() UI pattern: freeform text input via SkillUi.
 * Covers SilentUiAdapter, createSkillUi bridge, and InkUiAdapter non-TTY fallback.
 */

import { describe, it, expect } from 'vitest';
import { SilentUiAdapter } from '../adapters/SilentUiAdapter.js';
import { InkUiAdapter } from '../adapters/InkUiAdapter.js';
import { createSkillUi } from '../adapters/index.js';
import type { UiPattern } from '../adapters/UiAdapter.js';

// ---------------------------------------------------------------------------
// SilentUiAdapter askText
// ---------------------------------------------------------------------------

describe('SilentUiAdapter askText', () => {
  it('returns defaultValue as text with source "noninteractive"', async () => {
    const adapter = new SilentUiAdapter();
    const pattern: UiPattern = {
      handleId: 'h-text-1',
      kind: 'askText',
      data: { message: 'Q', defaultValue: 'hello' },
    };
    const outcome = await adapter.mountPattern(pattern);
    expect(outcome.kind).toBe('askText');
    expect(outcome.data).toEqual({
      text: 'hello',
      source: 'noninteractive',
    });
  });

  it('returns empty string when no defaultValue provided', async () => {
    const adapter = new SilentUiAdapter();
    const pattern: UiPattern = {
      handleId: 'h-text-2',
      kind: 'askText',
      data: { message: 'Q' },
    };
    const outcome = await adapter.mountPattern(pattern);
    expect(outcome.kind).toBe('askText');
    expect(outcome.data).toEqual({
      text: '',
      source: 'noninteractive',
    });
  });
});

// ---------------------------------------------------------------------------
// createSkillUi bridge askText
// ---------------------------------------------------------------------------

describe('createSkillUi askText bridge', () => {
  it('delegates askText to SilentUiAdapter and returns UiTextResult', async () => {
    const adapter = new SilentUiAdapter();
    const ui = createSkillUi(adapter);
    const result = await ui.askText({
      message: 'Describe:',
      defaultValue: 'test',
    });
    expect(result).toEqual({
      text: 'test',
      source: 'noninteractive',
    });
  });
});

// ---------------------------------------------------------------------------
// InkUiAdapter non-TTY fallback
// ---------------------------------------------------------------------------

describe('InkUiAdapter askText non-TTY fallback', () => {
  it('returns defaultValue with source "default" in non-TTY mode', async () => {
    const adapter = new InkUiAdapter();
    // In test environment, process.stdout.isTTY is falsy, so non-TTY fallback is used
    const pattern: UiPattern = {
      handleId: 'h-text-ink-1',
      kind: 'askText',
      data: { message: 'Enter text:', defaultValue: 'fallback-value' },
    };
    const outcome = await adapter.mountPattern(pattern);
    expect(outcome.kind).toBe('askText');
    expect(outcome.data).toEqual({
      text: 'fallback-value',
      source: 'default',
    });
  });
});
