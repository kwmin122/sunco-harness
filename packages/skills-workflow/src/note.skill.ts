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
  ],

  async execute(ctx) {
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
