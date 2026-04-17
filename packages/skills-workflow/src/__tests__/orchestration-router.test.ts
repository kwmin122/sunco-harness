/**
 * Tests for shared/orchestration-router.ts.
 *
 * Signal detection and plan shape. Pure functions, no I/O.
 */

import { describe, it, expect } from 'vitest';
import {
  detectSignals,
  buildPlan,
  buildContextPack,
  extendContextPack,
  renderContextPack,
} from '../shared/orchestration-router.js';

describe('detectSignals', () => {
  it('flags unknown-location for "where is" / "어디"', () => {
    expect(
      detectSignals('where is the auth middleware').some((s) => s.kind === 'unknown-location'),
    ).toBe(true);
    expect(
      detectSignals('인증 로직 어디 있는지 찾아줘').some((s) => s.kind === 'unknown-location'),
    ).toBe(true);
  });

  it('flags external-api on "sdk" / "api docs"', () => {
    expect(
      detectSignals('add support for Stripe SDK').some((s) => s.kind === 'external-api'),
    ).toBe(true);
    expect(
      detectSignals('read the api docs for polling').some((s) => s.kind === 'external-api'),
    ).toBe(true);
  });

  it('flags risky-change on refactor/migration/cross-file', () => {
    expect(
      detectSignals('refactor the router module').some((s) => s.kind === 'risky-change'),
    ).toBe(true);
    expect(
      detectSignals('migrate schema from v1 to v2').some((s) => s.kind === 'risky-change'),
    ).toBe(true);
    expect(
      detectSignals('cross-file rename of Foo to Bar').some((s) => s.kind === 'risky-change'),
    ).toBe(true);
  });

  it('flags ui-surface on .tsx, component, css', () => {
    expect(
      detectSignals('update styles in Button.tsx').some((s) => s.kind === 'ui-surface'),
    ).toBe(true);
    expect(
      detectSignals('tweak css of the settings modal').some((s) => s.kind === 'ui-surface'),
    ).toBe(true);
  });

  it('flags docs-only on readme/changelog/문서', () => {
    expect(
      detectSignals('update the README').some((s) => s.kind === 'docs-only'),
    ).toBe(true);
    expect(
      detectSignals('write docs for the new flag').some((s) => s.kind === 'docs-only'),
    ).toBe(true);
  });

  it('flags test-failure', () => {
    expect(
      detectSignals('tests are failing after the rebase').some((s) => s.kind === 'test-failure'),
    ).toBe(true);
  });

  it('flags exact-file on any foo.ts-like path', () => {
    const sigs = detectSignals('edit src/foo.ts:42 to add logging');
    expect(sigs.some((s) => s.kind === 'exact-file')).toBe(true);
  });

  it('falls back to default when nothing matches', () => {
    const sigs = detectSignals('do something nice');
    expect(sigs).toHaveLength(1);
    expect(sigs[0]!.kind).toBe('default');
  });
});

describe('buildPlan', () => {
  it('docs-only short-circuits to docs role only', () => {
    const plan = buildPlan('update the README with new install instructions');
    expect(plan.steps.map((s) => s.role)).toEqual(['docs']);
    expect(plan.steps[0]!.readOnly).toBe(false);
  });

  it('test-failure routes to debugger then verifier', () => {
    const plan = buildPlan('the auth test is failing intermittently');
    expect(plan.steps.map((s) => s.role)).toEqual(['debugger', 'verifier']);
  });

  it('exact-file + low risk = developer-only', () => {
    const plan = buildPlan('edit src/foo.ts to add a null check');
    expect(plan.steps.map((s) => s.role)).toEqual(['developer']);
  });

  it('unknown location + no exact file = explorer then developer then verifier', () => {
    const plan = buildPlan('where is the rate limiter?');
    const roles = plan.steps.map((s) => s.role);
    expect(roles[0]).toBe('explorer');
    expect(roles).toContain('developer');
    expect(roles[roles.length - 1]).toBe('verifier');
  });

  it('external API triggers librarian before developer', () => {
    const plan = buildPlan('integrate the Stripe SDK into the checkout flow');
    const roles = plan.steps.map((s) => s.role);
    expect(roles).toContain('librarian');
    expect(roles.indexOf('librarian')).toBeLessThan(
      roles.indexOf('developer') === -1
        ? roles.indexOf('frontend')
        : roles.indexOf('developer'),
    );
  });

  it('risky change gets oracle on both sides of developer', () => {
    const plan = buildPlan('refactor the auth middleware for multi-tenant support');
    const roles = plan.steps.map((s) => s.role);
    const oracleIdx = roles
      .map((r, i) => (r === 'oracle' ? i : -1))
      .filter((i) => i !== -1);
    const devIdx = roles.indexOf('developer');
    expect(oracleIdx.length).toBe(2);
    expect(oracleIdx[0]).toBeLessThan(devIdx);
    expect(oracleIdx[1]).toBeGreaterThan(devIdx);
  });

  it('ui surface routes to frontend instead of developer', () => {
    const plan = buildPlan('tweak the modal layout in SettingsModal.tsx');
    const roles = plan.steps.map((s) => s.role);
    expect(roles).toContain('frontend');
    expect(roles).not.toContain('developer');
  });

  it('explicit verify-only request goes straight to verifier', () => {
    const plan = buildPlan('run a fresh verify on phase 12');
    expect(plan.steps.map((s) => s.role)).toEqual(['verifier']);
  });

  it('every read-only role really is read-only', () => {
    const plan = buildPlan('find and fix the rate limiter bug in src/limiter.ts');
    for (const step of plan.steps) {
      if (step.role === 'explorer' || step.role === 'librarian' || step.role === 'oracle' || step.role === 'verifier') {
        expect(step.readOnly).toBe(true);
      }
    }
  });

  it('default task gets developer + verifier', () => {
    const plan = buildPlan('do something useful');
    const roles = plan.steps.map((s) => s.role);
    expect(roles).toContain('developer');
    expect(roles[roles.length - 1]).toBe('verifier');
  });
});

describe('context pack', () => {
  it('extracts explicit files from the task', () => {
    const pack = buildContextPack('edit src/foo.ts and docs/readme.md please');
    expect(pack.explicitFiles).toContain('src/foo.ts');
    expect(pack.explicitFiles).toContain('docs/readme.md');
  });

  it('extendContextPack appends to priorOutputs immutably', () => {
    const pack = buildContextPack('anything');
    const next = extendContextPack(pack, 'explorer', 'found foo.ts');
    expect(pack.priorOutputs).toHaveLength(0);
    expect(next.priorOutputs).toHaveLength(1);
    expect(next.priorOutputs[0]!.role).toBe('explorer');
  });

  it('renders a readable plaintext block', () => {
    const pack = extendContextPack(
      buildContextPack('fix src/foo.ts'),
      'explorer',
      'located src/foo.ts:42',
    );
    const rendered = renderContextPack(pack);
    expect(rendered).toContain('Original request: fix src/foo.ts');
    expect(rendered).toContain('Explicit files: src/foo.ts');
    expect(rendered).toContain('[explorer] located src/foo.ts:42');
  });
});
