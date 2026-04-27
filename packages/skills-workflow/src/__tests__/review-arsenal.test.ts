/**
 * Tests for Phase 24d review arsenal and compound skill.
 *
 * Covers:
 * 1. ceo-review.skill.ts: metadata
 * 2. eng-review.skill.ts: metadata
 * 3. design-review.skill.ts: metadata
 * 4. compound.skill.ts: metadata
 * 5. Review skills read multiple PLAN files (not just NN-PLAN.md)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('simple-git', () => ({
  simpleGit: () => ({
    log: vi.fn().mockResolvedValue({ all: [] }),
    diff: vi.fn().mockResolvedValue(''),
  }),
}));

import { readFile, readdir } from 'node:fs/promises';
const mockedReadFile = vi.mocked(readFile);
const mockedReaddir = vi.mocked(readdir);

// Skill imports
import ceoReviewSkill from '../ceo-review.skill.js';
import engReviewSkill from '../eng-review.skill.js';
import designReviewSkill from '../design-review.skill.js';
import compoundSkill from '../compound.skill.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockAgentResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    success: true,
    outputText: 'Mock result',
    providerId: 'test',
    artifacts: [],
    warnings: [],
    usage: { estimated: true, wallTimeMs: 0 },
    ...overrides,
  };
}

function createMockContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    agent: {
      run: vi.fn().mockResolvedValue(createMockAgentResult()),
      crossVerify: vi.fn().mockResolvedValue([]),
      listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
    } as unknown as SkillContext['agent'],
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue({ selectedId: 'approve', selectedLabel: 'Approve' }),
      askText: vi.fn().mockResolvedValue({ text: 'test' }),
      progress: vi.fn().mockReturnValue({
        update: vi.fn(),
        done: vi.fn(),
      }),
      result: vi.fn().mockResolvedValue(undefined),
    },
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    state: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    },
    fileStore: {
      read: vi.fn().mockResolvedValue(null),
      write: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    },
    run: vi.fn().mockResolvedValue({ success: true }),
    cwd: '/test/project',
    args: { phase: 5 },
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

const MOCK_ROADMAP = `# Roadmap

## Phases

- [ ] **Phase 5: Test Phase** - A test phase for review skills

### Phase 5: Test Phase
Requirements: REQ-01, REQ-02`;

const MOCK_STATE = `---
status: executing
---

Phase: 05 (test-phase)`;

// ---------------------------------------------------------------------------
// Metadata tests
// ---------------------------------------------------------------------------

describe('Review arsenal skill metadata', () => {
  it('ceo-review has correct metadata', () => {
    expect(ceoReviewSkill.id).toBe('workflow.ceo-review');
    expect(ceoReviewSkill.command).toBe('ceo-review');
    expect(ceoReviewSkill.kind).toBe('prompt');
  });

  it('eng-review has correct metadata', () => {
    expect(engReviewSkill.id).toBe('workflow.eng-review');
    expect(engReviewSkill.command).toBe('eng-review');
    expect(engReviewSkill.kind).toBe('prompt');
  });

  it('design-review has correct metadata', () => {
    expect(designReviewSkill.id).toBe('workflow.design-review');
    expect(designReviewSkill.command).toBe('design-review');
    expect(designReviewSkill.kind).toBe('prompt');
  });

  it('compound has correct metadata', () => {
    expect(compoundSkill.id).toBe('workflow.compound');
    expect(compoundSkill.command).toBe('compound');
    expect(compoundSkill.kind).toBe('prompt');
  });
});

// ---------------------------------------------------------------------------
// Multi-plan loading tests
// ---------------------------------------------------------------------------

describe('Review skills read multiple PLAN files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ceo-review reads all NN-*-PLAN.md files', async () => {
    mockedReaddir.mockImplementation(async (dirPath) => {
      const p = String(dirPath);
      // Phase dir contents (more specific match first)
      if (p.endsWith('05-test-phase')) {
        return ['05-01-PLAN.md', '05-02-PLAN.md', '05-CONTEXT.md'] as unknown as ReturnType<typeof readdir>;
      }
      // Phases listing
      if (p.includes('.planning/phases')) {
        return ['05-test-phase'] as unknown as ReturnType<typeof readdir>;
      }
      // .sun/designs (for ceo-review)
      if (p.includes('.sun/designs')) {
        return [] as unknown as ReturnType<typeof readdir>;
      }
      return [] as unknown as ReturnType<typeof readdir>;
    });

    mockedReadFile.mockImplementation(async (filePath) => {
      const p = String(filePath);
      if (p.includes('STATE.md')) return MOCK_STATE;
      if (p.includes('ROADMAP.md')) return MOCK_ROADMAP;
      if (p.includes('CLAUDE.md')) throw new Error('ENOENT');
      if (p.includes('01-PLAN.md')) return '# Plan 01\nFirst plan content';
      if (p.includes('02-PLAN.md')) return '# Plan 02\nSecond plan content';
      if (p.includes('CONTEXT.md')) return '# Context';
      if (p.includes('RESEARCH.md')) throw new Error('ENOENT');
      if (p.includes('PRODUCT-SPEC.md')) throw new Error('ENOENT');
      throw new Error(`ENOENT: ${p}`);
    });

    const ctx = createMockContext();
    const result = await ceoReviewSkill.execute(ctx);

    // Should succeed and call agent
    expect(result.success).toBe(true);
    expect(ctx.agent.run).toHaveBeenCalled();
    const agentCall = (ctx.agent.run as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // The prompt should contain both plans
    expect(agentCall.prompt).toContain('First plan content');
    expect(agentCall.prompt).toContain('Second plan content');
  });

  it('eng-review reads all NN-*-PLAN.md files', async () => {
    mockedReaddir.mockImplementation(async (dirPath) => {
      const p = String(dirPath);
      if (p.endsWith('05-test-phase')) {
        return ['05-01-PLAN.md', '05-02-PLAN.md'] as unknown as ReturnType<typeof readdir>;
      }
      if (p.includes('.planning/phases')) {
        return ['05-test-phase'] as unknown as ReturnType<typeof readdir>;
      }
      return [] as unknown as ReturnType<typeof readdir>;
    });

    mockedReadFile.mockImplementation(async (filePath) => {
      const p = String(filePath);
      if (p.includes('STATE.md')) return MOCK_STATE;
      if (p.includes('ROADMAP.md')) return MOCK_ROADMAP;
      if (p.includes('01-PLAN.md')) return '# Plan 01\nEng plan one';
      if (p.includes('02-PLAN.md')) return '# Plan 02\nEng plan two';
      if (p.includes('CONTEXT.md')) return '# Context';
      if (p.includes('RESEARCH.md')) throw new Error('ENOENT');
      if (p.includes('PRODUCT-SPEC.md')) throw new Error('ENOENT');
      throw new Error(`ENOENT: ${p}`);
    });

    const ctx = createMockContext();
    const result = await engReviewSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.agent.run).toHaveBeenCalled();
    const agentCall = (ctx.agent.run as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(agentCall.prompt).toContain('Eng plan one');
    expect(agentCall.prompt).toContain('Eng plan two');
  });
});
