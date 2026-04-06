/**
 * Tests for lifecycle-hooks.ts — hook runner register/emit system.
 * Requirements: LH-11, LH-12, LH-13
 */

import { describe, it, expect, vi } from 'vitest';
import { createHookRunner } from '../shared/lifecycle-hooks.js';
import { limitHookOutput, HOOK_OUTPUT_LIMIT } from '../shared/hook-output-limiter.js';
import type { HookDefinition, HookContext } from '../shared/lifecycle-hooks.js';

// ---------------------------------------------------------------------------
// Hook Runner
// ---------------------------------------------------------------------------

describe('createHookRunner', () => {
  const baseContext: HookContext = {
    skillId: 'workflow.status',
    phase: 3,
    zone: 'green',
    timestamp: '2026-04-06T00:00:00Z',
  };

  it('starts with an empty hook list', () => {
    const runner = createHookRunner();
    expect(runner.list()).toEqual([]);
  });

  it('registers hooks and lists them', () => {
    const runner = createHookRunner();
    const hook: HookDefinition = {
      event: 'PreSkill',
      name: 'test-hook',
      handler: async () => {},
      enabled: true,
    };

    runner.register(hook);
    expect(runner.list()).toHaveLength(1);
    expect(runner.list()[0].name).toBe('test-hook');
  });

  it('returns a copy from list() — mutations do not affect internals', () => {
    const runner = createHookRunner();
    runner.register({
      event: 'PreSkill',
      name: 'hook-a',
      handler: async () => {},
      enabled: true,
    });

    const list = runner.list();
    list.pop();
    expect(runner.list()).toHaveLength(1);
  });

  it('emits events to matching hooks', async () => {
    const runner = createHookRunner();
    const called: string[] = [];

    runner.register({
      event: 'PreSkill',
      name: 'pre-hook',
      handler: async () => { called.push('pre'); },
      enabled: true,
    });
    runner.register({
      event: 'PostSkill',
      name: 'post-hook',
      handler: async () => { called.push('post'); },
      enabled: true,
    });

    await runner.emit('PreSkill', baseContext);
    expect(called).toEqual(['pre']);
  });

  it('runs hooks in registration order', async () => {
    const runner = createHookRunner();
    const order: number[] = [];

    runner.register({
      event: 'SessionStart',
      name: 'first',
      handler: async () => { order.push(1); },
      enabled: true,
    });
    runner.register({
      event: 'SessionStart',
      name: 'second',
      handler: async () => { order.push(2); },
      enabled: true,
    });
    runner.register({
      event: 'SessionStart',
      name: 'third',
      handler: async () => { order.push(3); },
      enabled: true,
    });

    await runner.emit('SessionStart', baseContext);
    expect(order).toEqual([1, 2, 3]);
  });

  it('skips disabled hooks', async () => {
    const runner = createHookRunner();
    const handler = vi.fn();

    runner.register({
      event: 'PreCompact',
      name: 'disabled-hook',
      handler,
      enabled: false,
    });

    await runner.emit('PreCompact', baseContext);
    expect(handler).not.toHaveBeenCalled();
  });

  it('catches errors in hooks — never throws', async () => {
    const runner = createHookRunner();
    const afterError = vi.fn();

    runner.register({
      event: 'SessionEnd',
      name: 'broken-hook',
      handler: async () => { throw new Error('boom'); },
      enabled: true,
    });
    runner.register({
      event: 'SessionEnd',
      name: 'good-hook',
      handler: afterError,
      enabled: true,
    });

    // Should not throw
    await expect(runner.emit('SessionEnd', baseContext)).resolves.toBeUndefined();
    // The second hook should still run
    expect(afterError).toHaveBeenCalledOnce();
  });

  it('passes context to hook handlers', async () => {
    const runner = createHookRunner();
    let receivedCtx: HookContext | null = null;

    runner.register({
      event: 'PreSkill',
      name: 'ctx-check',
      handler: async (ctx) => { receivedCtx = ctx; },
      enabled: true,
    });

    await runner.emit('PreSkill', baseContext);
    expect(receivedCtx).toEqual(baseContext);
  });

  it('does nothing when no hooks match the event', async () => {
    const runner = createHookRunner();
    const handler = vi.fn();

    runner.register({
      event: 'PreSkill',
      name: 'pre-only',
      handler,
      enabled: true,
    });

    await runner.emit('PostSkill', baseContext);
    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Output Limiter
// ---------------------------------------------------------------------------

describe('limitHookOutput', () => {
  it('returns short output unchanged', () => {
    const result = limitHookOutput('hello');
    expect(result.text).toBe('hello');
    expect(result.truncated).toBe(false);
    expect(result.originalLength).toBe(5);
  });

  it('returns output at exact limit unchanged', () => {
    const exact = 'x'.repeat(HOOK_OUTPUT_LIMIT);
    const result = limitHookOutput(exact);
    expect(result.text).toBe(exact);
    expect(result.truncated).toBe(false);
    expect(result.originalLength).toBe(HOOK_OUTPUT_LIMIT);
  });

  it('truncates output exceeding the limit', () => {
    const oversized = 'a'.repeat(HOOK_OUTPUT_LIMIT + 500);
    const result = limitHookOutput(oversized);

    expect(result.truncated).toBe(true);
    expect(result.originalLength).toBe(HOOK_OUTPUT_LIMIT + 500);
    expect(result.text).toContain('[truncated');
    expect(result.text.startsWith('a'.repeat(HOOK_OUTPUT_LIMIT))).toBe(true);
  });

  it('returns empty string unchanged', () => {
    const result = limitHookOutput('');
    expect(result.text).toBe('');
    expect(result.truncated).toBe(false);
    expect(result.originalLength).toBe(0);
  });

  it('HOOK_OUTPUT_LIMIT is 10000', () => {
    expect(HOOK_OUTPUT_LIMIT).toBe(10_000);
  });
});
