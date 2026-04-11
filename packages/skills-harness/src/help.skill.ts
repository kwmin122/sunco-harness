/**
 * @sunco/skills-harness - Help Skill
 *
 * `sunco help` -- Intent-first task card view (default) and tier-grouped
 * command listing (--all flag). Deterministic, zero LLM cost.
 *
 * Default output: 6 task cards for the user tier (new/next/do/status/review + help --all)
 * --all output: three sections — User Commands / Workflow Commands / Expert Commands
 *
 * Decisions: D-03 (intent-first task cards), D-04 (--all = tier groups),
 *   D-05 (deterministic skill, not Commander configureHelp),
 *   D-06 (sunco --help redirects here)
 */

import { defineSkill } from '@sunco/core';

// ---------------------------------------------------------------------------
// Task card definitions (D-03)
// Order matches user journey: start → continue → do anything → status → review → more
// ---------------------------------------------------------------------------

const TASK_CARDS = [
  { label: '시작하기',     command: 'sunco new',        description: 'Bootstrap a new project' },
  { label: '이어서 작업',  command: 'sunco next',       description: 'Next recommended action + background work' },
  { label: '뭐든 시키기',  command: 'sunco do "..."',   description: 'Auto-categorize and route to the right skill' },
  { label: '지금 상태',    command: 'sunco status',     description: 'Status + active phase + background work' },
  { label: '리뷰 요청',    command: 'sunco review',     description: 'Auto-routed review (ceo/eng/design by context)' },
  { label: '도움말',       command: 'sunco help --all', description: 'Show all commands by tier' },
] as const;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Pad a string to a fixed width with trailing spaces */
function padEnd(str: string, width: number): string {
  return str + ' '.repeat(Math.max(0, width - str.length));
}

/** Render the default task card view */
function renderTaskCards(totalSkills: number): string {
  const labelWidth = Math.max(...TASK_CARDS.map((c) => c.label.length)) + 2;
  const cmdWidth   = Math.max(...TASK_CARDS.map((c) => c.command.length)) + 2;

  const lines = TASK_CARDS.map(
    (c) => `  ${padEnd(c.label, labelWidth)}  ${padEnd(c.command, cmdWidth)}`,
  );

  const shownCount = TASK_CARDS.length - 1; // exclude "help --all" row
  const moreCount  = totalSkills - shownCount;
  const footer = moreCount > 0
    ? `\n  ${shownCount} commands shown. ${moreCount} more with --all`
    : '';

  return '\n' + lines.join('\n') + '\n' + footer + '\n';
}

/** Render the --all three-section view */
function renderAllTiers(
  userSkills:     Array<{ command: string; description: string }>,
  workflowSkills: Array<{ command: string; description: string }>,
  expertSkills:   Array<{ command: string; description: string }>,
): string {
  function section(
    title: string,
    skills: Array<{ command: string; description: string }>,
  ): string {
    if (skills.length === 0) return '';
    const cmdWidth = Math.max(...skills.map((s) => s.command.length)) + 2;
    const rows = skills
      .slice()
      .sort((a, b) => a.command.localeCompare(b.command))
      .map((s) => `  ${padEnd(s.command, cmdWidth)}  ${s.description}`)
      .join('\n');
    return `${title}\n${rows}\n`;
  }

  const parts = [
    section('User Commands', userSkills),
    section('Workflow Commands', workflowSkills),
    section('Expert Commands', expertSkills),
  ].filter(Boolean);

  return '\n' + parts.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'harness.help',
  command: 'help',
  kind: 'deterministic',
  stage: 'stable',
  category: 'harness',
  routing: 'directExec',
  tier: 'user',
  description: 'Show available commands (default: task cards, --all: full tier list)',
  options: [
    { flags: '--all', description: 'Show all commands grouped by tier' },
  ],

  async execute(ctx) {
    const showAll = Boolean(ctx.args.all);

    // Enumerate skills from registry (available via ctx.registry after Plan 25-01)
    // Phase 32: aliases are intentionally excluded from default help output
    // (they live on the absorbing skill via skill.aliases[]; see CONTEXT.md D-05/D-06)
    // getAll() / getByTier() only return main skills — aliases never appear here.
    const allSkills = ctx.registry.getAll();
    const userSkills     = ctx.registry.getByTier('user');
    const workflowSkills = ctx.registry.getByTier('workflow');
    const expertSkills   = ctx.registry.getByTier('expert');

    let output: string;

    if (showAll) {
      output = renderAllTiers(
        userSkills.map((s) => ({ command: s.command, description: s.description })),
        workflowSkills.map((s) => ({ command: s.command, description: s.description })),
        expertSkills.map((s) => ({ command: s.command, description: s.description })),
      );
    } else {
      output = renderTaskCards(allSkills.length);
    }

    // Use console.log directly — help output is pure text, no SkillUi entry/result needed
    // eslint-disable-next-line no-console
    console.log(output);

    return {
      success: true,
      summary: showAll
        ? `${allSkills.length} skills listed across user/workflow/expert tiers`
        : `Task cards shown. Run 'sunco help --all' for full listing.`,
      data: {
        totalSkills: allSkills.length,
        userCount: userSkills.length,
        workflowCount: workflowSkills.length,
        expertCount: expertSkills.length,
        mode: showAll ? 'all' : 'cards',
      },
    };
  },
});
