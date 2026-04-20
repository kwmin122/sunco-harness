#!/usr/bin/env node

// Phase 54/M6 — SUNCO Compound-Router runtime.
//
// Clean-room notice. SUNCO Workflow Router is a clean-room design inspired
// only by the general workflow idea of recurring stages (Brainstorm → Plan →
// Work → Review → Compound → Repeat). No code, prompts, command files, schemas,
// agent definitions, skill implementations, or documentation text from
// compound-engineering-plugin or any third-party workflow/compound/retrospective
// tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning
// artifacts, approval boundaries, state machine, and router implementation
// authored independently against the SUNCO codebase.
//
// Post-stage durable-decision consumer (G5 (b') strict naming). Reads
// durable-tier RouteDecision logs under `.planning/router/decisions/`, scores
// whether the observed window warrants a compound artifact per DESIGN §8.2
// L3-split trigger model, and auto-writes `.planning/compound/*.md` at
// `status: proposed` when score crosses threshold. Sinks (memory, rules,
// backlog, SDI) are proposal-only via sink-proposer.mjs.
//
// Phase 52b patterns reused: adapter-injected IO, atomic tmp-in-same-dir
// rename, path-allowlist at writer boundary, local structural validator
// (no AJV — Phase 52b L7).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ─── Scoring constants (DESIGN §8.2 L3 split) ──────────────────────────────

const SCORE_SDI_OBSERVATIONAL = 2;   // per pattern observed ≥2 times NOT in spec/rules
const SCORE_SPEC_RULE_PRESCRIPTIVE = 3; // per pattern violating/extending spec/rule
const SCORE_ALREADY_CODIFIED = -1;   // per already-codified pattern (dedupe)
const SCORE_RELEASE_EXIT = 6;        // always-on
const SCORE_MILESTONE_CLOSED = 5;    // always-on
const SCORE_CHANGES_REQUIRED_ACKED = 3;
const SCORE_POST_JUDGE_FIX = 3;
const SCORE_CI_RECOVERED = 2;
const SCORE_ROLLBACK_USED = 2;
const SCORE_PLAN_DEBT = 1;
const SCORE_GATE_RED_YELLOW = 1;
const SCORE_USER_CORRECTION = 1;     // when correction count ≥2
const SCORE_DOCS_ONLY = -3;
const SCORE_NO_NEW_DEBT_GATE_ROLLBACK = -2;
const SCORE_WINDOW_TOO_SHORT = -2;

const THRESHOLD_WRITE = 5;           // score ≥5 → auto-write status=proposed
const THRESHOLD_CANDIDATE = 2;       // 2 ≤ score < 5 → candidate note

// Decision kinds returned by decideCompound.
export const DECISION_WRITE = 'write';
export const DECISION_CANDIDATE = 'candidate';
export const DECISION_SKIP = 'skip';

const DECISIONS = Object.freeze([DECISION_WRITE, DECISION_CANDIDATE, DECISION_SKIP]);

// Canonical 8-section order (schema + template parity).
export const COMPOUND_SECTIONS = Object.freeze([
  'context',
  'learnings',
  'patterns_sdi',
  'rule_promotions',
  'automation',
  'seeds',
  'memory_proposals',
  'approval_log',
]);

export const COMPOUND_SCOPES = Object.freeze(['release', 'milestone', 'phase', 'incident', 'ad_hoc']);
export const COMPOUND_STATUSES = Object.freeze(['draft', 'proposed', 'partially-approved', 'approved', 'archived']);

/**
 * Pure scoring function per DESIGN §8.2 L3 split. No IO. No LLM. No network.
 *
 * @param {object} input
 *   {string} stage_exit    One of BRAINSTORM/PLAN/WORK/REVIEW/VERIFY/PROCEED/SHIP/RELEASE/COMPOUND/PAUSE
 *   {object} event         Boolean/count flags describing the window
 *   {object} window        { from: ISO, to: ISO }
 * @returns {{ score: number, reasons: string[] }}
 */
export function scoreCompound(input) {
  if (!input || typeof input !== 'object') {
    return { score: 0, reasons: ['input:missing'] };
  }
  const event = (input.event && typeof input.event === 'object') ? input.event : {};
  const reasons = [];
  let score = 0;

  // L3 split contributions (patterns are counted; contribution scales per count).
  const sdiCount = toNonNegInt(event.sdi_observational_count);
  if (sdiCount > 0) {
    const delta = SCORE_SDI_OBSERVATIONAL * sdiCount;
    score += delta;
    reasons.push(`sdi_observational:+${delta}(${sdiCount})`);
  }
  const rulesCount = toNonNegInt(event.spec_rule_prescriptive_count);
  if (rulesCount > 0) {
    const delta = SCORE_SPEC_RULE_PRESCRIPTIVE * rulesCount;
    score += delta;
    reasons.push(`spec_rule_prescriptive:+${delta}(${rulesCount})`);
  }
  const codifiedCount = toNonNegInt(event.already_codified_count);
  if (codifiedCount > 0) {
    const delta = SCORE_ALREADY_CODIFIED * codifiedCount;
    score += delta;
    reasons.push(`already_codified:${delta}(${codifiedCount})`);
  }

  // Always-on contributions.
  if (input.stage_exit === 'RELEASE') {
    score += SCORE_RELEASE_EXIT;
    reasons.push(`release_exit:+${SCORE_RELEASE_EXIT}`);
  }
  if (event.milestone_closed === true) {
    score += SCORE_MILESTONE_CLOSED;
    reasons.push(`milestone_closed:+${SCORE_MILESTONE_CLOSED}`);
  }

  // Conditional contributions.
  if (event.changes_required_acked === true) {
    score += SCORE_CHANGES_REQUIRED_ACKED;
    reasons.push(`changes_required_acked:+${SCORE_CHANGES_REQUIRED_ACKED}`);
  }
  if (event.post_judge_fix === true) {
    score += SCORE_POST_JUDGE_FIX;
    reasons.push(`post_judge_fix:+${SCORE_POST_JUDGE_FIX}`);
  }
  if (event.ci_recovered === true) {
    score += SCORE_CI_RECOVERED;
    reasons.push(`ci_recovered:+${SCORE_CI_RECOVERED}`);
  }
  if (event.rollback_used === true) {
    score += SCORE_ROLLBACK_USED;
    reasons.push(`rollback_used:+${SCORE_ROLLBACK_USED}`);
  }
  if (event.plan_debt === true) {
    score += SCORE_PLAN_DEBT;
    reasons.push(`plan_debt:+${SCORE_PLAN_DEBT}`);
  }
  if (event.gate_red_yellow === true) {
    score += SCORE_GATE_RED_YELLOW;
    reasons.push(`gate_red_yellow:+${SCORE_GATE_RED_YELLOW}`);
  }
  const userCorrections = toNonNegInt(event.user_correction_count);
  if (userCorrections >= 2) {
    score += SCORE_USER_CORRECTION;
    reasons.push(`user_correction:+${SCORE_USER_CORRECTION}(${userCorrections})`);
  }

  // Dampeners.
  if (event.docs_only === true) {
    score += SCORE_DOCS_ONLY;
    reasons.push(`docs_only:${SCORE_DOCS_ONLY}`);
  }
  if (event.no_new_debt_gate_rollback === true) {
    score += SCORE_NO_NEW_DEBT_GATE_ROLLBACK;
    reasons.push(`no_new_debt_gate_rollback:${SCORE_NO_NEW_DEBT_GATE_ROLLBACK}`);
  }
  if (event.window_too_short === true) {
    score += SCORE_WINDOW_TOO_SHORT;
    reasons.push(`window_too_short:${SCORE_WINDOW_TOO_SHORT}`);
  }

  return { score, reasons };
}

/**
 * Deterministic decision gate per DESIGN §8.2. Always-on overrides
 * (RELEASE stage exit OR milestone_closed) force DECISION_WRITE regardless
 * of numeric score. Otherwise threshold comparison.
 *
 * @param {object} input  Same shape as scoreCompound input.
 * @returns {{ decision: string, score: number, reasons: string[], alwaysOn: boolean }}
 */
export function decideCompound(input) {
  const { score, reasons } = scoreCompound(input);
  const event = (input && input.event && typeof input.event === 'object') ? input.event : {};
  const alwaysOn = (input && input.stage_exit === 'RELEASE') || event.milestone_closed === true;
  let decision;
  if (alwaysOn) {
    decision = DECISION_WRITE;
    reasons.push('always_on_override');
  } else if (score >= THRESHOLD_WRITE) {
    decision = DECISION_WRITE;
  } else if (score >= THRESHOLD_CANDIDATE) {
    decision = DECISION_CANDIDATE;
  } else {
    decision = DECISION_SKIP;
  }
  return { decision, score, reasons, alwaysOn };
}

/**
 * Local structural validator for compound artifact objects (Phase 52b L7
 * no-AJV precedent). Throws CompoundArtifactInvalidError on any violation.
 *
 * @param {object} artifact
 */
export function validateCompoundArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    throw new CompoundArtifactInvalidError('artifact: must be object');
  }
  if (artifact.kind !== 'compound') {
    throw new CompoundArtifactInvalidError('kind: must be "compound"');
  }
  if (artifact.version !== 1) {
    throw new CompoundArtifactInvalidError('version: must be 1');
  }
  if (!COMPOUND_SCOPES.includes(artifact.scope)) {
    throw new CompoundArtifactInvalidError(`scope: must be one of ${COMPOUND_SCOPES.join('|')}`);
  }
  if (typeof artifact.ref !== 'string' || artifact.ref.length === 0) {
    throw new CompoundArtifactInvalidError('ref: must be non-empty string');
  }
  if (!artifact.window || typeof artifact.window !== 'object') {
    throw new CompoundArtifactInvalidError('window: must be object');
  }
  if (typeof artifact.window.from !== 'string' || !isIsoDateTime(artifact.window.from)) {
    throw new CompoundArtifactInvalidError('window.from: must be ISO date-time string');
  }
  if (typeof artifact.window.to !== 'string' || !isIsoDateTime(artifact.window.to)) {
    throw new CompoundArtifactInvalidError('window.to: must be ISO date-time string');
  }
  if (!COMPOUND_STATUSES.includes(artifact.status)) {
    throw new CompoundArtifactInvalidError(`status: must be one of ${COMPOUND_STATUSES.join('|')}`);
  }
  if (!Array.isArray(artifact.source_evidence)) {
    throw new CompoundArtifactInvalidError('source_evidence: must be array');
  }
  if (!Array.isArray(artifact.sections) || artifact.sections.length !== 8) {
    throw new CompoundArtifactInvalidError('sections: must be array of 8 names');
  }
  for (const s of artifact.sections) {
    if (!COMPOUND_SECTIONS.includes(s)) {
      throw new CompoundArtifactInvalidError(`sections: unknown name "${s}"`);
    }
  }
  // Uniqueness check.
  const seen = new Set();
  for (const s of artifact.sections) {
    if (seen.has(s)) {
      throw new CompoundArtifactInvalidError(`sections: duplicate "${s}"`);
    }
    seen.add(s);
  }
  if (artifact.clean_room_notice !== true) {
    throw new CompoundArtifactInvalidError('clean_room_notice: must be true');
  }
  if (artifact.generated_by !== 'sunco-compound-router') {
    throw new CompoundArtifactInvalidError('generated_by: must be "sunco-compound-router"');
  }
}

/**
 * Enforce the compound-router write path allowlist. Allowed paths:
 *   <repoRoot>/.planning/compound/<any-name>.md
 * Any other path throws CompoundWriterPathError.
 *
 * @param {string} absPath
 * @param {string} repoRoot
 */
export function assertInCompoundAllowlist(absPath, repoRoot) {
  if (typeof absPath !== 'string' || !absPath) {
    throw new CompoundWriterPathError('absPath required');
  }
  if (typeof repoRoot !== 'string' || !repoRoot) {
    throw new CompoundWriterPathError('repoRoot required');
  }
  const normAbs = path.normalize(absPath);
  const normRoot = path.normalize(repoRoot);
  if (!normAbs.startsWith(normRoot + path.sep) && normAbs !== normRoot) {
    throw new CompoundWriterPathError(`path outside repoRoot: ${absPath}`);
  }
  const rel = path.relative(normRoot, normAbs);
  const compoundDirMatch = rel.startsWith('.planning/compound/') && rel.endsWith('.md') && !rel.slice('.planning/compound/'.length).includes('/');
  if (!compoundDirMatch) {
    throw new CompoundWriterPathError(`path outside compound writer allowlist: ${rel}`);
  }
}

/**
 * Run the compound-router: score input, decide, optionally write artifact.
 *
 * @param {object} ctx
 *   {string} repoRoot
 *   {object} input         scoreCompound/decideCompound input
 *   {string} [scope]       required when writing; schema scope enum
 *   {string} [ref]         required when writing; scope-local id
 *   {object} [window]      required when writing; { from: ISO, to: ISO }
 *   {string[]} [source_evidence]  required when writing; defaults to []
 *   {string} [rendered]    pre-rendered markdown artifact body (optional;
 *                          consumer-generated from template.md)
 *   {Date}   [now]
 *   {Function} [writeFileSync]
 *   {Function} [renameSync]
 *   {Function} [mkdirSync]
 *   {boolean} [dryRun]     if true, do not write; return decision only
 * @returns {{ decision: string, score: number, reasons: string[], artifactPath: string|null }}
 */
export function runCompound(ctx) {
  if (!ctx || typeof ctx !== 'object') throw new CompoundWriterPathError('ctx required');
  if (!ctx.repoRoot) throw new CompoundWriterPathError('ctx.repoRoot required');
  const { decision, score, reasons, alwaysOn } = decideCompound(ctx.input || {});
  let artifactPath = null;

  if (decision === DECISION_WRITE && !ctx.dryRun) {
    if (!ctx.scope) throw new CompoundWriterPathError('ctx.scope required for write');
    if (!ctx.ref) throw new CompoundWriterPathError('ctx.ref required for write');
    if (!ctx.window || !ctx.window.from || !ctx.window.to) {
      throw new CompoundWriterPathError('ctx.window.{from,to} required for write');
    }
    const writers = resolveWriters(ctx);
    const now = ctx.now || new Date();
    const dateStr = formatDate(now);
    const safeRef = sanitizeRef(ctx.ref);
    const fileName = `${ctx.scope}-${safeRef}-${dateStr}.md`;
    const compoundDir = path.join(ctx.repoRoot, '.planning', 'compound');
    artifactPath = path.join(compoundDir, fileName);
    assertInCompoundAllowlist(artifactPath, ctx.repoRoot);

    const content = ctx.rendered || defaultRenderedBody({
      scope: ctx.scope,
      ref: ctx.ref,
      window: ctx.window,
      source_evidence: ctx.source_evidence || [],
      score,
      reasons,
      alwaysOn,
    });
    writers.mkdirSync(compoundDir, { recursive: true });
    atomicWrite(artifactPath, content, writers);
  }

  return { decision, score, reasons, artifactPath };
}

// ─── Default body renderer (consumer-overrideable via ctx.rendered) ────────

function defaultRenderedBody({ scope, ref, window, source_evidence, score, reasons, alwaysOn }) {
  const evidenceList = source_evidence.length
    ? source_evidence.map((p) => `  - ${p}`).join('\n')
    : '  []';
  return `# Compound Artifact — ${scope}-${ref}

<!--
Clean-room notice. SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.
-->

---
kind: compound
version: 1
scope: ${scope}
ref: ${ref}
window:
  from: ${window.from}
  to: ${window.to}
status: proposed
source_evidence:
${evidenceList}
sections:
  - context
  - learnings
  - patterns_sdi
  - rule_promotions
  - automation
  - seeds
  - memory_proposals
  - approval_log
clean_room_notice: true
generated_by: sunco-compound-router
---

Trigger score: ${score}${alwaysOn ? ' (always-on override)' : ''}.
Reasons: ${reasons.join(', ') || '(none)'}.

## context

(populate from source_evidence)

## learnings

(explicit takeaways)

## patterns_sdi

(sink-proposer output; SDI-observational; proposal-only)

## rule_promotions

(sink-proposer output; spec-rule-prescriptive; proposal-only)

## automation

(candidate automations)

## seeds

(forward-looking ideas with trigger conditions)

## memory_proposals

(auto-memory candidates; proposal-only)

## approval_log

| Proposal | Type | Decision | Date | Note |
|----------|------|----------|------|------|
| (none pending) | - | - | - | - |
`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function atomicWrite(finalPath, content, writers) {
  const dir = path.dirname(finalPath);
  const suffix = crypto.randomBytes(6).toString('hex');
  const tmpPath = path.join(dir, `.${path.basename(finalPath)}.tmp-${suffix}`);
  writers.writeFileSync(tmpPath, content, 'utf8');
  writers.renameSync(tmpPath, finalPath);
}

function resolveWriters(ctx) {
  return {
    writeFileSync: ctx.writeFileSync || fs.writeFileSync.bind(fs),
    renameSync: ctx.renameSync || fs.renameSync.bind(fs),
    mkdirSync: ctx.mkdirSync || fs.mkdirSync.bind(fs),
  };
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function toNonNegInt(n) {
  if (typeof n !== 'number') return 0;
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  return Math.floor(n);
}

function sanitizeRef(ref) {
  return String(ref).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function isIsoDateTime(s) {
  if (typeof s !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

// ─── Error classes ─────────────────────────────────────────────────────────

export class CompoundWriterPathError extends Error {
  constructor(message) { super(message); this.name = 'CompoundWriterPathError'; }
}

export class CompoundArtifactInvalidError extends Error {
  constructor(message) { super(message); this.name = 'CompoundArtifactInvalidError'; }
}

export {
  DECISIONS,
  THRESHOLD_WRITE,
  THRESHOLD_CANDIDATE,
  SCORE_SDI_OBSERVATIONAL,
  SCORE_SPEC_RULE_PRESCRIPTIVE,
  SCORE_RELEASE_EXIT,
  SCORE_MILESTONE_CLOSED,
};

// ─── Self-tests ────────────────────────────────────────────────────────────

function runSelfTests() {
  let passed = 0;
  let failed = 0;
  const tally = (name, cond) => {
    if (cond) { console.log(`  PASS  ${name}`); passed++; }
    else { console.error(`  FAIL  ${name}`); failed++; }
  };

  // ── scoreCompound tests ──────────────────────────────────────────────────

  tally('T01 empty input → score 0',
    (() => { const r = scoreCompound({}); return r.score === 0; })());

  tally('T02 null input → score 0 + input:missing',
    (() => { const r = scoreCompound(null); return r.score === 0 && r.reasons.includes('input:missing'); })());

  tally('T03 RELEASE stage_exit → +6',
    (() => { const r = scoreCompound({ stage_exit: 'RELEASE', event: {}, window: {} }); return r.score === 6; })());

  tally('T04 milestone_closed → +5',
    (() => { const r = scoreCompound({ stage_exit: 'COMPOUND', event: { milestone_closed: true }, window: {} }); return r.score === 5; })());

  tally('T05 sdi_observational_count=2 → +4',
    (() => { const r = scoreCompound({ stage_exit: 'PROCEED', event: { sdi_observational_count: 2 }, window: {} }); return r.score === 4; })());

  tally('T06 spec_rule_prescriptive_count=2 → +6',
    (() => { const r = scoreCompound({ stage_exit: 'PROCEED', event: { spec_rule_prescriptive_count: 2 }, window: {} }); return r.score === 6; })());

  tally('T07 already_codified_count=3 → -3',
    (() => { const r = scoreCompound({ stage_exit: 'PROCEED', event: { already_codified_count: 3 }, window: {} }); return r.score === -3; })());

  tally('T08 user_correction_count=2 → +1',
    (() => { const r = scoreCompound({ stage_exit: 'PROCEED', event: { user_correction_count: 2 }, window: {} }); return r.score === 1; })());

  tally('T09 user_correction_count=1 → 0 (below threshold)',
    (() => { const r = scoreCompound({ stage_exit: 'PROCEED', event: { user_correction_count: 1 }, window: {} }); return r.score === 0; })());

  tally('T10 dampener stack: docs_only + no_new_debt_gate_rollback + window_too_short → -7',
    (() => { const r = scoreCompound({ stage_exit: 'PROCEED', event: { docs_only: true, no_new_debt_gate_rollback: true, window_too_short: true }, window: {} }); return r.score === -7; })());

  tally('T11 mixed: RELEASE + CI recovered + 1 spec-rule = 11',
    (() => { const r = scoreCompound({ stage_exit: 'RELEASE', event: { ci_recovered: true, spec_rule_prescriptive_count: 1 }, window: {} }); return r.score === 11; })());

  tally('T12 determinism: 100 iterations byte-identical',
    (() => {
      const input = { stage_exit: 'PROCEED', event: { sdi_observational_count: 2, changes_required_acked: true, post_judge_fix: true, gate_red_yellow: true }, window: {} };
      const baseline = JSON.stringify(scoreCompound(input));
      for (let i = 0; i < 100; i++) {
        if (JSON.stringify(scoreCompound(input)) !== baseline) return false;
      }
      return true;
    })());

  tally('T13 non-numeric count → treated as 0',
    (() => { const r = scoreCompound({ stage_exit: 'PROCEED', event: { sdi_observational_count: 'abc' }, window: {} }); return r.score === 0; })());

  tally('T14 negative count → treated as 0',
    (() => { const r = scoreCompound({ stage_exit: 'PROCEED', event: { sdi_observational_count: -5 }, window: {} }); return r.score === 0; })());

  // ── decideCompound tests ────────────────────────────────────────────────

  tally('T15 RELEASE → DECISION_WRITE (always-on)',
    (() => { const r = decideCompound({ stage_exit: 'RELEASE', event: {}, window: {} }); return r.decision === DECISION_WRITE && r.alwaysOn === true; })());

  tally('T16 milestone_closed → DECISION_WRITE (always-on) regardless of score',
    (() => { const r = decideCompound({ stage_exit: 'BRAINSTORM', event: { milestone_closed: true, docs_only: true, window_too_short: true }, window: {} }); return r.decision === DECISION_WRITE && r.alwaysOn === true; })());

  tally('T17 score=5 not-always-on → DECISION_WRITE',
    (() => { const r = decideCompound({ stage_exit: 'PROCEED', event: { spec_rule_prescriptive_count: 1, ci_recovered: true }, window: {} }); return r.decision === DECISION_WRITE && r.alwaysOn === false; })());

  tally('T18 score=3 → DECISION_CANDIDATE',
    (() => { const r = decideCompound({ stage_exit: 'PROCEED', event: { spec_rule_prescriptive_count: 1 }, window: {} }); return r.decision === DECISION_CANDIDATE; })());

  tally('T19 score=1 → DECISION_SKIP',
    (() => { const r = decideCompound({ stage_exit: 'PROCEED', event: { gate_red_yellow: true }, window: {} }); return r.decision === DECISION_SKIP; })());

  tally('T20 score=0 → DECISION_SKIP',
    (() => { const r = decideCompound({ stage_exit: 'PROCEED', event: {}, window: {} }); return r.decision === DECISION_SKIP; })());

  // ── validateCompoundArtifact tests ───────────────────────────────────────

  const validArtifact = {
    kind: 'compound',
    version: 1,
    scope: 'release',
    ref: 'v0.12.0',
    window: { from: '2026-04-20T00:00:00.000Z', to: '2026-04-20T23:59:59.000Z' },
    status: 'proposed',
    source_evidence: [],
    sections: ['context', 'learnings', 'patterns_sdi', 'rule_promotions', 'automation', 'seeds', 'memory_proposals', 'approval_log'],
    clean_room_notice: true,
    generated_by: 'sunco-compound-router',
  };

  tally('T21 valid artifact passes',
    (() => { try { validateCompoundArtifact(validArtifact); return true; } catch (e) { return false; } })());

  tally('T22 missing kind throws',
    (() => { try { validateCompoundArtifact({ ...validArtifact, kind: 'nope' }); return false; } catch (e) { return e instanceof CompoundArtifactInvalidError; } })());

  tally('T23 wrong version throws',
    (() => { try { validateCompoundArtifact({ ...validArtifact, version: 2 }); return false; } catch (e) { return e instanceof CompoundArtifactInvalidError; } })());

  tally('T24 invalid scope throws',
    (() => { try { validateCompoundArtifact({ ...validArtifact, scope: 'bogus' }); return false; } catch (e) { return e instanceof CompoundArtifactInvalidError; } })());

  tally('T25 sections != 8 throws',
    (() => { try { validateCompoundArtifact({ ...validArtifact, sections: ['context'] }); return false; } catch (e) { return e instanceof CompoundArtifactInvalidError; } })());

  tally('T26 clean_room_notice !== true throws',
    (() => { try { validateCompoundArtifact({ ...validArtifact, clean_room_notice: false }); return false; } catch (e) { return e instanceof CompoundArtifactInvalidError; } })());

  tally('T27 generated_by wrong throws',
    (() => { try { validateCompoundArtifact({ ...validArtifact, generated_by: 'somebody-else' }); return false; } catch (e) { return e instanceof CompoundArtifactInvalidError; } })());

  tally('T28 window.from not ISO throws',
    (() => { try { validateCompoundArtifact({ ...validArtifact, window: { from: 'not-a-date', to: validArtifact.window.to } }); return false; } catch (e) { return e instanceof CompoundArtifactInvalidError; } })());

  tally('T29 duplicate section throws',
    (() => { try { validateCompoundArtifact({ ...validArtifact, sections: ['context', 'context', 'patterns_sdi', 'rule_promotions', 'automation', 'seeds', 'memory_proposals', 'approval_log'] }); return false; } catch (e) { return e instanceof CompoundArtifactInvalidError; } })());

  // ── assertInCompoundAllowlist tests ──────────────────────────────────────

  const fakeRoot = '/tmp/fake-repo-root';

  tally('T30 allowed path: .planning/compound/release-v0.12.0-20260420.md',
    (() => { try { assertInCompoundAllowlist(path.join(fakeRoot, '.planning/compound/release-v0.12.0-20260420.md'), fakeRoot); return true; } catch (e) { return false; } })());

  tally('T31 rejected: memory/ path',
    (() => { try { assertInCompoundAllowlist(path.join(fakeRoot, 'memory/foo.md'), fakeRoot); return false; } catch (e) { return e instanceof CompoundWriterPathError; } })());

  tally('T32 rejected: .claude/rules/ path',
    (() => { try { assertInCompoundAllowlist(path.join(fakeRoot, '.claude/rules/architecture.md'), fakeRoot); return false; } catch (e) { return e instanceof CompoundWriterPathError; } })());

  tally('T33 rejected: .planning/backlog/ path',
    (() => { try { assertInCompoundAllowlist(path.join(fakeRoot, '.planning/backlog/999.1.md'), fakeRoot); return false; } catch (e) { return e instanceof CompoundWriterPathError; } })());

  tally('T34 rejected: .planning/compound/subdir/foo.md (no subdirs)',
    (() => { try { assertInCompoundAllowlist(path.join(fakeRoot, '.planning/compound/subdir/foo.md'), fakeRoot); return false; } catch (e) { return e instanceof CompoundWriterPathError; } })());

  tally('T35 rejected: path outside repoRoot',
    (() => { try { assertInCompoundAllowlist('/etc/passwd', fakeRoot); return false; } catch (e) { return e instanceof CompoundWriterPathError; } })());

  tally('T36 rejected: STATE.md (repo_mutate_official hard-lock)',
    (() => { try { assertInCompoundAllowlist(path.join(fakeRoot, '.planning/STATE.md'), fakeRoot); return false; } catch (e) { return e instanceof CompoundWriterPathError; } })());

  // ── runCompound integration tests (adapter-injected IO) ─────────────────

  tally('T37 runCompound dryRun=true does not call writeFileSync',
    (() => {
      let writeCount = 0;
      const ctx = {
        repoRoot: fakeRoot,
        input: { stage_exit: 'RELEASE', event: {}, window: {} },
        scope: 'release',
        ref: 'v0.12.0',
        window: { from: '2026-04-20T00:00:00Z', to: '2026-04-20T23:59:59Z' },
        dryRun: true,
        writeFileSync: () => { writeCount++; },
        renameSync: () => {},
        mkdirSync: () => {},
        now: new Date('2026-04-20T12:00:00Z'),
      };
      const r = runCompound(ctx);
      return r.decision === DECISION_WRITE && r.artifactPath === null && writeCount === 0;
    })());

  tally('T38 runCompound write path uses allowlist pattern',
    (() => {
      const calls = [];
      const ctx = {
        repoRoot: fakeRoot,
        input: { stage_exit: 'RELEASE', event: {}, window: {} },
        scope: 'release',
        ref: 'v0.12.0',
        window: { from: '2026-04-20T00:00:00Z', to: '2026-04-20T23:59:59Z' },
        writeFileSync: (p, c) => calls.push(['write', p]),
        renameSync: (src, dst) => calls.push(['rename', src, dst]),
        mkdirSync: () => {},
        now: new Date('2026-04-20T12:00:00Z'),
      };
      const r = runCompound(ctx);
      return r.artifactPath && r.artifactPath.endsWith('.planning/compound/release-v0.12.0-20260420.md')
        && calls.some(([op]) => op === 'write')
        && calls.some(([op]) => op === 'rename');
    })());

  tally('T39 runCompound skip decision returns null artifactPath',
    (() => {
      const ctx = {
        repoRoot: fakeRoot,
        input: { stage_exit: 'PROCEED', event: {}, window: {} },
        writeFileSync: () => {},
        renameSync: () => {},
        mkdirSync: () => {},
      };
      const r = runCompound(ctx);
      return r.decision === DECISION_SKIP && r.artifactPath === null;
    })());

  tally('T40 runCompound atomic write: tmp path in same dir',
    (() => {
      const tmpPaths = [];
      const ctx = {
        repoRoot: fakeRoot,
        input: { stage_exit: 'RELEASE', event: {}, window: {} },
        scope: 'release',
        ref: 'v0.12.0',
        window: { from: '2026-04-20T00:00:00Z', to: '2026-04-20T23:59:59Z' },
        writeFileSync: (p) => tmpPaths.push(p),
        renameSync: () => {},
        mkdirSync: () => {},
        now: new Date('2026-04-20T12:00:00Z'),
      };
      runCompound(ctx);
      return tmpPaths.length === 1 && tmpPaths[0].includes('.tmp-') && path.dirname(tmpPaths[0]).endsWith('.planning/compound');
    })());

  tally('T41 runCompound schema-scope missing for write throws',
    (() => {
      try {
        runCompound({
          repoRoot: fakeRoot,
          input: { stage_exit: 'RELEASE', event: {}, window: {} },
          writeFileSync: () => {}, renameSync: () => {}, mkdirSync: () => {},
        });
        return false;
      } catch (e) {
        return e instanceof CompoundWriterPathError;
      }
    })());

  tally('T42 runCompound sanitizes ref',
    (() => {
      let written = '';
      const ctx = {
        repoRoot: fakeRoot,
        input: { stage_exit: 'RELEASE', event: {}, window: {} },
        scope: 'release',
        ref: 'v0.12.0 with spaces/slashes!',
        window: { from: '2026-04-20T00:00:00Z', to: '2026-04-20T23:59:59Z' },
        writeFileSync: (p) => { written = p; },
        renameSync: () => {}, mkdirSync: () => {},
        now: new Date('2026-04-20T12:00:00Z'),
      };
      const r = runCompound(ctx);
      return r.artifactPath && !r.artifactPath.includes(' ') && !r.artifactPath.includes('/v0.12.0 ') && !r.artifactPath.includes('!');
    })());

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

if (process.argv.includes('--test') && import.meta.url === `file://${process.argv[1]}`) {
  runSelfTests();
}
