#!/usr/bin/env node

// Phase 52b/M6 — SUNCO Workflow Router decision writer.
// Writes RouteDecision objects to ephemeral tier (always) and durable tier
// (when promotion criteria per DESIGN-v1.md §4.2 are satisfied). Enforces
// path allowlist (Codex C5 / Gate 52b v2 L6) and atomic tmp-in-same-dir
// rename pattern (L5).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Promotion criteria IDs for deterministic testing.
const PROMOTE_RELEASE_OR_COMPOUND = 'promote:release-or-compound';
const PROMOTE_MILESTONE_CLOSED = 'promote:milestone-closed';
const PROMOTE_CONFLICTED = 'promote:conflicted';
const PROMOTE_FIRST_IN_PHASE = 'promote:first-in-phase';
const PROMOTE_EXPLICIT = 'promote:explicit-durable';

const PROMOTE_REASONS = Object.freeze([
  PROMOTE_RELEASE_OR_COMPOUND,
  PROMOTE_MILESTONE_CLOSED,
  PROMOTE_CONFLICTED,
  PROMOTE_FIRST_IN_PHASE,
  PROMOTE_EXPLICIT,
]);

/**
 * Deterministic promotion rule per DESIGN-v1.md §4.2 (5 criteria, any-match).
 * Pure function (no IO). Returns `{ promote: boolean, reasons: string[] }`.
 *
 * @param {object} decision  RouteDecision
 * @param {object} [ctx]     Optional { explicitDurable, firstInPhase, milestoneClosed }
 * @returns {{ promote: boolean, reasons: string[] }}
 */
export function shouldPromote(decision, ctx) {
  const reasons = [];
  const c = ctx || {};
  if (decision.current_stage === 'RELEASE' || decision.current_stage === 'COMPOUND') {
    reasons.push(PROMOTE_RELEASE_OR_COMPOUND);
  }
  if (c.milestoneClosed === true) reasons.push(PROMOTE_MILESTONE_CLOSED);
  if (decision.freshness && decision.freshness.status === 'conflicted') {
    reasons.push(PROMOTE_CONFLICTED);
  }
  if (c.firstInPhase === true) reasons.push(PROMOTE_FIRST_IN_PHASE);
  if (c.explicitDurable === true) reasons.push(PROMOTE_EXPLICIT);
  return { promote: reasons.length > 0, reasons };
}

/**
 * Write a RouteDecision to the ephemeral tier (always) + the durable tier
 * (if shouldPromote returns true). Both writes use atomic tmp-in-same-dir
 * rename. Throws `RouterWriterPathError` if either target path falls outside
 * the allowlist.
 *
 * @param {object} decision  RouteDecision
 * @param {object} ctx
 *   {string} repoRoot
 *   {Date}   [now]
 *   {Function} [writeFileSync]
 *   {Function} [renameSync]
 *   {Function} [mkdirSync]
 *   {object} [promotionCtx]  (firstInPhase, milestoneClosed, explicitDurable)
 * @returns {{ ephemeralPath: string, durablePath: string|null, promoted: boolean, reasons: string[] }}
 */
export function writeDecision(decision, ctx) {
  if (!decision || typeof decision !== 'object') throw new RouterWriterPathError('decision required');
  if (!ctx || !ctx.repoRoot) throw new RouterWriterPathError('ctx.repoRoot required');
  const writers = resolveWriters(ctx);
  const now = (ctx.now || new Date());
  const stage = decision.current_stage || 'UNKNOWN';
  const ts = formatTs(now);

  const ephemeralDir = path.join(ctx.repoRoot, '.sun/router/session');
  const ephemeralFile = path.join(ephemeralDir, `${ts}-${stage}.json`);
  assertInAllowlist(ephemeralFile, ctx.repoRoot);
  writers.mkdirSync(ephemeralDir, { recursive: true });
  atomicWrite(ephemeralFile, JSON.stringify(decision, null, 2), writers);

  const { promote, reasons } = shouldPromote(decision, ctx.promotionCtx);
  let durablePath = null;
  if (promote) {
    const durableDir = path.join(ctx.repoRoot, '.planning/router/decisions');
    durablePath = path.join(durableDir, `${ts}-${stage}.json`);
    assertInAllowlist(durablePath, ctx.repoRoot);
    writers.mkdirSync(durableDir, { recursive: true });
    atomicWrite(durablePath, JSON.stringify(decision, null, 2), writers);
  }

  return {
    ephemeralPath: ephemeralFile,
    durablePath,
    promoted: promote,
    reasons,
  };
}

/**
 * Enforce the writer path allowlist. Any target path that is not one of
 * the allowed templates throws `RouterWriterPathError`.
 * Allowed paths:
 *   <repoRoot>/.sun/router/session/*.json
 *   <repoRoot>/.planning/router/decisions/*.json
 *   <repoRoot>/.planning/router/paused-state.json
 */
export function assertInAllowlist(absPath, repoRoot) {
  if (typeof absPath !== 'string' || !absPath) {
    throw new RouterWriterPathError('absPath required');
  }
  const normAbs = path.normalize(absPath);
  const normRoot = path.normalize(repoRoot);
  if (!normAbs.startsWith(normRoot)) {
    throw new RouterWriterPathError(`path outside repoRoot: ${absPath}`);
  }
  const rel = path.relative(normRoot, normAbs);
  const sessionMatch = rel.startsWith('.sun/router/session/') && rel.endsWith('.json');
  const decisionsMatch = rel.startsWith('.planning/router/decisions/') && rel.endsWith('.json');
  const pausedMatch = rel === '.planning/router/paused-state.json';
  if (!(sessionMatch || decisionsMatch || pausedMatch)) {
    throw new RouterWriterPathError(`path outside router writer allowlist: ${rel}`);
  }
}

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

function formatTs(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getUTCFullYear();
  const M = pad(date.getUTCMonth() + 1);
  const D = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const m = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}${M}${D}-${h}${m}${s}`;
}

export class RouterWriterPathError extends Error {
  constructor(message) { super(message); this.name = 'RouterWriterPathError'; }
}

export {
  PROMOTE_REASONS,
  PROMOTE_RELEASE_OR_COMPOUND,
  PROMOTE_MILESTONE_CLOSED,
  PROMOTE_CONFLICTED,
  PROMOTE_FIRST_IN_PHASE,
  PROMOTE_EXPLICIT,
};

// ─── Self-tests ──────────────────────────────────────────────────────────────

function runSelfTests() {
  let passed = 0;
  let failed = 0;
  const tally = (name, cond) => {
    if (cond) { passed++; console.log(`  PASS  ${name}`); }
    else { failed++; console.log(`  FAIL  ${name}`); }
  };

  // Stub writer that records calls without touching disk.
  const makeStubCtx = (extras) => {
    const calls = { writes: [], renames: [], mkdirs: [] };
    const ctx = {
      repoRoot: '/fake/repo',
      now: new Date('2026-04-20T12:34:56.000Z'),
      writeFileSync: (p, c, enc) => calls.writes.push({ p, c, enc }),
      renameSync: (a, b) => calls.renames.push({ from: a, to: b }),
      mkdirSync: (p, opts) => calls.mkdirs.push({ p, opts }),
      ...extras,
    };
    return { ctx, calls };
  };

  const baseDecision = {
    kind: 'route-decision', version: 1, ts: '2026-04-20T12:34:56.000Z',
    freshness: { status: 'fresh', checks: [] },
    current_stage: 'WORK', recommended_next: 'WORK', confidence: 0.9, reason: ['x'],
    preconditions: { satisfied: [], missing: [] },
    action: { command: '/sunco:execute', mode: 'requires_user_ack' },
    approval_envelope: { risk_level: 'repo_mutate', triggers_required: ['ack:repo_mutate'] },
  };

  // 1. shouldPromote pure: no criteria → not promoted.
  const r1 = shouldPromote(baseDecision);
  tally('shouldPromote(WORK, no ctx) → false', r1.promote === false && r1.reasons.length === 0);

  // 2. RELEASE stage triggers promotion.
  const r2 = shouldPromote({ ...baseDecision, current_stage: 'RELEASE' });
  tally('shouldPromote(RELEASE) → true + reason', r2.promote && r2.reasons.includes(PROMOTE_RELEASE_OR_COMPOUND));

  // 3. COMPOUND stage triggers promotion.
  const r3 = shouldPromote({ ...baseDecision, current_stage: 'COMPOUND' });
  tally('shouldPromote(COMPOUND) → true', r3.promote);

  // 4. Conflicted freshness triggers promotion (forensic trail).
  const r4 = shouldPromote({ ...baseDecision, freshness: { status: 'conflicted', checks: [] } });
  tally('shouldPromote(conflicted freshness) → true', r4.promote && r4.reasons.includes(PROMOTE_CONFLICTED));

  // 5. Milestone-closed triggers promotion.
  const r5 = shouldPromote(baseDecision, { milestoneClosed: true });
  tally('shouldPromote(milestoneClosed) → true', r5.promote && r5.reasons.includes(PROMOTE_MILESTONE_CLOSED));

  // 6. First-in-phase triggers promotion.
  const r6 = shouldPromote(baseDecision, { firstInPhase: true });
  tally('shouldPromote(firstInPhase) → true', r6.promote && r6.reasons.includes(PROMOTE_FIRST_IN_PHASE));

  // 7. Explicit-durable triggers promotion.
  const r7 = shouldPromote(baseDecision, { explicitDurable: true });
  tally('shouldPromote(explicitDurable) → true', r7.promote && r7.reasons.includes(PROMOTE_EXPLICIT));

  // 8. Determinism: same inputs produce same reasons 100 iterations.
  let allMatch = true;
  const expectedReasons = shouldPromote(baseDecision, { firstInPhase: true, explicitDurable: true }).reasons;
  for (let i = 0; i < 100; i++) {
    const got = shouldPromote(baseDecision, { firstInPhase: true, explicitDurable: true }).reasons;
    if (JSON.stringify(got) !== JSON.stringify(expectedReasons)) { allMatch = false; break; }
  }
  tally('shouldPromote deterministic over 100 iterations', allMatch);

  // 9. writeDecision ephemeral path only (no promotion).
  const { ctx: ctx9, calls: calls9 } = makeStubCtx();
  const w9 = writeDecision(baseDecision, ctx9);
  tally('writeDecision ephemeral path matches allowlist',
    w9.ephemeralPath.includes('.sun/router/session/') && w9.ephemeralPath.endsWith('-WORK.json'));
  tally('writeDecision non-promoted → durablePath null', w9.durablePath === null);
  tally('writeDecision promoted === false', w9.promoted === false);
  tally('writeDecision tmp-in-same-dir rename pattern',
    calls9.writes.length === 1
    && calls9.renames.length === 1
    && path.dirname(calls9.writes[0].p) === path.dirname(calls9.renames[0].to));
  tally('writeDecision tmp path is hidden dotfile + .tmp- suffix',
    /\/\.[^/]+\.tmp-[0-9a-f]{12}$/.test(calls9.writes[0].p));

  // 10. writeDecision promoted → dual-write (ephemeral + durable).
  const { ctx: ctx10, calls: calls10 } = makeStubCtx();
  const w10 = writeDecision({ ...baseDecision, current_stage: 'RELEASE' }, ctx10);
  tally('writeDecision RELEASE promoted === true', w10.promoted === true);
  tally('writeDecision RELEASE durablePath under .planning/router/decisions/',
    w10.durablePath && w10.durablePath.includes('.planning/router/decisions/'));
  tally('writeDecision RELEASE dual-write emits 2 renames', calls10.renames.length === 2);
  tally('writeDecision RELEASE dual-write emits 2 writes', calls10.writes.length === 2);

  // 11. Path allowlist enforcement.
  let rejectedSTATE = false;
  try { assertInAllowlist('/fake/repo/.planning/STATE.md', '/fake/repo'); }
  catch { rejectedSTATE = true; }
  tally('allowlist rejects STATE.md', rejectedSTATE);

  let rejectedROADMAP = false;
  try { assertInAllowlist('/fake/repo/.planning/ROADMAP.md', '/fake/repo'); }
  catch { rejectedROADMAP = true; }
  tally('allowlist rejects ROADMAP.md', rejectedROADMAP);

  let rejectedContext = false;
  try { assertInAllowlist('/fake/repo/.planning/phases/52b-router/52b-CONTEXT.md', '/fake/repo'); }
  catch { rejectedContext = true; }
  tally('allowlist rejects phase CONTEXT.md', rejectedContext);

  let rejectedOutsideRepo = false;
  try { assertInAllowlist('/etc/passwd', '/fake/repo'); }
  catch { rejectedOutsideRepo = true; }
  tally('allowlist rejects path outside repoRoot', rejectedOutsideRepo);

  let acceptedSession = true;
  try { assertInAllowlist('/fake/repo/.sun/router/session/20260420-123456-WORK.json', '/fake/repo'); }
  catch { acceptedSession = false; }
  tally('allowlist accepts ephemeral session path', acceptedSession);

  let acceptedDurable = true;
  try { assertInAllowlist('/fake/repo/.planning/router/decisions/20260420-123456-WORK.json', '/fake/repo'); }
  catch { acceptedDurable = false; }
  tally('allowlist accepts durable decisions path', acceptedDurable);

  let acceptedPaused = true;
  try { assertInAllowlist('/fake/repo/.planning/router/paused-state.json', '/fake/repo'); }
  catch { acceptedPaused = false; }
  tally('allowlist accepts paused-state.json', acceptedPaused);

  // 12. Y1 class-definition classifier: 10 file paths (5 in-class, 5 exception) per
  // APPROVAL-BOUNDARY.md §repo_mutate_official definitional class.
  const Y1_IN_CLASS = [
    '.planning/ROADMAP.md',
    '.planning/phases/52b-router/52b-CONTEXT.md',
    '.planning/phases/52b-router/52b-PLAN-01.md',
    '.planning/STATE.md',
    '.planning/REQUIREMENTS.md',
  ];
  const Y1_EXCEPTION = [
    '.planning/router/decisions/20260420-123456-WORK.json',
    '.planning/router/paused-state.json',
    '.planning/router/archive/old.json',
    '.sun/router/session/20260420-120000-WORK.json',
    '.sun/forensics/report.md',
  ];
  // In-class files must be REJECTED by writer allowlist (router never writes them).
  let inClassAllRejected = true;
  for (const p of Y1_IN_CLASS) {
    let rejected = false;
    try { assertInAllowlist(path.join('/fake/repo', p), '/fake/repo'); }
    catch { rejected = true; }
    if (!rejected) { inClassAllRejected = false; break; }
  }
  tally('Y1: 5 in-class files all rejected by writer allowlist', inClassAllRejected);

  // Exception files under router allowlist must be ACCEPTED when they match the session/decisions/paused patterns;
  // archive/ and .sun/forensics/ are out-of-router-scope and should be rejected (router writer class is narrower).
  let durableSessionAccepted = true;
  try { assertInAllowlist('/fake/repo/.planning/router/decisions/20260420-123456-WORK.json', '/fake/repo'); }
  catch { durableSessionAccepted = false; }
  tally('Y1 exception: decisions/*.json accepted', durableSessionAccepted);

  let ephemeralSessionAccepted = true;
  try { assertInAllowlist('/fake/repo/.sun/router/session/20260420-120000-WORK.json', '/fake/repo'); }
  catch { ephemeralSessionAccepted = false; }
  tally('Y1 exception: ephemeral session/*.json accepted', ephemeralSessionAccepted);

  // archive/ is read_only post-move-in (not a writer target); router writer rejects.
  let archiveRejected = false;
  try { assertInAllowlist('/fake/repo/.planning/router/archive/old.json', '/fake/repo'); }
  catch { archiveRejected = true; }
  tally('Y1 exception: archive/ rejected by writer (read_only)', archiveRejected);

  // 13. writeDecision throws if decision object is missing.
  let threwNoDecision = false;
  try { writeDecision(null, { repoRoot: '/fake/repo' }); } catch { threwNoDecision = true; }
  tally('writeDecision throws on null decision', threwNoDecision);

  // 14. writeDecision throws if repoRoot missing.
  let threwNoRoot = false;
  try { writeDecision(baseDecision, {}); } catch { threwNoRoot = true; }
  tally('writeDecision throws on missing repoRoot', threwNoRoot);

  // 15. shouldPromote returns frozen reason token.
  tally('PROMOTE_REASONS is frozen', Object.isFrozen(PROMOTE_REASONS));
  tally('PROMOTE_REASONS count === 5', PROMOTE_REASONS.length === 5);

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

if (process.argv.includes('--test') && import.meta.url === `file://${process.argv[1]}`) {
  runSelfTests();
}
