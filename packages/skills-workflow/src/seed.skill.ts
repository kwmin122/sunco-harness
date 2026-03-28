/**
 * @sunco/skills-workflow - Seed Skill
 *
 * Idea capture with trigger conditions for future surfacing.
 * Seeds are stored in SQLite via StateApi and surfaced by the recommender
 * when their trigger condition matches.
 *
 * Commands:
 *   sunco seed "idea" --trigger "condition"  -- plant a seed idea
 *   sunco seed list                          -- list all seeds (default)
 *
 * Requirements: IDX-03 (idea seeding), D-07 (trigger-based surfacing)
 */

import { defineSkill } from '@sunco/core';
import type { SeedItem } from './shared/types.js';

export default defineSkill({
  id: 'workflow.seed',
  command: 'seed',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Seed ideas with trigger conditions for future surfacing',
  options: [
    { flags: '--trigger <condition>', description: 'Trigger condition for surfacing' },
    { flags: '--list', description: 'List all seeds' },
  ],

  async execute(ctx) {
    const positional = (ctx.args._ as string[] | undefined) ?? [];
    const listFlag = ctx.args.list as boolean | undefined;

    // Determine operation: if --list flag, 'list' subcommand, or no text -> list
    const firstArg = positional[0];
    const isListCommand = listFlag || firstArg === 'list' || positional.length === 0;

    if (isListCommand && firstArg !== 'list') {
      // No text at all -> list
      return handleList(ctx);
    }

    if (firstArg === 'list') {
      return handleList(ctx);
    }

    // Otherwise, add a new seed
    return handleAdd(ctx, positional);
  },
});

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function handleAdd(
  ctx: import('@sunco/core').SkillContext,
  positional: string[],
): Promise<import('@sunco/core').SkillResult> {
  const idea = positional.join(' ').trim();
  const trigger = ((ctx.args.trigger as string) ?? '').trim();

  if (!idea) {
    await ctx.ui.result({
      success: false,
      title: 'Seed',
      summary: 'Please provide idea text',
    });
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
  await ctx.ui.result({
    success: true,
    title: 'Seed',
    summary: `Planted #${nextId}: ${idea}${triggerInfo}`,
  });

  return { success: true, summary: `Planted #${nextId}: ${idea}${triggerInfo}` };
}

async function handleList(
  ctx: import('@sunco/core').SkillContext,
): Promise<import('@sunco/core').SkillResult> {
  const items = (await ctx.state.get<SeedItem[]>('seed.items')) ?? [];

  if (items.length === 0) {
    await ctx.ui.result({
      success: true,
      title: 'Seed',
      summary: 'No seeds yet',
      details: ['No seeds yet. Use `sunco seed "idea" --trigger "condition"` to plant one.'],
    });
    return { success: true, summary: 'No seeds yet' };
  }

  const lines = items.map((item) => {
    const status = item.surfaced ? ' [surfaced]' : '';
    const trigger = item.trigger ? ` | trigger: ${item.trigger}` : '';
    return `#${item.id} ${item.idea}${trigger}${status}`;
  });

  await ctx.ui.result({
    success: true,
    title: 'Seed',
    summary: `${items.length} seed(s)`,
    details: lines,
  });

  return { success: true, summary: `${items.length} seed(s)`, data: items };
}
