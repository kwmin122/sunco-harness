/**
 * @sunco/skills-workflow - Settings Skill Tests (Enhanced with write-back)
 *
 * Tests for settings skill with TOML write-back, --set, --global flags,
 * and auto-detection of value types.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, SkillResult } from '@sunco/core';
import type { StateApi, FileStoreApi } from '@sunco/core';
import { SunConfigSchema } from '@sunco/core';

// ---------------------------------------------------------------------------
// Mock helpers (shared pattern from todo.test.ts)
// ---------------------------------------------------------------------------

function createMockState(store: Record<string, unknown> = {}): StateApi {
  return {
    get: vi.fn(async <T = unknown>(key: string): Promise<T | undefined> => store[key] as T | undefined),
    set: vi.fn(async (key: string, value: unknown): Promise<void> => {
      store[key] = value;
    }),
    delete: vi.fn(async (key: string): Promise<boolean> => {
      const existed = key in store;
      delete store[key];
      return existed;
    }),
    list: vi.fn(async (prefix?: string): Promise<string[]> => {
      if (!prefix) return Object.keys(store);
      return Object.keys(store).filter((k) => k.startsWith(prefix));
    }),
    has: vi.fn(async (key: string): Promise<boolean> => key in store),
  } as unknown as StateApi;
}

function createMockFileStore(): FileStoreApi {
  return {
    read: vi.fn(async () => undefined),
    write: vi.fn(async () => {}),
    delete: vi.fn(async () => false),
    list: vi.fn(async () => []),
    exists: vi.fn(async () => false),
  };
}

function createMockContext(
  args: Record<string, unknown> = {},
  configOverride: Record<string, unknown> = {},
): SkillContext {
  return {
    config: SunConfigSchema.parse({
      skills: { preset: 'none', add: [], remove: [] },
      agent: { defaultProvider: 'claude-code-cli', timeout: 120000, maxRetries: 1 },
      ui: { theme: 'default', silent: false, json: false },
      state: { dbPath: '.sun/state.db' },
      ...configOverride,
    }),
    state: createMockState(),
    fileStore: createMockFileStore(),
    agent: {} as SkillContext['agent'],
    recommend: {} as SkillContext['recommend'],
    ui: {
      entry: vi.fn(async () => {}),
      ask: vi.fn(async () => ''),
      progress: vi.fn(async () => {}),
      result: vi.fn(async () => {}),
    } as unknown as SkillContext['ui'],
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    run: vi.fn(async () => ({ success: true })),
    registry: {
      getAll: vi.fn().mockReturnValue([]),
      getByTier: vi.fn().mockReturnValue([]),
    },
    cwd: '/tmp/test-project',
    args,
    signal: new AbortController().signal,
  };
}

// ---------------------------------------------------------------------------
// Unit tests for helper functions
// ---------------------------------------------------------------------------

describe('settings.skill helpers', () => {
  let parseValueType: (raw: string) => unknown;
  let setNestedKey: (obj: Record<string, unknown>, keyPath: string, value: unknown) => void;

  beforeEach(async () => {
    const mod = await import('../settings.skill.js');
    parseValueType = mod._parseValueType;
    setNestedKey = mod._setNestedKey;
  });

  describe('parseValueType', () => {
    it('converts "true" to boolean true', () => {
      expect(parseValueType('true')).toBe(true);
    });

    it('converts "false" to boolean false', () => {
      expect(parseValueType('false')).toBe(false);
    });

    it('converts numeric strings to numbers', () => {
      expect(parseValueType('60000')).toBe(60000);
      expect(parseValueType('3.14')).toBe(3.14);
      expect(parseValueType('0')).toBe(0);
    });

    it('keeps non-numeric strings as strings', () => {
      expect(parseValueType('hello')).toBe('hello');
      expect(parseValueType('claude-code-cli')).toBe('claude-code-cli');
    });

    it('keeps empty string as string', () => {
      expect(parseValueType('')).toBe('');
    });
  });

  describe('setNestedKey', () => {
    it('sets a top-level key', () => {
      const obj: Record<string, unknown> = {};
      setNestedKey(obj, 'timeout', 60000);
      expect(obj.timeout).toBe(60000);
    });

    it('sets a nested key creating intermediate objects', () => {
      const obj: Record<string, unknown> = {};
      setNestedKey(obj, 'agent.timeout', 60000);
      expect((obj.agent as Record<string, unknown>).timeout).toBe(60000);
    });

    it('sets a deeply nested key', () => {
      const obj: Record<string, unknown> = {};
      setNestedKey(obj, 'a.b.c', 'deep');
      expect(((obj.a as Record<string, unknown>).b as Record<string, unknown>).c).toBe('deep');
    });

    it('preserves existing sibling keys', () => {
      const obj: Record<string, unknown> = {
        agent: { defaultProvider: 'claude-code-cli', timeout: 120000 },
      };
      setNestedKey(obj, 'agent.timeout', 60000);
      expect((obj.agent as Record<string, unknown>).timeout).toBe(60000);
      expect((obj.agent as Record<string, unknown>).defaultProvider).toBe('claude-code-cli');
    });
  });
});

// ---------------------------------------------------------------------------
// Skill execution tests
// ---------------------------------------------------------------------------

describe('settings.skill execute', () => {
  let settingsSkill: { execute: (ctx: SkillContext) => Promise<SkillResult> };

  beforeEach(async () => {
    vi.restoreAllMocks();
    const mod = await import('../settings.skill.js');
    settingsSkill = mod.default;
  });

  describe('--key flag (read)', () => {
    it('returns specific config value by dot-path', async () => {
      const ctx = createMockContext({ key: 'agent.timeout' });
      const result = await settingsSkill.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('120000');
    });

    it('returns error for non-existent key', async () => {
      const ctx = createMockContext({ key: 'nonexistent.path' });
      const result = await settingsSkill.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('not found');
    });
  });

  describe('default (no flags)', () => {
    it('shows full config as JSON display', async () => {
      const ctx = createMockContext({});
      const result = await settingsSkill.execute(ctx);

      expect(result.success).toBe(true);
      expect(ctx.ui.result).toHaveBeenCalled();
    });
  });

  describe('--set flag (write)', () => {
    it('parses key=value format and writes TOML file', async () => {
      // Mock fs operations
      const { readFile, writeFile, mkdir } = await import('node:fs/promises');
      vi.mock('node:fs/promises', async (importOriginal) => {
        const original = await importOriginal<typeof import('node:fs/promises')>();
        return {
          ...original,
          readFile: vi.fn(async () => '[agent]\ntimeout = 120000\n'),
          writeFile: vi.fn(async () => {}),
          mkdir: vi.fn(async () => undefined),
        };
      });

      // Re-import after mocking
      vi.resetModules();
      const freshMod = await import('../settings.skill.js');
      const freshSkill = freshMod.default;

      const ctx = createMockContext({ set: 'agent.timeout=60000' });
      const result = await freshSkill.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('agent.timeout');

      vi.restoreAllMocks();
    });

    it('returns error for invalid key=value format', async () => {
      const ctx = createMockContext({ set: 'invalidformat' });
      const result = await settingsSkill.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('key=value');
    });
  });
});
