/**
 * @sunco/skills-workflow - Note Skill
 *
 * Quick capture of timestamped markdown notes.
 * Notes go to .sun/notes/ by default, or .sun/tribal/ with --tribal flag.
 *
 * Commands:
 *   sunco note "some text"           -- save note to .sun/notes/
 *   sunco note "some text" --tribal  -- save to .sun/tribal/ (tribal knowledge)
 *
 * Requirements: IDX-01 (frictionless note capture), D-05 (FileStore backend)
 */

import { defineSkill } from '@sunco/core';

export default defineSkill({
  id: 'workflow.note',
  command: 'note',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Quick note capture -- timestamped markdown to .sun/notes/ or .sun/tribal/',
  options: [
    { flags: '--tribal', description: 'Save as tribal knowledge' },
    { flags: '--todo', description: 'Manage tasks (delegates to todo)' },
    { flags: '--seed', description: 'Plant an idea with trigger (delegates to seed)' },
    { flags: '--backlog', description: 'Parking lot for ideas (delegates to backlog)' },
  ],

  // Phase 33 Wave 1: 'todo', 'seed', 'backlog' absorbed into note
  aliases: [
    { command: 'todo',    id: 'workflow.todo',    defaultArgs: { todo: true },    hidden: true, replacedBy: 'note --todo' },
    { command: 'seed',    id: 'workflow.seed',    defaultArgs: { seed: true },    hidden: true, replacedBy: 'note --seed' },
    { command: 'backlog', id: 'workflow.backlog', defaultArgs: { backlog: true }, hidden: true, replacedBy: 'note --backlog' },
  ],

  async execute(ctx) {
    // Phase 33 Wave 1: direct calls to note-lists shared module (replaced ctx.run delegates)
    if (ctx.args.todo === true) {
      const { handleTodoListCmd } = await import('./shared/note-lists.js');
      return handleTodoListCmd({ state: ctx.state, ui: ctx.ui, args: ctx.args });
    }
    if (ctx.args.seed === true) {
      const { handleSeedListCmd } = await import('./shared/note-lists.js');
      return handleSeedListCmd({ state: ctx.state, ui: ctx.ui, args: ctx.args });
    }
    if (ctx.args.backlog === true) {
      const { handleBacklogListCmd } = await import('./shared/note-lists.js');
      return handleBacklogListCmd({ state: ctx.state, ui: ctx.ui, args: ctx.args });
    }

    // Get text from positional args
    const positional = (ctx.args._ as string[] | undefined) ?? [];
    const text = positional.join(' ').trim();

    if (!text) {
      await ctx.ui.result({
        success: false,
        title: 'Note',
        summary: 'Please provide note text',
      });
      return { success: false, summary: 'Please provide note text' };
    }

    // Generate timestamped filename
    const filename = new Date().toISOString().replace(/[:.]/g, '-') + '.md';

    // Build markdown content
    const content = `# Note\n\n${text}\n\nCreated: ${new Date().toISOString()}\n`;

    // Determine category based on --tribal flag
    const category = ctx.args.tribal ? 'tribal' : 'notes';

    // Write to file store
    await ctx.fileStore.write(category, filename, content);

    // Display result
    await ctx.ui.result({
      success: true,
      title: 'Note',
      summary: `Saved to ${category}/${filename}`,
    });

    return { success: true, summary: `Note saved to ${category}/${filename}` };
  },
});
