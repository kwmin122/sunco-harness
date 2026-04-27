/**
 * Tests for pause and resume skills
 *
 * Verifies:
 * - pause creates valid HANDOFF.json via fileStore.write
 * - pause captures git state (branch, uncommitted files)
 * - resume reads and displays HANDOFF.json
 * - resume handles missing HANDOFF.json gracefully
 * - resume warns on branch mismatch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, SkillResult, SkillUi } from '@sunco/core';
import type { FileStoreApi, StateApi, RecommenderApi } from '@sunco/core';
import type { Handoff } from '../shared/handoff.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockFileStore(store: Record<string, string> = {}): FileStoreApi {
  return {
    read: vi.fn(async (_category: string, filename: string) => store[filename] ?? undefined),
    write: vi.fn(async (_category: string, filename: string, content: string) => {
      store[filename] = content;
    }),
    delete: vi.fn(async (_category: string, filename: string) => {
      const existed = filename in store;
      delete store[filename];
      return existed;
    }),
    list: vi.fn(async () => Object.keys(store)),
    exists: vi.fn(async (_category: string, filename: string) => filename in store),
  };
}

function createMockUi(): SkillUi {
  return {
    entry: vi.fn(async () => {}),
    result: vi.fn(async () => {}),
    progress: vi.fn(async () => {}),
    ask: vi.fn(async () => ''),
    choose: vi.fn(async () => ''),
  } as unknown as SkillUi;
}

function createMockState(): StateApi {
  return {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => false),
    list: vi.fn(async () => []),
    has: vi.fn(async () => false),
  } as unknown as StateApi;
}

function createMockRecommender(): RecommenderApi {
  return {
    recommend: vi.fn(async () => []),
    addRule: vi.fn(),
  } as unknown as RecommenderApi;
}

function createMockContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: createMockState(),
    fileStore: createMockFileStore(),
    agent: {} as SkillContext['agent'],
    recommend: createMockRecommender(),
    ui: createMockUi(),
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    run: vi.fn(async () => ({ success: true })),
    registry: {
      getAll: vi.fn().mockReturnValue([]),
      getByTier: vi.fn().mockReturnValue([]),
    },
    cwd: '/test/project',
    args: {},
    signal: new AbortController().signal,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock captureGitState
// ---------------------------------------------------------------------------
vi.mock('../shared/git-state.js', () => ({
  captureGitState: vi.fn(async () => ({
    branch: 'main',
    uncommittedChanges: false,
    uncommittedFiles: [],
  })),
}));

// ---------------------------------------------------------------------------
// Mock fs/promises for STATE.md reading in pause skill
// ---------------------------------------------------------------------------
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => `---
status: executing
last_activity: 2026-03-28
progress:
  total_phases: 10
  completed_phases: 2
  total_plans: 26
  completed_plans: 21
  percent: 80
---

# Project State

## Current Position

Phase: 03 (standalone-ts-skills) -- EXECUTING
Plan: 2 of 6
`),
}));

import { captureGitState } from '../shared/git-state.js';
const mockCaptureGitState = vi.mocked(captureGitState);

// ---------------------------------------------------------------------------
// Import skills under test
// ---------------------------------------------------------------------------
import pauseSkill from '../pause.skill.js';
import resumeSkill from '../resume.skill.js';

// ---------------------------------------------------------------------------
// PAUSE SKILL TESTS
// ---------------------------------------------------------------------------
describe('pause.skill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct skill metadata', () => {
    expect(pauseSkill.id).toBe('workflow.pause');
    expect(pauseSkill.command).toBe('pause');
    expect(pauseSkill.kind).toBe('deterministic');
    expect(pauseSkill.stage).toBe('stable');
    expect(pauseSkill.category).toBe('workflow');
    expect(pauseSkill.routing).toBe('directExec');
  });

  it('creates HANDOFF.json via writeHandoff', async () => {
    const store: Record<string, string> = {};
    const fileStore = createMockFileStore(store);
    const ctx = createMockContext({ fileStore });

    const result = await pauseSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(fileStore.write).toHaveBeenCalledWith('', 'HANDOFF.json', expect.any(String));
    expect(store['HANDOFF.json']).toBeDefined();
  });

  it('captures git state via captureGitState', async () => {
    const store: Record<string, string> = {};
    const fileStore = createMockFileStore(store);
    const ctx = createMockContext({ fileStore, cwd: '/my/project' });

    await pauseSkill.execute(ctx);

    expect(mockCaptureGitState).toHaveBeenCalledWith('/my/project');
  });

  it('writes valid Handoff JSON with correct fields', async () => {
    mockCaptureGitState.mockResolvedValueOnce({
      branch: 'feature/test',
      uncommittedChanges: true,
      uncommittedFiles: ['src/foo.ts', 'src/bar.ts'],
    });

    const store: Record<string, string> = {};
    const fileStore = createMockFileStore(store);
    const ctx = createMockContext({ fileStore });

    await pauseSkill.execute(ctx);

    const handoff: Handoff = JSON.parse(store['HANDOFF.json']);
    expect(handoff.version).toBe(1);
    expect(handoff.timestamp).toBeTruthy();
    expect(handoff.currentPhase).toBe(3);
    expect(handoff.branch).toBe('feature/test');
    expect(handoff.uncommittedChanges).toBe(true);
    expect(handoff.uncommittedFiles).toEqual(['src/foo.ts', 'src/bar.ts']);
    expect(handoff.completedTasks).toEqual([]);
    expect(handoff.pendingDecisions).toEqual([]);
    expect(handoff.blockers).toEqual([]);
  });

  it('calls ui.entry and ui.result', async () => {
    const ui = createMockUi();
    const store: Record<string, string> = {};
    const fileStore = createMockFileStore(store);
    const ctx = createMockContext({ fileStore, ui });

    await pauseSkill.execute(ctx);

    expect(ui.entry).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pause' }),
    );
    expect(ui.result).toHaveBeenCalled();
  });

  it('returns success summary mentioning resume', async () => {
    const store: Record<string, string> = {};
    const fileStore = createMockFileStore(store);
    const ctx = createMockContext({ fileStore });

    const result = await pauseSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.summary).toContain('resume');
  });
});

// ---------------------------------------------------------------------------
// RESUME SKILL TESTS
// ---------------------------------------------------------------------------
describe('resume.skill', () => {
  const VALID_HANDOFF: Handoff = {
    version: 1,
    timestamp: '2026-03-28T09:00:00Z',
    currentPhase: 3,
    currentPhaseName: 'Standalone TS Skills',
    currentPlan: '03-01',
    completedTasks: ['task-1'],
    inProgressTask: 'task-2',
    pendingDecisions: ['Choose config format'],
    blockers: [],
    branch: 'main',
    uncommittedChanges: false,
    uncommittedFiles: [],
    lastSkillId: 'status',
    lastSkillResult: 'success',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct skill metadata', () => {
    expect(resumeSkill.id).toBe('workflow.resume');
    expect(resumeSkill.command).toBe('resume');
    expect(resumeSkill.kind).toBe('deterministic');
    expect(resumeSkill.stage).toBe('stable');
    expect(resumeSkill.category).toBe('workflow');
    expect(resumeSkill.routing).toBe('directExec');
  });

  it('reads and returns HANDOFF.json data', async () => {
    const store = { 'HANDOFF.json': JSON.stringify(VALID_HANDOFF) };
    const fileStore = createMockFileStore(store);
    const ctx = createMockContext({ fileStore });

    const result = await resumeSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect((result.data as Handoff).currentPhase).toBe(3);
    expect((result.data as Handoff).currentPlan).toBe('03-01');
  });

  it('returns failure when no HANDOFF.json exists', async () => {
    const fileStore = createMockFileStore({});
    const ctx = createMockContext({ fileStore });

    const result = await resumeSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toContain('No HANDOFF.json');
  });

  it('warns on branch mismatch', async () => {
    mockCaptureGitState.mockResolvedValueOnce({
      branch: 'feature/other',
      uncommittedChanges: false,
      uncommittedFiles: [],
    });

    const store = { 'HANDOFF.json': JSON.stringify(VALID_HANDOFF) };
    const fileStore = createMockFileStore(store);
    const ctx = createMockContext({ fileStore });

    const result = await resumeSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
    expect(result.warnings![0]).toContain('Branch mismatch');
    expect(result.warnings![0]).toContain('main');
    expect(result.warnings![0]).toContain('feature/other');
  });

  it('does not warn when branches match', async () => {
    mockCaptureGitState.mockResolvedValueOnce({
      branch: 'main',
      uncommittedChanges: false,
      uncommittedFiles: [],
    });

    const store = { 'HANDOFF.json': JSON.stringify(VALID_HANDOFF) };
    const fileStore = createMockFileStore(store);
    const ctx = createMockContext({ fileStore });

    const result = await resumeSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.warnings ?? []).toHaveLength(0);
  });

  it('calls ui.entry and ui.result', async () => {
    const ui = createMockUi();
    const store = { 'HANDOFF.json': JSON.stringify(VALID_HANDOFF) };
    const fileStore = createMockFileStore(store);
    const ctx = createMockContext({ fileStore, ui });

    await resumeSkill.execute(ctx);

    expect(ui.entry).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Resume' }),
    );
    expect(ui.result).toHaveBeenCalled();
  });
});
