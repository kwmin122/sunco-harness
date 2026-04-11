/**
 * @sunco/skills-workflow - Note Lists shared module tests
 *
 * Lean regression guards for handleTodoListCmd / handleSeedListCmd / handleBacklogListCmd.
 *
 * Phase 33 Wave 1: replaces the deleted todo.test.ts / seed.test.ts / backlog.test.ts
 * satellite tests. Tests the shared module directly instead of the removed skill files.
 *
 * Scope: core CRUD + state key preservation. Not exhaustive — full edge cases are
 * covered indirectly via note.skill.ts dispatch tests and the alias backcompat suite.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StateApi, SkillUi } from '@sunco/core';
import type { TodoItem, SeedItem, BacklogItem } from '../types.js';
import {
  handleTodoListCmd,
  handleSeedListCmd,
  handleBacklogListCmd,
  type NoteListContext,
} from '../note-lists.js';

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

function createMockUi(): SkillUi {
  return {
    entry: vi.fn(async () => {}),
    ask: vi.fn(async () => ''),
    askText: vi.fn(async () => ''),
    progress: vi.fn(async () => ({ update: vi.fn(async () => {}), dispose: vi.fn(async () => {}) })),
    result: vi.fn(async () => {}),
  } as unknown as SkillUi;
}

function createCtx(args: Record<string, unknown>, store: Record<string, unknown> = {}): NoteListContext {
  return { state: createMockState(store), ui: createMockUi(), args };
}

// ---------------------------------------------------------------------------
// Todo
// ---------------------------------------------------------------------------

describe('handleTodoListCmd', () => {
  it('adds a todo with auto-increment id; state key = todo.items', async () => {
    const store: Record<string, unknown> = {};
    const ctx = createCtx({ _: ['add', 'write', 'tests'] }, store);
    const r = await handleTodoListCmd(ctx);
    expect(r.success).toBe(true);
    expect(r.summary).toContain('#1');
    const items = store['todo.items'] as TodoItem[];
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe(1);
    expect(items[0]!.text).toBe('write tests');
    expect(items[0]!.done).toBe(false);
    expect(store['todo.nextId']).toBe(2);
  });

  it('lists existing todos (defaults to list subcommand)', async () => {
    const existing: TodoItem[] = [
      { id: 1, text: 'first', done: false, createdAt: '2026-04-11T00:00:00Z', doneAt: null },
      { id: 2, text: 'second', done: true, createdAt: '2026-04-11T00:00:01Z', doneAt: '2026-04-11T00:01:00Z' },
    ];
    const ctx = createCtx({ _: [] }, { 'todo.items': existing });
    const r = await handleTodoListCmd(ctx);
    expect(r.success).toBe(true);
    expect(r.summary).toBe('2 todo(s)');
  });

  it('empty list surfaces "No todos yet"', async () => {
    const ctx = createCtx({ _: ['list'] }, {});
    const r = await handleTodoListCmd(ctx);
    expect(r.success).toBe(true);
    expect(r.summary).toBe('No todos yet');
  });

  it('done marks an existing todo', async () => {
    const existing: TodoItem[] = [
      { id: 42, text: 'ship it', done: false, createdAt: '2026-04-11T00:00:00Z', doneAt: null },
    ];
    const ctx = createCtx({ _: ['done', '42'] }, { 'todo.items': existing });
    const r = await handleTodoListCmd(ctx);
    expect(r.success).toBe(true);
    expect(r.summary).toContain('#42');
    expect(existing[0]!.done).toBe(true);
    expect(existing[0]!.doneAt).not.toBeNull();
  });

  it('done rejects unknown id', async () => {
    const ctx = createCtx({ _: ['done', '999'] }, { 'todo.items': [] });
    const r = await handleTodoListCmd(ctx);
    expect(r.success).toBe(false);
    expect(r.summary).toContain('#999 not found');
  });

  it('add rejects empty text', async () => {
    const ctx = createCtx({ _: ['add'] }, {});
    const r = await handleTodoListCmd(ctx);
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

describe('handleSeedListCmd', () => {
  // Note: seed has no explicit `add` subcommand — any non-`list` positional is treated as idea text.
  it('adds a seed with optional trigger; state key = seed.items', async () => {
    const store: Record<string, unknown> = {};
    const ctx = createCtx({ _: ['refactor', 'router'], trigger: 'after v1.4' }, store);
    const r = await handleSeedListCmd(ctx);
    expect(r.success).toBe(true);
    const items = store['seed.items'] as SeedItem[];
    expect(items).toHaveLength(1);
    expect(items[0]!.idea).toBe('refactor router');
    expect(items[0]!.trigger).toBe('after v1.4');
    expect(store['seed.nextId']).toBe(2);
  });

  it('empty args list existing seeds (defaults to list since positional is empty)', async () => {
    const existing: SeedItem[] = [
      { id: 1, idea: 'idea-a', trigger: '', createdAt: '2026-04-11T00:00:00Z', surfaced: false, surfacedAt: null },
    ];
    const ctx = createCtx({ _: [] }, { 'seed.items': existing });
    const r = await handleSeedListCmd(ctx);
    expect(r.success).toBe(true);
    expect(r.summary).toBe('1 seed(s)');
  });

  it('explicit `list` subcommand returns "No seeds yet" when empty', async () => {
    const ctx = createCtx({ _: ['list'] }, {});
    const r = await handleSeedListCmd(ctx);
    expect(r.success).toBe(true);
    expect(r.summary).toBe('No seeds yet');
  });
});

// ---------------------------------------------------------------------------
// Backlog
// ---------------------------------------------------------------------------

describe('handleBacklogListCmd', () => {
  it('adds a backlog item with auto-increment id; state key = backlog.items', async () => {
    const store: Record<string, unknown> = {};
    const ctx = createCtx({ _: ['add', 'nice', 'to', 'have'] }, store);
    const r = await handleBacklogListCmd(ctx);
    expect(r.success).toBe(true);
    const items = store['backlog.items'] as BacklogItem[];
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe(1);
    expect(items[0]!.text).toBe('nice to have');
    expect(store['backlog.nextId']).toBe(2);
  });

  it('lists existing backlog items (defaults to list)', async () => {
    const existing: BacklogItem[] = [
      { id: 1, text: 'park', createdAt: '2026-04-11T00:00:00Z', promotedAt: null },
    ];
    const ctx = createCtx({ _: [] }, { 'backlog.items': existing });
    const r = await handleBacklogListCmd(ctx);
    expect(r.success).toBe(true);
  });

  it('promote sets promotedAt timestamp', async () => {
    const existing: BacklogItem[] = [
      { id: 7, text: 'later', createdAt: '2026-04-11T00:00:00Z', promotedAt: null },
    ];
    const ctx = createCtx({ _: ['promote', '7'] }, { 'backlog.items': existing });
    const r = await handleBacklogListCmd(ctx);
    expect(r.success).toBe(true);
    expect(existing[0]!.promotedAt).not.toBeNull();
  });

  it('promote rejects unknown id', async () => {
    const ctx = createCtx({ _: ['promote', '999'] }, { 'backlog.items': [] });
    const r = await handleBacklogListCmd(ctx);
    expect(r.success).toBe(false);
  });
});
