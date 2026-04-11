/**
 * Alias Backwards-Compat Tests (Phase 32)
 *
 * End-to-end verification that alias infrastructure doesn't break existing usage.
 * Drives through the SkillRegistry API directly (no CLI spawn needed).
 *
 * Cases guaranteed by D-09 (zero regression) and D-10 (ctx.run() compat):
 * 1. 'fast' command resolves to quickSkill
 * 2. 'progress' command resolves to statusSkill
 * 3. ctx.run('workflow.fast') invokes quick with speed: 'fast'
 * 4. ctx.run('workflow.progress') invokes status
 * 5. User args beat alias defaultArgs
 * 6. 'fast' is NOT in getByTier('user')
 * 7. 'fast' is NOT in getAll()
 * 8. Equivalence: execute('workflow.fast') ≡ execute('workflow.quick' + speed:fast)
 */

import { describe, it, expect, vi } from 'vitest';
import { SkillRegistry } from '@sunco/core';
import type { SkillContext } from '@sunco/core';
import quickSkill from '../quick.skill.js';
import { statusSkill } from '../status.skill.js';

// ---------------------------------------------------------------------------
// Mock context factory (no real filesystem or SQLite needed)
// ---------------------------------------------------------------------------

function makeCtx(args: Record<string, unknown> = {}): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as SkillContext['state'],
    fileStore: {
      read: vi.fn().mockResolvedValue(undefined),
      write: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(false),
    } as unknown as SkillContext['fileStore'],
    agent: {
      run: vi.fn().mockResolvedValue({ success: true, outputText: 'done' }),
    } as unknown as SkillContext['agent'],
    recommend: {
      getRecommendations: vi.fn().mockReturnValue([]),
    } as unknown as SkillContext['recommend'],
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      askText: vi.fn().mockResolvedValue({ text: 'test task' }),
      ask: vi.fn().mockResolvedValue({ choice: 'yes' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
    } as unknown as SkillContext['ui'],
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: vi.fn(),
    cwd: '/tmp/test-project',
    args,
    signal: new AbortController().signal,
    registry: {} as SkillContext['registry'],
  };
}

// ---------------------------------------------------------------------------
// Setup: build a minimal registry with both skills
// ---------------------------------------------------------------------------

function buildRegistry() {
  const registry = new SkillRegistry();
  registry.register(quickSkill);
  registry.register(statusSkill);
  return registry;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('alias backwards-compat (Phase 32)', () => {

  // Case 1: 'fast' command resolves to quickSkill
  it('registry.resolveCommand("fast") returns quickSkill with isAlias: true', () => {
    const registry = buildRegistry();
    const result = registry.resolveCommand('fast');

    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.skill).toBe(quickSkill);
    expect(result?.defaultArgs).toEqual({ speed: 'fast' });
  });

  // Case 2: 'progress' command resolves to statusSkill
  it('registry.resolveCommand("progress") returns statusSkill with isAlias: true', () => {
    const registry = buildRegistry();
    const result = registry.resolveCommand('progress');

    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.skill).toBe(statusSkill);
    expect(result?.defaultArgs).toEqual({});
  });

  // Case 3: ctx.run('workflow.fast') via registry.execute invokes quick with speed: 'fast'
  it('registry.execute("workflow.fast") calls quick execute with speed: "fast"', async () => {
    const capturedArgs: Record<string, unknown>[] = [];

    // Build a custom quick skill that captures args
    const { defineSkill } = await import('@sunco/core');
    const capturingQuick = defineSkill({
      ...quickSkill,
      execute: async (ctx) => {
        capturedArgs.push({ ...ctx.args });
        return { success: true, summary: 'done' };
      },
    });

    const registry = new SkillRegistry();
    registry.register(capturingQuick);

    const ctx = makeCtx({});  // no user args
    await registry.execute('workflow.fast', ctx);

    expect(capturedArgs).toHaveLength(1);
    expect(capturedArgs[0].speed).toBe('fast');
  });

  // Case 4: ctx.run('workflow.progress') via resolveId confirms status skill is returned
  it('registry.resolveId("workflow.progress") resolves to statusSkill (ctx.run compat)', () => {
    const registry = buildRegistry();

    // Verify resolveId returns the status skill, confirming ctx.run('workflow.progress') compat
    const result = registry.resolveId('workflow.progress');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.skill.id).toBe('workflow.status');
    // No defaultArgs for the progress alias (it's identical to status)
    expect(result?.defaultArgs).toEqual({});
  });

  // Case 5: User args beat alias defaultArgs
  it('user args override alias defaultArgs (speed: "slow" beats speed: "fast")', async () => {
    const capturedArgs: Record<string, unknown>[] = [];

    const { defineSkill } = await import('@sunco/core');
    const capturingQuick = defineSkill({
      ...quickSkill,
      execute: async (ctx) => {
        capturedArgs.push({ ...ctx.args });
        return { success: true, summary: 'done' };
      },
    });

    const registry = new SkillRegistry();
    registry.register(capturingQuick);

    const ctx = makeCtx({ speed: 'slow' });  // user explicitly overrides
    await registry.execute('workflow.fast', ctx);

    expect(capturedArgs[0].speed).toBe('slow');  // user wins
  });

  // Case 6: 'fast' is NOT in getByTier('user')
  it('"fast" is NOT in registry.getByTier("user")', () => {
    const registry = buildRegistry();
    const userCommands = registry.getByTier('user').map((s) => s.command);
    expect(userCommands).not.toContain('fast');
  });

  // Case 7: 'fast' is NOT in getAll()
  it('"fast" is NOT in registry.getAll()', () => {
    const registry = buildRegistry();
    const allCommands = registry.getAll().map((s) => s.command);
    expect(allCommands).not.toContain('fast');
    expect(allCommands).not.toContain('progress');
  });

  // Case 8: Equivalence — execute('workflow.fast') ≡ execute('workflow.quick' with speed:fast)
  it('execute("workflow.fast") and execute("workflow.quick", {speed:"fast"}) produce equivalent shapes', async () => {
    const { defineSkill } = await import('@sunco/core');
    const results: { id: string; args: Record<string, unknown> }[] = [];

    const capturingQuick = defineSkill({
      ...quickSkill,
      execute: async (ctx) => {
        results.push({ id: 'workflow.quick', args: { ...ctx.args } });
        return { success: true, summary: 'done', data: { speed: ctx.args.speed } };
      },
    });

    const registry = new SkillRegistry();
    registry.register(capturingQuick);

    // Path A: via alias
    const ctxA = makeCtx({});
    const resultA = await registry.execute('workflow.fast', ctxA);

    // Path B: via main skill with explicit speed: 'fast'
    const ctxB = makeCtx({ speed: 'fast' });
    const resultB = await registry.execute('workflow.quick', ctxB);

    // Both should produce the same structure
    expect(resultA.success).toBe(resultB.success);
    expect(resultA.summary).toBe(resultB.summary);
    expect(results[0].args.speed).toBe('fast');
    expect(results[1].args.speed).toBe('fast');
  });
});
