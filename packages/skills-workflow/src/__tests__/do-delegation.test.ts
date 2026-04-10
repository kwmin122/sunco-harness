/**
 * Regression tests for do.skill.ts delegation behavior.
 *
 * Verifies that after classification, `do` actually calls `ctx.run`
 * with the correct skill ID and args — especially the `deep -> quick --full` path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
  };
});

import doSkillModule from '../do.skill.js';
import type { SkillContext } from '@sunco/core';

function createMockCtx(input: string): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      has: vi.fn().mockResolvedValue(false),
    } as unknown as SkillContext['state'],
    fileStore: {} as SkillContext['fileStore'],
    agent: {} as SkillContext['agent'],
    recommend: {
      getRecommendations: vi.fn().mockReturnValue([]),
      getTopRecommendation: vi.fn().mockReturnValue(undefined),
    },
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue({ selectedId: '', selectedLabel: '', source: 'default' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
      askText: vi.fn().mockResolvedValue({ text: '' }),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: vi.fn().mockResolvedValue({ success: true, summary: 'done' }),
    cwd: '/tmp/test-do',
    args: { _: [input] },
  } as unknown as SkillContext;
}

describe('do.skill.ts delegation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deep category delegates to workflow.quick with full=true', async () => {
    const ctx = createMockCtx('implement phase 27');
    await doSkillModule.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    expect(runMock).toHaveBeenCalledTimes(1);

    const [skillId, args] = runMock.mock.calls[0]!;
    expect(skillId).toBe('workflow.quick');
    expect(args).toHaveProperty('full', true);
    expect(args._).toContain('implement phase 27');
  });

  it('quick category delegates to workflow.quick WITHOUT full flag', async () => {
    const ctx = createMockCtx('fix typo in README');
    await doSkillModule.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    expect(runMock).toHaveBeenCalledTimes(1);

    const [skillId, args] = runMock.mock.calls[0]!;
    expect(skillId).toBe('workflow.quick');
    expect(args.full).toBeUndefined();
  });

  it('debug category delegates to workflow.debug', async () => {
    const ctx = createMockCtx('why is this broken');
    await doSkillModule.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    const [skillId] = runMock.mock.calls[0]!;
    expect(skillId).toBe('workflow.debug');
  });

  it('review category delegates to workflow.review', async () => {
    const ctx = createMockCtx('review my PR');
    await doSkillModule.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    const [skillId] = runMock.mock.calls[0]!;
    expect(skillId).toBe('workflow.review');
  });

  it('no-match fallback delegates to workflow.quick (deep fallback)', async () => {
    const ctx = createMockCtx('xyzzy12345');
    await doSkillModule.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    const [skillId, args] = runMock.mock.calls[0]!;
    expect(skillId).toBe('workflow.quick');
    expect(args.full).toBe(true);
  });

  it('passes user input through _ positional args', async () => {
    const ctx = createMockCtx('build the new feature');
    await doSkillModule.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    const [, args] = runMock.mock.calls[0]!;
    expect(args._).toContain('build the new feature');
  });
});
