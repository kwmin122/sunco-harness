/**
 * @sunco/skills-workflow - Backlog Skill Tests
 *
 * Tests for backlog add/list/promote operations with auto-incrementing IDs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, SkillResult } from '@sunco/core';
import type { StateApi, FileStoreApi } from '@sunco/core';
import type { BacklogItem } from '../shared/types.js';

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

describe('backlog.skill', () => {
  let backlogSkill: { execute: (ctx: SkillContext) => Promise<SkillResult> };

  beforeEach(async () => {
    const mod = await import('../backlog.skill.js');
    backlogSkill = mod.default;
  });

  describe('add subcommand', () => {
    it('creates a backlog item with auto-increment ID', async () => {
      const store: Record<string, unknown> = {};
      const ctx = createMockContext({ _: ['add', 'Implement dark mode'] }, store);

      const result = await backlogSkill.execute(ctx);

      expect(result.success).toBe(true);
      const items = store['backlog.items'] as BacklogItem[];
      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe(1);
      expect(items[0]!.text).toBe('Implement dark mode');
      expect(items[0]!.promotedAt).toBeNull();
      expect(store['backlog.nextId']).toBe(2);
    });

    it('uses existing nextId for auto-increment', async () => {
      const existing: BacklogItem[] = [
        { id: 1, text: 'First', createdAt: '2026-01-01T00:00:00Z', promotedAt: null },
      ];
      const store: Record<string, unknown> = { 'backlog.items': existing, 'backlog.nextId': 2 };
      const ctx = createMockContext({ _: ['add', 'Second item'] }, store);

      await backlogSkill.execute(ctx);

      const items = store['backlog.items'] as BacklogItem[];
      expect(items).toHaveLength(2);
      expect(items[1]!.id).toBe(2);
      expect(store['backlog.nextId']).toBe(3);
    });

    it('returns error when no text provided', async () => {
      const ctx = createMockContext({ _: ['add'] });
      const result = await backlogSkill.execute(ctx);
      expect(result.success).toBe(false);
      expect(result.summary).toMatch(/text/i);
    });
  });

  describe('list subcommand', () => {
    it('lists all backlog items', async () => {
      const items: BacklogItem[] = [
        { id: 1, text: 'Dark mode', createdAt: '2026-01-01T00:00:00Z', promotedAt: null },
        { id: 2, text: 'API v2', createdAt: '2026-01-02T00:00:00Z', promotedAt: '2026-01-03T00:00:00Z' },
      ];
      const store: Record<string, unknown> = { 'backlog.items': items };
      const ctx = createMockContext({ _: ['list'] }, store);

      const result = await backlogSkill.execute(ctx);

      expect(result.success).toBe(true);
      expect(ctx.ui.result).toHaveBeenCalled();
    });

    it('shows empty message when no items', async () => {
      const ctx = createMockContext({ _: ['list'] });
      const result = await backlogSkill.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.summary).toMatch(/no|empty|0/i);
    });

    it('defaults to list when no subcommand', async () => {
      const ctx = createMockContext({ _: [] });
      const result = await backlogSkill.execute(ctx);
      expect(result.success).toBe(true);
    });
  });

  describe('promote subcommand', () => {
    it('marks an item as promoted', async () => {
      const items: BacklogItem[] = [
        { id: 1, text: 'Dark mode', createdAt: '2026-01-01T00:00:00Z', promotedAt: null },
      ];
      const store: Record<string, unknown> = { 'backlog.items': items };
      const ctx = createMockContext({ _: ['promote', '1'] }, store);

      const result = await backlogSkill.execute(ctx);

      expect(result.success).toBe(true);
      const updated = store['backlog.items'] as BacklogItem[];
      expect(updated[0]!.promotedAt).toBeTruthy();
    });

    it('returns error for non-existent item', async () => {
      const items: BacklogItem[] = [
        { id: 1, text: 'Dark mode', createdAt: '2026-01-01T00:00:00Z', promotedAt: null },
      ];
      const store: Record<string, unknown> = { 'backlog.items': items };
      const ctx = createMockContext({ _: ['promote', '999'] }, store);

      const result = await backlogSkill.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toMatch(/999/);
    });
  });
});
