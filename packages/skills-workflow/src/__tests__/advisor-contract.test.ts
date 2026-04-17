/**
 * Phase 0 contract smoke tests. Does NOT exercise logic (there is none yet
 * in Phase 0) — just asserts the contract types and defaults are exported
 * and shaped correctly so downstream phases can depend on them.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ADVISOR_CONFIG,
  DEFAULT_ADVISOR_MODEL_OPTIONS,
  DEFAULT_SUPPRESSION_POLICY,
  EMPTY_QUEUE,
  type AdvisorDecision,
  type InterventionLevel,
} from '../shared/advisor-types.js';
import {
  ADVISOR_RUNTIME_MATRIX,
  supportFor,
} from '../shared/advisor-runtime-matrix.js';

describe('advisor contract — defaults', () => {
  it('DEFAULT_ADVISOR_CONFIG has enabled=true and autoExecuteSkills=false', () => {
    expect(DEFAULT_ADVISOR_CONFIG.enabled).toBe(true);
    expect(DEFAULT_ADVISOR_CONFIG.autoExecuteSkills).toBe(false);
    // blocking OFF by default per rollout plan
    expect(DEFAULT_ADVISOR_CONFIG.blocking).toBe(false);
  });

  it('DEFAULT_ADVISOR_CONFIG model is a Claude Opus variant by default', () => {
    expect(DEFAULT_ADVISOR_CONFIG.model).toMatch(/^claude-opus/);
  });

  it('DEFAULT_SUPPRESSION_POLICY imposes at least 30 minute dedupe', () => {
    expect(DEFAULT_SUPPRESSION_POLICY.sameKeyMinutes).toBeGreaterThanOrEqual(30);
    expect(DEFAULT_SUPPRESSION_POLICY.maxPerPrompt).toBe(1);
  });

  it('EMPTY_QUEUE uses schema version 1', () => {
    expect(EMPTY_QUEUE.version).toBe(1);
    expect(EMPTY_QUEUE.items).toEqual([]);
  });
});

describe('advisor contract — model options', () => {
  it('includes Opus/Sonnet/Haiku + codex-cli + custom as default-visible rows', () => {
    const visible = DEFAULT_ADVISOR_MODEL_OPTIONS.filter((o) => o.defaultVisible).map((o) => o.id);
    expect(visible).toEqual(
      expect.arrayContaining([
        'claude-opus-4-7@max',
        'claude-opus-4-7@high',
        'claude-opus-4-7@medium',
        'claude-sonnet-4-6@max',
        'claude-sonnet-4-6@high',
        'claude-haiku-4-5@off',
        'codex-cli',
        'custom',
      ]),
    );
  });

  it('GPT-5 and Gemini 2.5 Pro are hidden until detected', () => {
    const gpt = DEFAULT_ADVISOR_MODEL_OPTIONS.find((o) => o.id === 'gpt-5');
    const gemini = DEFAULT_ADVISOR_MODEL_OPTIONS.find((o) => o.id === 'gemini-2.5-pro');
    expect(gpt?.defaultVisible).toBe(false);
    expect(gemini?.defaultVisible).toBe(false);
    expect(gpt?.requiresProvider).toBe('openai');
    expect(gemini?.requiresProvider).toBe('google');
  });

  it('custom row is always available (requiresProvider=null)', () => {
    const custom = DEFAULT_ADVISOR_MODEL_OPTIONS.find((o) => o.id === 'custom');
    expect(custom?.defaultVisible).toBe(true);
    expect(custom?.requiresProvider).toBe(null);
  });
});

describe('advisor runtime matrix', () => {
  it('covers exactly 4 runtimes', () => {
    const runtimes = ADVISOR_RUNTIME_MATRIX.map((r) => r.runtime).sort();
    expect(runtimes).toEqual(['antigravity', 'claude', 'codex', 'cursor']);
  });

  it('Claude Code has full ambient support; others are manual-only', () => {
    const claude = supportFor('claude');
    expect(claude.ambientPromptHook).toBe(true);
    expect(claude.postActionHook).toBe(true);
    for (const r of ['codex', 'cursor', 'antigravity'] as const) {
      const s = supportFor(r);
      expect(s.ambientPromptHook).toBe(false);
      expect(s.postActionHook).toBe(false);
      expect(s.manualSkill).toBe(true);
      expect(s.jsonOutput).toBe(true);
    }
  });

  it('supportFor throws on unknown runtime', () => {
    // @ts-expect-error intentional wrong value for runtime test
    expect(() => supportFor('nope')).toThrow();
  });
});

describe('advisor contract — type shape smoke', () => {
  it('AdvisorDecision accepts every InterventionLevel', () => {
    const levels: InterventionLevel[] = ['silent', 'notice', 'guarded', 'blocker'];
    for (const level of levels) {
      const d: AdvisorDecision = {
        level,
        confidence: 'high',
        reasonCodes: [],
        preGates: [],
        postGates: [],
        confirmationReason: null,
        suppressionKey: 'k',
        expiresAt: new Date().toISOString(),
      };
      expect(d.level).toBe(level);
    }
  });
});
