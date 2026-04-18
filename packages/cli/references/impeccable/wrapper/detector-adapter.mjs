#!/usr/bin/env node

// Phase 38/M2.1 — Detector Adapter (contract skeleton)
// SUNCO-authored wrapper. Exposes a normalization contract that converts
// Impeccable's detect-antipatterns JSON output into IMPECCABLE-AUDIT.md.
//
// Phase 38/M2.1 scope:  contract skeleton — normalizeFindings(findings)
//                       + DetectorUnavailableError sentinel (G8 fallback).
// Phase 41/M2.4 scope:  full integration — actual detector invocation,
//                       executable fallback handling, finding-lifecycle
//                       convergence with R6 severity × state.
//
// Upstream detector is vendored pristine at ../src/detect-antipatterns.mjs.
// This file does NOT modify vendored content. Wrapper-not-patch (spec R5).

/**
 * Sentinel error for detector-unavailable scenarios (G8 fallback contract).
 * Full executable fallback behavior ships in Phase 41/M2.4.
 */
export class DetectorUnavailableError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'DetectorUnavailableError';
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * Normalize a detector JSON findings array into IMPECCABLE-AUDIT.md markdown.
 *
 * Phase 38 skeleton output: minimal placeholder audit with severity labels
 * and file:line anchors. Full R6 finding-lifecycle (open/resolved/dismissed)
 * formatting lands in Phase 41/M2.4 + Phase 4.2/M4.
 *
 * @param {Array<object>} findings - Array of finding objects from
 *   detect-antipatterns.mjs JSON output. Each expected shape:
 *   { severity: 'HIGH'|'MEDIUM'|'LOW', file, line, rule, message }.
 * @returns {string} Markdown content suitable for IMPECCABLE-AUDIT.md.
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
    '> Phase 38/M2.1 skeleton output. Full finding-lifecycle formatting',
    '> (R6 severity × state — open/resolved/dismissed) lands in Phase 41/M2.4.',
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

// ---------------------------------------------------------------------------
// Skeleton test — invoked via `--test` flag.
// Phase 38 scope: validate contract shape only. NO actual detector execution.
// ---------------------------------------------------------------------------

function runSkeletonTest() {
  const sample = [
    { severity: 'HIGH',   file: 'app/Button.tsx', line: 12, rule: 'missing-focus-ring', message: 'Interactive element lacks visible focus indicator.' },
    { severity: 'MEDIUM', file: 'app/Card.tsx',   line: 30, rule: 'low-contrast',       message: 'Text contrast below WCAG AA.' },
  ];
  const output = normalizeFindings(sample);
  const checks = [
    ['output is a string',                           typeof output === 'string'],
    ['output includes "# Impeccable Audit" header',  output.includes('# Impeccable Audit')],
    ['output flags Phase 41/M2.4 future integration', output.includes('Phase 41/M2.4')],
    ['output groups HIGH findings (1)',              output.includes('## HIGH (1)')],
    ['output groups MEDIUM findings (1)',            output.includes('## MEDIUM (1)')],
    ['output includes file:line anchor',             output.includes('app/Button.tsx:12')],
  ];
  let passed = 0;
  let failed = 0;
  for (const [name, cond] of checks) {
    if (cond) { console.log(`  PASS  ${name}`); passed++; }
    else      { console.log(`  FAIL  ${name}`); failed++; }
  }

  // Empty-findings case
  const emptyOut = normalizeFindings([]);
  if (emptyOut.includes('No findings.')) { console.log(`  PASS  empty findings → "No findings."`); passed++; }
  else { console.log(`  FAIL  empty findings → "No findings."`); failed++; }

  // Sentinel export
  const err = new DetectorUnavailableError('skeleton test', { cause: new Error('upstream') });
  if (err instanceof Error && err.name === 'DetectorUnavailableError' && err.cause) {
    console.log(`  PASS  DetectorUnavailableError sentinel constructible with cause`);
    passed++;
  } else {
    console.log(`  FAIL  DetectorUnavailableError sentinel constructible with cause`);
    failed++;
  }

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

if (process.argv.includes('--test')) {
  runSkeletonTest();
}
