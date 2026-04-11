/**
 * @sunco/skills-workflow - Note Lists Shared Module
 *
 * Pure module extracted from todo.skill.ts, seed.skill.ts, backlog.skill.ts (Phase 33 Wave 1).
 * Accepts StateApi + SkillUi + args directly — no SkillContext dependency.
 *
 * CRITICAL: State keys preserved exactly as-is:
 *   todo.items, todo.nextId
 *   seed.items, seed.nextId
 *   backlog.items, backlog.nextId
 *
 * Phase 33 Wave 1: todo/seed/backlog .skill.ts files deleted — logic lives here,
 * consumed by note.skill.ts.
 */

import type { StateApi, SkillUi, SkillResult } from '@sunco/core';
import type { TodoItem, SeedItem, BacklogItem } from './types.js';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface NoteListContext {
  state: StateApi;
  ui: SkillUi;
  args: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Todo handlers
// ---------------------------------------------------------------------------

async function handleTodoAdd(ctx: NoteListContext, positional: string[]): Promise<SkillResult> {
  const text = positional.join(' ').trim();

  if (!text) {
    await ctx.ui.result({ success: false, title: 'Todo', summary: 'Please provide task text' });
    return { success: false, summary: 'Please provide task text' };
  }

  const items = (await ctx.state.get<TodoItem[]>('todo.items')) ?? [];
  const nextId = (await ctx.state.get<number>('todo.nextId')) ?? 1;

  const newItem: TodoItem = {
    id: nextId,
    text,
    done: false,
    createdAt: new Date().toISOString(),
    doneAt: null,
  };

  items.push(newItem);
  await ctx.state.set('todo.items', items);
  await ctx.state.set('todo.nextId', nextId + 1);

  await ctx.ui.result({ success: true, title: 'Todo', summary: `Added #${nextId}: ${text}` });
  return { success: true, summary: `Added #${nextId}: ${text}` };
}

async function handleTodoDone(ctx: NoteListContext, positional: string[]): Promise<SkillResult> {
  const idStr = positional[0];
  const id = Number(idStr);

  if (!idStr || isNaN(id)) {
    await ctx.ui.result({ success: false, title: 'Todo', summary: 'Please provide a valid todo ID' });
    return { success: false, summary: 'Please provide a valid todo ID' };
  }

  const items = (await ctx.state.get<TodoItem[]>('todo.items')) ?? [];
  const item = items.find((i) => i.id === id);

  if (!item) {
    await ctx.ui.result({ success: false, title: 'Todo', summary: `Todo #${id} not found` });
    return { success: false, summary: `Todo #${id} not found` };
  }

  item.done = true;
  item.doneAt = new Date().toISOString();
  await ctx.state.set('todo.items', items);

  await ctx.ui.result({ success: true, title: 'Todo', summary: `Completed #${id}: ${item.text}` });
  return { success: true, summary: `Completed #${id}: ${item.text}` };
}

async function handleTodoList(ctx: NoteListContext): Promise<SkillResult> {
  const items = (await ctx.state.get<TodoItem[]>('todo.items')) ?? [];

  if (items.length === 0) {
    await ctx.ui.result({
      success: true,
      title: 'Todo',
      summary: 'No todos yet',
      details: ['No todos yet. Use `sunco note --todo add "task"` to create one.'],
    });
    return { success: true, summary: 'No todos yet' };
  }

  const lines = items.map((item) => {
    const check = item.done ? 'x' : ' ';
    const status = item.done ? ' (done)' : '';
    return `[${check}] #${item.id} ${item.text}${status}`;
  });

  await ctx.ui.result({ success: true, title: 'Todo', summary: `${items.length} todo(s)`, details: lines });
  return { success: true, summary: `${items.length} todo(s)`, data: items };
}

/**
 * Handle todo list operations (add, done, list).
 * State key: todo.items
 */
export async function handleTodoListCmd(ctx: NoteListContext): Promise<SkillResult> {
  const positional = (ctx.args._ as string[] | undefined) ?? [];
  const subcommand = positional[0] ?? 'list';

  switch (subcommand) {
    case 'add':
      return handleTodoAdd(ctx, positional.slice(1));
    case 'done':
      return handleTodoDone(ctx, positional.slice(1));
    case 'list':
    default:
      return handleTodoList(ctx);
  }
}

// ---------------------------------------------------------------------------
// Seed handlers
// ---------------------------------------------------------------------------

async function handleSeedAdd(ctx: NoteListContext, positional: string[]): Promise<SkillResult> {
  const idea = positional.join(' ').trim();
  const trigger = ((ctx.args.trigger as string) ?? '').trim();

  if (!idea) {
    await ctx.ui.result({ success: false, title: 'Seed', summary: 'Please provide idea text' });
    return { success: false, summary: 'Please provide idea text' };
  }

  const items = (await ctx.state.get<SeedItem[]>('seed.items')) ?? [];
  const nextId = (await ctx.state.get<number>('seed.nextId')) ?? 1;

  const newItem: SeedItem = {
    id: nextId,
    idea,
    trigger,
    createdAt: new Date().toISOString(),
    surfaced: false,
    surfacedAt: null,
  };

  items.push(newItem);
  await ctx.state.set('seed.items', items);
  await ctx.state.set('seed.nextId', nextId + 1);

  const triggerInfo = trigger ? ` (trigger: ${trigger})` : '';
  await ctx.ui.result({ success: true, title: 'Seed', summary: `Planted #${nextId}: ${idea}${triggerInfo}` });
  return { success: true, summary: `Planted #${nextId}: ${idea}${triggerInfo}` };
}

async function handleSeedList(ctx: NoteListContext): Promise<SkillResult> {
  const items = (await ctx.state.get<SeedItem[]>('seed.items')) ?? [];

  if (items.length === 0) {
    await ctx.ui.result({
      success: true,
      title: 'Seed',
      summary: 'No seeds yet',
      details: ['No seeds yet. Use `sunco note --seed "idea" --trigger "condition"` to plant one.'],
    });
    return { success: true, summary: 'No seeds yet' };
  }

  const lines = items.map((item) => {
    const status = item.surfaced ? ' [surfaced]' : '';
    const triggerInfo = item.trigger ? ` | trigger: ${item.trigger}` : '';
    return `#${item.id} ${item.idea}${triggerInfo}${status}`;
  });

  await ctx.ui.result({ success: true, title: 'Seed', summary: `${items.length} seed(s)`, details: lines });
  return { success: true, summary: `${items.length} seed(s)`, data: items };
}

/**
 * Handle seed list operations (add/list).
 * State key: seed.items
 */
export async function handleSeedListCmd(ctx: NoteListContext): Promise<SkillResult> {
  const positional = (ctx.args._ as string[] | undefined) ?? [];
  const listFlag = ctx.args.list as boolean | undefined;

  const firstArg = positional[0];
  const isListCommand = listFlag || firstArg === 'list' || positional.length === 0;

  if (isListCommand && firstArg !== 'list') {
    return handleSeedList(ctx);
  }

  if (firstArg === 'list') {
    return handleSeedList(ctx);
  }

  return handleSeedAdd(ctx, positional);
}

// ---------------------------------------------------------------------------
// Backlog handlers
// ---------------------------------------------------------------------------

async function handleBacklogAdd(ctx: NoteListContext, positional: string[]): Promise<SkillResult> {
  const text = positional.join(' ').trim();

  if (!text) {
    await ctx.ui.result({ success: false, title: 'Backlog', summary: 'Please provide item text' });
    return { success: false, summary: 'Please provide item text' };
  }

  const items = (await ctx.state.get<BacklogItem[]>('backlog.items')) ?? [];
  const nextId = (await ctx.state.get<number>('backlog.nextId')) ?? 1;

  const newItem: BacklogItem = {
    id: nextId,
    text,
    createdAt: new Date().toISOString(),
    promotedAt: null,
  };

  items.push(newItem);
  await ctx.state.set('backlog.items', items);
  await ctx.state.set('backlog.nextId', nextId + 1);

  await ctx.ui.result({ success: true, title: 'Backlog', summary: `Added #${nextId}: ${text}` });
  return { success: true, summary: `Added #${nextId}: ${text}` };
}

async function handleBacklogList(ctx: NoteListContext): Promise<SkillResult> {
  const items = (await ctx.state.get<BacklogItem[]>('backlog.items')) ?? [];

  if (items.length === 0) {
    await ctx.ui.result({
      success: true,
      title: 'Backlog',
      summary: 'No backlog items yet',
      details: ['No backlog items yet. Use `sunco note --backlog add "idea"` to add one.'],
    });
    return { success: true, summary: 'No backlog items yet' };
  }

  const lines = items.map((item) => {
    const status = item.promotedAt ? ' [promoted]' : '';
    return `#${item.id} ${item.text}${status}`;
  });

  await ctx.ui.result({ success: true, title: 'Backlog', summary: `${items.length} backlog item(s)`, details: lines });
  return { success: true, summary: `${items.length} backlog item(s)`, data: items };
}

async function handleBacklogPromote(ctx: NoteListContext, positional: string[]): Promise<SkillResult> {
  const idStr = positional[0];
  const id = Number(idStr);

  if (!idStr || isNaN(id)) {
    await ctx.ui.result({ success: false, title: 'Backlog', summary: 'Please provide a valid backlog item ID' });
    return { success: false, summary: 'Please provide a valid backlog item ID' };
  }

  const items = (await ctx.state.get<BacklogItem[]>('backlog.items')) ?? [];
  const item = items.find((i) => i.id === id);

  if (!item) {
    await ctx.ui.result({ success: false, title: 'Backlog', summary: `Backlog #${id} not found` });
    return { success: false, summary: `Backlog #${id} not found` };
  }

  item.promotedAt = new Date().toISOString();
  await ctx.state.set('backlog.items', items);

  await ctx.ui.result({
    success: true,
    title: 'Backlog',
    summary: `Promoted #${id}: ${item.text}. Consider adding it as a todo or phase.`,
  });
  return { success: true, summary: `Promoted #${id}: ${item.text}. Consider adding it as a todo or phase.` };
}

/**
 * Handle backlog list operations (add, promote, list).
 * State key: backlog.items
 */
export async function handleBacklogListCmd(ctx: NoteListContext): Promise<SkillResult> {
  const positional = (ctx.args._ as string[] | undefined) ?? [];
  const subcommand = positional[0] ?? 'list';

  switch (subcommand) {
    case 'add':
      return handleBacklogAdd(ctx, positional.slice(1));
    case 'promote':
      return handleBacklogPromote(ctx, positional.slice(1));
    case 'list':
    default:
      return handleBacklogList(ctx);
  }
}
