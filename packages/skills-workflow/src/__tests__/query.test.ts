/**
 * Tests for query.skill.ts — instant state snapshot skill
 *
 * Verifies:
 * - Returns correct phase from STATE.md content
 * - Returns 0/0 progress when no roadmap exists
 * - Returns null phase when STATE.md is missing
 * - Correct percent calculation (3/10 = 30%)
 * - Skill kind is 'deterministic'
 * - Cost data from state store
 * - nextAction points to first incomplete phase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises before imports
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';
import querySkill from '../query.skill.js';
import type { SkillContext } from '@sunco/core';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE_STATE = `---
gsd_state_version: 1.0
status: executing
last_activity: 2026-03-28
progress:
  total_phases: 10
  completed_phases: 3
  total_plans: 30
  completed_plans: 15
  percent: 50
---

# Project State

## Current Position

Phase: 05 (context-and-planning) -- EXECUTING
Plan: 2 of 4
Status: Ready to execute
Last activity: 2026-03-28
`;

const SAMPLE_ROADMAP = `# Roadmap: SUN (sunco)

## Phases

- [x] **Phase 1: Core Platform** - CLI engine, config, skill system
- [x] **Phase 2: Harness Skills** - init, lint, health, agents, guard
- [x] **Phase 3: Workflow Skills** - Session, ideas, phase management
- [ ] **Phase 4: Project Initialization** - new and scan
- [ ] **Phase 5: Context and Planning** - discuss, assume, research, plan
- [ ] **Phase 6: Execution** - execute, review
- [ ] **Phase 7: Verification** - verify, validate, test-gen
- [ ] **Phase 8: Shipping** - ship, release, milestone
- [ ] **Phase 9: Composition** - auto, quick, fast, do
- [ ] **Phase 10: Debugging** - debug, diagnose, forensics
`;

// ---------------------------------------------------------------------------
// Mock context factory
// ---------------------------------------------------------------------------

function createMockContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      has: vi.fn().mockResolvedValue(false),
    } as unknown as SkillContext['state'],
    fileStore: {} as SkillContext['fileStore'],
    agent: {} as SkillContext['agent'],
    recommend: {
      getRecommendations: vi.fn().mockReturnValue([]),
      getTopRecommendation: vi.fn().mockReturnValue(undefined),
    },
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue({ selectedId: '', selectedLabel: '', source: 'default' }),
      askText: vi.fn().mockResolvedValue({ text: '', source: 'noninteractive' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
    },
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    run: vi.fn().mockResolvedValue({ success: true }),
    cwd: '/test/project',
    args: {},
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('querySkill', () => {
  const mockedReadFile = vi.mocked(readFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skill kind is deterministic', () => {
    expect(querySkill.kind).toBe('deterministic');
  });

  it('has correct skill metadata', () => {
    expect(querySkill.id).toBe('workflow.query');
    expect(querySkill.command).toBe('query');
    expect(querySkill.kind).toBe('deterministic');
    expect(querySkill.stage).toBe('stable');
    expect(querySkill.category).toBe('workflow');
    expect(querySkill.routing).toBe('routable');
  });

  it('returns correct phase number from STATE.md content', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP);
      return Promise.reject(new Error('File not found'));
    });

    const ctx = createMockContext();
    const result = await querySkill.execute(ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.phase).toBe(5);
    expect(data.status).toBe('executing');
  });

  it('returns 0/0 progress when no ROADMAP.md exists', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      // ROADMAP.md is missing
      return Promise.reject(new Error('ENOENT'));
    });

    const ctx = createMockContext();
    const result = await querySkill.execute(ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const progress = data.progress as Record<string, unknown>;
    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
    expect(progress.percent).toBe(0);
    expect(data.nextAction).toBeNull();
  });

  it('returns null phase when STATE.md is missing', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP);
      // STATE.md is missing
      return Promise.reject(new Error('ENOENT'));
    });

    const ctx = createMockContext();
    const result = await querySkill.execute(ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.phase).toBeNull();
    expect(data.status).toBe('unknown');
  });

  it('calculates correct percent (3/10 = 30%)', async () => {
    // Create a roadmap with exactly 10 phases, 3 completed
    const roadmap10 = `## Phases

- [x] **Phase 1: Phase One** - desc
- [x] **Phase 2: Phase Two** - desc
- [x] **Phase 3: Phase Three** - desc
- [ ] **Phase 4: Phase Four** - desc
- [ ] **Phase 5: Phase Five** - desc
- [ ] **Phase 6: Phase Six** - desc
- [ ] **Phase 7: Phase Seven** - desc
- [ ] **Phase 8: Phase Eight** - desc
- [ ] **Phase 9: Phase Nine** - desc
- [ ] **Phase 10: Phase Ten** - desc
`;

    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return Promise.resolve(roadmap10);
      return Promise.reject(new Error('ENOENT'));
    });

    const ctx = createMockContext();
    const result = await querySkill.execute(ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const progress = data.progress as Record<string, unknown>;
    expect(progress.total).toBe(10);
    expect(progress.completed).toBe(3);
    expect(progress.percent).toBe(30);
  });

  it('returns nextAction as first incomplete phase', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP);
      return Promise.reject(new Error('File not found'));
    });

    const ctx = createMockContext();
    const result = await querySkill.execute(ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    // Phase 4 is the first incomplete phase in SAMPLE_ROADMAP
    expect(data.nextAction).toBe('Phase 4: Project Initialization');
  });

  it('includes cost data from state store when available', async () => {
    mockedReadFile.mockRejectedValue(new Error('ENOENT'));

    const ctx = createMockContext({
      state: {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'usage.totalCostUsd') return Promise.resolve(1.2345);
          return Promise.resolve(null);
        }),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(false),
        list: vi.fn().mockResolvedValue([]),
        has: vi.fn().mockResolvedValue(false),
      } as unknown as SkillContext['state'],
    });

    const result = await querySkill.execute(ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const costs = data.costs as Record<string, unknown>;
    expect(costs.totalUsd).toBe(1.2345);
  });

  it('returns zero cost when state store has no cost data', async () => {
    mockedReadFile.mockRejectedValue(new Error('ENOENT'));

    const ctx = createMockContext();
    const result = await querySkill.execute(ctx);

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const costs = data.costs as Record<string, unknown>;
    expect(costs.totalUsd).toBe(0);
  });

  it('always returns success: true even with no files', async () => {
    mockedReadFile.mockRejectedValue(new Error('ENOENT'));

    const ctx = createMockContext();
    const result = await querySkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.data).toBeDefined();
  });

  it('includes a timestamp in ISO format', async () => {
    mockedReadFile.mockRejectedValue(new Error('ENOENT'));

    const ctx = createMockContext();
    const result = await querySkill.execute(ctx);

    const data = result.data as Record<string, unknown>;
    expect(typeof data.timestamp).toBe('string');
    // Should be a valid ISO date string
    expect(() => new Date(data.timestamp as string)).not.toThrow();
    expect(new Date(data.timestamp as string).toISOString()).toBe(data.timestamp);
  });
});
