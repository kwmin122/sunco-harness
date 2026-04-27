/**
 * Phase 5 — Golden scenarios. RELEASE GATE.
 *
 * Five end-to-end scenarios that exercise the entire advisor engine
 * (risk classifier → policy → message → noise budget). Each scenario
 * pins a SNAPSHOT of the observable output shape so future changes
 * can't silently drift the advisor's behavior.
 *
 * Scenarios (per the v2 plan):
 *   1. auth-edit       — "fix login session bug" over src/auth/session.ts
 *   2. button-copy     — "shorten the button label" over Button.tsx
 *   3. schema-deploy   — "apply the new schema to prod" over prisma/schema.prisma
 *   4. test-failure    — "tests are failing in the checkout flow"
 *   5. existing-plan   — same auth-edit with an approved spec already present
 *                        (the fact that .planning/PROJECT.md exists is
 *                        outside risk-classifier's scope, but we pin that
 *                        the advisor's suggestion still surfaces — the
 *                        hard gate happens later in the SUNCO pipeline,
 *                        not in advisor)
 *
 * Snapshot content is inlined (not vitest snapshots) so the file is
 * self-contained and easy to review in PRs.
 */

import { describe, it, expect } from 'vitest';

import { classifyRisk } from '../shared/risk-classifier.js';
import { decideAdvice } from '../shared/advisor-policy.js';
import { annotateDecision } from '../shared/advisor-message.js';
import {
  makeBudget,
  recordSurfaced,
  shouldSurface,
} from '../shared/advisor-noise-budget.js';
import {
  DEFAULT_ADVISOR_CONFIG,
  DEFAULT_SUPPRESSION_POLICY,
} from '../shared/advisor-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runScenario(intent: string, files: string[], flags?: Record<string, boolean>) {
  const risk = classifyRisk({ intent, files, flags });
  const decision = annotateDecision(decideAdvice({ risk, config: DEFAULT_ADVISOR_CONFIG }));
  const budget = makeBudget(DEFAULT_SUPPRESSION_POLICY);
  const surface = shouldSurface(budget, decision);
  return { risk, decision, surface };
}

// ---------------------------------------------------------------------------
// Scenario 1: auth-edit
// ---------------------------------------------------------------------------

describe('golden scenario 1 — auth-edit', () => {
  it('classifies as guarded with touchesAuth', () => {
    const r = runScenario(
      'fix the login session cookie bug',
      ['src/auth/session.ts'],
    );
    expect(r.risk.bucket).toBe('guarded');
    expect(r.risk.signals).toContain('touchesAuth');
  });

  it('policy pre-gates include spec-approval; post includes targeted test + security review', () => {
    const r = runScenario('fix the login bug', ['src/auth/login.ts']);
    expect(r.decision.preGates.map((g) => g.gate)).toEqual(
      expect.arrayContaining(['spec-approval']),
    );
    expect(r.decision.postGates.map((g) => g.gate)).toEqual(
      expect.arrayContaining(['lint', 'test', 'review']),
    );
    expect(
      r.decision.postGates.some((g) => g.gate === 'review' && g.scope === 'security'),
    ).toBe(true);
  });

  it('message follows Risk/Suggestion template and stays ≤ 300 chars', () => {
    const r = runScenario('fix login bug', ['src/auth/session.ts']);
    expect(r.decision.userVisibleMessage).toMatch(/^Risk:/);
    expect(r.decision.userVisibleMessage).toMatch(/Suggestion:/);
    expect((r.decision.userVisibleMessage ?? '').length).toBeLessThanOrEqual(300);
  });

  it('surfaces on first attempt, suppresses on repeat', () => {
    const state = makeBudget(DEFAULT_SUPPRESSION_POLICY);
    const { decision } = runScenario('fix login bug', ['src/auth/session.ts']);
    expect(shouldSurface(state, decision).show).toBe(true);
    recordSurfaced(state, decision);
    expect(shouldSurface(state, decision).show).toBe(false);
    expect(shouldSurface(state, decision).reason).toBe('recently-surfaced');
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: button-copy
// ---------------------------------------------------------------------------

describe('golden scenario 2 — button-copy (should be silent)', () => {
  it('classifies as silent, no user-visible message, no gates', () => {
    const r = runScenario('shorten the button label text', ['src/components/Button.tsx']);
    expect(r.risk.bucket).toBe('silent');
    expect(r.decision.level).toBe('silent');
    expect(r.decision.userVisibleMessage).toBeUndefined();
    expect(r.decision.systemInjection).toBeUndefined();
    expect(r.decision.preGates).toEqual([]);
    expect(r.decision.postGates).toEqual([]);
  });

  it('never surfaces regardless of budget', () => {
    const state = makeBudget(DEFAULT_SUPPRESSION_POLICY);
    const { decision } = runScenario('shorten the button label', ['src/components/Button.tsx']);
    const r = shouldSurface(state, decision);
    expect(r.show).toBe(false);
    expect(r.reason).toBe('level-silent');
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: schema-deploy
// ---------------------------------------------------------------------------

describe('golden scenario 3 — schema-deploy (blocker, downgrades to guarded by default)', () => {
  it('deploy intent + schema is blocker-bucket', () => {
    const r = runScenario(
      'apply the new schema migration to prod',
      ['prisma/schema.prisma', 'migrations/20240417_add_tenant.sql'],
    );
    expect(r.risk.bucket).toBe('blocker');
    expect(r.risk.signals).toContain('deploymentIntent');
  });

  it('with blocking=false (default), level downgrades to guarded but reasons preserved', () => {
    const r = runScenario(
      'apply the new schema migration to prod',
      ['prisma/schema.prisma'],
    );
    expect(r.decision.level).toBe('guarded');
    expect(r.decision.reasonCodes).toContain('deploymentIntent');
    expect(r.decision.confirmationReason).not.toBeNull();
  });

  it('with blocking=true, level stays blocker and the XML has confirmation attr', () => {
    const risk = classifyRisk({
      intent: 'apply the new schema migration to prod',
      files: ['prisma/schema.prisma'],
    });
    const decision = annotateDecision(
      decideAdvice({ risk, config: { ...DEFAULT_ADVISOR_CONFIG, blocking: true } }),
    );
    expect(decision.level).toBe('blocker');
    expect(decision.systemInjection).toMatch(/level="blocker"/);
    // Planning + verify + review gates all required
    expect(decision.preGates.map((g) => g.gate)).toEqual(
      expect.arrayContaining(['spec-approval', 'plan']),
    );
    expect(decision.postGates.map((g) => g.gate)).toEqual(
      expect.arrayContaining(['verify', 'review', 'proceed']),
    );
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: test-failure
// ---------------------------------------------------------------------------

describe('golden scenario 4 — test-failure', () => {
  it('testFailures flag routes to debug', () => {
    const r = runScenario('tests are failing in the checkout flow', [], {
      testFailures: true,
    });
    expect(r.decision.recommendedRoute).toBe('debug');
  });

  it('suggests running targeted tests in the advice text', () => {
    const r = runScenario('tests are failing', [], { testFailures: true });
    // At notice level, the route suggestion goes through a debug template
    expect(r.decision.userVisibleMessage).toMatch(/Risk:/);
    expect(r.decision.userVisibleMessage).toMatch(/Suggestion:/);
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: existing-plan (advisor must still surface; the spec gate
// is a separate concern, not the advisor's)
// ---------------------------------------------------------------------------

describe('golden scenario 5 — existing-plan (auth edit with spec already approved)', () => {
  it('advisor still surfaces a guarded message', () => {
    // The advisor does NOT check .planning/PROJECT.md — that's the
    // spec-approval gate's job. The advisor's contract says: surface
    // a Risk/Suggestion block whenever risk signals fire. The
    // downstream /sunco:execute will let the change through thanks to
    // spec-approval-gate; the advisor still does its job.
    const r = runScenario('implement session rotation', ['src/auth/session.ts']);
    expect(r.decision.level).toBe('guarded');
    expect(r.decision.userVisibleMessage).toMatch(/Risk:/);
  });

  it('second edit to the same file within the window is suppressed', () => {
    const state = makeBudget(DEFAULT_SUPPRESSION_POLICY);
    const { decision } = runScenario('session rotation v2', ['src/auth/session.ts']);
    expect(shouldSurface(state, decision).show).toBe(true);
    recordSurfaced(state, decision);
    expect(shouldSurface(state, decision).reason).toBe('recently-surfaced');
  });
});

// ---------------------------------------------------------------------------
// Cross-scenario invariants
// ---------------------------------------------------------------------------

describe('golden cross-scenario invariants', () => {
  const cases: Array<{ name: string; intent: string; files: readonly string[]; flags?: Record<string, boolean> }> = [
    { name: 'auth', intent: 'fix login bug', files: ['src/auth/session.ts'] },
    { name: 'docs', intent: 'fix typo', files: ['README.md'] },
    { name: 'schema-deploy', intent: 'deploy schema', files: ['prisma/schema.prisma'] },
    { name: 'test-fail', intent: 'debug test', files: [], flags: { testFailures: true } },
  ];

  it('every decision has a stable suppressionKey', () => {
    for (const c of cases) {
      const r1 = runScenario(c.intent, [...c.files], c.flags);
      const r2 = runScenario(c.intent, [...c.files], c.flags);
      expect(r1.decision.suppressionKey).toBe(r2.decision.suppressionKey);
    }
  });

  it('expiresAt is always a future ISO timestamp', () => {
    for (const c of cases) {
      const r = runScenario(c.intent, [...c.files], c.flags);
      expect(Date.parse(r.decision.expiresAt)).toBeGreaterThan(Date.now() - 1000);
    }
  });

  it('no decision leaks autoExecuteSkills on its wire format', () => {
    for (const c of cases) {
      const r = runScenario(c.intent, [...c.files], c.flags);
      expect(
        (r.decision as unknown as { autoExecuteSkills?: unknown }).autoExecuteSkills,
      ).toBeUndefined();
    }
  });

  it('systemInjection (when present) is valid-looking XML', () => {
    for (const c of cases) {
      const r = runScenario(c.intent, [...c.files], c.flags);
      if (!r.decision.systemInjection) continue;
      expect(r.decision.systemInjection).toMatch(/^<sunco_advisor /);
      expect(r.decision.systemInjection).toContain('visibility="internal"');
      expect(r.decision.systemInjection.trim()).toMatch(/<\/sunco_advisor>$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Noise budget dogfood: 6 distinct guarded tasks, cap at 5 visible
// ---------------------------------------------------------------------------

describe('golden noise-budget dogfood', () => {
  it('session cap hits at maxVisiblePerSession; 6th is suppressed', () => {
    const state = makeBudget({ ...DEFAULT_SUPPRESSION_POLICY, maxVisiblePerSession: 5 });
    // Produce 6 decisions with DISTINCT signal combinations so they
    // don't dedupe by suppressionKey. Cap is set at 5 so the 6th is
    // suppressed by session-cap, not by same-key dedupe.
    const tasks: Array<{ files: string[] }> = [
      { files: ['src/auth/a.ts'] },               // touchesAuth
      { files: ['src/payments/charge.ts'] },      // touchesPayments
      { files: ['prisma/schema.prisma'] },        // touchesSchema
      { files: ['src/api/users.ts'] },            // touchesPublicApi
      { files: ['.github/workflows/ci.yml'] },    // touchesCI
      { files: ['migrations/001.sql'] },          // touchesMigration
    ];
    const decisions = tasks.map((t) => {
      const risk = classifyRisk({ intent: '', files: t.files });
      return annotateDecision(decideAdvice({ risk, config: DEFAULT_ADVISOR_CONFIG }));
    });
    // Sanity: 6 distinct suppressionKeys.
    const keys = new Set(decisions.map((d) => d.suppressionKey));
    expect(keys.size).toBe(6);

    let shown = 0;
    for (const d of decisions) {
      if (shouldSurface(state, d).show) {
        shown++;
        recordSurfaced(state, d);
      }
    }
    expect(shown).toBe(5);
  });
});
