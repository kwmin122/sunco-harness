/**
 * Layer 6 behavior tests — cross-family selection and --require-codex paths.
 */

import { describe, it, expect, vi } from 'vitest';
import type { SkillContext } from '@sunco/core';
import type { VerifyFinding } from '../verify-types.js';

// Import the real function (not mocked)
const { runLayer6CrossModel } = await import('../verify-layers.js');

function makeMockCtx(overrides: Record<string, unknown> = {}): SkillContext {
  return {
    agent: {
      listProvidersWithFamily: vi.fn().mockResolvedValue([
        { id: 'claude-code-cli', family: 'claude' },
        { id: 'codex-cli', family: 'openai' },
      ]),
      crossVerify: vi.fn().mockResolvedValue([
        {
          providerId: 'codex-cli',
          success: true,
          outputText: '{"findings": []}',
          artifacts: [],
          warnings: [],
          usage: { estimated: true, wallTimeMs: 100 },
        },
      ]),
      run: vi.fn().mockResolvedValue({
        providerId: 'claude-code-cli',
        success: true,
        outputText: '{"findings": []}',
        artifacts: [],
        warnings: [],
        usage: { estimated: true, wallTimeMs: 100 },
      }),
      listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    ...overrides,
  } as unknown as SkillContext;
}

describe('runLayer6CrossModel', () => {
  it('uses cross-family pair when claude + codex available', async () => {
    const ctx = makeMockCtx();
    await runLayer6CrossModel(ctx, 'diff content', []);

    expect(ctx.agent.crossVerify).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'verification' }),
      ['claude-code-cli', 'codex-cli'],
    );
  });

  it('codex unavailable + normal mode → skeptical fallback + low WARN', async () => {
    const ctx = makeMockCtx();
    (ctx.agent.listProvidersWithFamily as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'claude-code-cli', family: 'claude' },
    ]);

    const result = await runLayer6CrossModel(ctx, 'diff', []);

    expect(result.passed).toBe(true);
    expect(result.findings.some((f: VerifyFinding) =>
      f.severity === 'low' && f.description.includes('install codex'),
    )).toBe(true);
  });

  it('codex unavailable + requireCodex → high-severity FAIL', async () => {
    const ctx = makeMockCtx();
    (ctx.agent.listProvidersWithFamily as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'claude-code-cli', family: 'claude' },
    ]);

    const result = await runLayer6CrossModel(ctx, 'diff', [], { requireCodex: true });

    expect(result.passed).toBe(false);
    expect(result.findings.some((f: VerifyFinding) =>
      f.severity === 'high' && f.description.includes('require-codex'),
    )).toBe(true);
    // Skeptical reviewer should NOT have run
    expect(ctx.agent.run).not.toHaveBeenCalled();
  });

  it('crossVerify throws + normal mode → skeptical fallback', async () => {
    const ctx = makeMockCtx();
    (ctx.agent.crossVerify as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));

    const result = await runLayer6CrossModel(ctx, 'diff', []);

    expect(result.passed).toBe(true);
    expect(ctx.agent.run).toHaveBeenCalled(); // skeptical reviewer ran
  });

  it('crossVerify throws + requireCodex → high-severity FAIL', async () => {
    const ctx = makeMockCtx();
    (ctx.agent.crossVerify as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));

    const result = await runLayer6CrossModel(ctx, 'diff', [], { requireCodex: true });

    expect(result.passed).toBe(false);
    expect(ctx.agent.run).not.toHaveBeenCalled(); // no fallback in strict mode
  });
});
