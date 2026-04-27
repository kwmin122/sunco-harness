import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs has no type declarations.
import { collectEvidence, runFreshnessGate, FRESHNESS_CHECK_IDS, EvidenceCollectorError } from '../../../../../packages/cli/references/router/src/evidence-collector.mjs';

const REPO = '/fake/repo';

type Fixture = {
  git: Record<string, string>;
  files?: Record<string, string>;
  stats?: Record<string, { mtimeMs: number; isDirectory: boolean; entries?: string[] }>;
};

const makeAdapters = (fs: Fixture) => ({
  repoRoot: REPO,
  execGit: (args: string[]) => fs.git[args.join(' ')] || '',
  readFile: (p: string) => (fs.files && fs.files[p] !== undefined) ? fs.files[p] : null,
  statFile: (p: string) => (fs.stats && fs.stats[p]) || null,
  now: () => new Date('2026-04-20T12:00:00.000Z'),
});

const FRESH_FIXTURE: Fixture = {
  git: {
    'status --porcelain': '',
    'rev-parse HEAD': 'abc123\n',
    'rev-parse origin/main': 'abc123\n',
    'log --since=14.days --format=%H %s': 'abc123 feat: x\n',
  },
  files: {
    [`${REPO}/.planning/STATE.md`]: '---\nmilestone: v1.5\nphase: 52b-router-classifier\n---\n',
    [`${REPO}/.planning/ROADMAP.md`]: '# Roadmap\nv1.5 section\n',
    [`${REPO}/.planning/REQUIREMENTS.md`]: '# Requirements\n',
    [`${REPO}/.planning/PROJECT.md`]: '# Project\n',
  },
  stats: {
    [`${REPO}/.planning/STATE.md`]: { mtimeMs: new Date('2026-04-20T11:58:00Z').getTime(), isDirectory: false },
    [`${REPO}/.planning/phases/52b-router-classifier`]: { mtimeMs: 0, isDirectory: true, entries: ['52b-CONTEXT.md'] },
  },
};

describe('router evidence-collector — IO boundary contract', () => {
  it('requires repoRoot', () => {
    expect(() => collectEvidence({})).toThrow(EvidenceCollectorError);
    expect(() => collectEvidence(null as any)).toThrow(EvidenceCollectorError);
  });

  it('uses injected adapters; never calls process.cwd()', () => {
    const spy = { readFileCalls: 0, statFileCalls: 0, execGitCalls: 0 };
    const ctx = {
      repoRoot: REPO,
      readFile: (p: string) => { spy.readFileCalls++; return FRESH_FIXTURE.files?.[p] ?? null; },
      statFile: (p: string) => { spy.statFileCalls++; return FRESH_FIXTURE.stats?.[p] || null; },
      execGit: (args: string[]) => { spy.execGitCalls++; return FRESH_FIXTURE.git[args.join(' ')] || ''; },
      now: () => new Date('2026-04-20T12:00:00.000Z'),
    };
    collectEvidence(ctx);
    expect(spy.readFileCalls).toBeGreaterThan(0);
    expect(spy.execGitCalls).toBeGreaterThan(0);
  });
});

describe('router evidence-collector — Freshness Gate contract', () => {
  it('returns exactly 7 checks in canonical ID order', () => {
    const ev = collectEvidence(makeAdapters(FRESH_FIXTURE));
    expect(ev.freshness.checks.length).toBe(7);
    expect(ev.freshness.checks.map((c: any) => c.id)).toEqual(FRESHNESS_CHECK_IDS);
  });

  it('FRESHNESS_CHECK_IDS length === 7 and frozen (EVIDENCE-MODEL.md L73 enforcement)', () => {
    expect(FRESHNESS_CHECK_IDS.length).toBe(7);
    expect(Object.isFrozen(FRESHNESS_CHECK_IDS)).toBe(true);
  });

  it('fresh scenario → freshness.status === "fresh"', () => {
    const ev = collectEvidence(makeAdapters(FRESH_FIXTURE));
    expect(ev.freshness.status).toBe('fresh');
  });

  it('dirty tree → drift with git-status check === "dirty"', () => {
    const f = JSON.parse(JSON.stringify(FRESH_FIXTURE));
    f.git['status --porcelain'] = ' M src/foo.ts\n';
    const ev = collectEvidence(makeAdapters(f));
    expect(ev.freshness.status).toBe('drift');
    expect(ev.freshness.checks.find((c: any) => c.id === 'git-status').result).toBe('dirty');
  });

  it('origin drift → drift with origin-head check === "drift"', () => {
    const f = JSON.parse(JSON.stringify(FRESH_FIXTURE));
    f.git['rev-parse origin/main'] = 'def456\n';
    const ev = collectEvidence(makeAdapters(f));
    expect(ev.freshness.status).toBe('drift');
    expect(ev.freshness.checks.find((c: any) => c.id === 'origin-head').result).toBe('drift');
  });

  it('phase dir missing → drift', () => {
    const f = JSON.parse(JSON.stringify(FRESH_FIXTURE));
    delete f.stats[`${REPO}/.planning/phases/52b-router-classifier`];
    const ev = collectEvidence(makeAdapters(f));
    expect(ev.freshness.status).toBe('drift');
  });

  it('STATE frontmatter present → roadmap-state-alignment aligned when milestone token appears in ROADMAP', () => {
    const ev = collectEvidence(makeAdapters(FRESH_FIXTURE));
    const check = ev.freshness.checks.find((c: any) => c.id === 'roadmap-state-alignment');
    expect(check.result).toBe('aligned');
  });

  it('paused-state.json parsed when present', () => {
    const f = JSON.parse(JSON.stringify(FRESH_FIXTURE));
    f.files[`${REPO}/.planning/router/paused-state.json`] = JSON.stringify({ paused_at_stage: 'WORK', ts: '2026-04-20' });
    const ev = collectEvidence(makeAdapters(f));
    expect(ev.pausedState).toBeDefined();
    expect(ev.pausedState.paused_at_stage).toBe('WORK');
  });

  it('evidence_refs populated from presence flags', () => {
    const ev = collectEvidence(makeAdapters(FRESH_FIXTURE));
    expect(ev.evidenceRefs).toContain('.planning/STATE.md');
    expect(ev.evidenceRefs).toContain('.planning/REQUIREMENTS.md');
  });

  it('overrides bypass adapter reads', () => {
    const ev = collectEvidence({
      ...makeAdapters(FRESH_FIXTURE),
      overrides: { requirementsPresent: false, testsState: 'passing' },
    });
    expect(ev.requirementsPresent).toBe(false);
    expect(ev.testsState).toBe('passing');
  });
});

describe('router evidence-collector — adapter injection isolation', () => {
  it('test fixtures never depend on live repo state (now() injectable)', () => {
    let calledNow = false;
    const ctx = {
      ...makeAdapters(FRESH_FIXTURE),
      now: () => { calledNow = true; return new Date('2026-04-20T12:00:00.000Z'); },
    };
    collectEvidence(ctx);
    expect(calledNow).toBe(true);
  });
});
