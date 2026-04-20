import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
// @ts-expect-error — .mjs has no type declarations.
import { shouldPromote, writeDecision, assertInAllowlist, RouterWriterPathError, PROMOTE_REASONS, PROMOTE_RELEASE_OR_COMPOUND, PROMOTE_MILESTONE_CLOSED, PROMOTE_CONFLICTED, PROMOTE_FIRST_IN_PHASE, PROMOTE_EXPLICIT } from '../../../../../packages/cli/references/router/src/decision-writer.mjs';

const REPO = '/fake/repo';
const BASE_DECISION = {
  kind: 'route-decision', version: 1, ts: '2026-04-20T12:34:56.000Z',
  freshness: { status: 'fresh', checks: [] },
  current_stage: 'WORK', recommended_next: 'WORK', confidence: 0.9, reason: ['x'],
  preconditions: { satisfied: [], missing: [] },
  action: { command: '/sunco:execute', mode: 'requires_user_ack' },
  approval_envelope: { risk_level: 'repo_mutate', triggers_required: ['ack:repo_mutate'] },
};

function makeStubCtx(extras: any = {}) {
  const calls: any = { writes: [], renames: [], mkdirs: [] };
  return {
    calls,
    ctx: {
      repoRoot: REPO,
      now: new Date('2026-04-20T12:34:56.000Z'),
      writeFileSync: (p: string, c: string) => calls.writes.push({ p, c }),
      renameSync: (a: string, b: string) => calls.renames.push({ from: a, to: b }),
      mkdirSync: (p: string) => calls.mkdirs.push(p),
      ...extras,
    },
  };
}

describe('router decision-writer — promotion criteria (DESIGN §4.2)', () => {
  it('PROMOTE_REASONS frozen + 5 entries', () => {
    expect(Object.isFrozen(PROMOTE_REASONS)).toBe(true);
    expect(PROMOTE_REASONS.length).toBe(5);
  });

  it('criterion a: RELEASE stage triggers promotion', () => {
    const r = shouldPromote({ ...BASE_DECISION, current_stage: 'RELEASE' });
    expect(r.promote).toBe(true);
    expect(r.reasons).toContain(PROMOTE_RELEASE_OR_COMPOUND);
  });

  it('criterion a: COMPOUND stage triggers promotion', () => {
    const r = shouldPromote({ ...BASE_DECISION, current_stage: 'COMPOUND' });
    expect(r.promote).toBe(true);
  });

  it('criterion b: milestone-closed triggers promotion', () => {
    const r = shouldPromote(BASE_DECISION, { milestoneClosed: true });
    expect(r.reasons).toContain(PROMOTE_MILESTONE_CLOSED);
  });

  it('criterion c: conflicted freshness triggers promotion', () => {
    const r = shouldPromote({ ...BASE_DECISION, freshness: { status: 'conflicted', checks: [] } });
    expect(r.reasons).toContain(PROMOTE_CONFLICTED);
  });

  it('criterion d: first-in-phase triggers promotion', () => {
    const r = shouldPromote(BASE_DECISION, { firstInPhase: true });
    expect(r.reasons).toContain(PROMOTE_FIRST_IN_PHASE);
  });

  it('criterion e: explicit --durable triggers promotion', () => {
    const r = shouldPromote(BASE_DECISION, { explicitDurable: true });
    expect(r.reasons).toContain(PROMOTE_EXPLICIT);
  });

  it('no criteria met → promote === false', () => {
    const r = shouldPromote(BASE_DECISION);
    expect(r.promote).toBe(false);
    expect(r.reasons).toEqual([]);
  });

  it('shouldPromote is deterministic over 10 fixture verdicts × 10 iter', () => {
    const fixtures = [
      { d: BASE_DECISION, ctx: {}, want: false },
      { d: { ...BASE_DECISION, current_stage: 'RELEASE' }, ctx: {}, want: true },
      { d: { ...BASE_DECISION, current_stage: 'COMPOUND' }, ctx: {}, want: true },
      { d: BASE_DECISION, ctx: { milestoneClosed: true }, want: true },
      { d: { ...BASE_DECISION, freshness: { status: 'conflicted', checks: [] } }, ctx: {}, want: true },
      { d: BASE_DECISION, ctx: { firstInPhase: true }, want: true },
      { d: BASE_DECISION, ctx: { explicitDurable: true }, want: true },
      { d: { ...BASE_DECISION, current_stage: 'WORK' }, ctx: {}, want: false },
      { d: { ...BASE_DECISION, current_stage: 'VERIFY' }, ctx: {}, want: false },
      { d: { ...BASE_DECISION, current_stage: 'PROCEED' }, ctx: {}, want: false },
    ];
    for (const f of fixtures) {
      for (let i = 0; i < 10; i++) {
        const r = shouldPromote(f.d, f.ctx);
        expect(r.promote).toBe(f.want);
      }
    }
  });
});

describe('router decision-writer — atomic tmp-in-same-dir rename', () => {
  it('writes to tmp file in same directory as final, then renames', () => {
    const { ctx, calls } = makeStubCtx();
    writeDecision(BASE_DECISION, ctx);
    expect(calls.writes.length).toBe(1);
    expect(calls.renames.length).toBe(1);
    expect(path.dirname(calls.writes[0].p)).toBe(path.dirname(calls.renames[0].to));
    expect(/\.tmp-[0-9a-f]+$/.test(calls.writes[0].p)).toBe(true);
  });

  it('promoted decision emits dual-write (ephemeral + durable)', () => {
    const { ctx, calls } = makeStubCtx();
    const result = writeDecision({ ...BASE_DECISION, current_stage: 'RELEASE' }, ctx);
    expect(result.promoted).toBe(true);
    expect(calls.writes.length).toBe(2);
    expect(calls.renames.length).toBe(2);
    expect(result.ephemeralPath).toContain('.sun/router/session/');
    expect(result.durablePath).toContain('.planning/router/decisions/');
  });
});

describe('router decision-writer — path allowlist (Codex C5 / Gate 52b L6)', () => {
  it('accepts .sun/router/session/*.json', () => {
    expect(() => assertInAllowlist(`${REPO}/.sun/router/session/20260420-120000-WORK.json`, REPO)).not.toThrow();
  });
  it('accepts .planning/router/decisions/*.json', () => {
    expect(() => assertInAllowlist(`${REPO}/.planning/router/decisions/20260420-120000-WORK.json`, REPO)).not.toThrow();
  });
  it('accepts .planning/router/paused-state.json', () => {
    expect(() => assertInAllowlist(`${REPO}/.planning/router/paused-state.json`, REPO)).not.toThrow();
  });

  it('rejects STATE.md', () => {
    expect(() => assertInAllowlist(`${REPO}/.planning/STATE.md`, REPO)).toThrow(RouterWriterPathError);
  });
  it('rejects ROADMAP.md', () => {
    expect(() => assertInAllowlist(`${REPO}/.planning/ROADMAP.md`, REPO)).toThrow(RouterWriterPathError);
  });
  it('rejects REQUIREMENTS.md', () => {
    expect(() => assertInAllowlist(`${REPO}/.planning/REQUIREMENTS.md`, REPO)).toThrow(RouterWriterPathError);
  });
  it('rejects phase CONTEXT.md', () => {
    expect(() => assertInAllowlist(`${REPO}/.planning/phases/52b-router/52b-CONTEXT.md`, REPO)).toThrow(RouterWriterPathError);
  });
  it('rejects path outside repoRoot', () => {
    expect(() => assertInAllowlist('/etc/passwd', REPO)).toThrow(RouterWriterPathError);
  });
  it('rejects archive/ (read_only after move-in)', () => {
    expect(() => assertInAllowlist(`${REPO}/.planning/router/archive/old.json`, REPO)).toThrow(RouterWriterPathError);
  });
});

describe('router decision-writer — Y1 class-definition (APPROVAL-BOUNDARY.md)', () => {
  const Y1_IN_CLASS_REPO_MUTATE_OFFICIAL = [
    '.planning/ROADMAP.md',
    '.planning/phases/52b-router/52b-CONTEXT.md',
    '.planning/phases/52b-router/52b-PLAN-01.md',
    '.planning/STATE.md',
    '.planning/REQUIREMENTS.md',
  ];
  const Y1_EXCEPTION_ROUTER_WRITER_ACCEPTS = [
    '.planning/router/decisions/20260420-123456-WORK.json',
    '.sun/router/session/20260420-120000-WORK.json',
    '.planning/router/paused-state.json',
  ];
  const Y1_EXCEPTION_ROUTER_WRITER_REJECTS = [
    '.planning/router/archive/old.json', // read_only after move-in
    '.sun/forensics/report.md',          // .sun/ scratch, not router scope
  ];

  for (const p of Y1_IN_CLASS_REPO_MUTATE_OFFICIAL) {
    it(`router writer REJECTS in-class file: ${p}`, () => {
      expect(() => assertInAllowlist(`${REPO}/${p}`, REPO)).toThrow(RouterWriterPathError);
    });
  }
  for (const p of Y1_EXCEPTION_ROUTER_WRITER_ACCEPTS) {
    it(`router writer ACCEPTS exception: ${p}`, () => {
      expect(() => assertInAllowlist(`${REPO}/${p}`, REPO)).not.toThrow();
    });
  }
  for (const p of Y1_EXCEPTION_ROUTER_WRITER_REJECTS) {
    it(`router writer REJECTS non-writer exception: ${p}`, () => {
      expect(() => assertInAllowlist(`${REPO}/${p}`, REPO)).toThrow(RouterWriterPathError);
    });
  }
});
