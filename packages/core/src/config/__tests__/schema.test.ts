/**
 * @sunco/core - Schema validation tests
 *
 * Tests Zod schema validation with defaults and user-friendly error messages.
 * Validates that partial configs are filled with defaults and invalid types
 * produce clear error messages with field paths.
 */

import { describe, it, expect } from 'vitest';
import { validateConfig } from '../schema.js';
import { ConfigError } from '../../errors/index.js';

describe('validateConfig', () => {
  it('returns full default config from empty object', () => {
    const config = validateConfig({});
    expect(config).toEqual({
      skills: { preset: 'none', add: [], remove: [] },
      agent: { defaultProvider: 'claude-code-cli', timeout: 120_000, maxRetries: 1 },
      ui: { theme: 'default', silent: false, json: false },
      state: { dbPath: '.sun/state.db' },
    });
  });

  it('fills missing fields with Zod defaults for partial config', () => {
    const config = validateConfig({
      agent: { timeout: 60_000 },
    });
    expect(config.agent.timeout).toBe(60_000);
    expect(config.agent.defaultProvider).toBe('claude-code-cli'); // default filled
    expect(config.skills).toEqual({ preset: 'none', add: [], remove: [] }); // default filled
  });

  it('preserves explicitly set values', () => {
    const config = validateConfig({
      ui: { theme: 'dark', silent: true, json: false },
    });
    expect(config.ui.theme).toBe('dark');
    expect(config.ui.silent).toBe(true);
  });

  it('throws ConfigError for invalid type (string where number expected)', () => {
    expect(() =>
      validateConfig({ agent: { timeout: 'slow' } }),
    ).toThrow(ConfigError);
  });

  it('error message contains field path for invalid values', () => {
    try {
      validateConfig({ agent: { timeout: 'slow' } });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const configErr = err as ConfigError;
      expect(configErr.message).toContain('agent');
      expect(configErr.message).toContain('timeout');
    }
  });

  it('throws ConfigError for invalid boolean type', () => {
    expect(() =>
      validateConfig({ ui: { silent: 'yes' } }),
    ).toThrow(ConfigError);
  });

  it('throws ConfigError for invalid nested type', () => {
    expect(() =>
      validateConfig({ skills: { add: 'not-an-array' } }),
    ).toThrow(ConfigError);
  });

  it('accepts complete valid config', () => {
    const full = {
      skills: { preset: 'harness', add: ['lint'], remove: ['debug'] },
      agent: { defaultProvider: 'claude-sdk', timeout: 30_000, maxRetries: 3 },
      ui: { theme: 'minimal', silent: false, json: true },
      state: { dbPath: '.sun/custom.db' },
    };
    const config = validateConfig(full);
    expect(config).toEqual(full);
  });
});
