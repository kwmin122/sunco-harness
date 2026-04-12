/**
 * @sunco/core - CodexCliProvider Tests
 *
 * Tests for Codex CLI provider using mocked execa.
 * No real CLI calls — validates argument building, error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRequest, AgentExecutionContext, PermissionSet } from '../types.js';

const mockExeca = vi.fn();

vi.mock('execa', () => ({
  execa: mockExeca,
}));

const { CodexCliProvider } = await import('../providers/codex-cli.js');

function makePermissions(overrides: Partial<PermissionSet> = {}): PermissionSet {
  return {
    role: 'verification',
    readPaths: ['**'],
    writePaths: [],
    allowTests: false,
    allowNetwork: false,
    allowGitWrite: false,
    allowCommands: [],
    ...overrides,
  };
}

function makeRequest(overrides: Partial<AgentRequest> = {}): AgentRequest {
  return {
    role: 'verification',
    prompt: 'Review this code for issues',
    permissions: makePermissions(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext {
  return {
    cwd: '/test/project',
    permissions: makePermissions(),
    timeout: 30_000,
    signal: AbortSignal.timeout(30_000),
    ...overrides,
  };
}

describe('CodexCliProvider', () => {
  let provider: InstanceType<typeof CodexCliProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new CodexCliProvider();
  });

  it('has correct identity', () => {
    expect(provider.id).toBe('codex-cli');
    expect(provider.family).toBe('openai');
    expect(provider.transport).toBe('cli');
  });

  describe('isAvailable', () => {
    it('returns true when codex is on PATH', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: '/opt/homebrew/bin/codex' });
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when codex is not on PATH', async () => {
      mockExeca.mockRejectedValueOnce(new Error('not found'));
      expect(await provider.isAvailable()).toBe(false);
    });
  });

  describe('execute', () => {
    it('spawns codex review with --base HEAD~1 default', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: '{"findings": []}' });
      await provider.execute(makeRequest(), makeContext());

      expect(mockExeca).toHaveBeenCalledWith(
        'codex',
        ['review', '--base', 'HEAD~1', '-c', 'sandbox_permissions=["disk-full-read-access"]', '-'],
        expect.objectContaining({
          input: 'Review this code for issues',
          cwd: '/test/project',
        }),
      );
    });

    it('passes prompt via stdin', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'ok' });
      await provider.execute(makeRequest({ prompt: 'custom prompt' }), makeContext());

      expect(mockExeca).toHaveBeenCalledWith(
        'codex',
        expect.any(Array),
        expect.objectContaining({ input: 'custom prompt' }),
      );
    });

    it('sets sandbox_permissions read-only override', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'ok' });
      await provider.execute(makeRequest(), makeContext());

      const [, args] = mockExeca.mock.calls[0] as [string, string[], unknown];
      expect(args).toContain('-c');
      expect(args).toContain('sandbox_permissions=["disk-full-read-access"]');
    });

    it('honors request.meta.baseRef override', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'ok' });
      await provider.execute(
        makeRequest({ meta: { baseRef: 'main' } }),
        makeContext(),
      );

      const [, args] = mockExeca.mock.calls[0] as [string, string[], unknown];
      expect(args).toContain('--base');
      const baseIdx = args.indexOf('--base');
      expect(args[baseIdx + 1]).toBe('main');
    });

    it('returns normalizeResult with outputText = stdout', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'No issues found.' });
      const result = await provider.execute(makeRequest(), makeContext());

      expect(result.providerId).toBe('codex-cli');
      expect(result.success).toBe(true);
      expect(result.outputText).toBe('No issues found.');
    });

    it('passes AbortSignal as cancelSignal', async () => {
      const signal = AbortSignal.timeout(5000);
      mockExeca.mockResolvedValueOnce({ stdout: 'ok' });
      await provider.execute(makeRequest(), makeContext({ signal }));

      expect(mockExeca).toHaveBeenCalledWith(
        'codex',
        expect.any(Array),
        expect.objectContaining({ cancelSignal: signal }),
      );
    });

    it('wraps spawn errors in ProviderExecutionError', async () => {
      const error = new Error('process exited with code 1');
      Object.assign(error, { exitCode: 1 });
      mockExeca.mockRejectedValueOnce(error);

      const { ProviderExecutionError } = await import('../errors.js');
      await expect(provider.execute(makeRequest(), makeContext()))
        .rejects.toThrow(ProviderExecutionError);
    });
  });
});
