/**
 * Tests for brainstorming.skill.ts (sunco brainstorming)
 *
 * Verifies:
 * - Skill metadata (id, command, kind, stage, aliases)
 * - Fails gracefully when no AI provider is available
 * - Fails gracefully when the vendored Superpowers SKILL.md cannot be located
 * - Passes the vendored source + user idea into the planning agent prompt
 * - Returns a SUNCO handoff summary pointing at /sunco:new --from-preflight
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises BEFORE importing the skill. Default to "not found" so tests
// opt into the source-present path by overriding per test.
vi.mock('node:fs/promises', () => ({
  readFile: vi
    .fn()
    .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
  access: vi
    .fn()
    .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
}));

import { readFile, access } from 'node:fs/promises';
import brainstormingSkill, { parseVisualStartOutput } from '../brainstorming.skill.js';
import type { SkillContext, AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgentResult(overrides?: Partial<AgentResult>): AgentResult {
  return {
    providerId: 'claude-code-cli',
    success: true,
    outputText: 'design draft',
    artifacts: [],
    warnings: [],
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      estimated: true,
      wallTimeMs: 10,
    },
    ...overrides,
  };
}

function createMockContext(
  overrides: Partial<SkillContext> = {},
): SkillContext {
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
    agent: {
      run: vi.fn().mockResolvedValue(makeAgentResult()),
      crossVerify: vi.fn(),
      listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
    } as unknown as SkillContext['agent'],
    recommend: {
      getRecommendations: vi.fn().mockReturnValue([]),
      getTopRecommendation: vi.fn().mockReturnValue(undefined),
    },
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi
        .fn()
        .mockResolvedValue({ selectedId: '', selectedLabel: '', source: 'default' }),
      askText: vi.fn().mockResolvedValue({ text: 'a cool idea', source: 'keyboard' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: vi.fn().mockResolvedValue({ success: true }),
    cwd: '/test/project',
    args: { _: [] },
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('brainstormingSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the default readFile mock to "not found" between tests.
    vi.mocked(readFile).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );
  });

  it('has correct skill metadata', () => {
    expect(brainstormingSkill.id).toBe('workflow.brainstorming');
    expect(brainstormingSkill.command).toBe('brainstorming');
    expect(brainstormingSkill.kind).toBe('prompt');
    expect(brainstormingSkill.stage).toBe('stable');
  });

  it('exposes brainstorm alias for backcompat', () => {
    const aliases = brainstormingSkill.aliases ?? [];
    const brainstormAlias = aliases.find(
      (a) => a.command === 'brainstorm',
    );
    expect(brainstormAlias).toBeDefined();
    expect(brainstormAlias?.replacedBy).toBe('brainstorming');
  });

  it('returns failure when no AI provider is available', async () => {
    const ctx = createMockContext({
      args: { _: ['a test idea'] },
      agent: {
        run: vi.fn(),
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue([]),
      } as unknown as SkillContext['agent'],
    } as Partial<SkillContext>);

    const result = await brainstormingSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary?.toLowerCase()).toMatch(/provider|agent/);
    expect(ctx.agent.run).not.toHaveBeenCalled();
  });

  it('returns failure when the vendored Superpowers source cannot be found', async () => {
    // readFile default rejection stays in place — no candidate path exists.
    const ctx = createMockContext({
      args: { _: ['a test idea'] },
    } as Partial<SkillContext>);

    const result = await brainstormingSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary?.toLowerCase()).toMatch(/superpowers|source/);
    expect(ctx.agent.run).not.toHaveBeenCalled();
  });

  it('passes the vendored source and user idea into the planning agent', async () => {
    // First readFile candidate succeeds.
    vi.mocked(readFile).mockResolvedValueOnce(
      '# Brainstorming\n<HARD-GATE>no implementation</HARD-GATE>',
    );

    const ctx = createMockContext({
      args: { _: ['build', 'a', 'minimal', 'ci', 'dashboard'] },
    } as Partial<SkillContext>);

    const result = await brainstormingSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.agent.run).toHaveBeenCalledTimes(1);

    const runArg = vi.mocked(ctx.agent.run).mock.calls[0]![0] as {
      role: string;
      prompt: string;
      permissions: { writePaths: string[]; allowGitWrite: boolean };
    };
    expect(runArg.role).toBe('planning');
    expect(runArg.prompt).toContain('Superpowers brainstorming');
    expect(runArg.prompt).toContain('HARD-GATE');
    expect(runArg.prompt).toContain('build a minimal ci dashboard');
    // The agent runs read-only — no writes, no git commits.
    expect(runArg.permissions.writePaths).toEqual([]);
    expect(runArg.permissions.allowGitWrite).toBe(false);
  });

  it('returns a handoff summary pointing at /sunco:new --from-preflight', async () => {
    vi.mocked(readFile).mockResolvedValueOnce('# Brainstorming');

    const ctx = createMockContext({
      args: { _: ['idea'] },
    } as Partial<SkillContext>);

    const result = await brainstormingSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.summary).toContain('/sunco:new --from-preflight');
    const data = result.data as { next?: string } | undefined;
    expect(data?.next).toContain('/sunco:new --from-preflight');
  });

  it('prompts for the idea interactively when no positional args are given', async () => {
    vi.mocked(readFile).mockResolvedValueOnce('# Brainstorming');

    const ctx = createMockContext({
      args: { _: [] },
    } as Partial<SkillContext>);

    await brainstormingSkill.execute(ctx);

    expect(ctx.ui.askText).toHaveBeenCalled();
    const runArg = vi.mocked(ctx.agent.run).mock.calls[0]![0] as {
      prompt: string;
    };
    // The interactive answer "a cool idea" should make it into the prompt.
    expect(runArg.prompt).toContain('a cool idea');
  });

  it('skips visual companion boot when --visual is absent', async () => {
    vi.mocked(readFile).mockResolvedValueOnce('# Brainstorming');

    const ctx = createMockContext({
      args: { _: ['idea'] },
    } as Partial<SkillContext>);

    const result = await brainstormingSkill.execute(ctx);
    const data = result.data as { visualCompanion?: unknown } | undefined;
    expect(data?.visualCompanion).toBeUndefined();

    const runArg = vi.mocked(ctx.agent.run).mock.calls[0]![0] as { prompt: string };
    expect(runArg.prompt).not.toMatch(/Visual companion:/);
  });

  it('reports unavailable when --visual is on but start script is not installed', async () => {
    // SKILL.md found, but access() rejects for every candidate script path.
    vi.mocked(readFile).mockResolvedValueOnce('# Brainstorming');

    const ctx = createMockContext({
      args: { _: ['idea'], visual: true },
    } as Partial<SkillContext>);

    const result = await brainstormingSkill.execute(ctx);

    const data = result.data as {
      visualCompanion?: { started: boolean; error?: string };
    };
    expect(data.visualCompanion?.started).toBe(false);
    expect(data.visualCompanion?.error).toBeDefined();
    const runArg = vi.mocked(ctx.agent.run).mock.calls[0]![0] as { prompt: string };
    expect(runArg.prompt).toContain('Visual companion: UNAVAILABLE');
  });
});

describe('parseVisualStartOutput', () => {
  it('extracts url/port/screen_dir from a server-started JSON line', () => {
    const raw =
      '{"type":"server-started","port":52341,"url":"http://localhost:52341","session_dir":"/tmp/x","state_dir":"/tmp/x/state","screen_dir":"/tmp/x/content"}\n';
    const parsed = parseVisualStartOutput(raw);
    expect(parsed).toMatchObject({
      started: true,
      url: 'http://localhost:52341',
      port: 52341,
      screenDir: '/tmp/x/content',
    });
  });

  it('returns null when no recognizable line is present', () => {
    expect(parseVisualStartOutput('no server here\njust noise\n')).toBeNull();
  });

  it('returns null when the line is not valid JSON', () => {
    expect(parseVisualStartOutput('server-started but not json\n')).toBeNull();
  });
});
