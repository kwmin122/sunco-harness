#!/usr/bin/env node

// Detector Adapter — SUNCO wrapper over Impeccable's detect-antipatterns.
//
// Phase 38/M2.1 scope: contract skeleton (normalizeFindings + DetectorUnavailableError).
// Phase 41/M2.4 scope: full runtime integration — runDetector + writeAuditReport
//                      + category→severity translation. Severity + file:line + message
//                      only (R6 boundary). Finding-lifecycle state (open/resolved/
//                      dismissed) is Phase 48/M4 scope and is intentionally NOT
//                      handled here.
//
// Wrapper-not-patch (spec R5): the vendored detector at ../src/detect-antipatterns.mjs
// is imported read-only for its ANTIPATTERNS metadata. Its source is never modified.
// All translation, severity derivation, filtering, and output formatting live here.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as nodePath from 'node:path';
import * as nodeFs from 'node:fs';
import { ANTIPATTERNS } from '../src/detect-antipatterns.mjs';

const DETECTOR_PATH = fileURLToPath(new URL('../src/detect-antipatterns.mjs', import.meta.url));

// Gate 41 A3 — conservative target resolution. Never scan SUNCO's own planning
// tree or vendored references. Detector's internal SKIP_DIRS already handles
// node_modules / .git / build output; these are the SUNCO-specific additions.
export const DEFAULT_EXCLUDES = Object.freeze([
  '.planning',
  'packages/cli/references/impeccable',
]);

// Category → severity. Categories live on ANTIPATTERNS metadata (not on
// individual findings), so we resolve by antipattern id at translate time.
// R6-compliant (HIGH / MEDIUM / LOW only — no state lifecycle).
const CATEGORY_TO_SEVERITY = Object.freeze({
  slop: 'HIGH',          // AI-generation tells — highest priority
  quality: 'MEDIUM',
  typography: 'MEDIUM',
  accessibility: 'MEDIUM',
  color: 'MEDIUM',
  contrast: 'MEDIUM',
  // everything else → LOW (default)
});

function categoryFor(antipatternId) {
  const ap = ANTIPATTERNS.find(a => a.id === antipatternId);
  return ap?.category || null;
}

function severityFor(antipatternId) {
  const cat = categoryFor(antipatternId);
  if (!cat) return 'LOW';
  return CATEGORY_TO_SEVERITY[String(cat).toLowerCase()] || 'LOW';
}

/**
 * Sentinel error for detector-unavailable scenarios (G8 + BS5 fallback contract).
 * `reason` is one of:
 *   'node-not-found'         — Node/npx binary missing
 *   'detector-crash'         — spawn failed or threw
 *   'detector-abnormal-exit' — exit code ∉ {0, 2}
 *   'json-parse-failed'      — output is not valid JSON array
 *   'target-not-found'       — provided path does not exist
 */
export class DetectorUnavailableError extends Error {
  constructor(reason, { cause } = {}) {
    super(`detector unavailable: ${reason}`);
    this.name = 'DetectorUnavailableError';
    this.reason = reason;
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * Translate a detector-native finding into the adapter contract shape.
 *
 * Detector shape (from vendored detect-antipatterns.mjs::finding()):
 *   { antipattern, name, description, file, line, snippet, importedBy? }
 * Adapter shape (R6: severity + file:line + message only):
 *   { severity, rule, file, line, message }
 */
export function translateFinding(raw) {
  if (!raw || typeof raw !== 'object') {
    return { severity: 'LOW', rule: 'rule-unknown', file: '<file>', line: 0, message: '' };
  }
  return {
    severity: severityFor(raw.antipattern),
    rule: raw.antipattern || 'rule-unknown',
    file: raw.file || '<file>',
    line: typeof raw.line === 'number' ? raw.line : 0,
    message: raw.description || raw.snippet || raw.name || '',
  };
}

/**
 * Normalize an adapter-shape findings array into IMPECCABLE-AUDIT.md body markdown.
 *
 * @param {Array<object>} findings - Adapter-shape findings.
 * @returns {string} Markdown content (header + severity-grouped sections).
 */
export function normalizeFindings(findings) {
  if (!Array.isArray(findings)) {
    throw new TypeError('normalizeFindings: findings must be an array');
  }

  const timestamp = new Date().toISOString();
  const header = [
    '# Impeccable Audit',
    '',
    `Generated: ${timestamp}`,
    '',
    '> Phase 41/M2.4 output — severity (HIGH/MEDIUM/LOW) + file:line + message.',
    '> R6 scope boundary: finding-lifecycle state (open/resolved/dismissed)',
    '> ships in Phase 48/M4 and is intentionally NOT reported here.',
    '',
  ];

  if (findings.length === 0) {
    return header.concat(['No findings.', '']).join('\n');
  }

  const bySeverity = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const f of findings) {
    const sev = String(f.severity || 'LOW').toUpperCase();
    (bySeverity[sev] || bySeverity.LOW).push(f);
  }

  const body = [];
  for (const sev of ['HIGH', 'MEDIUM', 'LOW']) {
    if (bySeverity[sev].length === 0) continue;
    body.push(`## ${sev} (${bySeverity[sev].length})`);
    body.push('');
    for (const f of bySeverity[sev]) {
      const rule = f.rule || 'rule-unknown';
      const file = f.file || '<file>';
      const line = typeof f.line === 'number' ? f.line : 0;
      const msg = f.message || '';
      body.push(`- **${rule}** — ${file}:${line} — ${msg}`);
    }
    body.push('');
  }

  return header.concat(body).join('\n');
}

/**
 * Spawn the vendored detector, capture --json output, translate + filter findings.
 *
 * Detector exit semantics (verified in detect-antipatterns.mjs L3437-3442):
 *   0 = clean scan (stdout has '[]' in --json mode)
 *   2 = findings present (stderr has JSON array in --json mode)
 *
 * @param {string} projectRootOrSrc - Path to scan.
 * @param {{excludes?: string[], timeoutMs?: number}} options
 * @returns {{status: 'ok', findings: Array, raw_count: number, filtered_count: number, projectRoot: string}}
 * @throws {DetectorUnavailableError} on any failure (graceful fallback upstream).
 */
export function runDetector(projectRootOrSrc, options = {}) {
  const excludes = options.excludes || DEFAULT_EXCLUDES;
  const timeoutMs = options.timeoutMs || 60_000;

  if (typeof projectRootOrSrc !== 'string' || !projectRootOrSrc.length) {
    throw new DetectorUnavailableError('target-not-found', {
      cause: new Error('projectRootOrSrc must be a non-empty string'),
    });
  }
  const absTarget = nodePath.resolve(projectRootOrSrc);
  if (!nodeFs.existsSync(absTarget)) {
    throw new DetectorUnavailableError('target-not-found', {
      cause: new Error(`no such path: ${absTarget}`),
    });
  }

  let result;
  try {
    result = spawnSync('node', [DETECTOR_PATH, absTarget, '--json'], {
      encoding: 'utf-8',
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new DetectorUnavailableError('detector-crash', { cause: err });
  }

  if (result.error) {
    const code = result.error.code;
    if (code === 'ENOENT') {
      throw new DetectorUnavailableError('node-not-found', { cause: result.error });
    }
    throw new DetectorUnavailableError('detector-crash', { cause: result.error });
  }

  const exitCode = result.status;
  if (exitCode !== 0 && exitCode !== 2) {
    throw new DetectorUnavailableError('detector-abnormal-exit', {
      cause: new Error(
        `exit ${exitCode}: ${(result.stderr || result.stdout || '').slice(0, 500)}`
      ),
    });
  }

  const jsonText =
    exitCode === 2
      ? (result.stderr || '').trim()
      : ((result.stdout || '').trim() || '[]');

  let rawFindings;
  try {
    rawFindings = JSON.parse(jsonText);
  } catch (err) {
    throw new DetectorUnavailableError('json-parse-failed', { cause: err });
  }
  if (!Array.isArray(rawFindings)) {
    throw new DetectorUnavailableError('json-parse-failed', {
      cause: new Error('detector JSON output is not an array'),
    });
  }

  const filtered = rawFindings.filter(f => {
    const file = String(f?.file || '');
    return !excludes.some(
      ex => file.includes(`/${ex}/`) || file === ex || file.startsWith(`${ex}/`)
    );
  });

  return {
    status: 'ok',
    findings: filtered.map(translateFinding),
    raw_count: rawFindings.length,
    filtered_count: filtered.length,
    projectRoot: absTarget,
  };
}

/**
 * Write the IMPECCABLE-AUDIT.md audit report. No silent success — `detector_status`
 * and `reason` are always emitted so downstream readers see detector state explicitly.
 *
 * @param {{status: 'ok'|'unavailable', reason?: string, findings?: Array}} result
 * @param {string} outPath - Target file (parent dir auto-created).
 * @returns {{path: string, status: string, reason: string|null, count?: number}}
 */
export function writeAuditReport(result, outPath) {
  if (!result || typeof result !== 'object') {
    throw new TypeError('writeAuditReport: result must be an object');
  }
  if (typeof outPath !== 'string' || !outPath.length) {
    throw new TypeError('writeAuditReport: outPath must be a non-empty string');
  }

  const absOut = nodePath.resolve(outPath);
  const dir = nodePath.dirname(absOut);
  nodeFs.mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString();

  if (result.status === 'unavailable') {
    const reason = result.reason || 'unknown';
    const lines = [
      '# Impeccable Audit',
      '',
      `Generated: ${timestamp}`,
      'detector_status: unavailable',
      `reason: ${reason}`,
      '',
      '> Detector could not run. LLM critique path continues (no block).',
      '> Fallback documented per Gate 41 A3 (G8 + BS5).',
      '',
    ];
    nodeFs.writeFileSync(absOut, lines.join('\n'), 'utf-8');
    return { path: absOut, status: 'unavailable', reason };
  }

  const findings = Array.isArray(result.findings) ? result.findings : [];
  const body = normalizeFindings(findings);
  // Inject detector_status keys after the H1 so smoke assertions can match on
  // a single deterministic line. Parser-friendly, human-readable.
  const injected = body.replace(
    '# Impeccable Audit',
    '# Impeccable Audit\n\ndetector_status: ok\nreason: null'
  );
  nodeFs.writeFileSync(absOut, injected, 'utf-8');
  return { path: absOut, status: 'ok', reason: null, count: findings.length };
}

// ---------------------------------------------------------------------------
// Self-test — invoked via `--test` flag.
// Phase 38 skeleton checks (8) preserved verbatim for regression proof.
// Phase 41 adds translate/write/error-path coverage.
// ---------------------------------------------------------------------------

function runSkeletonTest() {
  let passed = 0, failed = 0;
  const check = (name, cond) => {
    if (cond) { console.log(`  PASS  ${name}`); passed++; }
    else      { console.log(`  FAIL  ${name}`); failed++; }
  };

  // ─── Phase 38 skeleton (preserved) ─────────────────────────────────────
  const sample = [
    { severity: 'HIGH',   rule: 'missing-focus-ring', file: 'app/Button.tsx', line: 12, message: 'Interactive element lacks visible focus indicator.' },
    { severity: 'MEDIUM', rule: 'low-contrast',       file: 'app/Card.tsx',   line: 30, message: 'Text contrast below WCAG AA.' },
  ];
  const normalized = normalizeFindings(sample);
  check('output is a string',                           typeof normalized === 'string');
  check('output includes "# Impeccable Audit" header',  normalized.includes('# Impeccable Audit'));
  check('output flags Phase 41/M2.4 integration',       normalized.includes('Phase 41/M2.4'));
  check('output groups HIGH findings (1)',              normalized.includes('## HIGH (1)'));
  check('output groups MEDIUM findings (1)',            normalized.includes('## MEDIUM (1)'));
  check('output includes file:line anchor',             normalized.includes('app/Button.tsx:12'));

  const emptyOut = normalizeFindings([]);
  check('empty findings → "No findings."',              emptyOut.includes('No findings.'));

  const sentinel = new DetectorUnavailableError('node-not-found', { cause: new Error('upstream') });
  check(
    'DetectorUnavailableError sentinel constructible with cause',
    sentinel instanceof Error && sentinel.name === 'DetectorUnavailableError' && sentinel.cause
  );

  // ─── Phase 41 additions ────────────────────────────────────────────────
  // R6 scope boundary must appear in header (M4 note).
  check('normalizeFindings header flags M4 scope boundary', normalized.includes('Phase 48/M4'));

  // translateFinding — category → severity mapping
  const slopSample = { antipattern: 'side-tab', file: 'x.tsx', line: 1, snippet: 's', description: 'd' };
  const translated = translateFinding(slopSample);
  check('translateFinding: slop category → HIGH severity', translated.severity === 'HIGH');
  check('translateFinding: preserves file:line',           translated.file === 'x.tsx' && translated.line === 1);
  check('translateFinding: description → message',         translated.message === 'd');

  const unknownSample = { antipattern: 'no-such-id-ever', file: 'y.tsx', line: 2 };
  check('translateFinding: unknown antipattern → LOW severity', translateFinding(unknownSample).severity === 'LOW');

  // writeAuditReport — ok path
  const tmpRoot = process.env.TMPDIR || '/tmp';
  const testDir = nodePath.join(tmpRoot, `sunco-adapter-test-${process.pid}`);
  const okPath = nodePath.join(testDir, 'ok-IMPECCABLE-AUDIT.md');
  const unPath = nodePath.join(testDir, 'unavail-IMPECCABLE-AUDIT.md');
  try {
    const okResult = writeAuditReport({ status: 'ok', findings: [translated] }, okPath);
    const okContent = nodeFs.readFileSync(okPath, 'utf-8');
    check('writeAuditReport ok: returns {status:ok}',              okResult.status === 'ok');
    check('writeAuditReport ok: file contains "detector_status: ok"', okContent.includes('detector_status: ok'));
    check('writeAuditReport ok: file contains "reason: null"',     okContent.includes('reason: null'));
    check('writeAuditReport ok: file contains HIGH severity group', okContent.includes('## HIGH (1)'));

    const unResult = writeAuditReport({ status: 'unavailable', reason: 'node-not-found' }, unPath);
    const unContent = nodeFs.readFileSync(unPath, 'utf-8');
    check('writeAuditReport unavailable: preserves reason',                unResult.reason === 'node-not-found');
    check('writeAuditReport unavailable: file contains "detector_status: unavailable"', unContent.includes('detector_status: unavailable'));
    check('writeAuditReport unavailable: file contains reason value',      unContent.includes('reason: node-not-found'));
  } finally {
    try { nodeFs.rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  // runDetector — error paths (do NOT spawn a real scan in --test; that's for dogfood)
  let threwTarget = false;
  try {
    runDetector('/no/such/path/should/exist/ever/12345');
  } catch (err) {
    threwTarget = err instanceof DetectorUnavailableError && err.reason === 'target-not-found';
  }
  check('runDetector: nonexistent target → DetectorUnavailableError(target-not-found)', threwTarget);

  let threwEmpty = false;
  try { runDetector(''); } catch (err) {
    threwEmpty = err instanceof DetectorUnavailableError && err.reason === 'target-not-found';
  }
  check('runDetector: empty string → DetectorUnavailableError(target-not-found)', threwEmpty);

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

if (process.argv.includes('--test')) {
  runSkeletonTest();
}
