/**
 * @sunco/skills-workflow - Todo Skill
 *
 * Task list management with auto-incrementing IDs.
 * State backed by SQLite via StateApi.
 *
 * Commands:
 *   sunco todo add "task text"  -- add a new todo item
 *   sunco todo list             -- list all todo items (default)
 *   sunco todo done <id>        -- mark todo as done
 *
 * Requirements: IDX-02 (task tracking), D-06 (StateApi backend)
 */

import { defineSkill } from '@sunco/core';
import type { TodoItem } from './shared/types.js';

export default defineSkill({
  id: 'workflow.todo',
  command: 'todo',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Todo list -- add, list, and complete tasks',
  options: [],

  async execute(ctx) {
    const positional = (ctx.args._ as string[] | undefined) ?? [];
    const subcommand = positional[0] ?? 'list';

    switch (subcommand) {
      case 'add':
        return handleAdd(ctx, positional.slice(1));
      case 'done':
        return handleDone(ctx, positional.slice(1));
      case 'list':
      default:
        return handleList(ctx);
    }
  },
});

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function handleAdd(
  ctx: import('@sunco/core').SkillContext,
  args: string[],
): Promise<import('@sunco/core').SkillResult> {
  const text = args.join(' ').trim();

  if (!text) {
    await ctx.ui.result({
      success: false,
      title: 'Todo',
      summary: 'Please provide task text',
    });
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

  await ctx.ui.result({
    success: true,
    title: 'Todo',
    summary: `Added #${nextId}: ${text}`,
  });

  return { success: true, summary: `Added #${nextId}: ${text}` };
}

async function handleList(
  ctx: import('@sunco/core').SkillContext,
): Promise<import('@sunco/core').SkillResult> {
  const items = (await ctx.state.get<TodoItem[]>('todo.items')) ?? [];

  if (items.length === 0) {
    await ctx.ui.result({
      success: true,
      title: 'Todo',
      summary: 'No todos yet',
      details: ['No todos yet. Use `sunco todo add "task"` to create one.'],
    });
    return { success: true, summary: 'No todos yet' };
  }

  const lines = items.map((item) => {
    const check = item.done ? 'x' : ' ';
    const status = item.done ? ' (done)' : '';
    return `[${check}] #${item.id} ${item.text}${status}`;
  });

  await ctx.ui.result({
    success: true,
    title: 'Todo',
    summary: `${items.length} todo(s)`,
    details: lines,
  });

  return { success: true, summary: `${items.length} todo(s)`, data: items };
}

async function handleDone(
  ctx: import('@sunco/core').SkillContext,
  args: string[],
): Promise<import('@sunco/core').SkillResult> {
  const idStr = args[0];
  const id = Number(idStr);

  if (!idStr || isNaN(id)) {
    await ctx.ui.result({
      success: false,
      title: 'Todo',
      summary: 'Please provide a valid todo ID',
    });
    return { success: false, summary: 'Please provide a valid todo ID' };
  }

  const items = (await ctx.state.get<TodoItem[]>('todo.items')) ?? [];
  const item = items.find((i) => i.id === id);

  if (!item) {
    await ctx.ui.result({
      success: false,
      title: 'Todo',
      summary: `Todo #${id} not found`,
    });
    return { success: false, summary: `Todo #${id} not found` };
  }

  item.done = true;
  item.doneAt = new Date().toISOString();
  await ctx.state.set('todo.items', items);

  await ctx.ui.result({
    success: true,
    title: 'Todo',
    summary: `Completed #${id}: ${item.text}`,
  });

  return { success: true, summary: `Completed #${id}: ${item.text}` };
}
