/**
 * Phase 1 engine tests — risk-classifier + advisor-policy + advisor-message
 * + advisor-selector + advisor-noise-budget.
 *
 * Pure functions, no I/O.
 */

import { describe, it, expect } from 'vitest';

import {
  classifyRisk,
  extractSignals,
  isDocsFile,
  isTestFile,
  isGeneratedFile,
} from '../shared/risk-classifier.js';
import {
  buildSuppressionKey,
  decideAdvice,
} from '../shared/advisor-policy.js';
import {
  annotateDecision,
  renderInjection,
  renderMessage,
} from '../shared/advisor-message.js';
import {
  applyPickerChoice,
  buildPickerOptions,
  detectProviders,
  parsePickerId,
  resolveInitialConfig,
  shouldShowPicker,
} from '../shared/advisor-selector.js';
import {
  makeBudget,
  recordSurfaced,
  shouldSurface,
} from '../shared/advisor-noise-budget.js';
import {
  DEFAULT_ADVISOR_CONFIG,
  DEFAULT_SUPPRESSION_POLICY,
  type AdvisorConfig,
} from '../shared/advisor-types.js';

// ---------------------------------------------------------------------------
// risk-classifier
// ---------------------------------------------------------------------------

describe('risk-classifier — file predicates', () => {
  it('isDocsFile recognizes markdown + docs/', () => {
    expect(isDocsFile('README.md')).toBe(true);
    expect(isDocsFile('docs/intro.md')).toBe(true);
    expect(isDocsFile('src/foo.ts')).toBe(false);
  });

  it('isTestFile recognizes test/spec + __tests__', () => {
    expect(isTestFile('src/foo.test.ts')).toBe(true);
    expect(isTestFile('src/__tests__/foo.ts')).toBe(true);
    expect(isTestFile('src/foo.ts')).toBe(false);
  });

  it('isGeneratedFile recognizes dist/build/node_modules', () => {
    expect(isGeneratedFile('dist/cli.js')).toBe(true);
    expect(isGeneratedFile('build/index.html')).toBe(true);
    expect(isGeneratedFile('src/foo.ts')).toBe(false);
  });
});

describe('risk-classifier — signal extraction', () => {
  it('flags auth + session', () => {
    const sigs = extractSignals({ intent: '', files: ['src/auth/session.ts'] });
    expect(sigs).toContain('touchesAuth');
  });

  it('flags schema', () => {
    const sigs = extractSignals({ intent: '', files: ['prisma/schema.prisma'] });
    expect(sigs).toContain('touchesSchema');
  });

  it('flags migration', () => {
    const sigs = extractSignals({ intent: '', files: ['migrations/20240101_add.sql'] });
    expect(sigs).toContain('touchesMigration');
  });

  it('flags secrets (but not .env.example)', () => {
    const secretSigs = extractSignals({ intent: '', files: ['.env'] });
    const exampleSigs = extractSignals({ intent: '', files: ['.env.example'] });
    expect(secretSigs).toContain('touchesSecrets');
    expect(exampleSigs).not.toContain('touchesSecrets');
    expect(exampleSigs).toContain('touchesEnvExample');
  });

  it('flags destructive + deploy intents', () => {
    expect(extractSignals({ intent: 'rm -rf the cache', files: [] })).toContain('destructiveIntent');
    expect(extractSignals({ intent: 'deploy to prod', files: [] })).toContain('deploymentIntent');
    expect(extractSignals({ intent: '배포하자', files: [] })).toContain('deploymentIntent');
  });

  it('flags many-files and large-delete on diff stats', () => {
    const sigs = extractSignals({
      intent: '',
      files: ['a.ts', 'b.ts'],
      diffStats: {
        filesChanged: 15,
        linesAdded: 20,
        linesDeleted: 500,
        prodFilesChanged: 15,
        testFilesChanged: 0,
      },
    });
    expect(sigs).toContain('modifiesManyFiles');
    expect(sigs).toContain('largeDeletion');
  });

  it('docs-only triggers touchesDocsOnly', () => {
    const sigs = extractSignals({ intent: '', files: ['README.md', 'docs/a.md'] });
    expect(sigs).toContain('touchesDocsOnly');
  });
});

describe('risk-classifier — bucket resolution', () => {
  it('docs-only → silent', () => {
    const r = classifyRisk({ intent: 'update readme', files: ['README.md'] });
    expect(r.bucket).toBe('silent');
  });

  it('tests-only → silent', () => {
    const r = classifyRisk({ intent: 'add tests', files: ['src/x.test.ts'] });
    expect(r.bucket).toBe('silent');
  });

  it('auth → guarded', () => {
    const r = classifyRisk({ intent: '', files: ['src/auth/session.ts'] });
    expect(r.bucket).toBe('guarded');
  });

  it('destructive intent → blocker', () => {
    const r = classifyRisk({ intent: 'rm -rf everything', files: [] });
    expect(r.bucket).toBe('blocker');
  });

  it('deploy intent → blocker', () => {
    const r = classifyRisk({ intent: 'deploy to prod now', files: [] });
    expect(r.bucket).toBe('blocker');
  });

  it('config change → notice', () => {
    const r = classifyRisk({ intent: '', files: ['vite.config.ts'] });
    expect(r.bucket).toBe('notice');
  });

  it('no signals → silent', () => {
    const r = classifyRisk({ intent: 'think about it', files: [] });
    expect(r.bucket).toBe('silent');
  });
});

// ---------------------------------------------------------------------------
// advisor-policy
// ---------------------------------------------------------------------------

describe('advisor-policy', () => {
  const cfg = DEFAULT_ADVISOR_CONFIG;

  it('auth → guarded with preGates=[spec-approval] + security review postGate', () => {
    const risk = classifyRisk({ intent: '', files: ['src/auth/login.ts'] });
    const d = decideAdvice({ risk, config: cfg });
    expect(d.level).toBe('guarded');
    expect(d.preGates.map((g) => g.gate)).toContain('spec-approval');
    expect(d.postGates.some((g) => g.gate === 'review' && g.scope === 'security')).toBe(true);
  });

  it('destructive intent blocker downgrades to guarded when blocking=false', () => {
    const risk = classifyRisk({ intent: 'rm -rf dist', files: [] });
    const d = decideAdvice({ risk, config: { ...cfg, blocking: false } });
    expect(d.level).toBe('guarded');
    expect(d.reasonCodes).toContain('destructiveIntent');
    expect(d.confirmationReason).toBe('destructive');
  });

  it('destructive intent stays blocker when blocking=true', () => {
    const risk = classifyRisk({ intent: 'rm -rf dist', files: [] });
    const d = decideAdvice({ risk, config: { ...cfg, blocking: true } });
    expect(d.level).toBe('blocker');
  });

  it('test-failures route to debug', () => {
    const risk = classifyRisk({ intent: '', files: [], flags: { testFailures: true } });
    const d = decideAdvice({ risk, config: cfg });
    expect(d.recommendedRoute).toBe('debug');
  });

  it('docs-only → silent with no gates', () => {
    const risk = classifyRisk({ intent: '', files: ['README.md'] });
    const d = decideAdvice({ risk, config: cfg });
    expect(d.level).toBe('silent');
    expect(d.preGates).toEqual([]);
    expect(d.postGates).toEqual([]);
  });

  it('suppressionKey stable across call order', () => {
    const a = buildSuppressionKey('guarded', ['touchesAuth', 'testFailures']);
    const b = buildSuppressionKey('guarded', ['testFailures', 'touchesAuth']);
    expect(a).toBe(b);
  });

  it('policy never sets autoExecuteSkills via decision shape', () => {
    // The AdvisorConfig type pins autoExecuteSkills:false. If the policy
    // tried to set true, TS would fail — this is the runtime guard.
    const risk = classifyRisk({ intent: 'rm -rf x', files: [] });
    const d = decideAdvice({ risk, config: cfg });
    expect((d as unknown as { autoExecuteSkills?: unknown }).autoExecuteSkills).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// advisor-message
// ---------------------------------------------------------------------------

describe('advisor-message', () => {
  const cfg = DEFAULT_ADVISOR_CONFIG;

  it('silent → undefined (no message, no injection)', () => {
    const risk = classifyRisk({ intent: '', files: ['README.md'] });
    const d = decideAdvice({ risk, config: cfg });
    expect(renderMessage(d)).toBeUndefined();
    expect(renderInjection(d)).toBeUndefined();
  });

  it('guarded auth produces Risk/Suggestion lines', () => {
    const risk = classifyRisk({ intent: '', files: ['src/auth/session.ts'] });
    const d = decideAdvice({ risk, config: cfg });
    const msg = renderMessage(d)!;
    expect(msg).toMatch(/^Risk:/);
    expect(msg).toContain('Suggestion:');
  });

  it('message is bounded at 300 chars', () => {
    const risk = classifyRisk({
      intent: 'rm -rf',
      files: ['src/auth/session.ts', 'prisma/schema.prisma', 'migrations/20240101.sql', 'src/payments/charge.ts', '.env'],
    });
    const d = decideAdvice({ risk, config: cfg });
    const msg = renderMessage(d)!;
    expect(msg.length).toBeLessThanOrEqual(300);
  });

  it('injection includes level + confidence + XML wrapper', () => {
    const risk = classifyRisk({ intent: '', files: ['src/auth/session.ts'] });
    const d = decideAdvice({ risk, config: cfg });
    const xml = renderInjection(d)!;
    expect(xml).toMatch(/^<sunco_advisor /);
    expect(xml).toContain('level="guarded"');
    expect(xml).toContain('visibility="internal"');
    expect(xml).toContain('</sunco_advisor>');
  });

  it('annotateDecision fills both fields non-destructively', () => {
    const risk = classifyRisk({ intent: '', files: ['src/auth/session.ts'] });
    const d = decideAdvice({ risk, config: cfg });
    const annotated = annotateDecision(d);
    expect(annotated).not.toBe(d); // immutable
    expect(annotated.userVisibleMessage).toBeDefined();
    expect(annotated.systemInjection).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// advisor-selector
// ---------------------------------------------------------------------------

describe('advisor-selector', () => {
  it('detectProviders reads env + which', () => {
    const env = { ANTHROPIC_API_KEY: 'x', OPENAI_API_KEY: undefined } as Record<string, string | undefined>;
    const which = (name: string) => name === 'codex';
    const p = detectProviders(env, which);
    expect(p.anthropic).toBe(true);
    expect(p.codexCli).toBe(true);
    expect(p.openai).toBe(false);
  });

  it('buildPickerOptions hides anthropic rows when anthropic missing', () => {
    const env = { anthropic: false, codexCli: true, openai: false, google: false };
    const out = buildPickerOptions(env);
    expect(out.some((o) => o.id.startsWith('claude-'))).toBe(false);
    expect(out.some((o) => o.id === 'codex-cli')).toBe(true);
    expect(out.some((o) => o.id === 'custom')).toBe(true);
  });

  it('buildPickerOptions hides GPT-5 unless openai detected', () => {
    const base = { anthropic: true, codexCli: false, google: false };
    const without = buildPickerOptions({ ...base, openai: false });
    const with_ = buildPickerOptions({ ...base, openai: true });
    expect(without.some((o) => o.id === 'gpt-5')).toBe(false);
    expect(with_.some((o) => o.id === 'gpt-5')).toBe(true);
  });

  it('parsePickerId splits model@tier', () => {
    expect(parsePickerId('claude-opus-4-7@high')).toEqual({
      model: 'claude-opus-4-7',
      thinking: 'high',
    });
    expect(parsePickerId('codex-cli')).toEqual({
      model: 'codex-cli',
      thinking: null,
    });
    expect(parsePickerId('claude-sonnet-4-6@bogus')).toEqual({
      model: 'claude-sonnet-4-6',
      thinking: null,
    });
  });

  it('applyPickerChoice preserves non-model config fields', () => {
    const base: AdvisorConfig = { ...DEFAULT_ADVISOR_CONFIG, blocking: true, costCapPerSessionUSD: 10 };
    const next = applyPickerChoice(base, 'claude-sonnet-4-6@max');
    expect(next.model).toBe('claude-sonnet-4-6');
    expect(next.thinking).toBe('max');
    expect(next.blocking).toBe(true);
    expect(next.costCapPerSessionUSD).toBe(10);
  });

  it('shouldShowPicker: first run = true', () => {
    expect(shouldShowPicker(null)).toBe(true);
    expect(shouldShowPicker({})).toBe(true);
    expect(shouldShowPicker({ model: 'claude-opus-4-7' })).toBe(false);
    expect(shouldShowPicker({ model: 'custom' })).toBe(false);
    expect(shouldShowPicker({ enabled: false })).toBe(false);
  });

  it('resolveInitialConfig falls back by provider availability', () => {
    expect(resolveInitialConfig({ anthropic: true, codexCli: false, openai: false, google: false }).model)
      .toMatch(/^claude-/);
    expect(resolveInitialConfig({ anthropic: false, codexCli: true, openai: false, google: false }).model)
      .toBe('codex-cli');
    const none = resolveInitialConfig({ anthropic: false, codexCli: false, openai: false, google: false });
    expect(none.enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// advisor-noise-budget
// ---------------------------------------------------------------------------

describe('advisor-noise-budget', () => {
  const cfg = DEFAULT_ADVISOR_CONFIG;

  it('silent decisions never surface', () => {
    const risk = classifyRisk({ intent: '', files: ['README.md'] });
    const d = decideAdvice({ risk, config: cfg });
    const state = makeBudget(DEFAULT_SUPPRESSION_POLICY);
    expect(shouldSurface(state, d).show).toBe(false);
    expect(shouldSurface(state, d).reason).toBe('level-silent');
  });

  it('confidence below minVisibleConfidence is logged only', () => {
    const policy = { ...DEFAULT_SUPPRESSION_POLICY, minVisibleConfidence: 'high' as const };
    const state = makeBudget(policy);
    const risk = classifyRisk({ intent: '', files: ['vite.config.ts'] });
    const d = decideAdvice({ risk, config: cfg });
    expect(shouldSurface(state, d).show).toBe(false);
  });

  it('same key within window is suppressed; recording seeds the lastSurfaced table', () => {
    const state = makeBudget(DEFAULT_SUPPRESSION_POLICY);
    const risk = classifyRisk({ intent: '', files: ['src/auth/session.ts'] });
    const d = decideAdvice({ risk, config: cfg });
    expect(shouldSurface(state, d).show).toBe(true);
    recordSurfaced(state, d);
    expect(shouldSurface(state, d).show).toBe(false);
    expect(shouldSurface(state, d).reason).toBe('recently-surfaced');
  });

  it('session cap caps surfaces at 5', () => {
    const state = makeBudget({ ...DEFAULT_SUPPRESSION_POLICY, maxVisiblePerSession: 2 });
    const risk = classifyRisk({ intent: '', files: ['src/auth/session.ts'] });
    const base = decideAdvice({ risk, config: cfg });

    // Fabricate 3 distinct keys so same-key dedupe doesn't interfere.
    for (let i = 0; i < 2; i++) {
      const d = { ...base, suppressionKey: `k-${i}` };
      expect(shouldSurface(state, d).show).toBe(true);
      recordSurfaced(state, d);
    }
    const over = { ...base, suppressionKey: 'k-2' };
    expect(shouldSurface(state, over).show).toBe(false);
    expect(shouldSurface(state, over).reason).toBe('session-cap-reached');
  });
});
