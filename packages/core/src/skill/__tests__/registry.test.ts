/**
 * @sunco/core - SkillRegistry tests
 *
 * Tests for:
 * - register() with main skills and alias declarations
 * - resolveCommand() for main and alias commands
 * - resolveId() for main and alias ids
 * - execute() merges defaultArgs with user args (user wins on conflict)
 * - Duplicate alias command/id handling (warn + skip)
 *
 * Phase 32: alias infrastructure tests (10 new cases)
 */

import { describe, it, expect, vi } from 'vitest';
import { SkillRegistry } from '../registry.js';
import { defineSkill } from '../define.js';
import { SkillNotFoundError } from '../../errors/index.js';
import type { SkillContext, SkillResult } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(args: Record<string, unknown> = {}): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: {} as SkillContext['state'],
    fileStore: {} as SkillContext['fileStore'],
    agent: {} as SkillContext['agent'],
    recommend: {} as SkillContext['recommend'],
    ui: {} as SkillContext['ui'],
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: vi.fn(),
    cwd: '/tmp',
    args,
    signal: new AbortController().signal,
    registry: {} as SkillContext['registry'],
  };
}

function makeQuickSkill(executeFn?: (ctx: SkillContext) => Promise<SkillResult>) {
  return defineSkill({
    id: 'workflow.quick',
    command: 'quick',
    description: 'Quick task execution',
    kind: 'prompt',
    stage: 'stable',
    category: 'workflow',
    routing: 'directExec',
    aliases: [
      {
        command: 'fast',
        id: 'workflow.fast',
        defaultArgs: { speed: 'fast' },
        hidden: true,
        replacedBy: 'quick --speed fast',
      },
    ],
    execute: executeFn ?? (async (ctx) => ({
      success: true,
      summary: 'quick executed',
      data: { receivedArgs: ctx.args },
    })),
  });
}

function makeStatusSkill() {
  return defineSkill({
    id: 'workflow.status',
    command: 'status',
    description: 'Project status',
    kind: 'deterministic',
    stage: 'stable',
    category: 'workflow',
    routing: 'routable',
    tier: 'user',
    aliases: [
      {
        command: 'progress',
        id: 'workflow.progress',
        hidden: true,
        replacedBy: 'status',
      },
    ],
    execute: async () => ({ success: true, summary: 'status executed' }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillRegistry alias infrastructure (Phase 32)', () => {

  // Case 1: register() accepts aliases and populates alias maps
  it('register() accepts a skill with aliases array and populates alias maps', () => {
    const registry = new SkillRegistry();
    const quickSkill = makeQuickSkill();
    registry.register(quickSkill);

    // resolveCommand should find the alias
    const result = registry.resolveCommand('fast');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.skill.id).toBe('workflow.quick');
  });

  // Case 2: resolveCommand('fast') returns isAlias:true with correct defaultArgs
  it('resolveCommand("fast") returns { isAlias: true, defaultArgs: { speed: "fast" } }', () => {
    const registry = new SkillRegistry();
    registry.register(makeQuickSkill());

    const result = registry.resolveCommand('fast');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.defaultArgs).toEqual({ speed: 'fast' });
    expect(result?.skill.command).toBe('quick');
  });

  // Case 3: resolveCommand('quick') returns isAlias:false
  it('resolveCommand("quick") returns { isAlias: false, defaultArgs: {} }', () => {
    const registry = new SkillRegistry();
    registry.register(makeQuickSkill());

    const result = registry.resolveCommand('quick');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(false);
    expect(result?.defaultArgs).toEqual({});
    expect(result?.skill.id).toBe('workflow.quick');
  });

  // Case 4: resolveCommand('unknown') returns undefined
  it('resolveCommand("unknown") returns undefined', () => {
    const registry = new SkillRegistry();
    registry.register(makeQuickSkill());

    expect(registry.resolveCommand('unknown')).toBeUndefined();
  });

  // Case 5: resolveId('workflow.fast') returns the quick skill + defaultArgs
  it('resolveId("workflow.fast") returns the quick skill + defaultArgs', () => {
    const registry = new SkillRegistry();
    registry.register(makeQuickSkill());

    const result = registry.resolveId('workflow.fast');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.skill.id).toBe('workflow.quick');
    expect(result?.defaultArgs).toEqual({ speed: 'fast' });
  });

  // Case 6: resolveId('workflow.quick') returns the quick skill + empty args
  it('resolveId("workflow.quick") returns the quick skill + empty defaultArgs', () => {
    const registry = new SkillRegistry();
    registry.register(makeQuickSkill());

    const result = registry.resolveId('workflow.quick');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(false);
    expect(result?.skill.id).toBe('workflow.quick');
    expect(result?.defaultArgs).toEqual({});
  });

  // Case 7: Duplicate alias command → warn + skip (no throw)
  it('duplicate alias command across two skills warns and skips', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new SkillRegistry();

    const skill1 = makeQuickSkill();
    const skill2 = defineSkill({
      id: 'workflow.other',
      command: 'other',
      description: 'Another skill',
      kind: 'deterministic',
      stage: 'stable',
      category: 'workflow',
      routing: 'directExec',
      aliases: [
        {
          command: 'fast',  // duplicate alias command
          id: 'workflow.other-fast',
          defaultArgs: { mode: 'other' },
        },
      ],
      execute: async () => ({ success: true }),
    });

    registry.register(skill1);
    expect(() => registry.register(skill2)).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Skipping duplicate alias command: 'fast'"),
    );

    // The first registration wins
    const result = registry.resolveCommand('fast');
    expect(result?.skill.id).toBe('workflow.quick');

    warnSpy.mockRestore();
  });

  // Case 8: execute('workflow.fast', ctx) invokes quick's execute with args: { speed: 'fast' }
  it('execute("workflow.fast", ctx) invokes quick skill with speed: "fast" injected', async () => {
    const capturedArgs: Record<string, unknown>[] = [];
    const quickSkill = makeQuickSkill(async (ctx) => {
      capturedArgs.push({ ...ctx.args });
      return { success: true, summary: 'done' };
    });

    const registry = new SkillRegistry();
    registry.register(quickSkill);

    const ctx = makeContext({});  // no args from user
    await registry.execute('workflow.fast', ctx);

    expect(capturedArgs).toHaveLength(1);
    expect(capturedArgs[0]).toMatchObject({ speed: 'fast' });
  });

  // Case 9: execute('workflow.fast', ctxWithSpeedSlow) → user speed: 'slow' overrides alias default
  it('user args beat alias defaultArgs on conflict', async () => {
    const capturedArgs: Record<string, unknown>[] = [];
    const quickSkill = makeQuickSkill(async (ctx) => {
      capturedArgs.push({ ...ctx.args });
      return { success: true, summary: 'done' };
    });

    const registry = new SkillRegistry();
    registry.register(quickSkill);

    const ctx = makeContext({ speed: 'slow' });  // user overrides
    await registry.execute('workflow.fast', ctx);

    expect(capturedArgs).toHaveLength(1);
    expect(capturedArgs[0].speed).toBe('slow');  // user wins
  });

  // Case 10: execute('unknown.id') throws SkillNotFoundError
  it('execute("unknown.id") throws SkillNotFoundError', async () => {
    const registry = new SkillRegistry();
    registry.register(makeQuickSkill());

    const ctx = makeContext();
    await expect(registry.execute('unknown.id', ctx)).rejects.toThrow(SkillNotFoundError);
  });

  // Bonus: verify status alias (progress) also works
  it('resolveCommand("progress") returns statusSkill with isAlias: true', () => {
    const registry = new SkillRegistry();
    registry.register(makeStatusSkill());

    const result = registry.resolveCommand('progress');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.skill.id).toBe('workflow.status');
    expect(result?.defaultArgs).toEqual({});
  });

  it('resolveId("workflow.progress") returns statusSkill with isAlias: true', () => {
    const registry = new SkillRegistry();
    registry.register(makeStatusSkill());

    const result = registry.resolveId('workflow.progress');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.skill.id).toBe('workflow.status');
  });
});
