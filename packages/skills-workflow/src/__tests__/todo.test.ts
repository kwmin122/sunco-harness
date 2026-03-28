/**
 * @sunco/skills-workflow - Todo Skill Tests
 *
 * Tests for todo add/list/done CRUD operations with auto-incrementing IDs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, SkillResult } from '@sunco/core';
import type { StateApi, FileStoreApi } from '@sunco/core';
import type { TodoItem } from '../shared/types.js';

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

describe('todo.skill', () => {
  let todoSkill: { execute: (ctx: SkillContext) => Promise<SkillResult> };

  beforeEach(async () => {
    const mod = await import('../todo.skill.js');
    todoSkill = mod.default;
  });

  describe('add subcommand', () => {
    it('creates a todo item with auto-increment ID', async () => {
      const store: Record<string, unknown> = {};
      const ctx = createMockContext({ _: ['add', 'Write unit tests'] }, store);

      const result = await todoSkill.execute(ctx);

      expect(result.success).toBe(true);
      const items = store['todo.items'] as TodoItem[];
      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe(1);
      expect(items[0]!.text).toBe('Write unit tests');
      expect(items[0]!.done).toBe(false);
      expect(items[0]!.doneAt).toBeNull();
      expect(store['todo.nextId']).toBe(2);
    });

    it('uses existing nextId for auto-increment', async () => {
      const existing: TodoItem[] = [
        { id: 1, text: 'First', done: false, createdAt: '2026-01-01T00:00:00Z', doneAt: null },
      ];
      const store: Record<string, unknown> = { 'todo.items': existing, 'todo.nextId': 2 };
      const ctx = createMockContext({ _: ['add', 'Second task'] }, store);

      await todoSkill.execute(ctx);

      const items = store['todo.items'] as TodoItem[];
      expect(items).toHaveLength(2);
      expect(items[1]!.id).toBe(2);
      expect(items[1]!.text).toBe('Second task');
      expect(store['todo.nextId']).toBe(3);
    });

    it('returns error when no text provided for add', async () => {
      const ctx = createMockContext({ _: ['add'] });
      const result = await todoSkill.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toMatch(/text/i);
    });
  });

  describe('list subcommand', () => {
    it('lists all todo items', async () => {
      const items: TodoItem[] = [
        { id: 1, text: 'Fix bug', done: false, createdAt: '2026-01-01T00:00:00Z', doneAt: null },
        { id: 2, text: 'Write tests', done: true, createdAt: '2026-01-01T00:00:00Z', doneAt: '2026-01-02T00:00:00Z' },
      ];
      const store: Record<string, unknown> = { 'todo.items': items };
      const ctx = createMockContext({ _: ['list'] }, store);

      const result = await todoSkill.execute(ctx);

      expect(result.success).toBe(true);
      expect(ctx.ui.result).toHaveBeenCalled();
    });

    it('shows empty message when no todos', async () => {
      const ctx = createMockContext({ _: ['list'] });
      const result = await todoSkill.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toMatch(/no|empty|0/i);
    });
  });

  describe('done subcommand', () => {
    it('marks an item as done', async () => {
      const items: TodoItem[] = [
        { id: 1, text: 'Fix bug', done: false, createdAt: '2026-01-01T00:00:00Z', doneAt: null },
      ];
      const store: Record<string, unknown> = { 'todo.items': items };
      const ctx = createMockContext({ _: ['done', '1'] }, store);

      const result = await todoSkill.execute(ctx);

      expect(result.success).toBe(true);
      const updated = store['todo.items'] as TodoItem[];
      expect(updated[0]!.done).toBe(true);
      expect(updated[0]!.doneAt).toBeTruthy();
    });

    it('returns error for non-existent item', async () => {
      const items: TodoItem[] = [
        { id: 1, text: 'Fix bug', done: false, createdAt: '2026-01-01T00:00:00Z', doneAt: null },
      ];
      const store: Record<string, unknown> = { 'todo.items': items };
      const ctx = createMockContext({ _: ['done', '999'] }, store);

      const result = await todoSkill.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toMatch(/999/);
    });
  });

  describe('default behavior', () => {
    it('defaults to list when no subcommand', async () => {
      const ctx = createMockContext({ _: [] });
      const result = await todoSkill.execute(ctx);

      // Should not throw, should list (empty)
      expect(result.success).toBe(true);
    });
  });
});
