/**
 * Rendering integration tests for active-work in status + next skills (Phase 27, task 27-01-08).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

import { readFile } from 'node:fs/promises';
import { statusSkill } from '../status.skill.js';
import nextSkillModule from '../next.skill.js';
import type { SkillContext } from '@sunco/core';
import type { ActiveWork } from '@sunco/core';

const SAMPLE_ROADMAP = `# Roadmap\n## Phases\n- [ ] Phase 1: Test\n`;
const SAMPLE_STATE = `---\ngsd_state_version: 1.0\nstatus: executing\nlast_activity: 2026-04-10\nprogress:\n  total_phases: 1\n  completed_phases: 0\n  total_plans: 1\n  completed_plans: 0\n  percent: 0\n---\n# Project State\n## Current Position\nPhase: 01 -- EXECUTING\n`;

function createMockCtx(cwd: string): SkillContext {
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
        { skillId: 'workflow.verify', title: 'Verify', reason: 'execute complete', priority: 'high', isDefault: true },
      ]),
      getTopRecommendation: vi.fn().mockReturnValue(
        { skillId: 'workflow.verify', title: 'Verify', reason: 'execute complete', priority: 'high', isDefault: true },
      ),
    },
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue({ selectedId: '', selectedLabel: '', source: 'default' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
      askText: vi.fn().mockResolvedValue(''),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: vi.fn().mockResolvedValue({ success: true }),
    cwd,
    args: {},
  } as unknown as SkillContext;
}

function makeActiveWork(overrides: Partial<ActiveWork> = {}): ActiveWork {
  return {
    updated_at: new Date().toISOString(),
    active_phase: null,
    background_work: [],
    blocked_on: null,
    next_recommended_action: null,
    recent_skill_calls: [],
    routing_misses: [],
    ...overrides,
  };
}

function mockReadFile(cwd: string, activeWork: ActiveWork | null) {
  const mockedReadFile = readFile as ReturnType<typeof vi.fn>;
  mockedReadFile.mockImplementation(async (path: string) => {
    const p = String(path);
    if (p.includes('ROADMAP.md')) return SAMPLE_ROADMAP;
    if (p.includes('STATE.md')) return SAMPLE_STATE;
    if (p.includes('active-work.json')) {
      if (activeWork === null) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return JSON.stringify(activeWork);
    }
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  });
}

describe('active-work rendering in status', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Case 1 ──────────────────────────────────────────────────────────
  it('renders Active Phase + Background Work with D-14 rules', async () => {
    const now = Date.now();
    const fiveMinsAgo = new Date(now - 5 * 60_000).toISOString();
    const twoHoursAgo = new Date(now - 120 * 60_000).toISOString();

    const work = makeActiveWork({
      active_phase: {
        id: '27', slug: 'omo-ux', state: 'in_progress',
        current_step: 'execute', category: 'deep',
      },
      background_work: [
        { kind: 'r1', agent_id: 'aaaa1', started_at: new Date(now - 10_000).toISOString(), description: 'running1', state: 'running' },
        { kind: 'r2', agent_id: 'bbbb2', started_at: new Date(now - 20_000).toISOString(), description: 'running2', state: 'running' },
        { kind: 'c_recent', agent_id: 'cccc3', started_at: new Date(now - 300_000).toISOString(), description: 'done_recent', state: 'completed', completed_at: fiveMinsAgo },
        { kind: 'c_old', agent_id: 'dddd4', started_at: twoHoursAgo, description: 'done_old', state: 'completed', completed_at: twoHoursAgo },
      ],
    });

    mockReadFile('/fake', work);
    const ctx = createMockCtx('/fake');
    await statusSkill.execute(ctx);

    const resultCall = (ctx.ui.result as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const text = (resultCall?.details as string[])?.join('\n') ?? '';

    expect(text).toContain('Active Phase');
    expect(text).toContain('Phase 27');
    expect(text).toContain('Background Work');
    expect(text).toContain('running1');
    expect(text).toContain('running2');
    expect(text).toContain('done_recent');
    expect(text).not.toContain('done_old');
  });

  // ── Case 2 ──────────────────────────────────────────────────────────
  it('no crash and no sections when active-work.json missing', async () => {
    mockReadFile('/fake', null);
    const ctx = createMockCtx('/fake');
    const result = await statusSkill.execute(ctx);

    expect(result.success).toBe(true);
    const resultCall = (ctx.ui.result as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const text = (resultCall?.details as string[])?.join('\n') ?? '';
    expect(text).not.toContain('Background Work');
    expect(text).not.toContain('Blocked');
  });

  // ── Case 3 ──────────────────────────────────────────────────────────
  it('renders Blocked section when blocked_on is set', async () => {
    const work = makeActiveWork({
      blocked_on: { reason: 'waiting for user input', since: new Date(Date.now() - 10 * 60_000).toISOString() },
    });
    mockReadFile('/fake', work);
    const ctx = createMockCtx('/fake');
    await statusSkill.execute(ctx);

    const resultCall = (ctx.ui.result as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const text = (resultCall?.details as string[])?.join('\n') ?? '';
    expect(text).toContain('Blocked');
    expect(text).toContain('waiting for user input');
  });

  // ── Case 4 ──────────────────────────────────────────────────────────
  it('Background Work renders max 3 items', async () => {
    const now = Date.now();
    const work = makeActiveWork({
      background_work: Array.from({ length: 5 }, (_, i) => ({
        kind: `agent_${i}`,
        agent_id: `id${i}xx`,
        started_at: new Date(now - i * 1000).toISOString(),
        description: `task_${i}`,
        state: 'running' as const,
      })),
    });
    mockReadFile('/fake', work);
    const ctx = createMockCtx('/fake');
    await statusSkill.execute(ctx);

    const resultCall = (ctx.ui.result as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const text = (resultCall?.details as string[])?.join('\n') ?? '';
    const matches = text.match(/agent_\d/g);
    expect(matches?.length).toBeLessThanOrEqual(3);
  });
});

describe('active-work rendering in next', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Case 5 ──────────────────────────────────────────────────────────
  it('includes source footer when active-work.json exists', async () => {
    const work = makeActiveWork({
      next_recommended_action: { command: '/sunco:verify', reason: 'test', category: 'review' },
    });
    mockReadFile('/fake', work);
    const ctx = createMockCtx('/fake');
    await nextSkillModule.execute(ctx);

    const resultCall = (ctx.ui.result as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const text = (resultCall?.details as string[])?.join('\n') ?? '';
    expect(text).toContain('source: .sun/active-work.json + recommender');
  });

  // ── Case 6 ──────────────────────────────────────────────────────────
  it('falls back to recommender-only when active-work.json missing', async () => {
    mockReadFile('/fake', null);
    const ctx = createMockCtx('/fake');
    const result = await nextSkillModule.execute(ctx);

    expect(result.success).toBe(true);
    const resultCall = (ctx.ui.result as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const text = (resultCall?.details as string[])?.join('\n') ?? '';
    expect(text).not.toContain('source: .sun/active-work.json');
  });

  // ── Case 7 ──────────────────────────────────────────────────────────
  it('blocked_on null renders (none) literal', async () => {
    const work = makeActiveWork({ blocked_on: null });
    mockReadFile('/fake', work);
    const ctx = createMockCtx('/fake');
    await nextSkillModule.execute(ctx);

    const resultCall = (ctx.ui.result as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const text = (resultCall?.details as string[])?.join('\n') ?? '';
    expect(text).toContain('(none)');
  });
});
