/**
 * Tests for project preset resolution.
 * Verifies ecosystem-to-preset matching logic.
 */
import { describe, it, expect } from 'vitest';
import { resolvePreset, PROJECT_PRESETS } from '../presets.js';

describe('PROJECT_PRESETS', () => {
  it('has at least 6 preset entries', () => {
    expect(PROJECT_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it('each preset has id, name, activeSkills, and matchEcosystems', () => {
    for (const preset of PROJECT_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(typeof preset.name).toBe('string');
      expect(Array.isArray(preset.activeSkills)).toBe(true);
      expect(preset.activeSkills.length).toBeGreaterThan(0);
      expect(Array.isArray(preset.matchEcosystems)).toBe(true);
    }
  });
});

describe('resolvePreset', () => {
  it('resolves ["nodejs", "typescript"] to typescript-node preset', () => {
    const preset = resolvePreset(['nodejs', 'typescript']);
    expect(preset.id).toBe('typescript-node');
  });

  it('resolves ["rust"] to rust preset', () => {
    const preset = resolvePreset(['rust']);
    expect(preset.id).toBe('rust');
  });

  it('resolves ["python"] to python preset', () => {
    const preset = resolvePreset(['python']);
    expect(preset.id).toBe('python');
  });

  it('resolves [] to generic fallback preset', () => {
    const preset = resolvePreset([]);
    expect(preset.id).toBe('generic');
  });

  it('resolves ["go"] to go preset', () => {
    const preset = resolvePreset(['go']);
    expect(preset.id).toBe('go');
  });

  it('resolves ["nodejs"] to nodejs preset (not typescript-node)', () => {
    const preset = resolvePreset(['nodejs']);
    expect(preset.id).toBe('nodejs');
  });

  it('prefers preset with more ecosystem matches', () => {
    // typescript-node matches both nodejs+typescript, nodejs matches only nodejs
    const preset = resolvePreset(['nodejs', 'typescript']);
    expect(preset.id).toBe('typescript-node');
  });
});
