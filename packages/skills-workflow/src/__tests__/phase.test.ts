/**
 * Phase skill tests - add, insert, remove subcommands
 *
 * Tests cover:
 * - add: appends phase with next sequential number, creates directory
 * - insert: decimal numbering (3.1, 3.2), no renumbering
 * - remove: safety check (refuses completed/in-progress), renumbers subsequent
 * - no subcommand: shows usage help
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, SkillResult } from '@sunco/core';

// We need to mock fs/promises and the shared modules
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
  readdir: vi.fn(),
}));

import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';

const mockedReadFile = vi.mocked(readFile);
const mockedWriteFile = vi.mocked(writeFile);
const mockedMkdir = vi.mocked(mkdir);
const mockedRename = vi.mocked(rename);
const mockedReaddir = vi.mocked(readdir);

const SAMPLE_ROADMAP = `# Roadmap: SUN (sunco)

## Phases

- [x] **Phase 1: Core Platform** - CLI engine, config
- [ ] **Phase 2: Harness Skills** - init, lint
- [ ] **Phase 3: Standalone TS Skills** - session, ideas

## Phase Details

### Phase 1: Core Platform
**Goal**: Working CLI
**Requirements**: CLI-01

### Phase 2: Harness Skills
**Goal**: Deterministic backbone
**Requirements**: HRN-01

### Phase 3: Standalone TS Skills
**Goal**: Session management
**Requirements**: SES-01

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Platform | 12/12 | Complete |  |
| 2. Harness Skills | 0/8 | Not started | - |
| 3. Standalone TS Skills | 0/6 | Not started | - |
`;

function createMockContext(args: Record<string, unknown> = {}): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: {} as SkillContext['state'],
    fileStore: {} as SkillContext['fileStore'],
    agent: {} as SkillContext['agent'],
    recommend: {} as SkillContext['recommend'],
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      result: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue(undefined),
      progress: vi.fn().mockResolvedValue(undefined),
    } as unknown as SkillContext['ui'],
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    run: vi.fn(),
    registry: {
      getAll: vi.fn().mockReturnValue([]),
      getByTier: vi.fn().mockReturnValue([]),
    },
    cwd: '/test/project',
    args,
    signal: new AbortController().signal,
  };
}

describe('phase skill', () => {
  let phaseSkill: { default: { execute: (ctx: SkillContext) => Promise<SkillResult>; id: string; command: string } };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedMkdir.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
    mockedRename.mockResolvedValue(undefined);
    mockedReaddir.mockResolvedValue([]);
    phaseSkill = await import('../phase.skill.js');
  });

  describe('metadata', () => {
    it('has correct id and command', () => {
      expect(phaseSkill.default.id).toBe('workflow.phase');
      expect(phaseSkill.default.command).toBe('phase');
    });
  });

  describe('no subcommand', () => {
    it('shows usage help when no subcommand given', async () => {
      const ctx = createMockContext({ _: [] });
      const result = await phaseSkill.default.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.summary).toContain('Usage');
    });
  });

  describe('add subcommand', () => {
    it('appends phase with next sequential number', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['add', 'Debugging Tools'] });
      const result = await phaseSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      // Verify writeFile was called with content containing Phase 4
      const writtenContent = mockedWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('**Phase 4: Debugging Tools**');
      expect(writtenContent).toContain('- [ ] **Phase 4: Debugging Tools**');
    });

    it('creates the phase directory with padded number', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['add', 'Debugging Tools'] });
      await phaseSkill.default.execute(ctx);

      expect(mockedMkdir).toHaveBeenCalledWith(
        expect.stringContaining('04-debugging-tools'),
        { recursive: true },
      );
    });

    it('creates directory at correct .planning/phases/ path', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['add', 'Debug'] });
      await phaseSkill.default.execute(ctx);

      expect(mockedMkdir).toHaveBeenCalledWith(
        '/test/project/.planning/phases/04-debug',
        { recursive: true },
      );
    });

    it('writes updated ROADMAP.md back', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['add', 'New Phase'] });
      await phaseSkill.default.execute(ctx);

      expect(mockedWriteFile).toHaveBeenCalledWith(
        '/test/project/.planning/ROADMAP.md',
        expect.any(String),
        'utf-8',
      );
    });

    it('adds progress table row for new phase', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['add', 'Debugging'] });
      await phaseSkill.default.execute(ctx);

      const writtenContent = mockedWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('4. Debugging');
    });
  });

  describe('insert subcommand', () => {
    it('produces decimal phase number (3.1)', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['insert', 'Urgent Fix'], after: '3' });
      const result = await phaseSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      const writtenContent = mockedWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('**Phase 3.1: Urgent Fix**');
    });

    it('increments decimal if 3.1 already exists (3.2)', async () => {
      // Insert first
      const firstContent = SAMPLE_ROADMAP.replace(
        '- [ ] **Phase 3: Standalone TS Skills** - session, ideas',
        '- [ ] **Phase 3: Standalone TS Skills** - session, ideas\n- [ ] **Phase 3.1: First Fix** - first',
      );
      mockedReadFile.mockResolvedValue(firstContent);
      const ctx = createMockContext({ _: ['insert', 'Second Fix'], after: '3' });
      await phaseSkill.default.execute(ctx);

      const writtenContent = mockedWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('**Phase 3.2: Second Fix**');
    });

    it('creates directory with decimal number in name', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['insert', 'Urgent Fix'], after: '3' });
      await phaseSkill.default.execute(ctx);

      expect(mockedMkdir).toHaveBeenCalledWith(
        expect.stringContaining('03.1-urgent-fix'),
        { recursive: true },
      );
    });

    it('does not renumber existing phases', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['insert', 'Hotfix'], after: '2' });
      await phaseSkill.default.execute(ctx);

      const writtenContent = mockedWriteFile.mock.calls[0][1] as string;
      // Phase 3 should still be Phase 3 (no renumbering)
      expect(writtenContent).toContain('Phase 3: Standalone TS Skills');
    });

    it('requires --after option', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['insert', 'Fix'] });
      const result = await phaseSkill.default.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('--after');
    });
  });

  describe('remove subcommand', () => {
    it('removes a not-started phase', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      mockedReaddir.mockResolvedValue([]);
      const ctx = createMockContext({ _: ['remove', '3'] });
      const result = await phaseSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      const writtenContent = mockedWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).not.toContain('Phase 3: Standalone TS Skills');
    });

    it('refuses to remove a completed phase', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['remove', '1'] });
      const result = await phaseSkill.default.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('cannot be removed');
    });

    it('refuses to remove an in-progress phase (has completed plans)', async () => {
      // Modify sample to have Phase 2 with some completed plans
      const inProgressRoadmap = SAMPLE_ROADMAP.replace(
        '| 2. Harness Skills | 0/8 | Not started | - |',
        '| 2. Harness Skills | 3/8 | In progress | - |',
      );
      mockedReadFile.mockResolvedValue(inProgressRoadmap);
      const ctx = createMockContext({ _: ['remove', '2'] });
      const result = await phaseSkill.default.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('cannot be removed');
    });

    it('renumbers subsequent phases after removal', async () => {
      // Add Phase 4, then remove Phase 3 -- Phase 4 should become Phase 3
      const fourPhaseRoadmap = SAMPLE_ROADMAP
        .replace(
          '- [ ] **Phase 3: Standalone TS Skills** - session, ideas',
          '- [ ] **Phase 3: Standalone TS Skills** - session, ideas\n- [ ] **Phase 4: Debugging** - debug tools',
        )
        .replace(
          '| 3. Standalone TS Skills | 0/6 | Not started | - |',
          '| 3. Standalone TS Skills | 0/6 | Not started | - |\n| 4. Debugging | 0/? | Not started | - |',
        )
        .replace(
          '### Phase 3: Standalone TS Skills\n**Goal**: Session management\n**Requirements**: SES-01',
          '### Phase 3: Standalone TS Skills\n**Goal**: Session management\n**Requirements**: SES-01\n\n### Phase 4: Debugging\n**Goal**: Debug tools\n**Requirements**: DBG-01',
        );
      mockedReadFile.mockResolvedValue(fourPhaseRoadmap);
      mockedReaddir.mockResolvedValue([]);
      const ctx = createMockContext({ _: ['remove', '3'] });
      const result = await phaseSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      const writtenContent = mockedWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('Phase 3: Debugging');
      expect(writtenContent).not.toContain('Phase 4: Debugging');
    });

    it('returns error for non-existent phase', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['remove', '99'] });
      const result = await phaseSkill.default.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('not found');
    });

    it('requires phase number argument', async () => {
      mockedReadFile.mockResolvedValue(SAMPLE_ROADMAP);
      const ctx = createMockContext({ _: ['remove'] });
      const result = await phaseSkill.default.execute(ctx);

      expect(result.success).toBe(false);
    });
  });
});
