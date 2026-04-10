/**
 * AdvisorRunner unit tests (Phase 28).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdvisorRunner } from '../advisor.js';
import type { AdvisorConfig, AdvisorRequest } from '../types.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';

const baseCfg: AdvisorConfig = {
  enabled: true,
  transport: 'subagent',
  subagentName: 'sunco-advisor',
  modelHint: 'opus',
  maxCallsPerSkill: 2,
  timeoutMs: 5_000,
  maxTurns: 1,
  maxPromptChars: 10_000,
  strict: false,
  requireSignature: true,
  signaturePattern: '[sunco-advisor v1 model=opus]',
};

function dummyReq(): AdvisorRequest {
  return {
    skillId: 'workflow.plan',
    phaseId: '27',
    question: 'Is this safe?',
    context: { goal: 'test', evidence: ['e1'] },
  };
}

function dummyPrompt(_req: AdvisorRequest): string {
  return 'test prompt';
}

describe('AdvisorRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns disabled result when config.enabled is false', async () => {
    const runner = new AdvisorRunner({ ...baseCfg, enabled: false }, '/tmp');
    const result = await runner.run(dummyReq(), dummyPrompt);
    expect(result.success).toBe(false);
    expect(result.warnings[0]?.code).toBe('disabled');
  });

  it('invokes subagent and verifies signature', async () => {
    const mockedExeca = execa as unknown as ReturnType<typeof vi.fn>;
    mockedExeca.mockResolvedValue({ stdout: '1. Check scope\n[sunco-advisor v1 model=opus]' });

    const runner = new AdvisorRunner(baseCfg, '/tmp');
    const result = await runner.run(dummyReq(), dummyPrompt);

    expect(result.success).toBe(true);
    expect(result.signaturePresent).toBe(true);
    expect(result.advice).toBe('1. Check scope');
  });

  it('flags missing signature', async () => {
    const mockedExeca = execa as unknown as ReturnType<typeof vi.fn>;
    mockedExeca.mockResolvedValue({ stdout: 'Just advice without sig.' });

    const runner = new AdvisorRunner(baseCfg, '/tmp');
    const result = await runner.run(dummyReq(), dummyPrompt);

    expect(result.signaturePresent).toBe(false);
    expect(result.warnings.some(w => w.code === 'no_signature')).toBe(true);
  });

  it('enforces maxCallsPerSkill', async () => {
    const mockedExeca = execa as unknown as ReturnType<typeof vi.fn>;
    mockedExeca.mockResolvedValue({ stdout: 'ok [sunco-advisor v1 model=opus]' });

    const runner = new AdvisorRunner({ ...baseCfg, maxCallsPerSkill: 1 }, '/tmp');
    await runner.run(dummyReq(), dummyPrompt);
    const second = await runner.run(dummyReq(), dummyPrompt);
    expect(second.success).toBe(false);
    expect(second.warnings.some(w => w.code === 'cap_exceeded')).toBe(true);
  });

  it('handles transport error without failing in non-strict mode', async () => {
    const mockedExeca = execa as unknown as ReturnType<typeof vi.fn>;
    mockedExeca.mockRejectedValue(new Error('Connection refused'));

    const runner = new AdvisorRunner({ ...baseCfg, strict: false }, '/tmp');
    const result = await runner.run(dummyReq(), dummyPrompt);
    expect(result.success).toBe(false);
    expect(result.warnings.some(w => w.code === 'transport_error')).toBe(true);
  });

  it('throws in strict mode on transport error', async () => {
    const mockedExeca = execa as unknown as ReturnType<typeof vi.fn>;
    mockedExeca.mockRejectedValue(new Error('boom'));

    const runner = new AdvisorRunner({ ...baseCfg, strict: true }, '/tmp');
    await expect(runner.run(dummyReq(), dummyPrompt)).rejects.toThrow(/strict mode/);
  });

  it('warns on oversized prompt in non-strict mode', async () => {
    const mockedExeca = execa as unknown as ReturnType<typeof vi.fn>;
    mockedExeca.mockResolvedValue({ stdout: 'ok [sunco-advisor v1 model=opus]' });

    const longPrompt = (_req: AdvisorRequest) => 'x'.repeat(15_000);
    const runner = new AdvisorRunner({ ...baseCfg, maxPromptChars: 10_000 }, '/tmp');
    const result = await runner.run(dummyReq(), longPrompt);
    expect(result.warnings.some(w => w.code === 'prompt_too_long')).toBe(true);
    expect(result.success).toBe(true);
  });
});
