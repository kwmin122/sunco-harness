/**
 * Tests for review.skill.ts --fix auto-revise loop.
 *
 * Covers:
 *   - extractAgreedIssues: reads findings/issues/agreed_issues shapes
 *   - buildFixTaskText: formats a quick-friendly task string
 *   - end-to-end --fix path: calls workflow.quick per agreed issue,
 *     then workflow.verify, and annotates the returned summary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
  };
});

import reviewSkill, {
  extractAgreedIssues,
  buildFixTaskText,
} from '../review.skill.js';
import type { SkillContext, SkillResult } from '@sunco/core';

function makeCtx(args: Record<string, unknown>, delegatedResult: SkillResult): SkillContext {
  const runMock = vi.fn().mockImplementation(async (skillId: string) => {
    if (skillId === 'workflow.quick') return { success: true, summary: 'fixed' };
    if (skillId === 'workflow.verify') return { success: true, summary: 'verify PASS' };
    // specialist review (eng/ceo/design)
    return delegatedResult;
  });

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
      askText: vi.fn().mockResolvedValue({ text: '' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: runMock,
    cwd: '/tmp/test-review',
    args,
    signal: new AbortController().signal,
  } as unknown as SkillContext;
}

describe('extractAgreedIssues', () => {
  it('returns [] when data is empty', () => {
    expect(extractAgreedIssues({ success: true } as SkillResult)).toEqual([]);
  });

  it('reads agreed_issues bucket as agreed regardless of tag', () => {
    const result: SkillResult = {
      success: true,
      data: {
        agreed_issues: [
          { file: 'src/a.ts', line: 10, message: 'missing await' },
        ],
      },
    };
    const out = extractAgreedIssues(result);
    expect(out).toHaveLength(1);
    expect(out[0]!.file).toBe('src/a.ts');
    expect(out[0]!.agreement).toBe('agreed');
  });

  it('filters solo issues out of findings bucket', () => {
    const result: SkillResult = {
      success: true,
      data: {
        findings: [
          { file: 'src/a.ts', message: 'agreed issue', agreement: 'agreed' },
          { file: 'src/b.ts', message: 'solo issue', agreement: 'solo' },
        ],
      },
    };
    const out = extractAgreedIssues(result);
    expect(out.map((i) => i.message)).toEqual(['agreed issue']);
  });

  it('dedupes by file:line:message', () => {
    const result: SkillResult = {
      success: true,
      data: {
        agreed_issues: [
          { file: 'x', line: 1, message: 'same' },
          { file: 'x', line: 1, message: 'same' },
          { file: 'x', line: 2, message: 'same' },
        ],
      },
    };
    expect(extractAgreedIssues(result)).toHaveLength(2);
  });
});

describe('buildFixTaskText', () => {
  it('uses file:line when both present', () => {
    expect(
      buildFixTaskText({ file: 'src/x.ts', line: 12, message: 'missing null check' }),
    ).toBe('fix review finding at src/x.ts:12 — missing null check');
  });

  it('uses file only when line missing', () => {
    expect(
      buildFixTaskText({ file: 'src/x.ts', message: 'bad name' }),
    ).toBe('fix review finding at src/x.ts — bad name');
  });

  it('falls back to (unknown location) when file missing', () => {
    expect(buildFixTaskText({ message: 'unspecified' })).toBe(
      'fix review finding at (unknown location) — unspecified',
    );
  });
});

describe('review --fix loop', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes each agreed issue through workflow.quick and then re-verifies', async () => {
    const delegated: SkillResult = {
      success: true,
      summary: 'eng-review DONE',
      data: {
        agreed_issues: [
          { file: 'src/a.ts', line: 1, message: 'add await' },
          { file: 'src/b.ts', line: 5, message: 'handle null' },
        ],
      },
    };
    const ctx = makeCtx({ fix: true, type: 'eng' }, delegated);

    const result = await reviewSkill.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    const quickCalls = runMock.mock.calls.filter((c) => c[0] === 'workflow.quick');
    const verifyCalls = runMock.mock.calls.filter((c) => c[0] === 'workflow.verify');

    expect(quickCalls).toHaveLength(2);
    expect(quickCalls[0]![1]._[0]).toContain('src/a.ts:1');
    expect(quickCalls[1]![1]._[0]).toContain('src/b.ts:5');
    expect(verifyCalls).toHaveLength(1);
    const data = result.data as { fixLoop?: { succeeded: number; reVerifyPassed: boolean } };
    expect(data.fixLoop?.succeeded).toBe(2);
    expect(data.fixLoop?.reVerifyPassed).toBe(true);
  });

  it('caps fixes at --max-fix and reports skipped count', async () => {
    const delegated: SkillResult = {
      success: true,
      summary: 'eng-review DONE',
      data: {
        agreed_issues: [
          { file: 'src/a.ts', message: 'x' },
          { file: 'src/b.ts', message: 'y' },
          { file: 'src/c.ts', message: 'z' },
        ],
      },
    };
    const ctx = makeCtx({ fix: true, type: 'eng', 'max-fix': 1 }, delegated);

    await reviewSkill.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    const quickCalls = runMock.mock.calls.filter((c) => c[0] === 'workflow.quick');
    expect(quickCalls).toHaveLength(1);
  });

  it('does NOT run fix loop when --fix is absent', async () => {
    const delegated: SkillResult = {
      success: true,
      summary: 'eng-review DONE',
      data: { agreed_issues: [{ file: 'src/a.ts', message: 'x' }] },
    };
    const ctx = makeCtx({ type: 'eng' }, delegated);

    await reviewSkill.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    const quickCalls = runMock.mock.calls.filter((c) => c[0] === 'workflow.quick');
    expect(quickCalls).toHaveLength(0);
  });

  it('skips re-verify when no issues were successfully fixed', async () => {
    const delegated: SkillResult = {
      success: true,
      summary: 'eng-review DONE',
      data: { agreed_issues: [] },
    };
    const ctx = makeCtx({ fix: true, type: 'eng' }, delegated);

    await reviewSkill.execute(ctx);

    const runMock = ctx.run as ReturnType<typeof vi.fn>;
    const verifyCalls = runMock.mock.calls.filter((c) => c[0] === 'workflow.verify');
    expect(verifyCalls).toHaveLength(0);
  });
});
