import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Phase 57 — /sunco:auto Integration vitest runner.
//
// Consumes 3 fixture scenarios under test/fixtures/router/{06,07,08}/ to
// exercise the Phase 57 classifier-first gate policy (AB-57-1 --allow
// permitted set + AB-57-2 HIGH-band thin-HIGH→MEDIUM degradation) as
// specified by packages/cli/commands/sunco/auto.md Step 5a.5.
//
// Gate 57 L8: new vitest file SEPARATE from router-dogfood.test.ts
//   (Phase 55 L18 hard-lock preserves dogfood vitest byte-identical).
// Gate 57 L2/L3: pure policy-simulator — no new runtime module introduced.
//   Phase 52b classifier.mjs + confidence.mjs + evidence-collector.mjs +
//   decision-writer.mjs remain byte-identical.
// Gate 57 L7 γ hybrid layout: route-decisions/*.json flat + expected.json.

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const FIXTURES_ROOT = join(REPO_ROOT, 'test', 'fixtures', 'router');

type AllowLevel = 'read_only' | 'local_mutate' | 'repo_mutate';
type RiskLevel =
  | 'read_only'
  | 'local_mutate'
  | 'repo_mutate'
  | 'repo_mutate_official'
  | 'remote_mutate'
  | 'external_mutate';

type GateOutcome =
  | 'auto_execute'
  | 'halt_exceeds_allow'
  | 'halt_thin_high_degraded'
  | 'halt_medium_band'
  | 'halt_low_band'
  | 'halt_unknown_stage'
  | 'halt_hold_stage'
  | 'halt_repo_mutate_official'
  | 'halt_remote_mutate'
  | 'halt_external_mutate';

interface RouteDecision {
  kind: 'route-decision';
  version: 1;
  ts: string;
  current_stage: string;
  confidence: number;
  approval_envelope: { risk_level: RiskLevel };
  confidence_signals?: { primary_count: number; primary_present: string[] };
}

interface Oracle {
  scenario_id: number;
  scenario_name: string;
  last_current_stage: string;
  last_confidence: number;
  last_confidence_band: 'HIGH' | 'MEDIUM' | 'LOW';
  last_risk_level: RiskLevel;
  primary_signal_count: number;
  allow_level: AllowLevel;
  expected_gate_outcome: GateOutcome;
  ab_57_rationale: string;
  compound_artifact_expected: boolean;
}

// AB-57-1 + AB-57-2 classifier-first gate policy (pure function).
// Mirrors packages/cli/commands/sunco/auto.md Step 5a.5.
function evaluateAutoGate(rd: RouteDecision, allow: AllowLevel): GateOutcome {
  const risk = rd.approval_envelope.risk_level;
  const tierOrder: Record<AllowLevel, number> = {
    read_only: 0,
    local_mutate: 1,
    repo_mutate: 2,
  };
  const permitted: AllowLevel[] = ['read_only', 'local_mutate', 'repo_mutate'];

  // AB-57-1: non-permitted classes HALT regardless of --allow
  if (risk === 'remote_mutate') return 'halt_remote_mutate';
  if (risk === 'external_mutate') return 'halt_external_mutate';
  if (risk === 'repo_mutate_official') return 'halt_repo_mutate_official';

  // --allow tier comparison (within permitted set)
  if (!permitted.includes(risk as AllowLevel)) return 'halt_repo_mutate_official';
  if (tierOrder[risk as AllowLevel] > tierOrder[allow]) return 'halt_exceeds_allow';

  // Stage halts
  if (rd.current_stage === 'UNKNOWN') return 'halt_unknown_stage';
  if (rd.current_stage === 'HOLD') return 'halt_hold_stage';

  // AB-57-2: band gating + thin-HIGH degradation
  const band = rd.confidence >= 0.80 ? 'HIGH' : rd.confidence >= 0.50 ? 'MEDIUM' : 'LOW';
  if (band === 'LOW') return 'halt_low_band';
  if (band === 'MEDIUM') return 'halt_medium_band';
  // HIGH
  const primaryCount = rd.confidence_signals?.primary_count ?? 0;
  if (primaryCount < 2) return 'halt_thin_high_degraded';
  return 'auto_execute';
}

function loadFixture(scenario: string): { oracle: Oracle; lastRd: RouteDecision } {
  const dir = join(FIXTURES_ROOT, scenario);
  const oracle = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8')) as Oracle;
  const rdDir = join(dir, 'route-decisions');
  const files = readdirSync(rdDir).filter((f) => f.endsWith('.json')).sort();
  const lastRd = JSON.parse(readFileSync(join(rdDir, files[files.length - 1]), 'utf8')) as RouteDecision;
  return { oracle, lastRd };
}

describe('Phase 57 auto-fixture 06 — auto-conservative-allow', () => {
  const { oracle, lastRd } = loadFixture('06-auto-conservative-allow');

  it('last RouteDecision matches oracle current_stage + confidence + risk_level', () => {
    expect(lastRd.current_stage).toBe(oracle.last_current_stage);
    expect(lastRd.confidence).toBeCloseTo(oracle.last_confidence, 2);
    expect(lastRd.approval_envelope.risk_level).toBe(oracle.last_risk_level);
    expect(lastRd.confidence_signals?.primary_count).toBe(oracle.primary_signal_count);
  });

  it('gate evaluates to auto_execute (AB-57-1 pass + AB-57-2 HIGH + ≥2/3)', () => {
    const outcome = evaluateAutoGate(lastRd, oracle.allow_level);
    expect(outcome).toBe('auto_execute');
    expect(outcome).toBe(oracle.expected_gate_outcome);
  });
});

describe('Phase 57 auto-fixture 07 — auto-halt-remote', () => {
  const { oracle, lastRd } = loadFixture('07-auto-halt-remote');

  it('last RouteDecision encodes remote_mutate sub-stage (RELEASE PUSH)', () => {
    expect(lastRd.current_stage).toBe(oracle.last_current_stage);
    expect(lastRd.approval_envelope.risk_level).toBe('remote_mutate');
    expect(lastRd.approval_envelope.risk_level).toBe(oracle.last_risk_level);
  });

  it('gate halts regardless of --allow=repo_mutate (AB-57-1 non-permitted class)', () => {
    const outcome = evaluateAutoGate(lastRd, oracle.allow_level);
    expect(outcome).toBe('halt_remote_mutate');
    expect(outcome).toBe(oracle.expected_gate_outcome);
  });

  it('gate halts even if --allow were explicitly set to a higher permitted tier (sanity)', () => {
    // Even if user somehow passed --allow=repo_mutate, remote_mutate still halts
    expect(evaluateAutoGate(lastRd, 'repo_mutate')).toBe('halt_remote_mutate');
    expect(evaluateAutoGate(lastRd, 'local_mutate')).toBe('halt_remote_mutate');
    expect(evaluateAutoGate(lastRd, 'read_only')).toBe('halt_remote_mutate');
  });
});

describe('Phase 57 auto-fixture 08 — auto-halt-medium-band (AB-57-2 oracle)', () => {
  const { oracle, lastRd } = loadFixture('08-auto-halt-medium-band');

  it('last RouteDecision is MEDIUM band with local_mutate risk_level', () => {
    expect(lastRd.current_stage).toBe(oracle.last_current_stage);
    expect(lastRd.confidence).toBeCloseTo(oracle.last_confidence, 2);
    expect(lastRd.confidence).toBeLessThan(0.80);
    expect(lastRd.confidence).toBeGreaterThanOrEqual(0.50);
    expect(lastRd.approval_envelope.risk_level).toBe('local_mutate');
  });

  it('gate halts on MEDIUM band regardless of --allow=local_mutate (AB-57-2)', () => {
    const outcome = evaluateAutoGate(lastRd, oracle.allow_level);
    expect(outcome).toBe('halt_medium_band');
    expect(outcome).toBe(oracle.expected_gate_outcome);
  });

  it('gate still halts if --allow is raised to repo_mutate (band gate is orthogonal to --allow)', () => {
    expect(evaluateAutoGate(lastRd, 'repo_mutate')).toBe('halt_medium_band');
  });
});
