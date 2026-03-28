/**
 * @sunco/core - CLI Lifecycle Tests
 *
 * Tests for:
 * - createNoopRecommender fallback
 * - createLifecycle.createExecuteHook skill execution flow
 * - Recommendation display after skill execution
 * - Noop recommender produces no recommendations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNoopRecommender } from '../lifecycle.js';
import type { LifecycleServices } from '../lifecycle.js';
import type { SkillExecuteHook } from '../skill-router.js';
import { createLifecycle } from '../lifecycle.js';
import { SkillRegistry } from '../../skill/registry.js';
import { defineSkill } from '../../skill/define.js';
import type { SkillContext, SkillResult } from '../../skill/types.js';
import type { RecommenderApi, RecommendationState } from '../../recommend/types.js';
import type { StateApi, FileStoreApi, StateEngine } from '../../state/types.js';
import type { AgentRouterApi } from '../../agent/types.js';
import type { UiAdapter } from '../../ui/adapters/UiAdapter.js';
import type { SkillUi } from '../../ui/adapters/SkillUi.js';
import type { SunConfig } from '../../config/types.js';

// ---------------------------------------------------------------------------
// Noop Recommender
// ---------------------------------------------------------------------------

describe('createNoopRecommender', () => {
  it('returns empty array from getRecommendations', () => {
    const noop = createNoopRecommender();
    const result = noop.getRecommendations({
      projectState: {},
      activeSkills: new Set(),
    });
    expect(result).toEqual([]);
  });

  it('returns undefined from getTopRecommendation', () => {
    const noop = createNoopRecommender();
    const result = noop.getTopRecommendation({
      projectState: {},
      activeSkills: new Set(),
    });
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Execute Hook
// ---------------------------------------------------------------------------

describe('createLifecycle.createExecuteHook', () => {
  let mockRegistry: SkillRegistry;
  let mockResult: SkillResult;
  let mockSkillUi: SkillUi;
  let mockRecommender: RecommenderApi;
  let mockStateEngine: StateEngine;
  let executeHook: SkillExecuteHook;

  const mockConfig = {
    skills: { preset: 'none', add: [], remove: [] },
    agent: { defaultProvider: 'claude-code-cli', timeout: 120000, maxRetries: 1 },
    ui: { theme: 'default', silent: false, json: false },
    state: { dbPath: '.sun/state.db' },
  } satisfies SunConfig;

  beforeEach(() => {
    mockResult = { success: true, summary: 'test passed' };

    // Create a real registry with a test skill
    mockRegistry = new SkillRegistry();
    mockRegistry.register(
      defineSkill({
        id: 'test.skill',
        command: 'test-skill',
        description: 'A test skill',
        kind: 'deterministic',
        stage: 'stable',
        category: 'core',
        routing: 'directExec',
        execute: async (_ctx: SkillContext): Promise<SkillResult> => mockResult,
      }),
    );

    mockSkillUi = {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue({ selectedId: 'a', selectedLabel: 'A', source: 'default' as const }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
    };

    mockRecommender = {
      getRecommendations: vi.fn().mockReturnValue([]),
      getTopRecommendation: vi.fn().mockReturnValue(undefined),
    };

    const mockState: StateApi = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([]),
      has: vi.fn().mockResolvedValue(false),
    };

    const mockFileStore: FileStoreApi = {
      read: vi.fn().mockResolvedValue(''),
      write: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      delete: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([]),
    };

    mockStateEngine = {
      state: mockState,
      fileStore: mockFileStore,
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockAgentRouter: AgentRouterApi = {
      run: vi.fn().mockResolvedValue({ success: true, content: '' }),
      crossVerify: vi.fn().mockResolvedValue([]),
      listProviders: vi.fn().mockResolvedValue([]),
    };

    const mockUiAdapter: UiAdapter = {
      mountPattern: vi.fn().mockResolvedValue({ handleId: 'test', data: {} }),
      update: vi.fn(),
      dispose: vi.fn(),
    };

    const services: LifecycleServices = {
      config: mockConfig,
      stateEngine: mockStateEngine,
      registry: mockRegistry,
      agentRouter: mockAgentRouter,
      uiAdapter: mockUiAdapter,
      skillUi: mockSkillUi,
      recommender: mockRecommender,
      cwd: '/tmp/test',
      sunDir: '/tmp/test/.sun',
    };

    const lifecycle = createLifecycle();
    executeHook = lifecycle.createExecuteHook(services);
  });

  it('executes skill via registry', async () => {
    await executeHook('test.skill', {});
    // If it doesn't throw, skill was found and executed
  });

  it('calls recommender after successful skill execution', async () => {
    await executeHook('test.skill', {});
    expect(mockRecommender.getRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSkillId: 'test.skill',
        lastResult: mockResult,
      }),
    );
  });

  it('displays recommendations via UI when available', async () => {
    (mockRecommender.getRecommendations as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        skillId: 'harness.lint',
        title: 'Run linter',
        reason: 'You just initialized -- run lint next',
        priority: 'high',
        isDefault: true,
      },
    ]);

    await executeHook('test.skill', {});
    expect(mockSkillUi.result).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        title: 'Next Steps',
        recommendations: expect.arrayContaining([
          expect.objectContaining({ skillId: 'harness.lint' }),
        ]),
      }),
    );
  });

  it('does not display recommendations when noop recommender returns empty', async () => {
    (mockRecommender.getRecommendations as ReturnType<typeof vi.fn>).mockReturnValue([]);
    await executeHook('test.skill', {});
    expect(mockSkillUi.result).not.toHaveBeenCalled();
  });

  it('persists usage to state after execution', async () => {
    await executeHook('test.skill', {});
    expect(mockStateEngine.state.set).toHaveBeenCalledWith(
      'usage:test.skill:lastRun',
      expect.any(String),
    );
  });

  it('does not crash when recommender throws', async () => {
    (mockRecommender.getRecommendations as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Recommender crash');
    });
    // Should not throw
    await expect(executeHook('test.skill', {})).resolves.not.toThrow();
  });

  it('does not crash when state persistence fails', async () => {
    (mockStateEngine.state.set as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB write failure'),
    );
    await expect(executeHook('test.skill', {})).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Lifecycle teardown
// ---------------------------------------------------------------------------

describe('createLifecycle.teardown', () => {
  it('closes state engine', async () => {
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const services = {
      stateEngine: { close: mockClose },
    } as unknown as LifecycleServices;

    const lifecycle = createLifecycle();
    await lifecycle.teardown(services);
    expect(mockClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Provider Discovery
// ---------------------------------------------------------------------------

describe('Provider discovery', () => {
  it('ClaudeCliProvider and ClaudeSdkProvider are importable from lifecycle deps', async () => {
    const { ClaudeCliProvider } = await import('../../agent/providers/claude-cli.js');
    const { ClaudeSdkProvider } = await import('../../agent/providers/claude-sdk.js');
    expect(ClaudeCliProvider).toBeDefined();
    expect(ClaudeSdkProvider).toBeDefined();
    const cli = new ClaudeCliProvider();
    const sdk = new ClaudeSdkProvider();
    expect(cli.id).toBe('claude-code-cli');
    expect(sdk.id).toBe('claude-sdk');
    expect(typeof cli.isAvailable).toBe('function');
    expect(typeof sdk.isAvailable).toBe('function');
  });

  it('lifecycle.ts imports ClaudeCliProvider for provider wiring', async () => {
    // Verify the import exists in lifecycle.ts source
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const lifecycleSource = await readFile(join(dir, '..', 'lifecycle.ts'), 'utf-8');
    expect(lifecycleSource).toContain('ClaudeCliProvider');
    expect(lifecycleSource).toContain('ClaudeSdkProvider');
    expect(lifecycleSource).toContain('new ClaudeCliProvider');
    expect(lifecycleSource).toContain('new ClaudeSdkProvider');
    expect(lifecycleSource).toContain('isAvailable');
    expect(lifecycleSource).not.toContain("providers: []");
  });
});
