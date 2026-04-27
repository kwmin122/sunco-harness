/**
 * @sunco/core - Skill Context tests
 *
 * Tests SkillContext creation, blocked agent proxy for deterministic skills,
 * and circular invocation detection via ctx.run().
 */

import { describe, it, expect, vi } from 'vitest';
import { createSkillContext, createBlockedAgentProxy } from '../context.js';
import { SkillRegistry } from '../registry.js';
import { defineSkill } from '../define.js';
import { CircularSkillInvocationError } from '../../errors/index.js';
import type { AgentRouterApi } from '../../agent/types.js';
import type { StateApi, FileStoreApi } from '../../state/types.js';
import type { RecommenderApi } from '../../recommend/types.js';
import type { SkillUi } from '../../ui/adapters/SkillUi.js';
import type { SunConfig } from '../../config/types.js';
import { SunConfigSchema } from '../../config/types.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function mockConfig(): SunConfig {
  return SunConfigSchema.parse({
    skills: { preset: 'none', add: [], remove: [] },
    agent: { defaultProvider: 'claude-code-cli', timeout: 120_000, maxRetries: 1 },
    ui: { theme: 'default', silent: false, json: false },
    state: { dbPath: '.sun/state.db' },
  });
}

function mockStateApi(): StateApi {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(false),
    list: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as StateApi;
}

function mockFileStoreApi(): FileStoreApi {
  return {
    read: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(false),
  } as unknown as FileStoreApi;
}

function mockAgentRouter(): AgentRouterApi {
  return {
    run: vi.fn().mockResolvedValue({
      providerId: 'mock',
      success: true,
      outputText: 'mock output',
      artifacts: [],
      warnings: [],
      usage: { estimated: true, wallTimeMs: 0 },
    }),
    crossVerify: vi.fn().mockResolvedValue([]),
    listProviders: vi.fn().mockResolvedValue(['mock']),
    listProvidersWithFamily: vi.fn().mockResolvedValue([]),
  };
}

function mockRecommender(): RecommenderApi {
  return {
    getRecommendations: vi.fn().mockReturnValue([]),
    getTopRecommendation: vi.fn().mockReturnValue(undefined),
  };
}

function mockUi(): SkillUi {
  return {
    entry: vi.fn().mockResolvedValue(undefined),
    ask: vi.fn().mockResolvedValue({ choice: 'ok', data: {} }),
    progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
    result: vi.fn().mockResolvedValue(undefined),
  } as unknown as SkillUi;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createBlockedAgentProxy', () => {
  it('throws on any property access', () => {
    const proxy = createBlockedAgentProxy('harness.init');

    expect(() => proxy.run).toThrow(/Agent access blocked/);
    expect(() => proxy.crossVerify).toThrow(/Agent access blocked/);
    expect(() => proxy.listProviders).toThrow(/Agent access blocked/);
  });

  it('includes skill ID in error message', () => {
    const proxy = createBlockedAgentProxy('harness.lint');

    expect(() => proxy.run).toThrow("harness.lint");
  });

  it('includes property name in error message', () => {
    const proxy = createBlockedAgentProxy('test.skill');

    expect(() => proxy.run).toThrow("'run'");
  });
});

describe('createSkillContext', () => {
  it('creates context with all required fields', () => {
    const registry = new SkillRegistry();
    const skill = defineSkill({
      id: 'test.skill',
      command: 'test',
      kind: 'prompt',
      stage: 'stable',
      category: 'test',
      routing: 'directExec',
      description: 'Test',
      execute: async () => ({ success: true }),
    });
    registry.register(skill);

    const ctx = createSkillContext({
      skillId: 'test.skill',
      config: mockConfig(),
      state: mockStateApi(),
      fileStore: mockFileStoreApi(),
      agentRouter: mockAgentRouter(),
      recommender: mockRecommender(),
      ui: mockUi(),
      registry,
      cwd: '/tmp',
    });

    expect(ctx.config).toBeDefined();
    expect(ctx.state).toBeDefined();
    expect(ctx.fileStore).toBeDefined();
    expect(ctx.agent).toBeDefined();
    expect(ctx.recommend).toBeDefined();
    expect(ctx.ui).toBeDefined();
    expect(ctx.log).toBeDefined();
    expect(typeof ctx.run).toBe('function');
    expect(ctx.cwd).toBe('/tmp');
  });

  it('blocks agent for deterministic skills', () => {
    const registry = new SkillRegistry();
    const skill = defineSkill({
      id: 'harness.init',
      command: 'init',
      kind: 'deterministic',
      stage: 'stable',
      category: 'harness',
      routing: 'directExec',
      description: 'Init',
      execute: async () => ({ success: true }),
    });
    registry.register(skill);

    const ctx = createSkillContext({
      skillId: 'harness.init',
      config: mockConfig(),
      state: mockStateApi(),
      fileStore: mockFileStoreApi(),
      agentRouter: mockAgentRouter(),
      recommender: mockRecommender(),
      ui: mockUi(),
      registry,
      cwd: '/tmp',
    });

    // Accessing any property on agent should throw
    expect(() => ctx.agent.run).toThrow(/Agent access blocked/);
  });

  it('allows agent access for prompt skills', () => {
    const registry = new SkillRegistry();
    const realRouter = mockAgentRouter();
    const skill = defineSkill({
      id: 'workflow.discuss',
      command: 'discuss',
      kind: 'prompt',
      stage: 'stable',
      category: 'workflow',
      routing: 'routable',
      description: 'Discuss',
      execute: async () => ({ success: true }),
    });
    registry.register(skill);

    const ctx = createSkillContext({
      skillId: 'workflow.discuss',
      config: mockConfig(),
      state: mockStateApi(),
      fileStore: mockFileStoreApi(),
      agentRouter: realRouter,
      recommender: mockRecommender(),
      ui: mockUi(),
      registry,
      cwd: '/tmp',
    });

    // Should be the real router, not blocked
    expect(() => ctx.agent.run).not.toThrow();
    expect(ctx.agent).toBe(realRouter);
  });

  it('allows agent access for hybrid skills', () => {
    const registry = new SkillRegistry();
    const realRouter = mockAgentRouter();
    const skill = defineSkill({
      id: 'test.hybrid',
      command: 'hybrid',
      kind: 'hybrid',
      stage: 'stable',
      category: 'test',
      routing: 'directExec',
      description: 'Hybrid skill',
      execute: async () => ({ success: true }),
    });
    registry.register(skill);

    const ctx = createSkillContext({
      skillId: 'test.hybrid',
      config: mockConfig(),
      state: mockStateApi(),
      fileStore: mockFileStoreApi(),
      agentRouter: realRouter,
      recommender: mockRecommender(),
      ui: mockUi(),
      registry,
      cwd: '/tmp',
    });

    expect(ctx.agent).toBe(realRouter);
  });
});

describe('ctx.run() - inter-skill calls', () => {
  it('executes another skill through the registry', async () => {
    const registry = new SkillRegistry();
    const executeMock = vi.fn().mockResolvedValue({ success: true, summary: 'done' });

    registry.register(
      defineSkill({
        id: 'skill.a',
        command: 'a',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'Skill A',
        execute: async () => ({ success: true }),
      }),
    );

    registry.register(
      defineSkill({
        id: 'skill.b',
        command: 'b',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'Skill B',
        execute: executeMock,
      }),
    );

    const ctx = createSkillContext({
      skillId: 'skill.a',
      config: mockConfig(),
      state: mockStateApi(),
      fileStore: mockFileStoreApi(),
      agentRouter: mockAgentRouter(),
      recommender: mockRecommender(),
      ui: mockUi(),
      registry,
      cwd: '/tmp',
    });

    const result = await ctx.run('skill.b');
    expect(result.success).toBe(true);
    expect(executeMock).toHaveBeenCalled();
  });

  it('throws CircularSkillInvocationError for direct self-call', async () => {
    const registry = new SkillRegistry();

    // Skill A tries to call itself
    registry.register(
      defineSkill({
        id: 'skill.a',
        command: 'a',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'Skill A',
        execute: async (ctx) => ctx.run('skill.a'),
      }),
    );

    const ctx = createSkillContext({
      skillId: 'skill.a',
      config: mockConfig(),
      state: mockStateApi(),
      fileStore: mockFileStoreApi(),
      agentRouter: mockAgentRouter(),
      recommender: mockRecommender(),
      ui: mockUi(),
      registry,
      cwd: '/tmp',
    });

    await expect(ctx.run('skill.a')).rejects.toThrow(CircularSkillInvocationError);
  });

  it('throws CircularSkillInvocationError for A -> B -> A cycle', async () => {
    const registry = new SkillRegistry();

    // Skill B calls skill A (which creates a cycle)
    registry.register(
      defineSkill({
        id: 'skill.a',
        command: 'a',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'Skill A',
        execute: async (ctx) => ctx.run('skill.b'),
      }),
    );

    registry.register(
      defineSkill({
        id: 'skill.b',
        command: 'b',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'Skill B',
        execute: async (ctx) => ctx.run('skill.a'),
      }),
    );

    const ctx = createSkillContext({
      skillId: 'skill.a',
      config: mockConfig(),
      state: mockStateApi(),
      fileStore: mockFileStoreApi(),
      agentRouter: mockAgentRouter(),
      recommender: mockRecommender(),
      ui: mockUi(),
      registry,
      cwd: '/tmp',
    });

    // A calls B, B calls A -- circular
    await expect(ctx.run('skill.b')).rejects.toThrow(CircularSkillInvocationError);
  });

  it('allows A -> B -> C (no cycle)', async () => {
    const registry = new SkillRegistry();

    registry.register(
      defineSkill({
        id: 'skill.a',
        command: 'a',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'Skill A',
        execute: async (ctx) => ctx.run('skill.b'),
      }),
    );

    registry.register(
      defineSkill({
        id: 'skill.b',
        command: 'b',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'Skill B',
        execute: async (ctx) => ctx.run('skill.c'),
      }),
    );

    registry.register(
      defineSkill({
        id: 'skill.c',
        command: 'c',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'Skill C',
        execute: async () => ({ success: true, summary: 'C done' }),
      }),
    );

    const ctx = createSkillContext({
      skillId: 'skill.a',
      config: mockConfig(),
      state: mockStateApi(),
      fileStore: mockFileStoreApi(),
      agentRouter: mockAgentRouter(),
      recommender: mockRecommender(),
      ui: mockUi(),
      registry,
      cwd: '/tmp',
    });

    // A -> B -> C should work (no cycle)
    const result = await ctx.run('skill.b');
    expect(result.success).toBe(true);
  });
});
