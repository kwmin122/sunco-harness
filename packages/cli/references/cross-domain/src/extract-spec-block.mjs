#!/usr/bin/env node
// SUNCO cross-domain SPEC-BLOCK extractor + CROSS-DOMAIN.md generator (Phase 48/M4.1).
//
// Purpose
//   Deterministic, no-LLM projection of UI-SPEC.md + API-SPEC.md SPEC-BLOCK YAML into
//   CROSS-DOMAIN.md per spec §8 Phase 4.1. Used by workflows/cross-domain-sync.md.
//
// Invariants (hard; enforced structurally)
//   - No subagent spawn, no AI SDK import, no HTTP out, no `ai` / `anthropic` / `openai`.
//   - No new npm dependency introduced by Phase 48 (C2). `yaml` is dynamically required
//     at generation time matching Phase 45 backend-phase-api.md precedent; if absent at
//     runtime, throws with a clear install hint. The `--test` path does NOT load `yaml`
//     so smoke Section 23 can run deterministically in the Phase 48 repo where `yaml`
//     is absent at the CLI workspace.
//   - Source file SHA recorded in generated_from.sha is a SHA-256 of the source file's
//     raw bytes (C3), NOT a git commit SHA.
//   - Hand-authored prologue above SUNCO:CROSS-DOMAIN-BLOCK-START is preserved
//     byte-for-byte on regeneration (Phase 47 section-level replace precedent).
//
// Module surface
//   extractSpecBlock(filePath, kind)         → { data, text, sha, sourcePath, kind }
//   generateCrossDomain({ ui, api, audit })  → { crossDomainBlock, findingsSummary }
//   renderMarkdown(payload, priorContent)    → { content, changed }
//   main()                                    — CLI entry (--test | --generate flags)
//
// Test path (`node extract-spec-block.mjs --test`)
//   22 deterministic self-tests. Fixtures use JSON-compatible YAML so `JSON.parse`
//   stands in for the `yaml` package in the test environment.

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve as pathResolve, relative as pathRelative, isAbsolute } from 'node:path';

// ─── Constants ─────────────────────────────────────────────────────────────

export const SPEC_BLOCK_START = '<!-- SUNCO:SPEC-BLOCK-START -->';
export const SPEC_BLOCK_END = '<!-- SUNCO:SPEC-BLOCK-END -->';
export const CROSS_DOMAIN_BLOCK_START = '<!-- SUNCO:CROSS-DOMAIN-BLOCK-START -->';
export const CROSS_DOMAIN_BLOCK_END = '<!-- SUNCO:CROSS-DOMAIN-BLOCK-END -->';
export const OPEN_FINDINGS_SUMMARY_START = '<!-- SUNCO:OPEN-FINDINGS-SUMMARY-START -->';
export const OPEN_FINDINGS_SUMMARY_END = '<!-- SUNCO:OPEN-FINDINGS-SUMMARY-END -->';
export const VERSION_MARKER = '<!-- cross_domain_version: 1 -->';

export const SPEC_KIND_REQUIRED_FIELDS = Object.freeze({
  ui: ['version', 'layout', 'components', 'states', 'interactions', 'a11y', 'responsive',
       'motion', 'copy', 'anti_pattern_watchlist', 'design_system_tokens_used',
       'endpoints_consumed', 'error_states_handled'],
  api: ['version', 'endpoints', 'error_envelope', 'versioning_strategy',
        'auth_requirements', 'anti_pattern_watchlist'],
});

// ─── Pure helpers ──────────────────────────────────────────────────────────

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// Extracts the raw YAML text between SPEC-BLOCK-START / SPEC-BLOCK-END + ```yaml fences.
// Deterministic string ops; throws on marker/fence malformation with precise diagnostics.
export function extractFencedYaml(markdown, label = '<source>') {
  const startIdx = markdown.indexOf(SPEC_BLOCK_START);
  if (startIdx === -1) {
    throw new Error(`${label}: missing ${SPEC_BLOCK_START}`);
  }
  const endIdx = markdown.indexOf(SPEC_BLOCK_END, startIdx);
  if (endIdx === -1) {
    throw new Error(`${label}: missing ${SPEC_BLOCK_END} after start marker`);
  }
  const region = markdown.slice(startIdx + SPEC_BLOCK_START.length, endIdx);
  const fenceOpen = region.indexOf('```yaml');
  if (fenceOpen === -1) {
    throw new Error(`${label}: missing opening \`\`\`yaml fence inside SPEC-BLOCK`);
  }
  const afterOpen = region.indexOf('\n', fenceOpen);
  if (afterOpen === -1) {
    throw new Error(`${label}: malformed \`\`\`yaml fence (no newline after)`);
  }
  const fenceClose = region.indexOf('\n```', afterOpen);
  if (fenceClose === -1) {
    throw new Error(`${label}: missing closing \`\`\` fence inside SPEC-BLOCK`);
  }
  return region.slice(afterOpen + 1, fenceClose + 1);
}

// Dynamic require of `yaml`. In the --test path we never call this.
// Matches Phase 45 (backend-phase-api.md:242) convention.
async function loadYaml() {
  try {
    const mod = await import('yaml');
    return mod.default ?? mod;
  } catch (e) {
    throw new Error(
      'yaml package required for cross-domain-sync runtime. ' +
      'Install it in the project root: `npm i -D yaml`. ' +
      '(Phase 48 extractor does not depend on yaml for its self-tests.)'
    );
  }
}

// Parse YAML at runtime. If the input is JSON-compatible (test fixtures), JSON.parse
// works and no yaml dep is needed — the self-test path relies on this shortcut.
export async function parseYamlOrJson(text, { preferJson = false } = {}) {
  const trimmed = text.trim();
  if (preferJson || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  const yaml = await loadYaml();
  return yaml.parse(text);
}

function validateRequiredFields(obj, kind, label) {
  const required = SPEC_KIND_REQUIRED_FIELDS[kind];
  if (!required) {
    throw new Error(`${label}: unknown kind '${kind}' (expected ui|api)`);
  }
  for (const k of required) {
    if (!(k in obj)) {
      throw new Error(`${label}: SPEC-BLOCK missing required field '${k}'`);
    }
  }
  if (obj.version !== 1) {
    throw new Error(`${label}: SPEC-BLOCK version must be 1 (BS1), got ${JSON.stringify(obj.version)}`);
  }
}

// ─── Core extractor ────────────────────────────────────────────────────────

export async function extractSpecBlock(filePath, kind, { preferJson = false } = {}) {
  if (!existsSync(filePath)) {
    throw new Error(`extractSpecBlock: file not found: ${filePath}`);
  }
  const bytes = readFileSync(filePath);
  const text = bytes.toString('utf8');
  const yamlText = extractFencedYaml(text, filePath);
  const data = await parseYamlOrJson(yamlText, { preferJson });
  validateRequiredFields(data, kind, filePath);
  return {
    data,
    text: yamlText,
    sha: sha256(bytes),
    sourcePath: filePath,
    kind,
  };
}

// ─── Cross-domain projection ───────────────────────────────────────────────

function normalizeEndpoint(e) {
  if (typeof e === 'string') {
    const m = e.match(/^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S.*)$/);
    if (m) return { method: m[1], path: m[2] };
    return { method: 'GET', path: e };
  }
  return { method: e.method, path: e.path };
}

function endpointKey(e) {
  return `${e.method} ${e.path}`;
}

// Computes the generated CROSS-DOMAIN block fields.
// ui = { data, sha, sourcePath }, api = { data, sha, sourcePath } shape from extractSpecBlock.
export function generateCrossDomain({ ui, api }) {
  if (!ui || !api) {
    throw new Error('generateCrossDomain: both ui and api extraction results required');
  }

  const generated_from = [
    { spec: ui.sourcePath, sha: ui.sha },
    { spec: api.sourcePath, sha: api.sha },
  ];

  // endpoints_consumed: declared by UI, carrying ui_ref forward where present.
  const endpoints_consumed = [];
  const uiEps = Array.isArray(ui.data.endpoints_consumed) ? ui.data.endpoints_consumed : [];
  for (const entry of uiEps) {
    if (typeof entry === 'string') {
      const n = normalizeEndpoint(entry);
      endpoints_consumed.push({ ui_ref: '', method: n.method, path: n.path });
    } else if (entry && typeof entry === 'object') {
      const n = normalizeEndpoint(entry);
      endpoints_consumed.push({
        ui_ref: typeof entry.ui_ref === 'string' ? entry.ui_ref
              : typeof entry.component === 'string' ? entry.component
              : '',
        method: n.method,
        path: n.path,
      });
    }
  }

  // endpoints_defined: from API-SPEC endpoints array, owner_spec = full api path.
  const endpoints_defined = [];
  const apiEps = Array.isArray(api.data.endpoints) ? api.data.endpoints : [];
  for (const e of apiEps) {
    if (!e || typeof e !== 'object') continue;
    if (typeof e.method !== 'string' || typeof e.path !== 'string') continue;
    endpoints_defined.push({
      method: e.method,
      path: e.path,
      owner_spec: api.sourcePath,
    });
  }

  // error_mappings: cross UI error_states_handled against API error codes.
  const apiCodes = new Set();
  if (api.data.error_envelope && typeof api.data.error_envelope === 'object') {
    const declared = api.data.error_envelope.codes
                  ?? api.data.error_envelope.errors
                  ?? null;
    if (Array.isArray(declared)) {
      for (const c of declared) {
        if (typeof c === 'string') apiCodes.add(c);
        else if (c && typeof c === 'object' && typeof c.code === 'string') apiCodes.add(c.code);
      }
    }
  }
  for (const e of apiEps) {
    if (Array.isArray(e?.errors)) {
      for (const err of e.errors) {
        if (err && typeof err === 'object' && typeof err.code === 'string') apiCodes.add(err.code);
      }
    }
  }
  const uiStates = new Map(); // code → ui_state
  let fallback = '';
  const uiHandled = Array.isArray(ui.data.error_states_handled) ? ui.data.error_states_handled : [];
  for (const entry of uiHandled) {
    if (typeof entry === 'string') {
      if (/fallback|generic/i.test(entry) && !fallback) fallback = entry;
    } else if (entry && typeof entry === 'object') {
      const state = entry.state ?? entry.name ?? '';
      const codes = Array.isArray(entry.api_codes) ? entry.api_codes
                  : Array.isArray(entry.codes) ? entry.codes
                  : typeof entry.api_code === 'string' ? [entry.api_code]
                  : [];
      for (const c of codes) if (typeof c === 'string') uiStates.set(c, state);
      if (entry.fallback === true && !fallback) fallback = state;
    }
  }
  const error_mappings = [];
  for (const code of apiCodes) {
    error_mappings.push({
      api_code: code,
      ui_state: uiStates.get(code) ?? '',
      fallback,
    });
  }

  // type_contracts: simple field-path projection. Phase 48 records declarations;
  // Phase 49 heuristic review judges nuance. We walk any declared ui.type_contracts
  // structure and produce comparable entries against api response_schema field names.
  const type_contracts = [];
  const uiTypes = Array.isArray(ui.data.type_contracts) ? ui.data.type_contracts
                : (ui.data.type_contracts && typeof ui.data.type_contracts === 'object')
                  ? Object.entries(ui.data.type_contracts).map(([k, v]) => ({ field_path: k, ui_type: String(v) }))
                  : [];
  const apiFieldTypes = collectApiFieldTypes(apiEps);
  for (const entry of uiTypes) {
    if (!entry || typeof entry !== 'object') continue;
    const field_path = String(entry.field_path ?? '');
    if (!field_path) continue;
    const ui_type = String(entry.ui_type ?? '');
    const api_type = apiFieldTypes.get(field_path) ?? '';
    type_contracts.push({
      field_path,
      ui_type,
      api_type,
      match: Boolean(ui_type) && Boolean(api_type) && ui_type === api_type,
    });
  }

  return {
    crossDomainBlock: {
      version: 1,
      generated_from,
      endpoints_consumed,
      endpoints_defined,
      error_mappings,
      type_contracts,
    },
  };
}

function collectApiFieldTypes(apiEndpoints) {
  const out = new Map();
  for (const e of apiEndpoints) {
    const rs = e?.response_schema;
    if (!rs || typeof rs !== 'object') continue;
    const fields = rs.fields ?? rs.properties ?? null;
    if (!fields || typeof fields !== 'object') continue;
    const ownerHint = rs.name ?? rs.type ?? '';
    for (const [k, v] of Object.entries(fields)) {
      const key = ownerHint ? `${ownerHint}.${k}` : k;
      if (typeof v === 'string') out.set(key, v);
      else if (v && typeof v === 'object' && typeof v.type === 'string') out.set(key, v.type);
    }
  }
  return out;
}

// ─── Open findings summary (G5 — summary-only, no lifecycle) ──────────────

// Reads BACKEND-AUDIT.md if present and counts open findings per surface × severity.
// Section parsing is marker-based ("## API findings" etc.); robust to Phase 47's
// section-level replace format. audit_version:1 has state enum ["open"] single-value,
// so "open count" = total count within section.
export function countOpenFindingsFromAudit(auditMarkdown) {
  const surfaces = ['API', 'Data', 'Event', 'Ops'];
  const result = {};
  for (const s of surfaces) result[s] = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  if (typeof auditMarkdown !== 'string' || !auditMarkdown.length) return result;
  const sections = {};
  for (const s of surfaces) {
    const header = `## ${s} findings`;
    const idx = auditMarkdown.indexOf(header);
    if (idx === -1) { sections[s] = ''; continue; }
    const nextHeaderRe = /\n## [A-Z]/g;
    nextHeaderRe.lastIndex = idx + header.length;
    const m = nextHeaderRe.exec(auditMarkdown);
    const end = m ? m.index : auditMarkdown.length;
    sections[s] = auditMarkdown.slice(idx + header.length, end);
  }
  for (const s of surfaces) {
    const body = sections[s];
    if (!body) continue;
    // Each finding is declared with a severity token; count occurrences.
    // Match `severity: HIGH` or `**severity**: HIGH` — tolerant of markdown styling.
    const re = /severity[^A-Z\n]*(HIGH|MEDIUM|LOW)/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      result[s][m[1]] += 1;
    }
  }
  return result;
}

export function renderFindingsSummaryTable(counts) {
  const rows = ['API', 'Data', 'Event', 'Ops'];
  const lines = [];
  lines.push('|         | HIGH | MEDIUM | LOW |');
  lines.push('| ------- | ---- | ------ | --- |');
  for (const r of rows) {
    const c = counts[r] ?? { HIGH: 0, MEDIUM: 0, LOW: 0 };
    lines.push(`| ${r.padEnd(7)} | ${String(c.HIGH).padEnd(4)} | ${String(c.MEDIUM).padEnd(6)} | ${String(c.LOW).padEnd(3)} |`);
  }
  return lines.join('\n');
}

// ─── YAML serialization (output-side; template-string form) ───────────────
// Phase 48 emits SPEC-BLOCK YAML via deterministic template serialization, not via
// a YAML library. The structure is narrow (scalars + arrays of flat objects) and
// the output is re-parsed round-trip stable. No yaml dep needed for generation.

function serializeYamlValue(v, indent) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return yamlString(v);
  if (Array.isArray(v)) return serializeYamlArray(v, indent);
  if (typeof v === 'object') return serializeYamlObject(v, indent);
  return yamlString(String(v));
}

function yamlString(s) {
  if (s === '') return '""';
  if (/[:\n#"'\\&*!|>%@`]/.test(s) || /^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}

function serializeYamlArray(arr, indent) {
  if (arr.length === 0) return '[]';
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const item of arr) {
    if (item === null || item === undefined || typeof item !== 'object' || Array.isArray(item)) {
      lines.push(`${pad}- ${serializeYamlValue(item, indent + 2)}`);
    } else {
      const keys = Object.keys(item);
      if (keys.length === 0) { lines.push(`${pad}- {}`); continue; }
      const first = keys[0];
      lines.push(`${pad}- ${first}: ${serializeYamlValue(item[first], indent + 4)}`);
      for (let i = 1; i < keys.length; i++) {
        const k = keys[i];
        lines.push(`${pad}  ${k}: ${serializeYamlValue(item[k], indent + 4)}`);
      }
    }
  }
  return '\n' + lines.join('\n');
}

function serializeYamlObject(obj, indent) {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'object' && v !== null) {
      const rendered = serializeYamlValue(v, indent + 2);
      if (rendered.startsWith('\n') || rendered === '[]' || rendered === '{}') {
        lines.push(`${pad}${k}:${rendered.startsWith('\n') ? rendered : ' ' + rendered}`);
      } else {
        lines.push(`${pad}${k}: ${rendered}`);
      }
    } else {
      lines.push(`${pad}${k}: ${serializeYamlValue(v, indent + 2)}`);
    }
  }
  return '\n' + lines.join('\n');
}

export function serializeCrossDomainBlock(block) {
  // Emits the YAML body (without fences) starting with `version: 1` and keys in
  // schema-required order so output is diff-stable across regenerations.
  const orderedKeys = ['version', 'generated_from', 'endpoints_consumed',
                       'endpoints_defined', 'error_mappings', 'type_contracts'];
  const lines = [];
  for (const k of orderedKeys) {
    if (!(k in block)) continue;
    const v = block[k];
    if (typeof v !== 'object' || v === null) {
      lines.push(`${k}: ${serializeYamlValue(v, 2)}`);
    } else {
      const rendered = serializeYamlValue(v, 2);
      if (rendered === '[]' || rendered === '{}') {
        lines.push(`${k}: ${rendered}`);
      } else {
        lines.push(`${k}:${rendered.startsWith('\n') ? rendered : ' ' + rendered}`);
      }
    }
  }
  return lines.join('\n');
}

// ─── CROSS-DOMAIN.md rendering + preserve-hand-authored logic ──────────────

const DEFAULT_PROLOGUE = [
  `${VERSION_MARKER}`,
  `# CROSS-DOMAIN.md`,
  ``,
  `Deterministic projection of UI-SPEC.md + API-SPEC.md SPEC-BLOCK extraction.`,
  `Generated by \`packages/cli/workflows/cross-domain-sync.md\` (Phase 48/M4.1).`,
  `No hand-authored prose above the generated block yet — replace this paragraph with project context as needed; it will be preserved byte-for-byte on regeneration.`,
  ``,
].join('\n');

// Returns { prologue, generatedBlockRegion, summaryRegion, epilogue } from an
// existing CROSS-DOMAIN.md. Missing regions come back as null (caller decides defaults).
function splitExistingCrossDomain(content) {
  if (!content) return { prologue: null, generatedBlockRegion: null, summaryRegion: null, epilogue: '' };
  const gStart = content.indexOf(CROSS_DOMAIN_BLOCK_START);
  const gEnd = content.indexOf(CROSS_DOMAIN_BLOCK_END);
  const sStart = content.indexOf(OPEN_FINDINGS_SUMMARY_START);
  const sEnd = content.indexOf(OPEN_FINDINGS_SUMMARY_END);
  let prologue = null;
  let generatedBlockRegion = null;
  let summaryRegion = null;
  let epilogue = '';
  if (gStart !== -1 && gEnd !== -1 && gEnd > gStart) {
    prologue = content.slice(0, gStart);
    generatedBlockRegion = content.slice(gStart, gEnd + CROSS_DOMAIN_BLOCK_END.length);
    let tailStart = gEnd + CROSS_DOMAIN_BLOCK_END.length;
    if (sStart !== -1 && sEnd !== -1 && sEnd > sStart && sStart >= tailStart) {
      // between block-end and summary-start goes to epilogue (hand-authored)
      // summaryRegion replaces only the tagged region
      summaryRegion = content.slice(sStart, sEnd + OPEN_FINDINGS_SUMMARY_END.length);
      epilogue = content.slice(tailStart, sStart) + content.slice(sEnd + OPEN_FINDINGS_SUMMARY_END.length);
    } else {
      epilogue = content.slice(tailStart);
    }
  }
  return { prologue, generatedBlockRegion, summaryRegion, epilogue };
}

export function renderMarkdown({ crossDomainBlock, findingsCounts }, priorContent = null) {
  const split = splitExistingCrossDomain(priorContent);
  const prologue = split.prologue ?? DEFAULT_PROLOGUE;
  const blockBody = serializeCrossDomainBlock(crossDomainBlock);
  const generatedRegion = [
    CROSS_DOMAIN_BLOCK_START,
    '```yaml',
    blockBody,
    '```',
    CROSS_DOMAIN_BLOCK_END,
  ].join('\n');
  const summaryBody = findingsCounts
    ? renderFindingsSummaryTable(findingsCounts)
    : 'no BACKEND-AUDIT.md present — summary skipped (Phase 47 A5 rollup, summary-only per G5).';
  const summaryRegion = [
    OPEN_FINDINGS_SUMMARY_START,
    '## Open findings summary (M3 BACKEND-AUDIT rollup — summary only)',
    '',
    summaryBody,
    '',
    OPEN_FINDINGS_SUMMARY_END,
  ].join('\n');
  const epilogue = (split.epilogue && split.epilogue.trim().length)
    ? split.epilogue
    : '\n';
  const prologuePart = prologue.endsWith('\n') ? prologue : prologue + '\n';
  const content = `${prologuePart}${generatedRegion}\n\n${summaryRegion}${epilogue.startsWith('\n') ? epilogue : '\n' + epilogue}`;
  const changed = priorContent !== content;
  return { content, changed };
}

// ─── CLI entry ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { test: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--test') args.test = true;
  }
  return args;
}

async function runSelfTests() {
  let passed = 0;
  let failed = 0;
  const results = [];
  const ok = (name, cond, detail = '') => {
    if (cond) { passed++; results.push(`  ✓ ${name}`); }
    else { failed++; results.push(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
  };

  // Fixture: UI-SPEC SPEC-BLOCK in JSON-compatible YAML subset.
  const uiSpecMd = [
    '# UI-SPEC (fixture)',
    SPEC_BLOCK_START,
    '```yaml',
    JSON.stringify({
      version: 1,
      layout: 'single-column',
      components: [{ name: 'UserDashboard' }],
      states: ['default'],
      interactions: ['hover'],
      a11y: 'AA',
      responsive: { mobile: 'stack' },
      motion: 'minimal',
      copy: 'concise',
      anti_pattern_watchlist: ['a', 'b', 'c'],
      design_system_tokens_used: { color: ['primary'] },
      endpoints_consumed: [
        { ui_ref: 'UserDashboard', method: 'GET', path: '/users/me' },
      ],
      error_states_handled: [
        { state: 'relogin-prompt', api_codes: ['AUTH_EXPIRED'] },
        { state: 'generic-error', fallback: true },
      ],
      type_contracts: [{ field_path: 'User.email', ui_type: 'string' }],
    }, null, 2),
    '```',
    SPEC_BLOCK_END,
  ].join('\n');

  const apiSpecMd = [
    '<!-- spec_version: 1 -->',
    '# API-SPEC (fixture)',
    SPEC_BLOCK_START,
    '```yaml',
    JSON.stringify({
      version: 1,
      endpoints: [
        {
          method: 'GET', path: '/users/me',
          response_schema: { name: 'User', fields: { email: 'string' } },
          errors: [{ code: 'AUTH_EXPIRED', http: 401 }],
        },
        { method: 'POST', path: '/users/me/orphan' },
      ],
      error_envelope: { code: 'string', message: 'string' },
      versioning_strategy: 'url-major',
      auth_requirements: 'bearer',
      anti_pattern_watchlist: ['x', 'y', 'z'],
    }, null, 2),
    '```',
    SPEC_BLOCK_END,
  ].join('\n');

  // T1 — extractFencedYaml happy path
  try {
    const y = extractFencedYaml(uiSpecMd, 'ui-fixture');
    ok('T1 extractFencedYaml happy path', y.includes('"version": 1'));
  } catch (e) { ok('T1 extractFencedYaml happy path', false, e.message); }

  // T2 — missing START
  try {
    extractFencedYaml('no markers here', 'x');
    ok('T2 missing START marker throws', false);
  } catch (e) { ok('T2 missing START marker throws', /missing .*SPEC-BLOCK-START/.test(e.message)); }

  // T3 — missing END
  try {
    extractFencedYaml(SPEC_BLOCK_START + '\n```yaml\nfoo: 1\n```\n', 'x');
    ok('T3 missing END marker throws', false);
  } catch (e) { ok('T3 missing END marker throws', /missing .*SPEC-BLOCK-END/.test(e.message)); }

  // T4 — missing opening fence
  try {
    extractFencedYaml(SPEC_BLOCK_START + '\nno fence\n' + SPEC_BLOCK_END, 'x');
    ok('T4 missing yaml fence throws', false);
  } catch (e) { ok('T4 missing yaml fence throws', /missing opening/.test(e.message)); }

  // T5 — missing closing fence
  try {
    extractFencedYaml(SPEC_BLOCK_START + '\n```yaml\nversion: 1\n' + SPEC_BLOCK_END, 'x');
    ok('T5 missing closing fence throws', false);
  } catch (e) { ok('T5 missing closing fence throws', /missing closing/.test(e.message)); }

  // T6 — sha256 deterministic
  const h1 = sha256('abc');
  const h2 = sha256('abc');
  ok('T6 sha256 deterministic', h1 === h2 && /^[0-9a-f]{64}$/.test(h1));

  // T7 — sha256 differs for different input
  ok('T7 sha256 differs on different input', sha256('abc') !== sha256('abcd'));

  // T8 — parseYamlOrJson with JSON fixture (no yaml dep)
  const parsed = await parseYamlOrJson('{"version": 1, "x": [1, 2]}');
  ok('T8 parseYamlOrJson JSON fixture', parsed.version === 1 && Array.isArray(parsed.x));

  // T9 — validateRequiredFields throws on missing
  try {
    validateRequiredFields({ version: 1 }, 'ui', 'x');
    ok('T9 validate throws on missing field', false);
  } catch (e) { ok('T9 validate throws on missing field', /missing required field/.test(e.message)); }

  // T10 — extractSpecBlock UI kind (via temp file)
  const os = await import('node:os');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunco-x-'));
  const uiPath = path.join(tmpDir, 'UI-SPEC.md');
  const apiPath = path.join(tmpDir, 'API-SPEC.md');
  fs.writeFileSync(uiPath, uiSpecMd);
  fs.writeFileSync(apiPath, apiSpecMd);
  let ui, api;
  try {
    ui = await extractSpecBlock(uiPath, 'ui', { preferJson: true });
    ok('T10 extractSpecBlock UI kind', ui.data.version === 1 && ui.sha.length === 64);
  } catch (e) { ok('T10 extractSpecBlock UI kind', false, e.message); }

  // T11 — extractSpecBlock API kind
  try {
    api = await extractSpecBlock(apiPath, 'api', { preferJson: true });
    ok('T11 extractSpecBlock API kind', api.data.endpoints.length === 2);
  } catch (e) { ok('T11 extractSpecBlock API kind', false, e.message); }

  // T12 — version !== 1 throws
  try {
    const bad = uiSpecMd.replace('"version": 1', '"version": 2');
    const p = path.join(tmpDir, 'UI-BAD.md');
    fs.writeFileSync(p, bad);
    await extractSpecBlock(p, 'ui', { preferJson: true });
    ok('T12 version !== 1 throws', false);
  } catch (e) { ok('T12 version !== 1 throws', /version must be 1/.test(e.message)); }

  // T13 — generateCrossDomain computes endpoints
  const gen = generateCrossDomain({ ui, api });
  ok('T13 endpoints_consumed projected from UI',
    gen.crossDomainBlock.endpoints_consumed.length === 1 &&
    gen.crossDomainBlock.endpoints_consumed[0].ui_ref === 'UserDashboard');
  ok('T14 endpoints_defined projected from API',
    gen.crossDomainBlock.endpoints_defined.length === 2 &&
    gen.crossDomainBlock.endpoints_defined[0].owner_spec === apiPath);

  // T15 — error_mappings cross-projects
  const m = gen.crossDomainBlock.error_mappings.find(x => x.api_code === 'AUTH_EXPIRED');
  ok('T15 error_mappings links AUTH_EXPIRED → relogin-prompt',
    m && m.ui_state === 'relogin-prompt' && m.fallback === 'generic-error');

  // T16 — type_contracts match
  const tc = gen.crossDomainBlock.type_contracts.find(x => x.field_path === 'User.email');
  ok('T16 type_contracts computes match=true for string/string',
    tc && tc.ui_type === 'string' && tc.api_type === 'string' && tc.match === true);

  // T17 — generated_from path is full path + SHA-256
  ok('T17 generated_from uses full path + sha256',
    gen.crossDomainBlock.generated_from[0].spec === uiPath &&
    /^[0-9a-f]{64}$/.test(gen.crossDomainBlock.generated_from[0].sha));

  // T18 — serializeCrossDomainBlock round-trippable via YAML-subset parse (JSON trick)
  const serialized = serializeCrossDomainBlock(gen.crossDomainBlock);
  ok('T18 serializeCrossDomainBlock emits version first',
    serialized.startsWith('version: 1'));

  // T19 — countOpenFindingsFromAudit
  const audit = [
    '## API findings', 'severity: HIGH', 'severity: MEDIUM', 'severity: MEDIUM',
    '## Data findings', '(none)',
    '## Event findings', 'severity: LOW',
    '## Ops findings', 'severity: HIGH',
  ].join('\n');
  const counts = countOpenFindingsFromAudit(audit);
  ok('T19 countOpenFindingsFromAudit per-surface × severity',
    counts.API.HIGH === 1 && counts.API.MEDIUM === 2 &&
    counts.Event.LOW === 1 && counts.Ops.HIGH === 1);

  // T20 — renderFindingsSummaryTable rows (no lifecycle tokens)
  const table = renderFindingsSummaryTable(counts);
  ok('T20 findings table has no lifecycle tokens',
    !/resolved|dismissed|audit_version/i.test(table) && /HIGH/.test(table));

  // T21 — renderMarkdown happy path (no prior)
  const r1 = renderMarkdown({ crossDomainBlock: gen.crossDomainBlock, findingsCounts: counts }, null);
  ok('T21 renderMarkdown wraps in markers + version marker',
    r1.content.includes(VERSION_MARKER) &&
    r1.content.includes(CROSS_DOMAIN_BLOCK_START) &&
    r1.content.includes(CROSS_DOMAIN_BLOCK_END) &&
    r1.content.includes(OPEN_FINDINGS_SUMMARY_START));

  // T22 — renderMarkdown preserves hand-authored prologue byte-for-byte
  const customPrologue = `${VERSION_MARKER}\n# CROSS-DOMAIN.md\n\nHAND-AUTHORED BYTES DO NOT TOUCH\n\n`;
  const existing = customPrologue + CROSS_DOMAIN_BLOCK_START + '\n```yaml\nstale\n```\n' + CROSS_DOMAIN_BLOCK_END + '\n';
  const r2 = renderMarkdown({ crossDomainBlock: gen.crossDomainBlock, findingsCounts: counts }, existing);
  ok('T22 renderMarkdown preserves hand-authored prologue',
    r2.content.startsWith(customPrologue));

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  process.stdout.write(results.join('\n') + '\n');
  process.stdout.write(`${passed} passed, ${failed} failed\n`);
  return failed === 0 ? 0 : 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.test) {
    const code = await runSelfTests();
    process.exit(code);
  }
  process.stderr.write('usage: extract-spec-block.mjs --test\n');
  process.exit(2);
}

const isDirectRun = (() => {
  try {
    const argv1 = process.argv[1] ?? '';
    const metaPath = new URL(import.meta.url).pathname;
    return argv1 && (argv1 === metaPath || pathResolve(argv1) === metaPath);
  } catch { return false; }
})();
if (isDirectRun) {
  main().catch((e) => {
    process.stderr.write(`FATAL: ${e.message}\n`);
    process.exit(1);
  });
}
