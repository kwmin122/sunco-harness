/**
 * Tests for ultraplan.skill.ts
 *
 * Verifies:
 * 1. Skill metadata (id, command, kind, stage)
 * 2. Prepare: No phase → failure
 * 3. Prepare: No PLAN.md files → failure with guidance
 * 4. Prepare: Happy path → prompt file written
 * 5. Prepare --draft: Missing CONTEXT.md → failure
 * 6. Prepare --draft: Happy path → prompt file written
 * 7. Import: Empty input → failure
 * 8. Import: Valid PLAN_SEPARATOR input → files written
 * 9. Import: Validation failure → warnings, partial success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext } from '@sunco/core';
import type { Dirent } from 'node:fs';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../shared/roadmap-parser.js', () => ({
  parseRoadmap: vi.fn().mockReturnValue({
    phases: [
      {
        number: 5,
        name: 'context-planning',
        description: 'Context and planning skills',
        completed: false,
        requirements: ['WF-09', 'WF-12'],
        plans: [],
        planCount: null,
        completedCount: 0,
      },
    ],
    progress: [],
  }),
}));

import { readFile, readdir, writeFile } from 'node:fs/promises';
import ultraplanSkill from '../ultraplan.skill.js';

const mockedReadFile = vi.mocked(readFile);
const mockedReaddir = vi.mocked(readdir);
const mockedWriteFile = vi.mocked(writeFile);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PLAN = `---
phase: 05-context-planning
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/plan.ts
autonomous: true
requirements:
  - WF-12
---

<objective>Create plan skill</objective>

<context>Context.</context>

<tasks>
<task type="auto">
  <name>Task 1: Create plan</name>
  <read_first>src/plan.ts</read_first>
  <files>src/plan.ts</files>
  <action>Implement.</action>
  <acceptance_criteria>file contains export function plan</acceptance_criteria>
  <verify><automated>npm test</automated></verify>
  <done>- Plan created</done>
</task>
</tasks>

<verification>npm test</verification>
<success_criteria>Plan complete.</success_criteria>`;

// ---------------------------------------------------------------------------
// Mock context factory
// ---------------------------------------------------------------------------

function createMockContext(
  overrides: Partial<SkillContext> = {},
): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      has: vi.fn().mockResolvedValue(false),
    } as unknown as SkillContext['state'],
    fileStore: {
      read: vi.fn().mockResolvedValue(undefined),
      write: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(false),
      exists: vi.fn().mockResolvedValue(false),
    } as unknown as SkillContext['fileStore'],
    agent: {
      run: vi.fn().mockResolvedValue({ success: true, outputText: '' }),
      crossVerify: vi.fn().mockResolvedValue([]),
      listProviders: vi.fn().mockResolvedValue([]),
    } as unknown as SkillContext['agent'],
    recommend: {
      getRecommendations: vi.fn().mockReturnValue([]),
      getTopRecommendation: vi.fn().mockReturnValue(undefined),
    },
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue({ selectedId: '', selectedLabel: '', source: 'default' }),
      askText: vi.fn().mockResolvedValue({ text: '', source: 'default' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: vi.fn().mockResolvedValue({ success: true }),
    cwd: '/test/project',
    args: { phase: 5 },
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

// ---------------------------------------------------------------------------
// readFile/readdir helpers
// ---------------------------------------------------------------------------

function mockReaddirImplementation(impl: (dir: unknown) => string[]): void {
  (mockedReaddir as unknown as {
    mockImplementation(fn: (dir: unknown) => Promise<string[]>): void;
  }).mockImplementation(async (dir) => impl(dir));
}

function setupPhaseDir() {
  mockReaddirImplementation((dir) => {
    const dirStr = String(dir);
    if (dirStr.endsWith('phases')) return ['05-context-planning'];
    if (dirStr.includes('05-context-planning')) return ['05-01-PLAN.md'];
    return [];
  });
}

function setupPlanFiles() {
  setupPhaseDir();
  mockedReadFile.mockImplementation(async (path) => {
    const p = String(path);
    if (p.includes('05-01-PLAN.md')) return MOCK_PLAN;
    if (p.includes('CONTEXT.md')) return '# Context\nDecisions.';
    if (p.includes('RESEARCH.md')) return '# Research\nFindings.';
    if (p.includes('ROADMAP.md')) return '# Roadmap\n- Phase 5';
    if (p.includes('STATE.md')) return '---\nstatus: planned\n---\nPhase: 5';
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ultraplan skill metadata', () => {
  it('has correct id, command, kind, stage', () => {
    expect(ultraplanSkill.id).toBe('workflow.ultraplan');
    expect(ultraplanSkill.command).toBe('ultraplan');
    expect(ultraplanSkill.kind).toBe('deterministic');
    expect(ultraplanSkill.stage).toBe('experimental');
  });
});

describe('prepare mode (review)', () => {
  it('fails when no phase number', async () => {
    mockedReadFile.mockRejectedValue(new Error('ENOENT'));
    const ctx = createMockContext({ args: {} });
    const result = await ultraplanSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toContain('No phase number');
  });

  it('fails when no PLAN.md files exist', async () => {
    setupPhaseDir();
    mockReaddirImplementation((dir) => {
      const dirStr = String(dir);
      if (dirStr.endsWith('phases')) return ['05-context-planning'];
      // Phase dir has no PLAN files
      return ['05-CONTEXT.md'];
    });
    mockedReadFile.mockImplementation(async (path) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return '# Roadmap';
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const ctx = createMockContext();
    const result = await ultraplanSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toContain('No PLAN.md files');
  });

  it('writes prompt file on success', async () => {
    setupPlanFiles();
    const ctx = createMockContext();
    const result = await ultraplanSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('outputPath');
    expect(result.data).toHaveProperty('planCount', 1);

    // writeFile called for the prompt
    expect(mockedWriteFile).toHaveBeenCalled();
    const writeCalls = mockedWriteFile.mock.calls;
    const promptWrite = writeCalls.find((c) => String(c[0]).includes('ULTRAPLAN-PROMPT'));
    expect(promptWrite).toBeDefined();
  });
});

describe('prepare --draft mode', () => {
  it('fails when CONTEXT.md is missing', async () => {
    mockReaddirImplementation((dir) => {
      const dirStr = String(dir);
      if (dirStr.endsWith('phases')) return ['05-context-planning'];
      return [];
    });
    mockedReadFile.mockRejectedValue(new Error('ENOENT'));

    const ctx = createMockContext({ args: { phase: 5, draft: true } });
    const result = await ultraplanSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toContain('CONTEXT.md not found');
  });

  it('writes draft prompt on success', async () => {
    mockReaddirImplementation((dir) => {
      const dirStr = String(dir);
      if (dirStr.endsWith('phases')) return ['05-context-planning'];
      return [];
    });
    mockedReadFile.mockImplementation(async (path) => {
      const p = String(path);
      if (p.includes('CONTEXT.md')) return '# Context\nDecisions.';
      if (p.includes('ROADMAP.md')) return '# Roadmap';
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const ctx = createMockContext({ args: { phase: 5, draft: true } });
    const result = await ultraplanSkill.execute(ctx);
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('mode', 'draft');
  });
});

describe('import mode', () => {
  it('fails on empty input', async () => {
    setupPhaseDir();
    mockedReadFile.mockImplementation(async (path) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return '# Roadmap';
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const ctx = createMockContext({ args: { phase: 5, import: true } });
    // askText returns empty
    const result = await ultraplanSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toContain('Empty');
  });

  it('imports valid PLAN_SEPARATOR input', async () => {
    setupPhaseDir();
    mockedReadFile.mockImplementation(async (path) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return '# Roadmap';
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const twoPlans = `${MOCK_PLAN}\n---PLAN_SEPARATOR---\n${MOCK_PLAN.replace('plan: 01', 'plan: 02')}`;
    const ctx = createMockContext({
      args: { phase: 5, import: true },
    });
    // Override askText to return content
    (ctx.ui.askText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: twoPlans,
      source: 'default',
    });

    const result = await ultraplanSkill.execute(ctx);
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('planCount', 2);
    expect(result.data).toHaveProperty('written');
  });

  it('reports validation failures as warnings', async () => {
    setupPhaseDir();
    mockedReadFile.mockImplementation(async (path) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return '# Roadmap';
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    // One valid, one invalid (no frontmatter after split)
    const mixed = `${MOCK_PLAN}\n---PLAN_SEPARATOR---\nJust plain text without frontmatter`;
    const ctx = createMockContext({ args: { phase: 5, import: true } });
    (ctx.ui.askText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: mixed,
      source: 'default',
    });

    const result = await ultraplanSkill.execute(ctx);
    // Should succeed (1 valid plan) but with warnings
    expect(result.success).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
  });

  it('rejects unstructured markdown input', async () => {
    setupPhaseDir();
    mockedReadFile.mockImplementation(async (path) => {
      const p = String(path);
      if (p.includes('ROADMAP.md')) return '# Roadmap';
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const ctx = createMockContext({ args: { phase: 5, import: true } });
    (ctx.ui.askText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'Plans look good, all requirements covered.',
      source: 'default',
    });

    const result = await ultraplanSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toContain('Could not parse');
  });
});
