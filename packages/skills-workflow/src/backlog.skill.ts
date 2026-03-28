/**
 * @sunco/skills-workflow - Backlog Skill
 *
 * Parking lot for ideas that aren't ready for immediate action.
 * Items can be promoted when ready to become active tasks.
 *
 * Commands:
 *   sunco backlog add "item text"   -- add to backlog
 *   sunco backlog list              -- list all items (default)
 *   sunco backlog promote <id>      -- mark as promoted
 *
 * Requirements: IDX-04 (backlog management), D-08 (promote to active)
 */

import { defineSkill } from '@sunco/core';
import type { BacklogItem } from './shared/types.js';

export default defineSkill({
  id: 'workflow.backlog',
  command: 'backlog',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Backlog parking lot -- add, list, and promote ideas',
  options: [],

  async execute(ctx) {
    const positional = (ctx.args._ as string[] | undefined) ?? [];
    const subcommand = positional[0] ?? 'list';

    switch (subcommand) {
      case 'add':
        return handleAdd(ctx, positional.slice(1));
      case 'promote':
        return handlePromote(ctx, positional.slice(1));
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
      title: 'Backlog',
      summary: 'Please provide item text',
    });
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

  await ctx.ui.result({
    success: true,
    title: 'Backlog',
    summary: `Added #${nextId}: ${text}`,
  });

  return { success: true, summary: `Added #${nextId}: ${text}` };
}

async function handleList(
  ctx: import('@sunco/core').SkillContext,
): Promise<import('@sunco/core').SkillResult> {
  const items = (await ctx.state.get<BacklogItem[]>('backlog.items')) ?? [];

  if (items.length === 0) {
    await ctx.ui.result({
      success: true,
      title: 'Backlog',
      summary: 'No backlog items yet',
      details: ['No backlog items yet. Use `sunco backlog add "idea"` to add one.'],
    });
    return { success: true, summary: 'No backlog items yet' };
  }

  const lines = items.map((item) => {
    const status = item.promotedAt ? ' [promoted]' : '';
    return `#${item.id} ${item.text}${status}`;
  });

  await ctx.ui.result({
    success: true,
    title: 'Backlog',
    summary: `${items.length} backlog item(s)`,
    details: lines,
  });

  return { success: true, summary: `${items.length} backlog item(s)`, data: items };
}

async function handlePromote(
  ctx: import('@sunco/core').SkillContext,
  args: string[],
): Promise<import('@sunco/core').SkillResult> {
  const idStr = args[0];
  const id = Number(idStr);

  if (!idStr || isNaN(id)) {
    await ctx.ui.result({
      success: false,
      title: 'Backlog',
      summary: 'Please provide a valid backlog item ID',
    });
    return { success: false, summary: 'Please provide a valid backlog item ID' };
  }

  const items = (await ctx.state.get<BacklogItem[]>('backlog.items')) ?? [];
  const item = items.find((i) => i.id === id);

  if (!item) {
    await ctx.ui.result({
      success: false,
      title: 'Backlog',
      summary: `Backlog #${id} not found`,
    });
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
