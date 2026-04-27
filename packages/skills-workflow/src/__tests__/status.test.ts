/**
 * Tests for status.skill.ts - statusSkill (and progress alias)
 *
 * Verifies:
 * - Reads ROADMAP.md + STATE.md and displays formatted phase table
 * - --json flag returns raw data
 * - Missing .planning/ returns failure
 * - Phase 32: 'progress' alias resolves to statusSkill via registry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises before imports
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';
import { statusSkill } from '../status.skill.js';
import { SkillRegistry } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE_ROADMAP = `# Roadmap: SUN (sunco)

## Phases

- [x] **Phase 1: Core Platform** - CLI engine, config, skill system
- [x] **Phase 2: Harness Skills** - init, lint, health, agents, guard
- [ ] **Phase 3: Standalone TS Skills** - Session, ideas, phase management
- [ ] **Phase 4: Project Initialization** - new and scan

## Phase Details

### Phase 1: Core Platform
**Requirements**: CLI-01, CLI-02
**Plans:** 12 plans

Plans:
- [x] 01-01-PLAN.md -- Monorepo scaffold
- [x] 01-02-PLAN.md -- Config System

### Phase 2: Harness Skills
**Requirements**: HRN-01
**Plans:** 8 plans

Plans:
- [x] 02-01-PLAN.md -- Dependencies
- [x] 02-02-PLAN.md -- Init presets

### Phase 3: Standalone TS Skills
**Requirements**: SES-01
**Plans:** 6 plans

Plans:
- [x] 03-01-PLAN.md -- Package scaffold
- [ ] 03-02-PLAN.md -- Status skills

## Progress

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Core Platform | 12/12 | Complete |
| 2. Harness Skills | 8/8 | Complete |
| 3. Standalone TS Skills | 1/6 | In Progress |
| 4. Project Initialization | 0/4 | Planned |
`;

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
`;

function enoent(): NodeJS.ErrnoException {
  return Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
}

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
          skillId: 'workflow.next',
          title: 'Check next action',
          reason: 'Continue workflow',
          priority: 'medium',
          isDefault: true,
        },
      ]),
      getTopRecommendation: vi.fn().mockReturnValue({
        skillId: 'workflow.next',
        title: 'Check next action',
        reason: 'Continue workflow',
        priority: 'medium',
        isDefault: true,
      }),
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

describe('statusSkill', () => {
  const mockedReadFile = vi.mocked(readFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct skill metadata', () => {
    expect(statusSkill.id).toBe('workflow.status');
    expect(statusSkill.command).toBe('status');
    expect(statusSkill.kind).toBe('deterministic');
    expect(statusSkill.stage).toBe('stable');
    expect(statusSkill.category).toBe('workflow');
    expect(statusSkill.routing).toBe('routable');
  });

  it('reads ROADMAP.md and STATE.md and returns success', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(enoent());
    });

    const ctx = createMockContext();
    const result = await statusSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(ctx.ui.entry).toHaveBeenCalled();
    expect(ctx.ui.result).toHaveBeenCalled();
  });

  it('returns failure when .planning/ directory is missing', async () => {
    mockedReadFile.mockRejectedValue(enoent());

    const ctx = createMockContext();
    const result = await statusSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/\.planning/);
  });

  it('returns raw JSON superset with --json flag (Phase 33 Wave 1)', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(enoent());
    });

    const ctx = createMockContext({ args: { json: true } });
    const result = await statusSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // Phase 33 Wave 1 D-09: --json emits superset { status, query }
    // status half: parseRoadmap shape ({ phases: [...], progress: {...}, state: {...} })
    // query half: QuerySnapshot shape ({ phase, status, progress, nextAction, costs, timestamp, stoppedAt })
    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('query');
    const statusHalf = data.status as Record<string, unknown>;
    const queryHalf = data.query as Record<string, unknown>;
    // Status half uses plural `phases` (array from parseRoadmap) + nested `state`
    expect(statusHalf).toHaveProperty('phases');
    expect(statusHalf).toHaveProperty('state');
    // Query half uses singular `phase` (number from parseStateMd) + flat fields
    expect(queryHalf).toHaveProperty('phase');
    expect(queryHalf).toHaveProperty('timestamp');
  });

  it('returns query-native shape when snapshot=query (backcompat for `query` alias path)', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(enoent());
    });

    const ctx = createMockContext({ args: { json: true, snapshot: 'query' } });
    const result = await statusSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    // Query-native flat shape (matches old sunco query output): phase (singular), status, timestamp, etc.
    expect(data).toHaveProperty('phase');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('nextAction');
    // Must NOT have the superset nesting (would break parsers of old `sunco query` output)
    expect(data).not.toHaveProperty('phases');
    expect(data).not.toHaveProperty('query');
  });

  it('handles ROADMAP.md missing but STATE.md present', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return Promise.reject(enoent());
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(enoent());
    });

    const ctx = createMockContext();
    const result = await statusSkill.execute(ctx);

    // Should still succeed with partial data
    expect(result.success).toBe(true);
  });

  it('calls recommend.getRecommendations for next action display', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(enoent());
    });

    const ctx = createMockContext();
    await statusSkill.execute(ctx);

    expect(ctx.recommend.getRecommendations).toHaveBeenCalled();
  });
});

// Phase 32: progressSkill export removed — 'progress' is now an alias on statusSkill
// These tests verify that the alias resolution works correctly via the registry
describe('progress alias (Phase 32)', () => {
  it('statusSkill declares a progress alias', () => {
    expect(statusSkill.aliases).toBeDefined();
    const progressAlias = statusSkill.aliases?.find((a) => a.command === 'progress');
    expect(progressAlias).toBeDefined();
    expect(progressAlias?.id).toBe('workflow.progress');
    expect(progressAlias?.hidden).toBe(true);
    expect(progressAlias?.replacedBy).toBe('status');
  });

  it('registry.resolveCommand("progress") returns statusSkill with isAlias: true', () => {
    const registry = new SkillRegistry();
    registry.register(statusSkill);

    const result = registry.resolveCommand('progress');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.skill.id).toBe('workflow.status');
    expect(result?.defaultArgs).toEqual({});
  });

  it('registry.resolveId("workflow.progress") returns statusSkill with isAlias: true', () => {
    const registry = new SkillRegistry();
    registry.register(statusSkill);

    const result = registry.resolveId('workflow.progress');
    expect(result).toBeDefined();
    expect(result?.isAlias).toBe(true);
    expect(result?.skill.id).toBe('workflow.status');
  });

  it('progress alias produces identical output to status (equivalence)', async () => {
    // Both 'progress' and 'status' dispatch to the same executeStatus() function
    const mockedReadFile = vi.mocked(readFile);
    mockedReadFile.mockRejectedValue(enoent());

    const ctx1 = createMockContext();
    const ctx2 = createMockContext();

    const result1 = await statusSkill.execute(ctx1);

    // Via registry.execute('workflow.progress') — identical behavior guaranteed
    const registry = new SkillRegistry();
    registry.register(statusSkill);
    const result2 = await registry.execute('workflow.progress', ctx2);

    expect(result1.success).toBe(result2.success);
    expect(result1.summary).toBe(result2.summary);
  });
});
