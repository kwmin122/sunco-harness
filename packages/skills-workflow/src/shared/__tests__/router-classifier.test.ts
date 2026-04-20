import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs has no type declarations; runtime contract is stable per Phase 52a schema.
import { classifyStage, inferCurrentStage, inferRecommendedNext, validateRouteDecision, renderNarrativeReasons, RouteDecisionInvalidError, CURRENT_STAGE_ENUM, RECOMMENDED_NEXT_ENUM, STAGE_ACTION_MAP } from '../../../../../packages/cli/references/router/src/classifier.mjs';

const TS = '2026-04-20T00:00:00.000Z';
const FRESH = { status: 'fresh', checks: [] };
const GIT_OK = { statusClean: true, originSynced: true, stateAligned: true };

describe('router classifier — stage enum contract', () => {
  it('current_stage enum contains exactly 11 values (10 stages + UNKNOWN)', () => {
    expect(CURRENT_STAGE_ENUM.length).toBe(11);
    expect(CURRENT_STAGE_ENUM.includes('UNKNOWN')).toBe(true);
    expect(CURRENT_STAGE_ENUM.includes('IDEATE')).toBe(false); // D9 merge confirmed
  });
  it('recommended_next enum excludes UNKNOWN, includes HOLD', () => {
    expect(RECOMMENDED_NEXT_ENUM.includes('UNKNOWN')).toBe(false);
    expect(RECOMMENDED_NEXT_ENUM.includes('HOLD')).toBe(true);
  });
  it('STAGE_ACTION_MAP covers all 10 forward stages + HOLD', () => {
    const expected = ['BRAINSTORM','PLAN','WORK','REVIEW','VERIFY','PROCEED','SHIP','RELEASE','COMPOUND','PAUSE','HOLD'];
    for (const k of expected) expect(STAGE_ACTION_MAP[k]).toBeDefined();
  });
});

describe('router classifier — stage classification', () => {
  it('freshness drift → UNKNOWN + HOLD + confidence 0', () => {
    const d = classifyStage({ freshness: { status: 'drift', checks: [{ id: 'git-status', result: 'dirty' }] } }, TS);
    expect(d.current_stage).toBe('UNKNOWN');
    expect(d.recommended_next).toBe('HOLD');
    expect(d.confidence).toBe(0);
  });

  it('paused-state pointer → PAUSE precedence', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK,
      pausedState: { paused_at_stage: 'WORK' },
    }, TS);
    expect(d.current_stage).toBe('PAUSE');
    expect(d.recommended_next).toBe('HOLD');
  });

  it('no requirements → BRAINSTORM (recommended_next stays BRAINSTORM)', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: false,
      phaseArtifacts: {}, commitsInWindow: [], goalStatementPresent: true,
    }, TS);
    expect(d.current_stage).toBe('BRAINSTORM');
    expect(d.recommended_next).toBe('BRAINSTORM');
    expect(d.approval_envelope.risk_level).toBe('local_mutate');
  });

  it('requirements + no plan → PLAN (repo_mutate_official, requires_user_ack)', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true }, commitsInWindow: [],
    }, TS);
    expect(d.current_stage).toBe('PLAN');
    expect(d.recommended_next).toBe('PLAN');
    expect(d.approval_envelope.risk_level).toBe('repo_mutate_official');
    expect(d.action.mode).toBe('requires_user_ack');
  });

  it('plan exists no commits → WORK', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true }, commitsInWindow: [],
    }, TS);
    expect(d.current_stage).toBe('WORK');
  });

  it('commits + plan + summary + no verification → VERIFY', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true },
      commitsInWindow: [{ sha: 'abc' }],
    }, TS);
    expect(d.current_stage).toBe('VERIFY');
    expect(d.recommended_next).toBe('VERIFY');
  });

  it('verification exists → PROCEED', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true, verification: true },
      commitsInWindow: [{ sha: 'abc' }],
    }, TS);
    expect(d.current_stage).toBe('PROCEED');
  });

  it('proceedVerdict=PROCEED + !shipped → SHIP (remote_mutate)', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true, verification: true, proceedVerdict: 'PROCEED', shipped: false },
      commitsInWindow: [{ sha: 'abc' }],
    }, TS);
    expect(d.current_stage).toBe('SHIP');
    expect(d.approval_envelope.risk_level).toBe('remote_mutate');
  });

  it('shipped without release → RELEASE (external_mutate)', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true, verification: true, proceedVerdict: 'PROCEED', shipped: true },
      commitsInWindow: [{ sha: 'abc' }],
    }, TS);
    expect(d.current_stage).toBe('RELEASE');
    expect(d.approval_envelope.risk_level).toBe('external_mutate');
  });

  it('release tag + compound artifact → COMPOUND (terminal, recommended_next HOLD)', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true, verification: true, shipped: true },
      releaseArtifacts: { tag: 'v1.4.0', publishedVersion: '0.12.0' },
      compoundArtifactPresent: true,
      commitsInWindow: [{ sha: 'abc' }],
    }, TS);
    expect(d.current_stage).toBe('COMPOUND');
    expect(d.recommended_next).toBe('HOLD');
  });
});

describe('router classifier — regress edges', () => {
  it('VERIFY + layer FAIL → regress WORK', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true, verificationLayerFail: true },
      commitsInWindow: [{ sha: 'abc' }],
    }, TS);
    expect(d.recommended_next).toBe('WORK');
  });

  it('PROCEED verdict=BLOCKED → regress WORK', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true, verification: true, proceedVerdict: 'BLOCKED' },
      commitsInWindow: [{ sha: 'abc' }],
    }, TS);
    expect(d.recommended_next).toBe('WORK');
  });

  it('PROCEED verdict=CHANGES_REQUIRED + ackDeclined → regress REVIEW', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true, verification: true, proceedVerdict: 'CHANGES_REQUIRED' },
      ackDeclined: true,
      commitsInWindow: [{ sha: 'abc' }],
    }, TS);
    expect(d.recommended_next).toBe('REVIEW');
  });

  it('WORK + failing tests → self-loop WORK', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true }, commitsInWindow: [],
      testsState: 'failing',
    }, TS);
    expect(d.current_stage).toBe('WORK');
    expect(d.recommended_next).toBe('WORK');
  });
});

describe('router classifier — L14 action.mode enforcement', () => {
  it('remote_mutate (SHIP) NEVER auto_safe regardless of confidence', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true, verification: true, proceedVerdict: 'PROCEED', shipped: false },
      commitsInWindow: [{ sha: 'abc' }],
      intentHint: 'ship',
    }, TS);
    expect(d.approval_envelope.risk_level).toBe('remote_mutate');
    expect(d.action.mode).not.toBe('auto_safe');
  });

  it('external_mutate (RELEASE) NEVER auto_safe regardless of confidence', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: true,
      phaseArtifacts: { context: true, plan: true, summary: true, verification: true, proceedVerdict: 'PROCEED', shipped: true },
      commitsInWindow: [{ sha: 'abc' }],
      intentHint: 'release',
    }, TS);
    expect(d.approval_envelope.risk_level).toBe('external_mutate');
    expect(d.action.mode).not.toBe('auto_safe');
  });
});

describe('router classifier — structural validator', () => {
  it('validateRouteDecision accepts a well-formed decision', () => {
    const d = classifyStage({
      freshness: FRESH, gitFlags: GIT_OK, requirementsPresent: false,
      phaseArtifacts: {}, commitsInWindow: [],
    }, TS);
    expect(validateRouteDecision(d)).toBe(true);
  });

  it('validateRouteDecision rejects invalid current_stage enum', () => {
    const d: any = { kind: 'route-decision', version: 1, ts: TS, freshness: FRESH,
      current_stage: 'BOGUS', recommended_next: 'HOLD', confidence: 0, reason: ['x'],
      preconditions: { satisfied: [], missing: [] }, action: { command: 'x', mode: 'manual_only' },
      approval_envelope: { risk_level: 'read_only', triggers_required: [] } };
    expect(() => validateRouteDecision(d)).toThrow(RouteDecisionInvalidError);
  });

  it('validateRouteDecision rejects L14 violation (external_mutate + auto_safe)', () => {
    const d: any = { kind: 'route-decision', version: 1, ts: TS, freshness: FRESH,
      current_stage: 'RELEASE', recommended_next: 'RELEASE', confidence: 0.9, reason: ['x'],
      preconditions: { satisfied: [], missing: [] },
      action: { command: '/sunco:release', mode: 'auto_safe' },
      approval_envelope: { risk_level: 'external_mutate', triggers_required: [] } };
    expect(() => validateRouteDecision(d)).toThrow(/L14/);
  });
});

describe('router classifier — narrative rendering lives outside confidence.mjs', () => {
  it('renderNarrativeReasons orders by weight contribution (deterministic)', () => {
    const reasonRaw = [
      ['recent_user_intent_match', 'low weight'],
      ['phase_artifacts_complete', 'highest weight'],
      ['state_md_alignment', 'middle weight'],
    ];
    const signals = { recent_user_intent_match: 1, phase_artifacts_complete: 1, state_md_alignment: 1 };
    const r = renderNarrativeReasons(reasonRaw, signals);
    expect(r[0]).toBe('highest weight');
    // Deterministic repeat.
    expect(renderNarrativeReasons(reasonRaw, signals)).toEqual(r);
  });
});
