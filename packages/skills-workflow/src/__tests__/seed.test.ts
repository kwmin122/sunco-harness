/**
 * @sunco/skills-workflow - Seed Skill Tests
 *
 * Tests for seed idea capture with trigger conditions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, SkillResult } from '@sunco/core';
import type { StateApi, FileStoreApi } from '@sunco/core';
import type { SeedItem } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Mock helpers
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
  };
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
  stateStore: Record<string, unknown> = {},
): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: createMockState(stateStore),
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
    cwd: '/tmp/test-project',
    args,
    signal: new AbortController().signal,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seed.skill', () => {
  let seedSkill: { execute: (ctx: SkillContext) => Promise<SkillResult> };

  beforeEach(async () => {
    const mod = await import('../seed.skill.js');
    seedSkill = mod.default;
  });

  describe('add (default with text)', () => {
    it('creates a seed item with trigger condition', async () => {
      const store: Record<string, unknown> = {};
      const ctx = createMockContext(
        { _: ['Use caching for hot paths'], trigger: 'when phase 5 starts' },
        store,
      );

      const result = await seedSkill.execute(ctx);

      expect(result.success).toBe(true);
      const items = store['seed.items'] as SeedItem[];
      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe(1);
      expect(items[0]!.idea).toBe('Use caching for hot paths');
      expect(items[0]!.trigger).toBe('when phase 5 starts');
      expect(items[0]!.surfaced).toBe(false);
      expect(items[0]!.surfacedAt).toBeNull();
      expect(store['seed.nextId']).toBe(2);
    });

    it('creates a seed with empty trigger when none provided', async () => {
      const store: Record<string, unknown> = {};
      const ctx = createMockContext({ _: ['Add dark mode support'] }, store);

      const result = await seedSkill.execute(ctx);

      expect(result.success).toBe(true);
      const items = store['seed.items'] as SeedItem[];
      expect(items[0]!.trigger).toBe('');
    });

    it('uses existing nextId for auto-increment', async () => {
      const existing: SeedItem[] = [
        { id: 1, idea: 'First', trigger: '', createdAt: '2026-01-01T00:00:00Z', surfaced: false, surfacedAt: null },
      ];
      const store: Record<string, unknown> = { 'seed.items': existing, 'seed.nextId': 2 };
      const ctx = createMockContext({ _: ['Second idea'], trigger: 'later' }, store);

      await seedSkill.execute(ctx);

      const items = store['seed.items'] as SeedItem[];
      expect(items).toHaveLength(2);
      expect(items[1]!.id).toBe(2);
      expect(store['seed.nextId']).toBe(3);
    });
  });

  describe('list', () => {
    it('lists all seeds with trigger conditions', async () => {
      const items: SeedItem[] = [
        { id: 1, idea: 'Caching', trigger: 'phase 5', createdAt: '2026-01-01T00:00:00Z', surfaced: false, surfacedAt: null },
        { id: 2, idea: 'Dark mode', trigger: '', createdAt: '2026-01-02T00:00:00Z', surfaced: true, surfacedAt: '2026-01-03T00:00:00Z' },
      ];
      const store: Record<string, unknown> = { 'seed.items': items };
      const ctx = createMockContext({ _: ['list'] }, store);

      const result = await seedSkill.execute(ctx);

      expect(result.success).toBe(true);
      expect(ctx.ui.result).toHaveBeenCalled();
    });

    it('defaults to list when no positional args', async () => {
      const ctx = createMockContext({ _: [] });
      const result = await seedSkill.execute(ctx);
      expect(result.success).toBe(true);
    });

    it('shows empty message when no seeds', async () => {
      const ctx = createMockContext({ _: ['list'] });
      const result = await seedSkill.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.summary).toMatch(/no|empty|0/i);
    });
  });
});
