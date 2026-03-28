/**
 * @sunco/core - AgentRouter Tests
 *
 * Tests for the Agent Router using mock providers.
 * Covers: provider selection, permission enforcement, cross-verify,
 * timeout handling, error propagation, usage tracking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgentRouter } from '../router.js';
import { UsageTracker } from '../tracker.js';
import {
  ProviderUnavailableError,
  PermissionDeniedError,
  ProviderExecutionError,
} from '../errors.js';
import type {
  AgentProvider,
  AgentRequest,
  AgentResult,
  AgentExecutionContext,
  PermissionSet,
  AgentRouterApi,
} from '../types.js';

// ---------------------------------------------------------------------------
// Mock Provider Factory
// ---------------------------------------------------------------------------

function createMockProvider(
  overrides: Partial<AgentProvider> & { id: string },
): AgentProvider {
  return {
    family: 'claude',
    transport: 'sdk',
    isAvailable: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue({
      providerId: overrides.id,
      success: true,
      outputText: `result from ${overrides.id}`,
      artifacts: [],
      warnings: [],
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostUsd: 0.01,
        estimated: false,
        wallTimeMs: 200,
      },
    } satisfies AgentResult),
    ...overrides,
  };
}

function makePermissions(
  role: PermissionSet['role'],
  overrides: Partial<PermissionSet> = {},
): PermissionSet {
  const defaults: Record<PermissionSet['role'], Partial<PermissionSet>> = {
    research: {},
    planning: { writePaths: ['.planning/plan.md'] },
    execution: {
      writePaths: ['src/index.ts'],
      allowTests: true,
      allowGitWrite: true,
      allowCommands: ['npm test'],
    },
    verification: { allowTests: true, allowCommands: ['npm test'] },
  };

  return {
    role,
    readPaths: ['**'],
    writePaths: [],
    allowTests: false,
    allowNetwork: false,
    allowGitWrite: false,
    allowCommands: [],
    ...defaults[role],
    ...overrides,
  };
}

function makeRequest(overrides: Partial<AgentRequest> = {}): AgentRequest {
  return {
    role: 'research',
    prompt: 'test prompt',
    permissions: makePermissions('research'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('AgentRouter', () => {
  let cliProvider: AgentProvider;
  let sdkProvider: AgentProvider;
  let tracker: UsageTracker;
  let router: AgentRouterApi;

  beforeEach(() => {
    cliProvider = createMockProvider({ id: 'claude-code-cli', transport: 'cli' });
    sdkProvider = createMockProvider({ id: 'claude-sdk', transport: 'sdk' });
    tracker = new UsageTracker();
    router = createAgentRouter({
      providers: [cliProvider, sdkProvider],
      cwd: '/test/project',
      tracker,
    });
  });

  // -------------------------------------------------------------------------
  // Provider Selection (D-23)
  // -------------------------------------------------------------------------

  describe('provider selection', () => {
    it('selects SDK provider for research role', async () => {
      await router.run(makeRequest({ role: 'research' }));
      expect(sdkProvider.execute).toHaveBeenCalled();
      expect(cliProvider.execute).not.toHaveBeenCalled();
    });

    it('selects SDK provider for planning role', async () => {
      await router.run(makeRequest({
        role: 'planning',
        permissions: makePermissions('planning'),
      }));
      expect(sdkProvider.execute).toHaveBeenCalled();
      expect(cliProvider.execute).not.toHaveBeenCalled();
    });

    it('selects CLI provider for execution role', async () => {
      await router.run(makeRequest({
        role: 'execution',
        permissions: makePermissions('execution'),
      }));
      expect(cliProvider.execute).toHaveBeenCalled();
      expect(sdkProvider.execute).not.toHaveBeenCalled();
    });

    it('selects SDK provider for verification role', async () => {
      await router.run(makeRequest({
        role: 'verification',
        permissions: makePermissions('verification'),
      }));
      expect(sdkProvider.execute).toHaveBeenCalled();
      expect(cliProvider.execute).not.toHaveBeenCalled();
    });

    it('falls back to available provider when preferred is unavailable', async () => {
      (sdkProvider.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      await router.run(makeRequest({ role: 'research' }));
      expect(cliProvider.execute).toHaveBeenCalled();
    });

    it('throws ProviderUnavailableError when no providers available', async () => {
      (cliProvider.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      (sdkProvider.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      await expect(router.run(makeRequest())).rejects.toThrow(ProviderUnavailableError);
    });

    it('uses specific provider when providerId is specified', async () => {
      await router.run(makeRequest({
        role: 'research',
        providerId: 'claude-code-cli',
        permissions: makePermissions('research'),
      }));
      expect(cliProvider.execute).toHaveBeenCalled();
      expect(sdkProvider.execute).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Permission Enforcement
  // -------------------------------------------------------------------------

  describe('permission enforcement', () => {
    it('rejects requests that exceed role permissions', async () => {
      await expect(
        router.run(makeRequest({
          role: 'research',
          permissions: makePermissions('research', {
            writePaths: ['src/hack.ts'],
          }),
        })),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('passes valid permissions to provider', async () => {
      await router.run(makeRequest({
        role: 'execution',
        permissions: makePermissions('execution'),
      }));
      expect(cliProvider.execute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          permissions: expect.objectContaining({ role: 'execution' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Cross-Verify (D-22)
  // -------------------------------------------------------------------------

  describe('crossVerify', () => {
    it('dispatches to all available providers', async () => {
      const results = await router.crossVerify(makeRequest());
      expect(results).toHaveLength(2);
      expect(cliProvider.execute).toHaveBeenCalled();
      expect(sdkProvider.execute).toHaveBeenCalled();
    });

    it('dispatches to specified provider IDs only', async () => {
      const results = await router.crossVerify(makeRequest(), ['claude-sdk']);
      expect(results).toHaveLength(1);
      expect(sdkProvider.execute).toHaveBeenCalled();
      expect(cliProvider.execute).not.toHaveBeenCalled();
    });

    it('returns results from settled promises (one failure)', async () => {
      (cliProvider.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ProviderExecutionError('claude-code-cli', 'test error'),
      );
      const results = await router.crossVerify(makeRequest());
      // Only SDK succeeds
      expect(results).toHaveLength(1);
      expect(results[0]!.providerId).toBe('claude-sdk');
    });

    it('returns empty array when all providers fail', async () => {
      (cliProvider.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
      (sdkProvider.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
      const results = await router.crossVerify(makeRequest());
      expect(results).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Usage Tracking
  // -------------------------------------------------------------------------

  describe('usage tracking', () => {
    it('records usage after successful run', async () => {
      await router.run(makeRequest());
      expect(tracker.callCount).toBe(1);
      const summary = tracker.getSummary();
      expect(summary.inputTokens).toBe(100);
      expect(summary.outputTokens).toBe(50);
    });

    it('does not record usage on permission error', async () => {
      try {
        await router.run(makeRequest({
          role: 'research',
          permissions: makePermissions('research', { allowGitWrite: true }),
        }));
      } catch {
        // expected
      }
      expect(tracker.callCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // listProviders
  // -------------------------------------------------------------------------

  describe('listProviders', () => {
    it('returns IDs of available providers', async () => {
      const ids = await router.listProviders();
      expect(ids).toContain('claude-code-cli');
      expect(ids).toContain('claude-sdk');
    });

    it('excludes unavailable providers', async () => {
      (sdkProvider.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const ids = await router.listProviders();
      expect(ids).toContain('claude-code-cli');
      expect(ids).not.toContain('claude-sdk');
    });
  });
});
