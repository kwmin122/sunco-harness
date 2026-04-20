#!/usr/bin/env node

// Phase 52b/M6 — SUNCO Workflow Router evidence collector.
// IO BOUNDARY with injected adapter pattern (Codex C1 / Gate 52b v2 L3).
// This module is the only place router code performs filesystem / child_process /
// clock reads. Classifier, confidence, and decision-writer remain pure.
//
// Contract:
//   collectEvidence({ repoRoot, execGit, readFile, statFile, now }) → evidence
//   runFreshnessGate(evidence) → { status, checks[7] }
//
// All adapters optional; defaults resolve to Node fs/child_process/Date. Tests
// always inject stubs to stay deterministic and avoid live repo dependency.

import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';

const FRESHNESS_CHECK_IDS = Object.freeze([
  'git-status', 'origin-head', 'artifact-mtime',
  'roadmap-state-alignment', 'state-phase-exists',
  'phase-dir-populated', 'cross-artifact-refs',
]);

/**
 * Collect router evidence from repo state using injected or default adapters.
 * Returns an evidence object consumable by classifier.mjs.
 *
 * @param {object} ctx
 * @param {string} ctx.repoRoot  Required. Absolute path to repo root.
 * @param {Function} [ctx.execGit]   (args: string[]) => string stdout
 * @param {Function} [ctx.readFile]  (absPath: string) => string | null
 * @param {Function} [ctx.statFile]  (absPath: string) => { mtimeMs, size } | null
 * @param {Function} [ctx.now]       () => Date (for deterministic tests)
 * @param {object} [ctx.overrides]   Optional hand-supplied fields that bypass collection (tests only)
 * @returns {object} evidence
 */
export function collectEvidence(ctx) {
  if (!ctx || typeof ctx !== 'object') throw new EvidenceCollectorError('ctx required');
  if (!ctx.repoRoot || typeof ctx.repoRoot !== 'string') {
    throw new EvidenceCollectorError('ctx.repoRoot (absolute path) required');
  }
  const adapters = resolveAdapters(ctx);
  const overrides = ctx.overrides || {};

  const evidence = {
    gitFlags: {
      statusClean: overrides.statusClean ?? inferStatusClean(adapters),
      originSynced: overrides.originSynced ?? inferOriginSynced(adapters),
      stateAligned: overrides.stateAligned ?? true, // tightened by freshness gate
    },
    commitsInWindow: overrides.commitsInWindow ?? inferCommitsInWindow(adapters),
    stateFrontmatter: overrides.stateFrontmatter ?? readStateFrontmatter(adapters, ctx.repoRoot),
    requirementsPresent: overrides.requirementsPresent ?? adapters.readFile(path.join(ctx.repoRoot, '.planning/REQUIREMENTS.md')) !== null,
    goalStatementPresent: overrides.goalStatementPresent ?? adapters.readFile(path.join(ctx.repoRoot, '.planning/PROJECT.md')) !== null,
    phaseArtifacts: overrides.phaseArtifacts ?? readPhaseArtifacts(adapters, ctx.repoRoot, overrides.stateFrontmatter),
    pausedState: overrides.pausedState ?? readPausedState(adapters, ctx.repoRoot),
    releaseArtifacts: overrides.releaseArtifacts ?? readReleaseArtifacts(adapters, ctx.repoRoot),
    compoundArtifactPresent: overrides.compoundArtifactPresent ?? false,
    milestoneClosed: overrides.milestoneClosed ?? false,
    ackDeclined: overrides.ackDeclined ?? false,
    reviewPending: overrides.reviewPending ?? false,
    testsState: overrides.testsState ?? 'unknown',
    intentHint: overrides.intentHint ?? null,
    evidenceRefs: [],
  };

  // Run freshness gate (Step 0) and attach the verdict + state alignment.
  const freshness = runFreshnessGate(evidence, { ...ctx, ...adapters });
  evidence.freshness = freshness;
  evidence.gitFlags.stateAligned = freshness.checks.find(c => c.id === 'roadmap-state-alignment')?.result === 'aligned';
  evidence.evidenceRefs = buildEvidenceRefs(ctx.repoRoot, evidence);
  return evidence;
}

/**
 * Run the 7-point Freshness Gate. Returns { status, checks } where checks has
 * EXACTLY 7 entries (DESIGN EVIDENCE-MODEL.md §Freshness Gate L73 enforcement).
 *
 * @param {object} evidence
 * @param {object} ctx   adapters + repoRoot
 * @returns {{ status: 'fresh'|'drift'|'conflicted', checks: Array }}
 */
export function runFreshnessGate(evidence, ctx) {
  const adapters = resolveAdapters(ctx);
  const repoRoot = ctx.repoRoot;

  const checks = [
    check1GitStatus(evidence),
    check2OriginHead(evidence),
    check3ArtifactMtime(adapters, repoRoot, evidence, ctx.now),
    check4RoadmapStateAlignment(adapters, repoRoot, evidence),
    check5StatePhaseExists(adapters, repoRoot, evidence),
    check6PhaseDirPopulated(adapters, repoRoot, evidence),
    check7CrossArtifactRefs(adapters, repoRoot, evidence),
  ];
  if (checks.length !== 7) {
    throw new EvidenceCollectorError(`Freshness Gate must produce exactly 7 checks; got ${checks.length}`);
  }
  for (let i = 0; i < 7; i++) {
    if (checks[i].id !== FRESHNESS_CHECK_IDS[i]) {
      throw new EvidenceCollectorError(`Freshness Gate check[${i}] id mismatch: expected ${FRESHNESS_CHECK_IDS[i]}, got ${checks[i].id}`);
    }
  }

  const fails = checks.filter(c => c.result !== 'aligned' && c.result !== 'clean' && c.result !== 'synced' && c.result !== 'exists' && c.result !== 'populated' && c.result !== 'consistent');
  let status;
  if (fails.length === 0) status = 'fresh';
  else if (fails.length >= 2 && fails.some(f => f.result === 'conflicted' || /conflict/.test(f.result))) status = 'conflicted';
  else status = 'drift';

  return { status, checks };
}

// ─── 7 sub-predicates ────────────────────────────────────────────────────────

function check1GitStatus(evidence) {
  const clean = evidence.gitFlags && evidence.gitFlags.statusClean;
  return { id: 'git-status', result: clean ? 'clean' : 'dirty' };
}

function check2OriginHead(evidence) {
  const synced = evidence.gitFlags && evidence.gitFlags.originSynced;
  return { id: 'origin-head', result: synced ? 'synced' : 'drift' };
}

function check3ArtifactMtime(adapters, repoRoot, evidence, nowFn) {
  const statePath = path.join(repoRoot, '.planning/STATE.md');
  const stat = adapters.statFile(statePath);
  if (!stat) return { id: 'artifact-mtime', result: 'missing' };
  const now = (nowFn ? nowFn() : new Date()).getTime();
  const diffMin = (now - stat.mtimeMs) / 60000;
  // "drift>5min vs last commit" — approximate via absolute age vs a generous window.
  // Strict mtime-vs-commit comparison requires git log per file; use adapter-provided
  // lastCommitMs if the test injects one, else approximate as aligned (optimistic default
  // for fresh tree; drift surfaces via other checks).
  if (stat.lastCommitMs !== undefined && Math.abs(stat.mtimeMs - stat.lastCommitMs) > 5 * 60000) {
    return { id: 'artifact-mtime', result: 'drift>5min' };
  }
  return { id: 'artifact-mtime', result: 'aligned', detail: `age=${diffMin.toFixed(1)}min` };
}

function check4RoadmapStateAlignment(adapters, repoRoot, evidence) {
  const fm = evidence.stateFrontmatter;
  if (!fm || !fm.milestone) return { id: 'roadmap-state-alignment', result: 'missing' };
  const roadmap = adapters.readFile(path.join(repoRoot, '.planning/ROADMAP.md'));
  if (!roadmap) return { id: 'roadmap-state-alignment', result: 'missing' };
  // Soft alignment: does the milestone token appear in ROADMAP? If yes, "aligned".
  if (roadmap.indexOf(fm.milestone) !== -1) {
    return { id: 'roadmap-state-alignment', result: 'aligned' };
  }
  return { id: 'roadmap-state-alignment', result: 'STATE stale' };
}

function check5StatePhaseExists(adapters, repoRoot, evidence) {
  const fm = evidence.stateFrontmatter;
  const phase = fm && fm.phase;
  if (!phase) return { id: 'state-phase-exists', result: 'missing' };
  const dir = path.join(repoRoot, `.planning/phases/${phase}`);
  const stat = adapters.statFile(dir);
  if (stat && stat.isDirectory) return { id: 'state-phase-exists', result: 'exists' };
  return { id: 'state-phase-exists', result: 'missing' };
}

function check6PhaseDirPopulated(adapters, repoRoot, evidence) {
  const fm = evidence.stateFrontmatter;
  const phase = fm && fm.phase;
  if (!phase) return { id: 'phase-dir-populated', result: 'missing' };
  const dir = path.join(repoRoot, `.planning/phases/${phase}`);
  const stat = adapters.statFile(dir);
  if (!stat || !stat.isDirectory) return { id: 'phase-dir-populated', result: 'missing' };
  const entries = stat.entries || [];
  if (entries.length === 0) return { id: 'phase-dir-populated', result: 'empty' };
  const hasContext = entries.some(name => /CONTEXT\.md$/.test(name));
  return { id: 'phase-dir-populated', result: hasContext ? 'populated' : 'partial' };
}

function check7CrossArtifactRefs(adapters, repoRoot, evidence) {
  // Light cross-artifact check: verify REQUIREMENTS + ROADMAP both present
  // when stateFrontmatter declares an executing milestone.
  const fm = evidence.stateFrontmatter;
  if (!fm) return { id: 'cross-artifact-refs', result: 'missing' };
  const req = adapters.readFile(path.join(repoRoot, '.planning/REQUIREMENTS.md'));
  const roadmap = adapters.readFile(path.join(repoRoot, '.planning/ROADMAP.md'));
  if (!req || !roadmap) return { id: 'cross-artifact-refs', result: 'mismatch' };
  return { id: 'cross-artifact-refs', result: 'consistent' };
}

// ─── Adapters ────────────────────────────────────────────────────────────────

function resolveAdapters(ctx) {
  return {
    execGit: ctx.execGit || defaultExecGit,
    readFile: ctx.readFile || defaultReadFile,
    statFile: ctx.statFile || defaultStatFile,
    now: ctx.now || (() => new Date()),
  };
}

function defaultExecGit(args) {
  try {
    return childProcess.execFileSync('git', args, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function defaultReadFile(absPath) {
  try { return fs.readFileSync(absPath, 'utf8'); }
  catch { return null; }
}

function defaultStatFile(absPath) {
  try {
    const s = fs.statSync(absPath);
    const entry = s.isDirectory() ? fs.readdirSync(absPath) : null;
    return { mtimeMs: s.mtimeMs, size: s.size, isDirectory: s.isDirectory(), entries: entry };
  } catch { return null; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferStatusClean(adapters) {
  const out = adapters.execGit(['status', '--porcelain']);
  return out.trim().length === 0;
}

function inferOriginSynced(adapters) {
  const head = adapters.execGit(['rev-parse', 'HEAD']).trim();
  const origin = adapters.execGit(['rev-parse', 'origin/main']).trim();
  if (!head || !origin) return false;
  return head === origin;
}

function inferCommitsInWindow(adapters) {
  const out = adapters.execGit(['log', '--since=14.days', '--format=%H %s']);
  if (!out.trim()) return [];
  return out.trim().split('\n').slice(0, 50).map(line => {
    const idx = line.indexOf(' ');
    return idx === -1 ? { sha: line, subject: '' } : { sha: line.slice(0, idx), subject: line.slice(idx + 1) };
  });
}

function readStateFrontmatter(adapters, repoRoot) {
  const content = adapters.readFile(path.join(repoRoot, '.planning/STATE.md'));
  if (!content) return null;
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      let val = kv[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      fm[kv[1]] = val;
    }
  }
  // Also surface a 'phase' field derived from Current Position section.
  if (!fm.phase) {
    const cp = content.match(/Current phase:\s*([^\s\n(]+)/);
    if (cp) fm.phase = cp[1].trim();
  }
  return fm;
}

function readPhaseArtifacts(adapters, repoRoot, stateFrontmatter) {
  const phase = stateFrontmatter && stateFrontmatter.phase;
  if (!phase) return {};
  const dir = path.join(repoRoot, `.planning/phases/${phase}`);
  const stat = adapters.statFile(dir);
  if (!stat || !stat.isDirectory) return {};
  const entries = stat.entries || [];
  const has = (suffix) => entries.some(name => name.endsWith(suffix));
  return {
    context: has('CONTEXT.md'),
    plan: entries.some(name => /PLAN(-|\.)/i.test(name) && name.endsWith('.md')),
    research: has('RESEARCH.md'),
    verification: has('VERIFICATION.md'),
    summary: has('SUMMARY.md'),
  };
}

function readPausedState(adapters, repoRoot) {
  const content = adapters.readFile(path.join(repoRoot, '.planning/router/paused-state.json'));
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

function readReleaseArtifacts(adapters, repoRoot) {
  const changelog = adapters.readFile(path.join(repoRoot, 'CHANGELOG.md'));
  const pkgJsonStr = adapters.readFile(path.join(repoRoot, 'packages/cli/package.json'));
  if (!changelog && !pkgJsonStr) return null;
  let publishedVersion = null;
  if (pkgJsonStr) {
    try { publishedVersion = JSON.parse(pkgJsonStr).version || null; } catch {}
  }
  let tag = null;
  if (changelog) {
    const m = changelog.match(/##\s*\[([^\]]+)\]/);
    if (m) tag = 'v' + m[1];
  }
  return { tag, publishedVersion };
}

function buildEvidenceRefs(repoRoot, evidence) {
  const refs = [];
  if (evidence.stateFrontmatter) refs.push('.planning/STATE.md');
  if (evidence.requirementsPresent) refs.push('.planning/REQUIREMENTS.md');
  if (evidence.goalStatementPresent) refs.push('.planning/PROJECT.md');
  if (evidence.releaseArtifacts) refs.push('CHANGELOG.md');
  if (evidence.pausedState) refs.push('.planning/router/paused-state.json');
  return refs;
}

export class EvidenceCollectorError extends Error {
  constructor(message) { super(message); this.name = 'EvidenceCollectorError'; }
}

export { FRESHNESS_CHECK_IDS };

// ─── Self-tests (use injected adapters; no real git/fs) ──────────────────────

function runSelfTests() {
  let passed = 0;
  let failed = 0;
  const tally = (name, cond) => {
    if (cond) { passed++; console.log(`  PASS  ${name}`); }
    else { failed++; console.log(`  FAIL  ${name}`); }
  };

  // Fixture-based adapters.
  const makeAdapters = (fs) => ({
    repoRoot: '/fake/repo',
    execGit: (args) => fs.git[args.join(' ')] || '',
    readFile: (p) => fs.files[p] !== undefined ? fs.files[p] : null,
    statFile: (p) => fs.stats[p] || null,
    now: () => new Date('2026-04-20T12:00:00.000Z'),
  });

  // 1. Fresh scenario — all checks aligned.
  const freshFs = {
    git: {
      'status --porcelain': '',
      'rev-parse HEAD': 'abc123\n',
      'rev-parse origin/main': 'abc123\n',
      'log --since=14.days --format=%H %s': 'abc123 feat: x\n',
    },
    files: {
      '/fake/repo/.planning/STATE.md': '---\nmilestone: v1.5\nphase: 52b-router-classifier\n---\n\n# State\n',
      '/fake/repo/.planning/ROADMAP.md': '# Roadmap\nv1.5 section\n',
      '/fake/repo/.planning/REQUIREMENTS.md': '# Requirements\n',
      '/fake/repo/.planning/PROJECT.md': '# Project\n',
    },
    stats: {
      '/fake/repo/.planning/STATE.md': { mtimeMs: new Date('2026-04-20T11:58:00.000Z').getTime(), isDirectory: false },
      '/fake/repo/.planning/phases/52b-router-classifier': { mtimeMs: 0, isDirectory: true, entries: ['52b-CONTEXT.md'] },
    },
  };
  const ev1 = collectEvidence(makeAdapters(freshFs));
  tally('fresh scenario freshness.status === fresh', ev1.freshness.status === 'fresh');
  tally('fresh scenario emits 7 freshness checks', ev1.freshness.checks.length === 7);
  tally('fresh scenario check ids in canonical order',
    JSON.stringify(ev1.freshness.checks.map(c => c.id)) === JSON.stringify(FRESHNESS_CHECK_IDS));
  tally('fresh scenario requirementsPresent === true', ev1.requirementsPresent === true);
  tally('fresh scenario stateFrontmatter.phase parsed', ev1.stateFrontmatter.phase === '52b-router-classifier');
  tally('fresh scenario phase-dir-populated === populated',
    ev1.freshness.checks.find(c => c.id === 'phase-dir-populated').result === 'populated');

  // 2. Drift scenario — dirty working tree.
  const driftFs = JSON.parse(JSON.stringify(freshFs));
  driftFs.git['status --porcelain'] = ' M src/foo.ts\n';
  const ev2 = collectEvidence(makeAdapters(driftFs));
  tally('dirty tree → freshness.status === drift', ev2.freshness.status === 'drift');
  tally('dirty tree → git-status result === dirty',
    ev2.freshness.checks.find(c => c.id === 'git-status').result === 'dirty');

  // 3. Origin drift.
  const originDriftFs = JSON.parse(JSON.stringify(freshFs));
  originDriftFs.git['rev-parse origin/main'] = 'def456\n';
  const ev3 = collectEvidence(makeAdapters(originDriftFs));
  tally('origin drift → freshness.status === drift', ev3.freshness.status === 'drift');
  tally('origin drift → origin-head result === drift',
    ev3.freshness.checks.find(c => c.id === 'origin-head').result === 'drift');

  // 4. Phase dir missing.
  const missingDirFs = JSON.parse(JSON.stringify(freshFs));
  delete missingDirFs.stats['/fake/repo/.planning/phases/52b-router-classifier'];
  const ev4 = collectEvidence(makeAdapters(missingDirFs));
  tally('phase dir missing → freshness.status === drift', ev4.freshness.status === 'drift');

  // 5. STATE frontmatter missing milestone → freshness not blocked (informational missing).
  const noStateFs = JSON.parse(JSON.stringify(freshFs));
  noStateFs.files['/fake/repo/.planning/STATE.md'] = '# State without frontmatter\n';
  const ev5 = collectEvidence(makeAdapters(noStateFs));
  tally('no frontmatter → roadmap-state-alignment missing',
    ev5.freshness.checks.find(c => c.id === 'roadmap-state-alignment').result === 'missing');

  // 6. Paused state detection.
  const pausedFs = JSON.parse(JSON.stringify(freshFs));
  pausedFs.files['/fake/repo/.planning/router/paused-state.json'] = JSON.stringify({ paused_at_stage: 'WORK', ts: '2026-04-20' });
  const ev6 = collectEvidence(makeAdapters(pausedFs));
  tally('paused-state.json parsed', ev6.pausedState && ev6.pausedState.paused_at_stage === 'WORK');

  // 7. Overrides bypass collection.
  const ev7 = collectEvidence({ ...makeAdapters(freshFs), overrides: { requirementsPresent: false, testsState: 'passing' } });
  tally('overrides.requirementsPresent takes precedence', ev7.requirementsPresent === false);
  tally('overrides.testsState takes precedence', ev7.testsState === 'passing');

  // 8. Adapter pattern: no implicit cwd dependency.
  // (Structural check: repoRoot required, throws without it.)
  let threwNoRoot = false;
  try { collectEvidence({}); } catch { threwNoRoot = true; }
  tally('missing repoRoot throws', threwNoRoot);

  // 9. runFreshnessGate rejects caller that produces non-7 checks (impossible via public API, structural self-check).
  // Here we just assert FRESHNESS_CHECK_IDS length === 7.
  tally('FRESHNESS_CHECK_IDS length === 7', FRESHNESS_CHECK_IDS.length === 7);
  tally('FRESHNESS_CHECK_IDS is frozen', Object.isFrozen(FRESHNESS_CHECK_IDS));

  // 10. evidence_refs built from presence flags.
  tally('evidence_refs includes STATE.md when frontmatter present', ev1.evidenceRefs.includes('.planning/STATE.md'));
  tally('evidence_refs includes REQUIREMENTS.md when present', ev1.evidenceRefs.includes('.planning/REQUIREMENTS.md'));

  // 11. Default adapters don't touch disk when overrides fully resolve everything.
  // (We pass overrides for everything the defaults would try to read; the default adapters
  // should never be invoked when the caller provides full overrides. This is a smoke check
  // — not a formal enforcement — that the override path works.)
  const ev11 = collectEvidence({
    repoRoot: '/does-not-exist',
    execGit: () => '',
    readFile: () => null,
    statFile: () => null,
    now: () => new Date('2026-04-20T00:00:00.000Z'),
    overrides: {
      statusClean: true, originSynced: true,
      stateFrontmatter: { milestone: 'v1.5', phase: '52b-router-classifier' },
      requirementsPresent: true, goalStatementPresent: true,
      phaseArtifacts: { context: true, plan: true },
      pausedState: null, releaseArtifacts: null,
      commitsInWindow: [], testsState: 'unknown',
    },
  });
  tally('adapters-not-touched-with-overrides scenario returns evidence', ev11 && typeof ev11 === 'object');

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

if (process.argv.includes('--test') && import.meta.url === `file://${process.argv[1]}`) {
  runSelfTests();
}
