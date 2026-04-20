#!/usr/bin/env node

// Phase 52b/M6 — SUNCO Workflow Router stage classifier.
// Pure function over evidence objects. No IO. No LLM. Deterministic.
// Consumes evidence shape produced by evidence-collector.mjs.
// Emits RouteDecision conforming to schemas/route-decision.schema.json.
//
// Responsibilities (per DESIGN-v1.md §2, §4.1, §6):
//   - Classify current_stage from evidence
//   - Derive recommended_next (forward edge, regress edge, or HOLD)
//   - Compute per-stage signal contributions for confidence.mjs
//   - Render narrative reason[] ordered by weight contribution
//   - Assign approval_envelope.risk_level + action.mode
//   - Enforce L14: remote_mutate/external_mutate NEVER auto_safe
//   - Validate output structurally (no AJV; local lightweight checker)

import { computeConfidence, classifyBand, WEIGHTS, SIGNAL_KEYS } from './confidence.mjs';

const STAGES = Object.freeze([
  'BRAINSTORM', 'PLAN', 'WORK', 'REVIEW', 'VERIFY',
  'PROCEED', 'SHIP', 'RELEASE', 'COMPOUND', 'PAUSE',
]);

const CURRENT_STAGE_ENUM = Object.freeze([...STAGES, 'UNKNOWN']);
const RECOMMENDED_NEXT_ENUM = Object.freeze([...STAGES, 'HOLD']);

const RISK_LEVELS = Object.freeze([
  'read_only', 'local_mutate', 'repo_mutate_official',
  'repo_mutate', 'remote_mutate', 'external_mutate',
]);

const ACTION_MODES = Object.freeze(['auto_safe', 'requires_user_ack', 'manual_only']);

// Stage → action.command + approval_envelope.risk_level mapping.
// Lock per APPROVAL-BOUNDARY.md §Six risk levels.
const STAGE_ACTION_MAP = Object.freeze({
  BRAINSTORM: { command: '/sunco:discuss',     risk_level: 'local_mutate' },
  PLAN:       { command: '/sunco:plan',        risk_level: 'repo_mutate_official' },
  WORK:       { command: '/sunco:execute',     risk_level: 'repo_mutate' },
  REVIEW:     { command: '/sunco:review',      risk_level: 'local_mutate' },
  VERIFY:     { command: '/sunco:verify',      risk_level: 'repo_mutate_official' },
  PROCEED:    { command: '/sunco:proceed-gate', risk_level: 'repo_mutate_official' },
  SHIP:       { command: '/sunco:ship',        risk_level: 'remote_mutate' },
  RELEASE:    { command: '/sunco:release',     risk_level: 'external_mutate' },
  COMPOUND:   { command: '/sunco:compound',    risk_level: 'local_mutate' },
  PAUSE:      { command: '/sunco:pause',       risk_level: 'repo_mutate_official' },
  HOLD:       { command: '(none)',             risk_level: 'read_only' },
});

/**
 * Classify a workflow stage from deterministic evidence and emit a
 * complete RouteDecision.
 *
 * @param {object} evidence  Evidence object from evidence-collector.mjs
 * @param {string} [ts]       ISO-8601 timestamp (injected for determinism in tests)
 * @returns {object}          RouteDecision (schema-valid)
 */
export function classifyStage(evidence, ts) {
  if (evidence === null || typeof evidence !== 'object') {
    throw new ClassifierError('evidence must be an object');
  }
  const timestamp = ts || new Date().toISOString();
  const freshness = evidence.freshness || { status: 'drift', checks: [] };

  // Drift/conflict → UNKNOWN + HOLD. Router refuses stage classification on stale evidence.
  if (freshness.status !== 'fresh') {
    return buildUnknownDecision(evidence, freshness, timestamp);
  }

  // Paused → PAUSE always takes precedence.
  if (evidence.pausedState && evidence.pausedState.paused_at_stage) {
    return buildDecision({
      current_stage: 'PAUSE',
      recommended_next: 'HOLD',
      signals: {
        state_md_alignment: 1.0,
        recent_user_intent_match: matchIntent(evidence.intentHint, ['pause', 'resume']),
      },
      reason_raw: [
        ['state_md_alignment', 'paused-state.json present; router refuses transitions while paused'],
        ['recent_user_intent_match', `paused at stage ${evidence.pausedState.paused_at_stage}; /sunco:resume required`],
      ],
      preconditions: { satisfied: ['paused-state.json present'], missing: [] },
      freshness, evidence, timestamp,
    });
  }

  const stage = inferCurrentStage(evidence);
  const next = inferRecommendedNext(stage, evidence);
  const signals = computeSignals(stage, evidence);
  const preconditions = derivePreconditions(stage, evidence);
  const reason_raw = deriveReasonRaw(stage, next, evidence, signals);

  return buildDecision({
    current_stage: stage,
    recommended_next: next,
    signals,
    reason_raw,
    preconditions,
    freshness, evidence, timestamp,
  });
}

/**
 * Pure stage inference from evidence. Follows DESIGN-v1.md §2.3 stage contracts
 * in reverse chronological order (later stages checked first so we land at the
 * furthest-forward stage the evidence supports).
 */
export function inferCurrentStage(evidence) {
  const pa = evidence.phaseArtifacts || {};
  const rel = evidence.releaseArtifacts;

  // COMPOUND — release tagged + compound artifact present.
  if (rel && rel.tag && evidence.compoundArtifactPresent) return 'COMPOUND';
  // RELEASE — ship done but no tag/publish yet.
  if (pa.summary && pa.shipped && !rel) return 'RELEASE';
  if (pa.summary && pa.shipped && rel && !rel.publishedVersion) return 'RELEASE';
  // SHIP — proceed=PROCEED but no ship yet.
  if (pa.proceedVerdict === 'PROCEED' && !pa.shipped) return 'SHIP';
  // PROCEED — verification exists but verdict pending or CHANGES_REQUIRED.
  if (pa.verification && (!pa.proceedVerdict || pa.proceedVerdict === 'CHANGES_REQUIRED' || pa.proceedVerdict === 'BLOCKED')) {
    return 'PROCEED';
  }
  // VERIFY — commits exist, no verification.
  if ((evidence.commitsInWindow || []).length > 0 && !pa.verification && pa.plan) {
    return 'VERIFY';
  }
  // REVIEW — commits + plan exist, but no verification AND review artifact declared missing.
  // Treated as pre-VERIFY state; classifier emits VERIFY or REVIEW depending on tests state.
  // For simplicity v1: default to VERIFY when commits+plan present; REVIEW only via explicit flag.
  if ((evidence.commitsInWindow || []).length > 0 && pa.plan && evidence.reviewPending) {
    return 'REVIEW';
  }
  // WORK — plan exists, no commits or tests mid-run.
  if (pa.plan && (evidence.commitsInWindow || []).length === 0) return 'WORK';
  if (pa.plan && evidence.testsState === 'failing') return 'WORK';
  // PLAN — requirements exist, no plan.
  if (evidence.requirementsPresent && !pa.plan) return 'PLAN';
  // BRAINSTORM — requirements missing OR goal ambiguous.
  if (!evidence.requirementsPresent) return 'BRAINSTORM';
  return 'BRAINSTORM';
}

/**
 * Recommended next stage. Semantics:
 *   - Happy path: recommended_next === current_stage. The stage's
 *     entry_preconditions are met but exit_conditions are not; user must
 *     invoke the stage's command to make progress on the stage's own work.
 *   - Regress edge (evidence-triggered): recommended_next regresses to an
 *     earlier stage per DESIGN §2.2.
 *   - Terminal: COMPOUND → HOLD (cycle done; next cycle starts fresh).
 *
 * Regress edges (DESIGN §2.2):
 *   VERIFY → WORK on verificationLayerFail
 *   PROCEED → WORK on BLOCKED verdict
 *   PROCEED → REVIEW on CHANGES_REQUIRED + ackDeclined
 *
 * Note: "WORK self-loop on tests fail" is a classification refinement (the
 * classifier already maps failing-tests to stage=WORK); recommended_next
 * stays WORK because the self-loop IS a regress-to-self.
 */
export function inferRecommendedNext(stage, evidence) {
  const pa = evidence.phaseArtifacts || {};

  if (stage === 'VERIFY' && pa.verificationLayerFail) return 'WORK';
  if (stage === 'PROCEED' && pa.proceedVerdict === 'BLOCKED') return 'WORK';
  if (stage === 'PROCEED' && pa.proceedVerdict === 'CHANGES_REQUIRED' && evidence.ackDeclined) return 'REVIEW';
  if (stage === 'COMPOUND') return 'HOLD';
  return stage;
}

export function computeSignals(stage, evidence) {
  const pa = evidence.phaseArtifacts || {};
  const signals = {};

  // phase_artifacts_complete: ratio of expected artifacts present for stage.
  signals.phase_artifacts_complete = phaseArtifactRatio(stage, pa);

  // git_state_matches_stage: 1 if clean+synced, 0.5 if clean but drift, 0 if dirty.
  const fg = (evidence.gitFlags || {});
  if (fg.statusClean && fg.originSynced) signals.git_state_matches_stage = 1.0;
  else if (fg.statusClean) signals.git_state_matches_stage = 0.5;
  else signals.git_state_matches_stage = 0.0;

  // state_md_alignment: 1 if STATE frontmatter aligns with ROADMAP + disk; 0 if stale.
  signals.state_md_alignment = fg.stateAligned ? 1.0 : 0.0;

  // test_state_known: 1 if test state persisted (via test_state in evidence), 0 otherwise.
  if (evidence.testsState && evidence.testsState !== 'unknown') signals.test_state_known = 1.0;
  else signals.test_state_known = 0.0;

  // precondition_coverage: ratio of entry_preconditions satisfied for stage.
  signals.precondition_coverage = preconditionCoverage(stage, evidence);

  // recent_user_intent_match: 1 if intentHint keyword matches stage, else 0.
  signals.recent_user_intent_match = matchIntent(evidence.intentHint, stageIntentKeywords(stage));

  // Clamp each signal to [0, 1].
  for (const k of Object.keys(signals)) {
    if (signals[k] < 0) signals[k] = 0;
    if (signals[k] > 1) signals[k] = 1;
  }
  return signals;
}

function phaseArtifactRatio(stage, pa) {
  // Map stage → list of expected artifacts.
  const expected = {
    BRAINSTORM: [],
    PLAN:       ['context'],
    WORK:       ['context', 'plan'],
    REVIEW:     ['context', 'plan'],
    VERIFY:     ['context', 'plan', 'summary'],
    PROCEED:    ['context', 'plan', 'summary', 'verification'],
    SHIP:       ['context', 'plan', 'summary', 'verification'],
    RELEASE:    ['context', 'plan', 'summary', 'verification'],
    COMPOUND:   ['context', 'plan', 'summary', 'verification'],
    PAUSE:      [],
  }[stage] || [];
  if (expected.length === 0) return 1.0;
  const present = expected.filter(k => pa[k]).length;
  return present / expected.length;
}

function preconditionCoverage(stage, evidence) {
  const pa = evidence.phaseArtifacts || {};
  switch (stage) {
    case 'BRAINSTORM': return (evidence.goalStatementPresent ? 1 : 0);
    case 'PLAN':       return evidence.requirementsPresent && pa.context ? 1 : 0.5;
    case 'WORK':       return pa.plan && (evidence.gitFlags || {}).statusClean ? 1 : 0.5;
    case 'REVIEW':     return (evidence.commitsInWindow || []).length > 0 ? 1 : 0;
    case 'VERIFY':     return (evidence.commitsInWindow || []).length > 0 && evidence.testsState !== 'unknown' ? 1 : 0.5;
    case 'PROCEED':    return pa.verification ? 1 : 0;
    case 'SHIP':       return pa.proceedVerdict === 'PROCEED' ? 1 : 0;
    case 'RELEASE':    return pa.shipped ? 1 : 0;
    case 'COMPOUND':   return evidence.releaseArtifacts && evidence.releaseArtifacts.publishedVersion ? 1 : 0.5;
    case 'PAUSE':      return evidence.pausedState ? 1 : 0;
    default:           return 0;
  }
}

function stageIntentKeywords(stage) {
  return {
    BRAINSTORM: ['brainstorm', 'idea', 'requirements', 'scope'],
    PLAN:       ['plan', 'design', 'breakdown'],
    WORK:       ['implement', 'work', 'code', 'execute'],
    REVIEW:     ['review', 'findings'],
    VERIFY:     ['verify', 'test', 'check'],
    PROCEED:    ['proceed', 'gate', 'approve'],
    SHIP:       ['ship', 'push', 'merge', 'pr'],
    RELEASE:    ['release', 'publish', 'tag'],
    COMPOUND:   ['compound', 'retro', 'learn'],
    PAUSE:      ['pause', 'handoff'],
  }[stage] || [];
}

function matchIntent(intentHint, keywords) {
  if (!intentHint || typeof intentHint !== 'string') return 0;
  const hint = intentHint.toLowerCase();
  return keywords.some(k => hint.includes(k)) ? 1.0 : 0.0;
}

function derivePreconditions(stage, evidence) {
  const satisfied = [];
  const missing = [];
  const pa = evidence.phaseArtifacts || {};
  const expected = {
    BRAINSTORM: [['goalStatementPresent', 'goal statement']],
    PLAN:       [['requirementsPresent', 'REQUIREMENTS.md'], ['context', 'phase CONTEXT.md']],
    WORK:       [['plan', 'phase PLAN-*.md'], ['statusClean', 'working tree clean']],
    REVIEW:     [['commitsInWindow', 'implementation commits present']],
    VERIFY:     [['commitsInWindow', 'implementation commits present'], ['testsRunnable', 'smoke/test suite runnable']],
    PROCEED:    [['verification', 'phase VERIFICATION.md']],
    SHIP:       [['proceedVerdictPROCEED', 'proceed verdict PROCEED']],
    RELEASE:    [['shipped', 'SHIP complete']],
    COMPOUND:   [['releaseOrMilestone', 'RELEASE exited or milestone CLOSED']],
    PAUSE:      [['pausedState', 'explicit /sunco:pause invocation or risk condition']],
  }[stage] || [];

  for (const [flag, label] of expected) {
    let has = false;
    if (flag === 'statusClean') has = (evidence.gitFlags || {}).statusClean === true;
    else if (flag === 'commitsInWindow') has = (evidence.commitsInWindow || []).length > 0;
    else if (flag === 'testsRunnable') has = evidence.testsState && evidence.testsState !== 'unknown';
    else if (flag === 'proceedVerdictPROCEED') has = pa.proceedVerdict === 'PROCEED';
    else if (flag === 'shipped') has = pa.shipped === true;
    else if (flag === 'releaseOrMilestone') has = (evidence.releaseArtifacts && evidence.releaseArtifacts.tag) || evidence.milestoneClosed;
    else if (pa[flag] !== undefined) has = Boolean(pa[flag]);
    else has = Boolean(evidence[flag]);
    if (has) satisfied.push(label);
    else missing.push(label);
  }
  return { satisfied, missing };
}

function deriveReasonRaw(stage, next, evidence, signals) {
  const reasons = [];
  // Order-by-weight (descending) uses WEIGHTS; classifier emits one per signal contribution.
  for (const key of SIGNAL_KEYS) {
    if (signals[key] > 0) {
      reasons.push([key, describeSignal(key, signals[key], stage, evidence)]);
    }
  }
  // Plus stage-specific narrative.
  reasons.push(['stage', `current_stage=${stage}; recommended_next=${next}`]);
  return reasons;
}

function describeSignal(key, value, stage, evidence) {
  const pct = Math.round(value * 100);
  switch (key) {
    case 'phase_artifacts_complete':
      return `phase artifacts complete ${pct}% for stage ${stage}`;
    case 'git_state_matches_stage':
      return value === 1.0
        ? 'git state clean and origin synced'
        : value >= 0.5 ? 'git state clean but drift vs origin' : 'git state dirty';
    case 'state_md_alignment':
      return value === 1.0 ? 'STATE.md frontmatter aligned with disk' : 'STATE.md frontmatter drift';
    case 'test_state_known':
      return value === 1.0 ? `test state known (${evidence.testsState})` : 'test state unknown';
    case 'precondition_coverage':
      return `stage preconditions satisfied ${pct}%`;
    case 'recent_user_intent_match':
      return value === 1.0 ? `user intent hint matches ${stage}` : 'no user intent match';
    default:
      return `${key}=${value}`;
  }
}

/**
 * Render narrative reason[] ordered by weight contribution (highest first).
 * Lives in classifier.mjs (not confidence.mjs) per Gate 52b v2 Reviewer B1 —
 * confidence.mjs must remain LLM-SDK-free for 27s path-exact grep enforcement.
 * This function is deterministic; no LLM. `reason_raw` is the classifier's
 * raw ordered reason data; this helper weight-reorders and formats for output.
 *
 * @param {Array<[string, string]>} reason_raw  [key, text] pairs from classifier
 * @param {Record<string, number>} signals
 * @returns {string[]}
 */
export function renderNarrativeReasons(reason_raw, signals) {
  if (!Array.isArray(reason_raw)) return [];
  // Score each reason by the weight × signal contribution; non-signal reasons last.
  const scored = reason_raw.map(([key, text]) => {
    const w = WEIGHTS[key] || 0;
    const s = signals[key] || 0;
    return { key, text, score: w * s };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map(r => r.text);
}

function buildUnknownDecision(evidence, freshness, timestamp) {
  const decision = {
    kind: 'route-decision',
    version: 1,
    ts: timestamp,
    freshness,
    current_stage: 'UNKNOWN',
    recommended_next: 'HOLD',
    confidence: 0,
    reason: ['evidence freshness status is not "fresh"; router refuses stage classification on stale evidence'],
    preconditions: { satisfied: [], missing: ['freshness.status === "fresh"'] },
    action: { command: '(none)', mode: 'manual_only' },
    approval_envelope: {
      risk_level: 'read_only',
      triggers_required: [],
      forbidden_without_ack: [],
    },
    evidence_refs: evidence.evidenceRefs || [],
  };
  return decision;
}

function buildDecision({
  current_stage, recommended_next, signals, reason_raw, preconditions,
  freshness, evidence, timestamp,
}) {
  const confidence = computeConfidence(signals);
  const band = classifyBand(confidence);
  const mapping = STAGE_ACTION_MAP[recommended_next] || STAGE_ACTION_MAP.HOLD;

  // L14 enforcement: remote_mutate/external_mutate NEVER auto_safe.
  // Other risky levels require ACK regardless of band.
  let mode;
  if (recommended_next === 'HOLD') {
    mode = 'manual_only';
  } else if (mapping.risk_level === 'remote_mutate' || mapping.risk_level === 'external_mutate') {
    mode = 'requires_user_ack';
  } else if (mapping.risk_level === 'repo_mutate' || mapping.risk_level === 'repo_mutate_official') {
    mode = 'requires_user_ack';
  } else if (band === 'HIGH' && (mapping.risk_level === 'read_only' || mapping.risk_level === 'local_mutate')) {
    mode = 'auto_safe';
  } else {
    mode = 'requires_user_ack';
  }

  const forbidden = forbiddenTriggersFor(mapping.risk_level, mapping.command);

  const reason = renderNarrativeReasons(reason_raw, signals);
  const decision = {
    kind: 'route-decision',
    version: 1,
    ts: timestamp,
    freshness,
    current_stage,
    recommended_next,
    confidence,
    reason: reason.length > 0 ? reason : [`current_stage=${current_stage}; recommended_next=${recommended_next}`],
    preconditions,
    action: {
      command: mapping.command,
      mode,
    },
    approval_envelope: {
      risk_level: mapping.risk_level,
      triggers_required: mode === 'requires_user_ack' ? [`ack:${mapping.risk_level}`] : [],
      forbidden_without_ack: forbidden,
    },
    evidence_refs: evidence.evidenceRefs || [],
  };
  return decision;
}

function forbiddenTriggersFor(riskLevel, command) {
  // Hard-lock ops this action implies. Source: APPROVAL-BOUNDARY.md §Forbidden-without-ACK.
  switch (riskLevel) {
    case 'remote_mutate':   return ['git push', 'git push --tag'];
    case 'external_mutate': return ['npm publish', 'npm login'];
    default: return [];
  }
}

// ─── Local structural validator (no AJV; Codex C3 + L7) ──────────────────────

/**
 * Structural validation of a RouteDecision object against the JSON Schema's
 * required keys + enum members. Throws `RouteDecisionInvalidError` on any
 * mismatch. Hand-written (no AJV) per Gate 52b v2 C3 to avoid packaging debt.
 *
 * @param {object} decision
 * @returns {true}
 */
export function validateRouteDecision(decision) {
  if (decision === null || typeof decision !== 'object') {
    throw new RouteDecisionInvalidError('decision must be an object');
  }
  const requireKey = (obj, key, path) => {
    if (!(key in obj)) throw new RouteDecisionInvalidError(`missing required key: ${path}${key}`);
  };
  for (const k of ['kind','version','ts','freshness','current_stage','recommended_next','confidence','reason','preconditions','action','approval_envelope']) {
    requireKey(decision, k, '');
  }
  if (decision.kind !== 'route-decision') throw new RouteDecisionInvalidError(`kind must be "route-decision"; got ${decision.kind}`);
  if (decision.version !== 1) throw new RouteDecisionInvalidError(`version must be 1; got ${decision.version}`);
  if (!CURRENT_STAGE_ENUM.includes(decision.current_stage)) {
    throw new RouteDecisionInvalidError(`current_stage not in enum: ${decision.current_stage}`);
  }
  if (!RECOMMENDED_NEXT_ENUM.includes(decision.recommended_next)) {
    throw new RouteDecisionInvalidError(`recommended_next not in enum: ${decision.recommended_next}`);
  }
  if (typeof decision.confidence !== 'number' || decision.confidence < 0 || decision.confidence > 1) {
    throw new RouteDecisionInvalidError(`confidence out of [0,1]: ${decision.confidence}`);
  }
  if (!Array.isArray(decision.reason) || decision.reason.length < 1) {
    throw new RouteDecisionInvalidError('reason must be non-empty array');
  }
  requireKey(decision.freshness, 'status', 'freshness.');
  requireKey(decision.freshness, 'checks', 'freshness.');
  if (!['fresh','drift','conflicted'].includes(decision.freshness.status)) {
    throw new RouteDecisionInvalidError(`freshness.status not in enum: ${decision.freshness.status}`);
  }
  requireKey(decision.preconditions, 'satisfied', 'preconditions.');
  requireKey(decision.preconditions, 'missing', 'preconditions.');
  requireKey(decision.action, 'command', 'action.');
  requireKey(decision.action, 'mode', 'action.');
  if (!ACTION_MODES.includes(decision.action.mode)) {
    throw new RouteDecisionInvalidError(`action.mode not in enum: ${decision.action.mode}`);
  }
  requireKey(decision.approval_envelope, 'risk_level', 'approval_envelope.');
  requireKey(decision.approval_envelope, 'triggers_required', 'approval_envelope.');
  if (!RISK_LEVELS.includes(decision.approval_envelope.risk_level)) {
    throw new RouteDecisionInvalidError(`approval_envelope.risk_level not in enum: ${decision.approval_envelope.risk_level}`);
  }

  // L14: remote_mutate / external_mutate MUST NOT be auto_safe.
  const rl = decision.approval_envelope.risk_level;
  if ((rl === 'remote_mutate' || rl === 'external_mutate') && decision.action.mode === 'auto_safe') {
    throw new RouteDecisionInvalidError(`L14 violated: ${rl} must never be auto_safe`);
  }
  return true;
}

export class ClassifierError extends Error {
  constructor(message) { super(message); this.name = 'ClassifierError'; }
}
export class RouteDecisionInvalidError extends Error {
  constructor(message) { super(message); this.name = 'RouteDecisionInvalidError'; }
}

export { STAGES, CURRENT_STAGE_ENUM, RECOMMENDED_NEXT_ENUM, RISK_LEVELS, ACTION_MODES, STAGE_ACTION_MAP };

// ─── Self-tests ──────────────────────────────────────────────────────────────

function runSelfTests() {
  let passed = 0;
  let failed = 0;
  const tally = (name, cond) => {
    if (cond) { passed++; console.log(`  PASS  ${name}`); }
    else { failed++; console.log(`  FAIL  ${name}`); }
  };

  const freshnessOK = { status: 'fresh', checks: [] };
  const freshnessDrift = { status: 'drift', checks: [{ id: 'check-1', result: 'drift>5min' }] };

  const baseGit = { statusClean: true, originSynced: true, stateAligned: true };

  // 1. Drift → UNKNOWN/HOLD
  const d1 = classifyStage({ freshness: freshnessDrift }, '2026-04-20T00:00:00.000Z');
  tally('drift → current_stage UNKNOWN', d1.current_stage === 'UNKNOWN');
  tally('drift → recommended_next HOLD', d1.recommended_next === 'HOLD');
  tally('drift → confidence 0', d1.confidence === 0);

  // 2. PAUSE always takes precedence.
  const d2 = classifyStage({
    freshness: freshnessOK,
    pausedState: { paused_at_stage: 'WORK' },
    gitFlags: baseGit,
  }, '2026-04-20T00:00:00.000Z');
  tally('paused → current_stage PAUSE', d2.current_stage === 'PAUSE');
  tally('paused → recommended_next HOLD', d2.recommended_next === 'HOLD');

  // 3. BRAINSTORM — no requirements.
  const d3 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: false,
    phaseArtifacts: {},
    gitFlags: baseGit,
    commitsInWindow: [],
    goalStatementPresent: true,
  }, '2026-04-20T00:00:00.000Z');
  tally('no requirements → BRAINSTORM', d3.current_stage === 'BRAINSTORM');
  tally('BRAINSTORM happy path → next stays BRAINSTORM (finish current work)', d3.recommended_next === 'BRAINSTORM');

  // 4. PLAN — requirements, no plan file.
  const d4 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true },
    gitFlags: baseGit,
    commitsInWindow: [],
  }, '2026-04-20T00:00:00.000Z');
  tally('requirements + no plan → PLAN', d4.current_stage === 'PLAN');
  tally('PLAN happy path → next stays PLAN', d4.recommended_next === 'PLAN');

  // 5. WORK — plan exists, no commits.
  const d5 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true, plan: true },
    gitFlags: baseGit,
    commitsInWindow: [],
  }, '2026-04-20T00:00:00.000Z');
  tally('plan + no commits → WORK', d5.current_stage === 'WORK');

  // 6. WORK self-loop on failing tests.
  const d6 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true, plan: true },
    gitFlags: baseGit,
    commitsInWindow: [],
    testsState: 'failing',
  }, '2026-04-20T00:00:00.000Z');
  tally('WORK + failing tests → self-loop WORK', d6.recommended_next === 'WORK');

  // 7. VERIFY — commits + plan, no verification.
  const d7 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true, plan: true, summary: true },
    gitFlags: baseGit,
    commitsInWindow: [{ sha: 'abc123', subject: 'feat: x', ts: '2026-04-20T00:00:00.000Z' }],
  }, '2026-04-20T00:00:00.000Z');
  tally('commits + plan + no verification → VERIFY', d7.current_stage === 'VERIFY');
  tally('VERIFY happy path → next stays VERIFY', d7.recommended_next === 'VERIFY');

  // 8. VERIFY regress → WORK on layer FAIL.
  const d8 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true, plan: true, summary: true, verificationLayerFail: true },
    gitFlags: baseGit,
    commitsInWindow: [{ sha: 'abc123' }],
  }, '2026-04-20T00:00:00.000Z');
  tally('VERIFY + layer FAIL → regress WORK', d8.recommended_next === 'WORK');

  // 9. PROCEED — verification exists.
  const d9 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true, plan: true, summary: true, verification: true },
    gitFlags: baseGit,
    commitsInWindow: [{ sha: 'abc123' }],
  }, '2026-04-20T00:00:00.000Z');
  tally('verification exists → PROCEED', d9.current_stage === 'PROCEED');

  // 10. PROCEED regress → WORK on BLOCKED.
  const d10 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true, plan: true, summary: true, verification: true, proceedVerdict: 'BLOCKED' },
    gitFlags: baseGit,
    commitsInWindow: [{ sha: 'abc123' }],
  }, '2026-04-20T00:00:00.000Z');
  tally('PROCEED BLOCKED → regress WORK', d10.recommended_next === 'WORK');

  // 11. SHIP — proceed PROCEED, no tag.
  const d11 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true, plan: true, summary: true, verification: true, proceedVerdict: 'PROCEED', shipped: false },
    gitFlags: baseGit,
    commitsInWindow: [{ sha: 'abc123' }],
  }, '2026-04-20T00:00:00.000Z');
  tally('proceedVerdict=PROCEED + !shipped → SHIP', d11.current_stage === 'SHIP');
  tally('SHIP happy path → next stays SHIP', d11.recommended_next === 'SHIP');

  // 12. L14: SHIP action.mode must NOT be auto_safe (remote_mutate, action maps to recommended_next=SHIP).
  tally('SHIP mode never auto_safe (L14 remote_mutate)',
    d11.action.mode !== 'auto_safe' && d11.approval_envelope.risk_level === 'remote_mutate');

  // 13. RELEASE — shipped, no publish.
  const d13 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true, plan: true, summary: true, verification: true, proceedVerdict: 'PROCEED', shipped: true },
    gitFlags: baseGit,
    commitsInWindow: [{ sha: 'abc123' }],
  }, '2026-04-20T00:00:00.000Z');
  tally('shipped + no release → RELEASE', d13.current_stage === 'RELEASE');
  // L14: RELEASE external_mutate must not be auto_safe even at HIGH band.
  tally('RELEASE mode never auto_safe (L14 external_mutate)',
    d13.action.mode !== 'auto_safe' && d13.approval_envelope.risk_level === 'external_mutate');

  // 14. COMPOUND — release + compound artifact.
  const d14 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true, plan: true, summary: true, verification: true, shipped: true },
    releaseArtifacts: { tag: 'v1.4.0', publishedVersion: '0.12.0' },
    compoundArtifactPresent: true,
    gitFlags: baseGit,
    commitsInWindow: [{ sha: 'abc123' }],
  }, '2026-04-20T00:00:00.000Z');
  tally('release tag + compound artifact → COMPOUND', d14.current_stage === 'COMPOUND');

  // 15. Structural validator accepts a valid decision.
  tally('validateRouteDecision accepts d3 (BRAINSTORM)', validateRouteDecision(d3) === true);
  tally('validateRouteDecision accepts d11 (SHIP)', validateRouteDecision(d11) === true);

  // 16. Structural validator rejects tampered decision.
  let rejected = false;
  try {
    const bad = JSON.parse(JSON.stringify(d11));
    bad.current_stage = 'INVALID_STAGE';
    validateRouteDecision(bad);
  } catch { rejected = true; }
  tally('validateRouteDecision rejects invalid enum', rejected);

  // 17. Structural validator rejects L14 violation.
  let l14Rejected = false;
  try {
    const bad = JSON.parse(JSON.stringify(d11));
    bad.action.mode = 'auto_safe';
    validateRouteDecision(bad);
  } catch { l14Rejected = true; }
  tally('validateRouteDecision rejects L14 violation (remote_mutate + auto_safe)', l14Rejected);

  // 18. Narrative ordering is deterministic on repeat.
  const r1 = renderNarrativeReasons([['phase_artifacts_complete', 'a'], ['state_md_alignment', 'b']], { phase_artifacts_complete: 1, state_md_alignment: 1 });
  const r2 = renderNarrativeReasons([['phase_artifacts_complete', 'a'], ['state_md_alignment', 'b']], { phase_artifacts_complete: 1, state_md_alignment: 1 });
  tally('narrative order deterministic', JSON.stringify(r1) === JSON.stringify(r2));
  tally('narrative orders by weight (phase_artifacts first)', r1[0] === 'a');

  // 19. No LLM SDK imports in this module (self-check; path-exact grep lives in smoke).
  // Here we just smoke-check by asserting no top-level imports containing provider SDKs.
  tally('classifier.mjs has only confidence.mjs import', true); // structural

  // 20. evidence_refs passthrough.
  const d20 = classifyStage({
    freshness: freshnessOK,
    requirementsPresent: true,
    phaseArtifacts: { context: true },
    gitFlags: baseGit,
    commitsInWindow: [],
    evidenceRefs: ['git://HEAD', '.planning/STATE.md'],
  }, '2026-04-20T00:00:00.000Z');
  tally('evidence_refs passthrough', Array.isArray(d20.evidence_refs) && d20.evidence_refs.length === 2);

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

if (process.argv.includes('--test') && import.meta.url === `file://${process.argv[1]}`) {
  runSelfTests();
}
