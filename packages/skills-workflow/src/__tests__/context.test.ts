/**
 * Tests for context.skill.ts
 *
 * Verifies:
 * - Reads STATE.md and extracts decisions, blockers, position
 * - Reads phase CONTEXT.md if available
 * - Displays pending todos from StateApi
 * - Shows next actions from recommender
 * - Handles missing files gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises before imports
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import { readFile, readdir } from 'node:fs/promises';
import contextSkill from '../context.skill.js';
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
  completed_phases: 2
  total_plans: 26
  completed_plans: 21
  percent: 81
---

# Project State

## Current Position

Phase: 03 (standalone-ts-skills) -- EXECUTING
Plan: 2 of 6
Status: Ready to execute
Last activity: 2026-03-28

### Decisions

- [Phase 01]: TypeScript 6.0.2 with esnext target
- [Phase 02]: eslint-plugin-boundaries requires mode:'folder'

### Blockers/Concerns

- Phase 1 has 32 requirements -- largest phase.
- Research flagged: Agent Router permission model needs spec.
`;

const SAMPLE_CONTEXT = `# Phase 03 Context

## Key Decisions
- D-17: Auto-route via recommender
- D-19: Recommender-based next action
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
      getRecommendations: vi.fn().mockReturnValue([
        {
          skillId: 'workflow.status',
          title: 'Check status',
          reason: 'Review progress',
          priority: 'medium',
          isDefault: true,
        },
      ]),
      getTopRecommendation: vi.fn().mockReturnValue(undefined),
    },
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue({ selectedId: '', selectedLabel: '', source: 'default' }),
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

describe('contextSkill', () => {
  const mockedReadFile = vi.mocked(readFile);
  const mockedReaddir = vi.mocked(readdir);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct skill metadata', () => {
    expect(contextSkill.id).toBe('workflow.context');
    expect(contextSkill.command).toBe('context');
    expect(contextSkill.kind).toBe('deterministic');
    expect(contextSkill.stage).toBe('stable');
    expect(contextSkill.category).toBe('workflow');
    expect(contextSkill.routing).toBe('routable');
  });

  it('reads STATE.md and extracts decisions and blockers', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(new Error('ENOENT'));
    });
    mockedReaddir.mockResolvedValue(['03-standalone-ts-skills'] as unknown as Awaited<ReturnType<typeof readdir>>);

    const ctx = createMockContext();
    const result = await contextSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.summary).toContain('Phase 3');
    expect(result.summary).toContain('2 decisions');
    expect(result.summary).toContain('2 blockers');
    expect(ctx.ui.result).toHaveBeenCalled();
  });

  it('returns failure when STATE.md is missing', async () => {
    mockedReadFile.mockRejectedValue(new Error('ENOENT'));

    const ctx = createMockContext();
    const result = await contextSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/STATE\.md/);
  });

  it('displays pending todos from state', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(new Error('ENOENT'));
    });
    mockedReaddir.mockResolvedValue(['03-standalone-ts-skills'] as unknown as Awaited<ReturnType<typeof readdir>>);

    const todoItems = [
      { text: 'Fix linting errors', done: false },
      { text: 'Write more tests', done: false },
      { text: 'Completed task', done: true },
    ];

    const ctx = createMockContext({
      state: {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'todo.items') return Promise.resolve(todoItems);
          return Promise.resolve(null);
        }),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(false),
        list: vi.fn().mockResolvedValue([]),
        has: vi.fn().mockResolvedValue(false),
      } as unknown as SkillContext['state'],
    });

    const result = await contextSkill.execute(ctx);

    expect(result.success).toBe(true);
    // Check that result was called with details containing todo text
    const resultCall = vi.mocked(ctx.ui.result).mock.calls[0]?.[0];
    const detailsStr = resultCall?.details?.join('\n') ?? '';
    expect(detailsStr).toContain('Fix linting errors');
    expect(detailsStr).toContain('Write more tests');
    // Done todos should not appear
    expect(detailsStr).not.toContain('Completed task');
  });

  it('loads phase CONTEXT.md when available', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      if (p.includes('CONTEXT.md')) return Promise.resolve(SAMPLE_CONTEXT);
      return Promise.reject(new Error('ENOENT'));
    });
    mockedReaddir.mockResolvedValue(['03-standalone-ts-skills'] as unknown as Awaited<ReturnType<typeof readdir>>);

    const ctx = createMockContext();
    const result = await contextSkill.execute(ctx);

    expect(result.success).toBe(true);
    const resultCall = vi.mocked(ctx.ui.result).mock.calls[0]?.[0];
    const detailsStr = resultCall?.details?.join('\n') ?? '';
    expect(detailsStr).toContain('Phase Context');
  });

  it('calls recommend.getRecommendations for next actions', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(new Error('ENOENT'));
    });
    mockedReaddir.mockResolvedValue(['03-standalone-ts-skills'] as unknown as Awaited<ReturnType<typeof readdir>>);

    const ctx = createMockContext();
    await contextSkill.execute(ctx);

    expect(ctx.recommend.getRecommendations).toHaveBeenCalled();
  });
});
