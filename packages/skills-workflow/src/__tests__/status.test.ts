/**
 * Tests for status.skill.ts - statusSkill and progressSkill
 *
 * Verifies:
 * - Reads ROADMAP.md + STATE.md and displays formatted phase table
 * - --json flag returns raw data
 * - Missing .planning/ returns failure
 * - progressSkill shares the same execute function as statusSkill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises before imports
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';
import { statusSkill, progressSkill } from '../status.skill.js';
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
      return Promise.reject(new Error('File not found'));
    });

    const ctx = createMockContext();
    const result = await statusSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(ctx.ui.entry).toHaveBeenCalled();
    expect(ctx.ui.result).toHaveBeenCalled();
  });

  it('returns failure when .planning/ directory is missing', async () => {
    mockedReadFile.mockRejectedValue(new Error('ENOENT'));

    const ctx = createMockContext();
    const result = await statusSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/\.planning/);
  });

  it('returns raw JSON with --json flag', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(new Error('File not found'));
    });

    const ctx = createMockContext({ args: { json: true } });
    const result = await statusSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('phases');
    expect(data).toHaveProperty('state');
  });

  it('handles ROADMAP.md missing but STATE.md present', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return Promise.reject(new Error('ENOENT'));
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE);
      return Promise.reject(new Error('File not found'));
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
      return Promise.reject(new Error('File not found'));
    });

    const ctx = createMockContext();
    await statusSkill.execute(ctx);

    expect(ctx.recommend.getRecommendations).toHaveBeenCalled();
  });
});

describe('progressSkill', () => {
  it('has correct skill metadata', () => {
    expect(progressSkill.id).toBe('workflow.progress');
    expect(progressSkill.command).toBe('progress');
    expect(progressSkill.kind).toBe('deterministic');
    expect(progressSkill.category).toBe('workflow');
  });

  it('shares the same execute function as statusSkill', () => {
    // Both skills use the same underlying execute function
    expect(progressSkill.execute).toBe(statusSkill.execute);
  });
});
