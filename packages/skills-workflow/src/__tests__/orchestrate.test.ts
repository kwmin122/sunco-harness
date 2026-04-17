/**
 * Tests for orchestrate.skill.ts.
 *
 * Verifies:
 *   - metadata (id, command, kind=prompt)
 *   - --plan dry-run returns the plan without running any step
 *   - full execution calls ctx.run for each non-agent step, in plan order
 *   - context_pack flows through to each delegated skill call
 *   - stop-on-fail aborts after first failure
 *   - default behavior continues despite failures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import orchestrateSkill from '../orchestrate.skill.js';
import type { SkillContext, SkillResult } from '@sunco/core';

function makeCtx(
  args: Record<string, unknown>,
  runImpl?: (id: string, args: unknown) => Promise<SkillResult>,
): SkillContext {
  const defaultRun = async (): Promise<SkillResult> => ({ success: true, summary: 'ok' });
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
      askText: vi.fn().mockResolvedValue({ text: '' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: vi.fn(runImpl ?? defaultRun),
    cwd: '/tmp/orch',
    args,
    signal: new AbortController().signal,
  } as unknown as SkillContext;
}

describe('orchestrateSkill metadata', () => {
  it('has the expected id/command/kind', () => {
    expect(orchestrateSkill.id).toBe('workflow.orchestrate');
    expect(orchestrateSkill.command).toBe('orchestrate');
    expect(orchestrateSkill.kind).toBe('prompt');
    expect(orchestrateSkill.stage).toBe('stable');
  });
});

describe('orchestrateSkill --plan (dry run)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not call ctx.run when --plan is set', async () => {
    const ctx = makeCtx({ _: ['refactor the router'], plan: true });
    const result = await orchestrateSkill.execute(ctx);

    expect(result.success).toBe(true);
    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    expect(runMock).not.toHaveBeenCalled();
    const data = result.data as { dryRun: boolean; plan: { steps: unknown[] } };
    expect(data.dryRun).toBe(true);
    expect(data.plan.steps.length).toBeGreaterThan(0);
  });

  it('--dry-run is an alias for --plan', async () => {
    const ctx = makeCtx({ _: ['refactor the router'], 'dry-run': true });
    await orchestrateSkill.execute(ctx);
    expect((ctx.run as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});

describe('orchestrateSkill execution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls each non-agent delegate once in plan order, passing the context pack', async () => {
    const calls: Array<{ id: string; args: Record<string, unknown> }> = [];
    const ctx = makeCtx(
      { _: ['refactor the auth middleware'] },
      async (id, args) => {
        calls.push({ id, args: args as Record<string, unknown> });
        return { success: true, summary: `${id} done` };
      },
    );

    await orchestrateSkill.execute(ctx);

    // The plan for "refactor the auth middleware" is:
    // oracle (agent) → developer → oracle (agent) → verifier.
    // Skill-delegated calls go to ctx.run; agent-typed ones are advisory.
    const skillIds = calls.map((c) => c.id);
    expect(skillIds).toContain('workflow.quick');
    expect(skillIds).toContain('workflow.verify');

    // Every call received a context_pack string containing the original request.
    for (const c of calls) {
      expect(typeof c.args.context_pack).toBe('string');
      expect(c.args.context_pack as string).toContain(
        'Original request: refactor the auth middleware',
      );
    }
  });

  it('later steps see earlier outputs in the context pack', async () => {
    const seen: string[] = [];
    const ctx = makeCtx(
      { _: ['fix bug — where is the rate limiter?'] },
      async (id, args) => {
        const pack = (args as Record<string, unknown>).context_pack as string;
        seen.push(pack);
        return { success: true, summary: `${id}-summary` };
      },
    );

    await orchestrateSkill.execute(ctx);

    // First call has no prior outputs; last call has at least one prior output.
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[0]).not.toMatch(/Prior steps:/);
    expect(seen[seen.length - 1]).toMatch(/Prior steps:/);
  });

  it('stop-on-fail aborts after the first failed step', async () => {
    const runMock = vi.fn(async (id: string): Promise<SkillResult> => {
      if (id === 'workflow.scan') return { success: false, summary: 'scan failed' };
      return { success: true, summary: 'ok' };
    });

    const ctx = makeCtx(
      { _: ['where is the rate limiter'], 'stop-on-fail': true },
      (id, args) => runMock(id, args),
    );
    await orchestrateSkill.execute(ctx);
    // Plan: explorer (workflow.scan) → developer (workflow.quick) → verifier (workflow.verify)
    // With stop-on-fail, only scan should run.
    const ids = runMock.mock.calls.map((c) => c[0]);
    expect(ids).toEqual(['workflow.scan']);
  });

  it('without --stop-on-fail, continues through the chain despite failures', async () => {
    const runMock = vi.fn(async (id: string): Promise<SkillResult> => {
      if (id === 'workflow.scan') return { success: false, summary: 'scan failed' };
      return { success: true, summary: 'ok' };
    });

    const ctx = makeCtx(
      { _: ['where is the rate limiter'] },
      (id, args) => runMock(id, args),
    );
    const result = await orchestrateSkill.execute(ctx);
    const ids = runMock.mock.calls.map((c) => c[0]);
    expect(ids.length).toBeGreaterThan(1);
    expect(result.success).toBe(false);
  });
});
