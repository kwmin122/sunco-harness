/**
 * Tests for selectCrossFamilyProviders pure helper.
 */

import { describe, it, expect } from 'vitest';
import { selectCrossFamilyProviders } from '../verify-layers.js';
import type { AgentFamily } from '@sunco/core';

function provider(id: string, family: AgentFamily) {
  return { id, family };
}

describe('selectCrossFamilyProviders', () => {
  it('returns claude + openai when both available', () => {
    const result = selectCrossFamilyProviders([
      provider('claude-code-cli', 'claude'),
      provider('codex-cli', 'openai'),
    ]);
    expect(result).toEqual({
      primary: 'claude-code-cli',
      secondary: 'codex-cli',
      isCrossFamily: true,
    });
  });

  it('returns claude + null when only claude available', () => {
    const result = selectCrossFamilyProviders([
      provider('claude-code-cli', 'claude'),
      provider('claude-sdk', 'claude'),
    ]);
    expect(result).toEqual({
      primary: 'claude-code-cli',
      secondary: null,
      isCrossFamily: false,
    });
  });

  it('returns null when no claude provider available', () => {
    const result = selectCrossFamilyProviders([
      provider('codex-cli', 'openai'),
    ]);
    expect(result).toBeNull();
  });

  it('prefers first openai entry when multiple present', () => {
    const result = selectCrossFamilyProviders([
      provider('claude-code-cli', 'claude'),
      provider('codex-cli', 'openai'),
      provider('gpt-sdk', 'openai'),
    ]);
    expect(result!.secondary).toBe('codex-cli');
  });

  it('returns empty-set null for empty input', () => {
    expect(selectCrossFamilyProviders([])).toBeNull();
  });
});
