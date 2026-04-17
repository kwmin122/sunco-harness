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

  it('DEFAULT_ADVISOR_CONFIG starts deterministic with runtime=unknown (v0.11.1 rewrite)', () => {
    expect(DEFAULT_ADVISOR_CONFIG.runtime).toBe('unknown');
    expect(DEFAULT_ADVISOR_CONFIG.engine).toBe('deterministic');
    expect(DEFAULT_ADVISOR_CONFIG.family).toBe('local');
    expect(DEFAULT_ADVISOR_CONFIG.model).toBe('deterministic');
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

describe('advisor contract — behavior picker (v0.11.1)', () => {
  it('includes Claude runtime-native rows for Claude Code', () => {
    const claudeRows = DEFAULT_ADVISOR_MODEL_OPTIONS.filter(
      (o) => o.scope === 'runtime-native' && o.runtime === 'claude',
    ).map((o) => o.id);
    expect(claudeRows).toEqual(
      expect.arrayContaining([
        'claude-opus-4-7@high',
        'claude-opus-4-7@max',
        'claude-sonnet-4-6@high',
        'claude-haiku-4-5@off',
      ]),
    );
  });

  it('includes Codex runtime-native rows with reasoning effort', () => {
    const codexRows = DEFAULT_ADVISOR_MODEL_OPTIONS.filter(
      (o) => o.scope === 'runtime-native' && o.runtime === 'codex',
    );
    expect(codexRows.map((o) => o.id)).toEqual(
      expect.arrayContaining(['gpt-5.4@high', 'gpt-5.4@xhigh', 'gpt-5.4-mini@high']),
    );
    // Every codex row declares a reasoning effort, not a thinking tier.
    for (const r of codexRows) {
      expect(r.reasoningEffort).toBeDefined();
    }
  });

  it('always-available rows include deterministic + custom', () => {
    const always = DEFAULT_ADVISOR_MODEL_OPTIONS.filter((o) => o.scope === 'always').map((o) => o.id);
    expect(always).toEqual(expect.arrayContaining(['deterministic', 'custom']));
  });

  it('advanced rows are gated by requiresProvider (anthropic-api/codex-cli/openai/google)', () => {
    const advanced = DEFAULT_ADVISOR_MODEL_OPTIONS.filter((o) => o.scope === 'advanced');
    expect(advanced.length).toBeGreaterThanOrEqual(3);
    for (const o of advanced) {
      expect(o.requiresProvider).toBeDefined();
    }
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
