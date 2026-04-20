import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
// @ts-expect-error — .mjs has no type declarations.
import { computeConfidence, classifyBand, WEIGHTS, SIGNAL_KEYS, ConfidenceSignalError } from '../../../../../packages/cli/references/router/src/confidence.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIDENCE_MJS_PATH = path.resolve(HERE, '../../../../../packages/cli/references/router/src/confidence.mjs');

describe('router confidence — I1 Determinism', () => {
  it('100 iterations byte-identical on fixture signals', () => {
    const signals = {
      phase_artifacts_complete: 0.75,
      git_state_matches_stage: 0.50,
      state_md_alignment: 1.0,
      test_state_known: 0.25,
      precondition_coverage: 0.60,
      recent_user_intent_match: 0.90,
    };
    const expected = computeConfidence(signals);
    for (let i = 0; i < 100; i++) {
      expect(computeConfidence(signals)).toBe(expected);
    }
  });
});

describe('router confidence — I2 Bounds', () => {
  it('empty signals → 0', () => {
    expect(computeConfidence({})).toBe(0);
  });
  it('all positive signals (each 1.0) → 1.0', () => {
    const allPositive = Object.fromEntries(SIGNAL_KEYS.map((k: string) => [k, 1]));
    expect(computeConfidence(allPositive)).toBe(1.0);
  });
});

describe('router confidence — I3 Monotonicity', () => {
  it('zeroing any positive signal does not increase score', () => {
    const allPositive = Object.fromEntries(SIGNAL_KEYS.map((k: string) => [k, 1]));
    const base = computeConfidence(allPositive);
    for (const k of SIGNAL_KEYS) {
      const zeroed = { ...allPositive, [k]: 0 };
      expect(computeConfidence(zeroed)).toBeLessThanOrEqual(base);
    }
  });
  it('removing any positive signal does not increase score', () => {
    const allPositive = Object.fromEntries(SIGNAL_KEYS.map((k: string) => [k, 1]));
    const base = computeConfidence(allPositive);
    for (const k of SIGNAL_KEYS) {
      const stripped = { ...allPositive };
      delete stripped[k];
      expect(computeConfidence(stripped)).toBeLessThanOrEqual(base);
    }
  });
});

describe('router confidence — I4 No LLM SDK imports', () => {
  it('confidence.mjs source contains zero LLM SDK imports (path-exact grep)', () => {
    const src = readFileSync(CONFIDENCE_MJS_PATH, 'utf8');
    // Forbidden imports per CONFIDENCE-CALIBRATION.md §I4.
    const forbiddenPatterns = [
      /from\s+['"]@anthropic-ai\//,
      /from\s+['"]@openai\//,
      /from\s+['"]openai['"]/,
      /from\s+['"]@ai-sdk\//,
      /from\s+['"]ai['"]/,
      /from\s+['"]@vercel\/ai/,
      /from\s+['"]agent['"]/,
      /import\s*\(\s*['"]ai['"]/,
    ];
    for (const p of forbiddenPatterns) {
      expect(p.test(src)).toBe(false);
    }
  });
});

describe('router confidence — structural contract', () => {
  it('WEIGHTS is frozen', () => {
    expect(Object.isFrozen(WEIGHTS)).toBe(true);
  });
  it('SIGNAL_KEYS is frozen and has 6 entries', () => {
    expect(Object.isFrozen(SIGNAL_KEYS)).toBe(true);
    expect(SIGNAL_KEYS.length).toBe(6);
  });
  it('weight sum equals 1.0', () => {
    const sum = SIGNAL_KEYS.reduce((s: number, k: string) => s + WEIGHTS[k], 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
  });
});

describe('router confidence — classifyBand', () => {
  it('band boundaries: 0.80 → HIGH, 0.50 → MEDIUM, below 0.50 → LOW', () => {
    expect(classifyBand(0.80)).toBe('HIGH');
    expect(classifyBand(1.0)).toBe('HIGH');
    expect(classifyBand(0.799)).toBe('MEDIUM');
    expect(classifyBand(0.50)).toBe('MEDIUM');
    expect(classifyBand(0.499)).toBe('LOW');
    expect(classifyBand(0)).toBe('LOW');
  });
});

describe('router confidence — input validation', () => {
  it('rejects unknown signal key', () => {
    expect(() => computeConfidence({ bogus_signal: 0.5 })).toThrow(ConfidenceSignalError);
  });
  it('rejects out-of-range signal', () => {
    expect(() => computeConfidence({ phase_artifacts_complete: 1.5 })).toThrow(ConfidenceSignalError);
    expect(() => computeConfidence({ phase_artifacts_complete: -0.1 })).toThrow(ConfidenceSignalError);
  });
  it('rejects non-finite signal', () => {
    expect(() => computeConfidence({ phase_artifacts_complete: NaN })).toThrow(ConfidenceSignalError);
  });
});
