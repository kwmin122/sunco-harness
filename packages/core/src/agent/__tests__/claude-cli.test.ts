/**
 * @sunco/core - ClaudeCliProvider Tests
 *
 * Tests for Claude Code CLI provider using mocked execa.
 * No real CLI calls -- validates argument building, parsing, error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRequest, AgentExecutionContext, PermissionSet } from '../types.js';

// ---------------------------------------------------------------------------
// Mock execa before importing the provider
// ---------------------------------------------------------------------------

const mockExeca = vi.fn();

vi.mock('execa', () => ({
  execa: mockExeca,
}));

// Import after mock setup
const { ClaudeCliProvider } = await import('../providers/claude-cli.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePermissions(overrides: Partial<PermissionSet> = {}): PermissionSet {
  return {
    role: 'execution',
    readPaths: ['**'],
    writePaths: ['src/**'],
    allowTests: true,
    allowNetwork: false,
    allowGitWrite: true,
    allowCommands: ['npm test'],
    ...overrides,
  };
}

function makeRequest(overrides: Partial<AgentRequest> = {}): AgentRequest {
  return {
    role: 'execution',
    prompt: 'Write a hello world function',
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

// ---------------------------------------------------------------------------
// ClaudeCliProvider identity
// ---------------------------------------------------------------------------

describe('ClaudeCliProvider', () => {
  let provider: InstanceType<typeof ClaudeCliProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClaudeCliProvider();
  });

  it('has correct identity', () => {
    expect(provider.id).toBe('claude-code-cli');
    expect(provider.family).toBe('claude');
    expect(provider.transport).toBe('cli');
  });

  // -------------------------------------------------------------------------
  // isAvailable
  // -------------------------------------------------------------------------

  describe('isAvailable', () => {
    it('returns true when claude CLI is found', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: '/usr/local/bin/claude' });
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('returns false when claude CLI is not found', async () => {
      mockExeca.mockRejectedValueOnce(new Error('not found'));
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // execute - success
  // -------------------------------------------------------------------------

  describe('execute', () => {
    it('spawns claude with correct base arguments', async () => {
      const cliOutput = JSON.stringify({
        result: 'Hello world function created',
        cost_usd: 0.05,
        duration_ms: 1500,
        is_error: false,
        num_turns: 1,
        session_id: 'test-session',
      });
      mockExeca.mockResolvedValueOnce({ stdout: cliOutput, exitCode: 0 });

      await provider.execute(makeRequest(), makeContext());

      expect(mockExeca).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['-p', '--output-format', 'json', '--max-turns', '1']),
        expect.objectContaining({
          input: 'Write a hello world function',
          cwd: '/test/project',
        }),
      );
    });

    it('uses default --max-turns 1 when maxTurns is not set', async () => {
      const cliOutput = JSON.stringify({
        result: 'done',
        cost_usd: 0.01,
        duration_ms: 200,
        is_error: false,
      });
      mockExeca.mockResolvedValueOnce({ stdout: cliOutput, exitCode: 0 });

      await provider.execute(makeRequest(), makeContext());

      const [, args] = mockExeca.mock.calls[0] as [string, string[], unknown];
      const idx = args.indexOf('--max-turns');
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe('1');
    });

    it('passes --max-turns 5 when maxTurns: 5 is set', async () => {
      const cliOutput = JSON.stringify({
        result: 'done',
        cost_usd: 0.01,
        duration_ms: 200,
        is_error: false,
      });
      mockExeca.mockResolvedValueOnce({ stdout: cliOutput, exitCode: 0 });

      await provider.execute(makeRequest({ maxTurns: 5 }), makeContext());

      const [, args] = mockExeca.mock.calls[0] as [string, string[], unknown];
      const idx = args.indexOf('--max-turns');
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe('5');
    });

    it('passes --max-turns 0 when maxTurns: 0 is set (edge case)', async () => {
      const cliOutput = JSON.stringify({
        result: 'done',
        cost_usd: 0.01,
        duration_ms: 200,
        is_error: false,
      });
      mockExeca.mockResolvedValueOnce({ stdout: cliOutput, exitCode: 0 });

      await provider.execute(makeRequest({ maxTurns: 0 }), makeContext());

      const [, args] = mockExeca.mock.calls[0] as [string, string[], unknown];
      const idx = args.indexOf('--max-turns');
      expect(idx).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe('0');
    });

    it('returns normalized AgentResult on success', async () => {
      const cliOutput = JSON.stringify({
        result: 'function hello() { return "world"; }',
        cost_usd: 0.03,
        duration_ms: 800,
        is_error: false,
        num_turns: 1,
        session_id: 'test-session',
      });
      mockExeca.mockResolvedValueOnce({ stdout: cliOutput, exitCode: 0 });

      const result = await provider.execute(makeRequest(), makeContext());

      expect(result.providerId).toBe('claude-code-cli');
      expect(result.success).toBe(true);
      expect(result.outputText).toBe('function hello() { return "world"; }');
      expect(result.usage.estimated).toBe(true);
      expect(result.usage.estimatedCostUsd).toBe(0.03);
      expect(result.usage.wallTimeMs).toBe(800);
    });

    it('passes AbortSignal to execa as cancelSignal', async () => {
      const signal = AbortSignal.timeout(5000);
      const cliOutput = JSON.stringify({
        result: 'done',
        cost_usd: 0.01,
        duration_ms: 200,
        is_error: false,
      });
      mockExeca.mockResolvedValueOnce({ stdout: cliOutput, exitCode: 0 });

      await provider.execute(makeRequest(), makeContext({ signal }));

      expect(mockExeca).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({ cancelSignal: signal }),
      );
    });

    it('handles timeout from request', async () => {
      const cliOutput = JSON.stringify({
        result: 'done',
        cost_usd: 0.01,
        duration_ms: 200,
        is_error: false,
      });
      mockExeca.mockResolvedValueOnce({ stdout: cliOutput, exitCode: 0 });

      await provider.execute(
        makeRequest({ timeout: 10_000 }),
        makeContext({ timeout: 10_000 }),
      );

      expect(mockExeca).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({ timeout: 10_000 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // execute - error cases
  // -------------------------------------------------------------------------

  describe('execute - errors', () => {
    it('handles is_error response from CLI', async () => {
      const cliOutput = JSON.stringify({
        result: 'Error: rate limit exceeded',
        cost_usd: 0.001,
        duration_ms: 100,
        is_error: true,
      });
      mockExeca.mockResolvedValueOnce({ stdout: cliOutput, exitCode: 0 });

      const result = await provider.execute(makeRequest(), makeContext());

      expect(result.success).toBe(false);
      expect(result.outputText).toBe('Error: rate limit exceeded');
    });

    it('throws ProviderExecutionError on non-zero exit', async () => {
      const error = new Error('process exited with code 1');
      Object.assign(error, { exitCode: 1, stdout: '', stderr: 'fatal error' });
      mockExeca.mockRejectedValueOnce(error);

      const { ProviderExecutionError } = await import('../errors.js');
      await expect(provider.execute(makeRequest(), makeContext()))
        .rejects.toThrow(ProviderExecutionError);
    });

    it('handles invalid JSON output gracefully', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'not json at all', exitCode: 0 });

      const { ProviderExecutionError } = await import('../errors.js');
      await expect(provider.execute(makeRequest(), makeContext()))
        .rejects.toThrow(ProviderExecutionError);
    });
  });
});
