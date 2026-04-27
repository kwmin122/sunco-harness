/**
 * Milestone skill tests -- 5 subcommands + usage fallback
 *
 * Tests cover:
 * - no subcommand: shows usage listing all 5 subcommands
 * - unknown subcommand: shows usage instructions
 * - handleNew: asks name/goal/scope/timeline/risks via ctx.ui, dispatches agent, writes artifacts
 * - handleAudit: reads planning artifacts, dispatches agent, parses score with parseMilestoneAudit
 * - handleComplete: archives milestone, creates git tag, resets state; blocks if audit < 70% unless --force
 * - handleSummary: reads all artifacts, dispatches agent, writes MILESTONE-SUMMARY.md
 * - handleGaps: reads audit report, extracts unmet reqs, builds gap phases, writes ROADMAP.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, SkillResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted ensures variables are available in vi.mock factory)
// ---------------------------------------------------------------------------

const {
  mockReadFile,
  mockWriteFile,
  mockMkdir,
  mockReaddir,
  mockCp,
  mockSimpleGit,
} = vi.hoisted(() => {
  const mockGitInstance = {
    addAnnotatedTag: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockReadFile: vi.fn(),
    mockWriteFile: vi.fn(),
    mockMkdir: vi.fn(),
    mockReaddir: vi.fn(),
    mockCp: vi.fn(),
    mockSimpleGit: vi.fn(() => mockGitInstance),
  };
});

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  cp: mockCp,
  readdir: mockReaddir,
}));

vi.mock('simple-git', () => ({
  simpleGit: mockSimpleGit,
}));

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

function createMockContext(
  args: Record<string, unknown> = {},
  overrides: {
    agentOutput?: string;
    stateValues?: Record<string, string>;
    askTextResponses?: string[];
  } = {},
): SkillContext {
  let askTextCallIdx = 0;
  const askTextResponses = overrides.askTextResponses ?? ['v2.0', 'Ship all core features', 'Core platform + harness', 'End of Q1', 'None'];
  const stateValues = overrides.stateValues ?? { milestone: 'v1.0' };

  return {
    config: {} as SkillContext['config'],
    state: {
      get: vi.fn((key: string) => Promise.resolve(stateValues[key] ?? null)),
      set: vi.fn().mockResolvedValue(undefined),
    } as unknown as SkillContext['state'],
    fileStore: {} as SkillContext['fileStore'],
    agent: {
      run: vi.fn().mockResolvedValue({
        success: true,
        outputText: overrides.agentOutput ?? 'Agent output',
      }),
      crossVerify: vi.fn(),
      listProviders: vi.fn().mockResolvedValue(['claude']),
    } as unknown as SkillContext['agent'],
    recommend: {} as SkillContext['recommend'],
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      result: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue(undefined),
      askText: vi.fn().mockImplementation(() => {
        const text = askTextResponses[askTextCallIdx] ?? '';
        askTextCallIdx++;
        return Promise.resolve({ text });
      }),
      progress: vi.fn().mockReturnValue({
        update: vi.fn(),
        done: vi.fn(),
      }),
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

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE_PROJECT_MD = '# Project\n\nSUNCO workspace OS\n';
const SAMPLE_REQUIREMENTS_MD = '# Requirements\n\n- [ ] AUTH-01: Login\n- [ ] AUTH-02: Logout\n- [x] UI-01: Dashboard\n';
const SAMPLE_STATE_MD = `---
milestone: v1.0
status: executing
---

# Project State

## Current Position

Phase: 08 (shipping-milestones)
`;

const SAMPLE_ROADMAP_MD = `# Roadmap

## Phases

- [x] **Phase 1: Core** - Core platform
- [ ] **Phase 2: Harness** - Harness skills

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core | 12/12 | Complete | |
| 2. Harness | 0/8 | Not started | - |
`;

const SAMPLE_AUDIT_REPORT = `\`\`\`json
{
  "score": 85,
  "verdict": "WARN",
  "met": ["AUTH-01", "UI-01"],
  "unmet": ["AUTH-02"],
  "analysis": "Most requirements met."
}
\`\`\``;

const SAMPLE_AUDIT_FAIL = `\`\`\`json
{
  "score": 50,
  "verdict": "FAIL",
  "met": ["UI-01"],
  "unmet": ["AUTH-01", "AUTH-02"],
  "analysis": "Significant gaps."
}
\`\`\``;

const SAMPLE_AUDIT_PASS = `\`\`\`json
{
  "score": 95,
  "verdict": "PASS",
  "met": ["AUTH-01", "AUTH-02", "UI-01"],
  "unmet": [],
  "analysis": "All requirements met."
}
\`\`\``;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('milestone skill', () => {
  let milestoneSkill: {
    default: {
      execute: (ctx: SkillContext) => Promise<SkillResult>;
      id: string;
      command: string;
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockCp.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue([]);
    milestoneSkill = await import('../milestone.skill.js');
  });

  describe('metadata', () => {
    it('has correct id and command', () => {
      expect(milestoneSkill.default.id).toBe('workflow.milestone');
      expect(milestoneSkill.default.command).toBe('milestone');
    });
  });

  describe('no subcommand', () => {
    it('shows usage listing all 5 subcommands', async () => {
      const ctx = createMockContext({ _: [] });
      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('Usage');
      // All 5 subcommands should be listed
      const uiResult = (ctx.ui.result as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const details = uiResult.details?.join('\n') ?? uiResult.summary;
      expect(details).toContain('new');
      expect(details).toContain('audit');
      expect(details).toContain('complete');
      expect(details).toContain('summary');
      expect(details).toContain('gaps');
    });
  });

  describe('unknown subcommand', () => {
    it('returns usage instructions for unknown subcommand', async () => {
      const ctx = createMockContext({ _: ['unknown'] });
      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('Unknown subcommand');
    });
  });

  // -------------------------------------------------------------------------
  // handleNew
  // -------------------------------------------------------------------------

  describe('handleNew', () => {
    it('asks milestone name and goal via ctx.ui, dispatches agent, writes result', async () => {
      const agentOutput = `# Requirements: v2.0\n\n- [ ] FEAT-01: New feature\n\n---DOCUMENT_SEPARATOR---\n\n# Roadmap: v2.0\n\n## Phases\n\n- [ ] **Phase 1: Core** - Core\n`;

      const ctx = createMockContext(
        { _: ['new'] },
        {
          agentOutput,
          askTextResponses: ['v2.0', 'Ship all core features', 'Core platform', 'End of Q1', 'None'],
        },
      );

      // Mock readdir for archive scan (no previous milestone)
      mockReaddir.mockResolvedValue([]);

      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('v2.0');
      expect(result.data).toHaveProperty('milestoneName', 'v2.0');

      // Verify askText was called for name, goal, scope, timeline, risks
      expect(ctx.ui.askText).toHaveBeenCalledTimes(5);

      // Verify agent was dispatched
      expect(ctx.agent.run).toHaveBeenCalledTimes(1);
      const agentCall = (ctx.agent.run as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(agentCall.prompt).toContain('v2.0');

      // Verify state was updated
      expect(ctx.state.set).toHaveBeenCalledWith('milestone', 'v2.0');
    });
  });

  // -------------------------------------------------------------------------
  // handleAudit
  // -------------------------------------------------------------------------

  describe('handleAudit', () => {
    it('reads artifacts, dispatches agent, parses score', async () => {
      const ctx = createMockContext(
        { _: ['audit'] },
        { agentOutput: SAMPLE_AUDIT_REPORT },
      );

      // Mock file reads: PROJECT.md, REQUIREMENTS.md
      mockReadFile
        .mockResolvedValueOnce(SAMPLE_PROJECT_MD)       // PROJECT.md
        .mockResolvedValueOnce(SAMPLE_REQUIREMENTS_MD);  // REQUIREMENTS.md

      // Mock readdir for phase directories scan
      mockReaddir.mockResolvedValueOnce(['01-core-platform', '02-harness']);

      // No VERIFICATION or SUMMARY files found in phase dirs
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('85');
      expect(result.summary).toContain('WARN');
      expect(result.data).toHaveProperty('score', 85);
      expect(result.data).toHaveProperty('verdict', 'WARN');
      const data = result.data as { met: string[]; unmet: string[] };
      expect(data.met).toEqual(['AUTH-01', 'UI-01']);
      expect(data.unmet).toEqual(['AUTH-02']);

      // Verify agent was dispatched
      expect(ctx.agent.run).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // handleComplete
  // -------------------------------------------------------------------------

  describe('handleComplete', () => {
    it('archives milestone, creates git tag, resets state', async () => {
      const ctx = createMockContext({ _: ['complete'] });

      // Mock audit report read (score >= 70)
      mockReadFile.mockResolvedValueOnce(SAMPLE_AUDIT_REPORT); // MILESTONE-AUDIT.md

      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('v1.0');
      expect(result.summary).toContain('completed');
      expect(result.data).toHaveProperty('tag');

      // Verify git tag was created
      const gitInstance = mockSimpleGit();
      expect(gitInstance.addAnnotatedTag).toHaveBeenCalledWith(
        'milestone/v1.0',
        expect.stringContaining('Milestone'),
      );
    });

    it('blocks if audit score is below 70% without --force', async () => {
      const ctx = createMockContext({ _: ['complete'] });

      // Mock audit report read (score < 70)
      mockReadFile.mockResolvedValueOnce(SAMPLE_AUDIT_FAIL);

      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.summary).toContain('too low');
      expect(result.summary).toContain('--force');
    });

    it('allows completion with --force even when score is low', async () => {
      const ctx = createMockContext({ _: ['complete'], force: true });

      // Mock audit report read (score < 70)
      mockReadFile.mockResolvedValueOnce(SAMPLE_AUDIT_FAIL);

      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('completed');
    });
  });

  // -------------------------------------------------------------------------
  // handleSummary
  // -------------------------------------------------------------------------

  describe('handleSummary', () => {
    it('reads all artifacts, dispatches agent, writes MILESTONE-SUMMARY.md', async () => {
      const summaryOutput = '# Milestone Report: v1.0\n\nComprehensive summary...';
      const ctx = createMockContext(
        { _: ['summary'] },
        { agentOutput: summaryOutput },
      );

      // Mock file reads: PROJECT.md, STATE.md, ROADMAP.md
      mockReadFile
        .mockResolvedValueOnce(SAMPLE_PROJECT_MD)   // PROJECT.md
        .mockResolvedValueOnce(SAMPLE_STATE_MD)      // STATE.md
        .mockResolvedValueOnce(SAMPLE_ROADMAP_MD);   // ROADMAP.md

      // Mock readdir for phase directories
      mockReaddir.mockResolvedValueOnce(['01-core-platform']);

      // No SUMMARY or VERIFICATION files
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('summary written');
      expect(result.data).toHaveProperty('path', '.planning/MILESTONE-SUMMARY.md');

      // Verify agent was dispatched
      expect(ctx.agent.run).toHaveBeenCalledTimes(1);

      // Verify file was written
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('MILESTONE-SUMMARY.md'),
        summaryOutput,
        'utf-8',
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleGaps
  // -------------------------------------------------------------------------

  describe('handleGaps', () => {
    it('reads audit, extracts unmet reqs, builds gap phases, writes ROADMAP.md', async () => {
      const ctx = createMockContext({ _: ['gaps'] });

      // Mock audit report read
      mockReadFile
        .mockResolvedValueOnce(SAMPLE_AUDIT_REPORT) // MILESTONE-AUDIT.md
        .mockResolvedValueOnce(SAMPLE_ROADMAP_MD);  // ROADMAP.md

      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('catch-up');
      expect(result.summary).toContain('1'); // 1 unmet req

      // Verify ROADMAP.md was written back
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('ROADMAP.md'),
        expect.stringContaining('AUTH Gap Resolution'),
        'utf-8',
      );
    });

    it('returns empty result when no unmet requirements exist', async () => {
      const ctx = createMockContext({ _: ['gaps'] });

      // Mock audit report with no unmet requirements
      mockReadFile.mockResolvedValueOnce(SAMPLE_AUDIT_PASS);

      const result = await milestoneSkill.default.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('No gaps');

      // Verify ROADMAP.md was NOT written (no changes needed)
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
