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

// Phase 49/M4.2 CROSS-DOMAIN-FINDINGS.md markers (separate file from Phase 48 CROSS-DOMAIN.md).
export const CROSS_DOMAIN_FINDINGS_BLOCK_START = '<!-- SUNCO:CROSS-DOMAIN-FINDINGS-BLOCK-START -->';
export const CROSS_DOMAIN_FINDINGS_BLOCK_END = '<!-- SUNCO:CROSS-DOMAIN-FINDINGS-BLOCK-END -->';
export const CROSS_DOMAIN_LIFECYCLE_START = '<!-- SUNCO:CROSS-DOMAIN-LIFECYCLE-START -->';
export const CROSS_DOMAIN_LIFECYCLE_END = '<!-- SUNCO:CROSS-DOMAIN-LIFECYCLE-END -->';
export const FINDINGS_VERSION_MARKER = '<!-- findings_version: 1 -->';

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

// ─── Phase 49/M4.2 extensions ──────────────────────────────────────────────
// Extension-only: all existing exports above IMMUTABLE (Phase 48 1a508ba lock).
// Phase 49 adds cross-domain findings generation, staleness detection, lifecycle
// override parsing, findings-markdown rendering, required_specs + domains CONTEXT
// parsing. All deterministic (no LLM, no subagent, no HTTP) — charter G7 option (a).

// Emits 4 check-type findings from a generated CROSS-DOMAIN block:
//   - missing-endpoint HIGH (UI consumes; API undefined)
//   - orphan-endpoint  LOW  (API defines; UI never consumes)
//   - type-drift       HIGH (type_contracts[].match === false)
//   - error-state-mismatch MEDIUM (error_mappings[].ui_state === '')
// Deterministic ordering: rule asc, file asc, line asc, match asc. All findings
// carry state='open', kind='deterministic', source='cross-domain'. Phase 49 is the
// sole cross-domain findings writer — lifecycle transitions are expressed via
// human-edited overrides[] joined by rule:file:line id.
export function generateCrossDomainFindings({ crossDomainBlock }) {
  if (!crossDomainBlock || typeof crossDomainBlock !== 'object') {
    throw new Error('generateCrossDomainFindings: crossDomainBlock required');
  }
  const endpoints_consumed = Array.isArray(crossDomainBlock.endpoints_consumed) ? crossDomainBlock.endpoints_consumed : [];
  const endpoints_defined = Array.isArray(crossDomainBlock.endpoints_defined) ? crossDomainBlock.endpoints_defined : [];
  const error_mappings = Array.isArray(crossDomainBlock.error_mappings) ? crossDomainBlock.error_mappings : [];
  const type_contracts = Array.isArray(crossDomainBlock.type_contracts) ? crossDomainBlock.type_contracts : [];
  const generated_from = Array.isArray(crossDomainBlock.generated_from) ? crossDomainBlock.generated_from : [];

  const uiSpecPath = (generated_from.find(e => typeof e?.spec === 'string' && /UI-SPEC\.md$/.test(e.spec)) || {}).spec || '-';
  const apiSpecPath = (generated_from.find(e => typeof e?.spec === 'string' && /API-SPEC\.md$/.test(e.spec)) || {}).spec || '-';

  const definedKeys = new Set(endpoints_defined.map(e => `${e.method} ${e.path}`));
  const consumedKeys = new Set(endpoints_consumed.map(e => `${e.method} ${e.path}`));

  const findings = [];

  for (const ep of endpoints_consumed) {
    const key = `${ep.method} ${ep.path}`;
    if (!definedKeys.has(key)) {
      findings.push({
        rule: 'missing-endpoint',
        severity: 'HIGH',
        kind: 'deterministic',
        file: uiSpecPath,
        line: 0,
        state: 'open',
        source: 'cross-domain',
        match: key,
        fix_hint: `API does not define ${key} consumed by ${ep.ui_ref || 'UI'}; either add endpoint to API-SPEC.md or remove consumption from UI-SPEC.md.`,
      });
    }
  }

  for (const ep of endpoints_defined) {
    const key = `${ep.method} ${ep.path}`;
    if (!consumedKeys.has(key)) {
      findings.push({
        rule: 'orphan-endpoint',
        severity: 'LOW',
        kind: 'deterministic',
        file: apiSpecPath,
        line: 0,
        state: 'open',
        source: 'cross-domain',
        match: key,
        fix_hint: `API defines ${key} but no UI consumer declares it; either remove from API-SPEC.md or add consumption in UI-SPEC.md.`,
      });
    }
  }

  for (const tc of type_contracts) {
    if (tc && tc.match === false) {
      findings.push({
        rule: 'type-drift',
        severity: 'HIGH',
        kind: 'deterministic',
        file: uiSpecPath,
        line: 0,
        state: 'open',
        source: 'cross-domain',
        match: tc.field_path || '',
        fix_hint: `UI type '${tc.ui_type || ''}' does not match API type '${tc.api_type || ''}' at ${tc.field_path || ''}; align type declarations in UI-SPEC.md and API-SPEC.md.`,
      });
    }
  }

  for (const em of error_mappings) {
    if (em && (em.ui_state === '' || em.ui_state == null)) {
      findings.push({
        rule: 'error-state-mismatch',
        severity: 'MEDIUM',
        kind: 'deterministic',
        file: uiSpecPath,
        line: 0,
        state: 'open',
        source: 'cross-domain',
        match: em.api_code || '',
        fix_hint: `UI does not explicitly handle API error code '${em.api_code || ''}'; relies on fallback '${em.fallback || 'none'}'. Add explicit UI state or accept fallback.`,
      });
    }
  }

  findings.sort((a, b) => {
    if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.line !== b.line) return a.line - b.line;
    const ma = a.match || '';
    const mb = b.match || '';
    return ma < mb ? -1 : ma > mb ? 1 : 0;
  });

  return { findings };
}

// Tolerant generated_from SHA extractor. Returns Map<specPath, sha256Hex>.
// Does not require a YAML library — parses the serialized output the module itself emits.
function extractGeneratedFromShaMap(crossDomainContent) {
  const shaMap = new Map();
  if (typeof crossDomainContent !== 'string') return shaMap;
  const gStart = crossDomainContent.indexOf(CROSS_DOMAIN_BLOCK_START);
  const gEnd = crossDomainContent.indexOf(CROSS_DOMAIN_BLOCK_END);
  if (gStart === -1 || gEnd === -1 || gEnd <= gStart) return shaMap;
  const body = crossDomainContent.slice(gStart, gEnd);
  // Scan for "    - spec: X\n      sha: Y" pairs (our serializer's emission form).
  const lines = body.split('\n');
  let pendingSpec = null;
  for (const line of lines) {
    const specM = line.match(/^\s*-\s*spec:\s*(.+?)\s*$/);
    if (specM) {
      pendingSpec = specM[1].replace(/^["']|["']$/g, '');
      continue;
    }
    const shaM = line.match(/^\s*sha:\s*([0-9a-f]{64})\s*$/);
    if (shaM && pendingSpec) {
      shaMap.set(pendingSpec, shaM[1]);
      pendingSpec = null;
    }
  }
  return shaMap;
}

// Returns true if CROSS-DOMAIN.md is absent, malformed, or any tracked spec SHA
// has drifted from its current file content. Missing tracked-spec entry for an
// explicitly required path also counts as stale (signals config change).
export function isCrossDomainStale(crossDomainPath, requiredSpecPaths = []) {
  if (!existsSync(crossDomainPath)) return true;
  const content = readFileSync(crossDomainPath, 'utf8');
  const shaMap = extractGeneratedFromShaMap(content);
  if (shaMap.size === 0) return true;
  for (const required of requiredSpecPaths) {
    if (!shaMap.has(required)) return true;
  }
  for (const [path, prevSha] of shaMap) {
    if (!existsSync(path)) return true;
    const currentSha = sha256(readFileSync(path));
    if (currentSha !== prevSha) return true;
  }
  return false;
}

// Extracts overrides[] from the CROSS-DOMAIN-LIFECYCLE YAML block.
// Tolerant parser — expects the same subset our serializer emits:
//   overrides:
//     - id: <rule>:<file>:<line>
//       state: resolved | dismissed-with-rationale
//       resolved_commit: <hex>            # optional
//       dismissed_rationale: "<text>"     # optional
// Returns { overrides: [...] } with each override as a flat object.
export function parseLifecycleOverrides(findingsMarkdown) {
  if (typeof findingsMarkdown !== 'string') return { overrides: [] };
  const lStart = findingsMarkdown.indexOf(CROSS_DOMAIN_LIFECYCLE_START);
  const lEnd = findingsMarkdown.indexOf(CROSS_DOMAIN_LIFECYCLE_END);
  if (lStart === -1 || lEnd === -1 || lEnd <= lStart) return { overrides: [] };
  const region = findingsMarkdown.slice(lStart + CROSS_DOMAIN_LIFECYCLE_START.length, lEnd);
  const fenceOpen = region.indexOf('```yaml');
  if (fenceOpen === -1) return { overrides: [] };
  const afterOpen = region.indexOf('\n', fenceOpen);
  if (afterOpen === -1) return { overrides: [] };
  const fenceClose = region.indexOf('\n```', afterOpen);
  if (fenceClose === -1) return { overrides: [] };
  const yamlText = region.slice(afterOpen + 1, fenceClose + 1);

  const overrides = [];
  let current = null;
  for (const rawLine of yamlText.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const itemM = line.match(/^\s*-\s*id:\s*(.+)$/);
    if (itemM) {
      if (current) overrides.push(current);
      current = { id: itemM[1].trim().replace(/^["']|["']$/g, '') };
      continue;
    }
    if (current) {
      const kvM = line.match(/^\s+([a-z_]+):\s*(.+)$/);
      if (kvM) current[kvM[1]] = kvM[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  if (current) overrides.push(current);
  return { overrides };
}

function serializeFindingsYaml(findings) {
  const list = Array.isArray(findings) ? findings : [];
  if (list.length === 0) return 'findings: []';
  const lines = ['findings:'];
  const orderedKeys = ['rule', 'severity', 'kind', 'file', 'line', 'state', 'source', 'match', 'fix_hint', 'resolved_commit', 'dismissed_rationale'];
  for (const f of list) {
    let first = true;
    for (const k of orderedKeys) {
      if (!(k in f)) continue;
      const v = f[k];
      const rendered = serializeYamlValue(v, 6);
      if (first) {
        lines.push(`  - ${k}: ${rendered.startsWith('\n') ? rendered.trimStart() : rendered}`);
        first = false;
      } else {
        lines.push(`    ${k}: ${rendered.startsWith('\n') ? rendered.trimStart() : rendered}`);
      }
    }
  }
  return lines.join('\n');
}

function serializeOverridesYaml(overrides) {
  const list = Array.isArray(overrides) ? overrides : [];
  if (list.length === 0) return 'overrides: []';
  const lines = ['overrides:'];
  for (const o of list) {
    const keys = Object.keys(o);
    if (keys.length === 0) continue;
    let first = true;
    for (const k of keys) {
      const v = o[k];
      const rendered = serializeYamlValue(v, 6);
      if (first) {
        lines.push(`  - ${k}: ${rendered.startsWith('\n') ? rendered.trimStart() : rendered}`);
        first = false;
      } else {
        lines.push(`    ${k}: ${rendered.startsWith('\n') ? rendered.trimStart() : rendered}`);
      }
    }
  }
  return lines.join('\n');
}

const DEFAULT_FINDINGS_PROLOGUE = [
  FINDINGS_VERSION_MARKER,
  '# CROSS-DOMAIN-FINDINGS.md',
  '',
  'Auto-generated by Phase 49 verify-gate cross-domain layer. Findings block below is overwritten on regeneration (deterministic ordering). Lifecycle overrides region is human-editable and preserved across regenerations. Prose below the lifecycle region is preserved byte-for-byte.',
  '',
].join('\n');

// Renders the 3-region CROSS-DOMAIN-FINDINGS.md:
//   (1) prologue (preserved byte-for-byte if existing; default inserted otherwise)
//   (2) findings YAML block (overwrite — deterministic auto-gen)
//   (3) lifecycle overrides YAML block (preserved byte-for-byte when existing and
//       no new overrides passed in; overwritten only when overrides arg provided)
//   (4) prose below lifecycle (preserved byte-for-byte)
// Passing overrides=undefined preserves existing lifecycle; passing [] overwrites
// with an empty override list (initial generation).
export function renderFindingsMarkdown({ findings, overrides }, priorContent = null) {
  let prologue = null;
  let existingLifecycleRegion = null;
  let prose = '';

  if (typeof priorContent === 'string' && priorContent.length) {
    const fStart = priorContent.indexOf(CROSS_DOMAIN_FINDINGS_BLOCK_START);
    const fEnd = priorContent.indexOf(CROSS_DOMAIN_FINDINGS_BLOCK_END);
    const lStart = priorContent.indexOf(CROSS_DOMAIN_LIFECYCLE_START);
    const lEnd = priorContent.indexOf(CROSS_DOMAIN_LIFECYCLE_END);
    if (fStart !== -1 && fEnd !== -1 && fEnd > fStart) {
      prologue = priorContent.slice(0, fStart);
      const afterFindings = fEnd + CROSS_DOMAIN_FINDINGS_BLOCK_END.length;
      if (lStart !== -1 && lEnd !== -1 && lEnd > lStart && lStart >= afterFindings) {
        existingLifecycleRegion = priorContent.slice(lStart, lEnd + CROSS_DOMAIN_LIFECYCLE_END.length);
        prose = priorContent.slice(lEnd + CROSS_DOMAIN_LIFECYCLE_END.length);
      } else {
        prose = priorContent.slice(afterFindings);
      }
    }
  }

  if (prologue === null) prologue = DEFAULT_FINDINGS_PROLOGUE;
  if (!prologue.endsWith('\n')) prologue = prologue + '\n';

  const findingsRegion = [
    CROSS_DOMAIN_FINDINGS_BLOCK_START,
    '```yaml',
    serializeFindingsYaml(findings),
    '```',
    CROSS_DOMAIN_FINDINGS_BLOCK_END,
  ].join('\n');

  let lifecycleRegion;
  if (overrides === undefined && existingLifecycleRegion) {
    lifecycleRegion = existingLifecycleRegion;
  } else {
    lifecycleRegion = [
      CROSS_DOMAIN_LIFECYCLE_START,
      '```yaml',
      serializeOverridesYaml(overrides ?? []),
      '```',
      CROSS_DOMAIN_LIFECYCLE_END,
    ].join('\n');
  }

  const proseOut = (prose && prose.trim().length) ? prose : '\n';
  const content = `${prologue}${findingsRegion}\n\n${lifecycleRegion}${proseOut.startsWith('\n') ? proseOut : '\n' + proseOut}`;
  const changed = priorContent !== content;
  return { content, changed };
}

// Parses required_specs list from a CONTEXT.md. Tolerant — matches both inline
// array (`required_specs: [path1, path2]`) and list-form (`required_specs:\n  - path\n  - path`).
// Returns deduplicated string[] of .planning/domains/**/*-SPEC.md paths. Empty
// array when required_specs is absent or malformed.
export function readRequiredSpecs(contextMarkdown) {
  if (typeof contextMarkdown !== 'string') return [];
  const idx = contextMarkdown.indexOf('required_specs:');
  if (idx === -1) return [];
  const tail = contextMarkdown.slice(idx);
  // Stop at next top-level key (line starting without leading whitespace) or end.
  const stopMatch = tail.slice('required_specs:'.length).match(/\n[^\s\-]/);
  const block = stopMatch ? tail.slice(0, 'required_specs:'.length + stopMatch.index) : tail;
  const paths = [...block.matchAll(/(\.planning\/domains\/[a-z]+\/[A-Z-]+\.md)/g)].map(x => x[1]);
  return [...new Set(paths)];
}

// Parses `domains:` list from CONTEXT.md frontmatter or body. Returns string[] of
// lowercased domain names. Supports inline (`domains: [frontend, backend]`) and
// list-form (`domains:\n  - frontend\n  - backend`). Empty array when absent.
export function readDomainsField(contextMarkdown) {
  if (typeof contextMarkdown !== 'string') return [];
  const inline = contextMarkdown.match(/^\s*domains:\s*\[([^\]]*)\]/m);
  if (inline) {
    return inline[1].split(',')
      .map(s => s.trim().replace(/^["']|["']$/g, '').toLowerCase())
      .filter(Boolean);
  }
  const block = contextMarkdown.match(/^\s*domains:\s*\n((?:\s*-\s*\S+\s*\n?)+)/m);
  if (block) {
    return [...block[1].matchAll(/-\s*(\S+)/g)].map(x => x[1].toLowerCase().replace(/^["']|["']$/g, ''));
  }
  return [];
}

// Gate-predicate helper: should the verify-gate cross-domain layer fire for this phase?
// Fires when domains includes BOTH frontend AND backend, OR when required_specs includes
// both UI-SPEC and API-SPEC paths. Single-domain or no-domain phases skip the layer
// (spec §8 line 731 non-regression guarantee).
export function shouldTriggerCrossDomainLayer(contextMarkdown) {
  const domains = readDomainsField(contextMarkdown);
  if (domains.includes('frontend') && domains.includes('backend')) return true;
  const specs = readRequiredSpecs(contextMarkdown);
  const hasUi = specs.some(p => /UI-SPEC\.md$/.test(p));
  const hasApi = specs.some(p => /API-SPEC\.md$/.test(p));
  return hasUi && hasApi;
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

  // ─── Phase 49/M4.2 extensions self-tests (T23-T33) ────────────────────────

  // Build a Phase 49 fixture cross-domain block with INTENTIONAL 4-check-type mismatches:
  //   - missing-endpoint: UI consumes GET /orders, API does not define it
  //   - orphan-endpoint: API defines POST /users/me/orphan, UI does not consume it
  //   - type-drift: User.email ui_type='string' api_type='number' (match=false)
  //   - error-state-mismatch: API code UNKNOWN_ERR with empty ui_state
  const p49Fixture = {
    version: 1,
    generated_from: [
      { spec: '.planning/domains/frontend/UI-SPEC.md', sha: 'a'.repeat(64) },
      { spec: '.planning/domains/backend/API-SPEC.md', sha: 'b'.repeat(64) },
    ],
    endpoints_consumed: [
      { ui_ref: 'OrderList', method: 'GET', path: '/orders' },
      { ui_ref: 'UserDashboard', method: 'GET', path: '/users/me' },
    ],
    endpoints_defined: [
      { method: 'GET', path: '/users/me', owner_spec: '.planning/domains/backend/API-SPEC.md' },
      { method: 'POST', path: '/users/me/orphan', owner_spec: '.planning/domains/backend/API-SPEC.md' },
    ],
    error_mappings: [
      { api_code: 'AUTH_EXPIRED', ui_state: 'relogin-prompt', fallback: 'generic-error' },
      { api_code: 'UNKNOWN_ERR', ui_state: '', fallback: 'generic-error' },
    ],
    type_contracts: [
      { field_path: 'User.email', ui_type: 'string', api_type: 'number', match: false },
      { field_path: 'User.id', ui_type: 'string', api_type: 'string', match: true },
    ],
  };

  // T23 — generateCrossDomainFindings emits all 4 check types with correct severity
  const f49 = generateCrossDomainFindings({ crossDomainBlock: p49Fixture });
  const findByRule = (rule) => f49.findings.filter(x => x.rule === rule);
  ok('T23 generateCrossDomainFindings emits 4 check types with correct severity',
    findByRule('missing-endpoint').length === 1 && findByRule('missing-endpoint')[0].severity === 'HIGH' &&
    findByRule('orphan-endpoint').length === 1 && findByRule('orphan-endpoint')[0].severity === 'LOW' &&
    findByRule('type-drift').length === 1 && findByRule('type-drift')[0].severity === 'HIGH' &&
    findByRule('error-state-mismatch').length === 1 && findByRule('error-state-mismatch')[0].severity === 'MEDIUM');

  // T24 — all findings carry state='open', kind='deterministic', source='cross-domain'
  ok('T24 cross-domain findings carry state=open + kind=deterministic + source=cross-domain',
    f49.findings.every(f => f.state === 'open' && f.kind === 'deterministic' && f.source === 'cross-domain'));

  // T25 — deterministic ordering (rule asc, then file asc, then line asc, then match asc)
  const ruleOrder = f49.findings.map(f => f.rule);
  const sortedRuleOrder = [...ruleOrder].sort();
  ok('T25 findings are deterministically ordered by rule',
    JSON.stringify(ruleOrder) === JSON.stringify(sortedRuleOrder));

  // T26 — file_ref routes by check type (consumer→UI-SPEC, definer→API-SPEC)
  ok('T26 file_ref routes by check type',
    findByRule('missing-endpoint')[0].file === '.planning/domains/frontend/UI-SPEC.md' &&
    findByRule('orphan-endpoint')[0].file === '.planning/domains/backend/API-SPEC.md' &&
    findByRule('type-drift')[0].file === '.planning/domains/frontend/UI-SPEC.md' &&
    findByRule('error-state-mismatch')[0].file === '.planning/domains/frontend/UI-SPEC.md');

  // T27 — renderFindingsMarkdown emits 3-region structure with FINDINGS_VERSION_MARKER
  const r49 = renderFindingsMarkdown({ findings: f49.findings, overrides: [] }, null);
  ok('T27 renderFindingsMarkdown 3-region structure + findings_version marker',
    r49.content.includes(FINDINGS_VERSION_MARKER) &&
    r49.content.includes(CROSS_DOMAIN_FINDINGS_BLOCK_START) &&
    r49.content.includes(CROSS_DOMAIN_FINDINGS_BLOCK_END) &&
    r49.content.includes(CROSS_DOMAIN_LIFECYCLE_START) &&
    r49.content.includes(CROSS_DOMAIN_LIFECYCLE_END));

  // T28 — lifecycle block preserved byte-for-byte when overrides=undefined
  const customLifecycle = CROSS_DOMAIN_LIFECYCLE_START + '\n```yaml\noverrides:\n  - id: type-drift:.planning/domains/frontend/UI-SPEC.md:0\n    state: resolved\n    resolved_commit: abc1234\n```\n' + CROSS_DOMAIN_LIFECYCLE_END;
  const customFindingsMd = FINDINGS_VERSION_MARKER + '\n# CROSS-DOMAIN-FINDINGS.md\n\nHAND PROLOGUE DO NOT TOUCH\n\n' +
    CROSS_DOMAIN_FINDINGS_BLOCK_START + '\n```yaml\nfindings: []\n```\n' + CROSS_DOMAIN_FINDINGS_BLOCK_END + '\n\n' +
    customLifecycle + '\nHAND PROSE BELOW LIFECYCLE\n';
  const r49b = renderFindingsMarkdown({ findings: f49.findings }, customFindingsMd);
  ok('T28 lifecycle region preserved when overrides=undefined',
    r49b.content.includes('resolved_commit: abc1234') && r49b.content.includes('HAND PROSE BELOW LIFECYCLE') && r49b.content.startsWith(FINDINGS_VERSION_MARKER + '\n# CROSS-DOMAIN-FINDINGS.md\n\nHAND PROLOGUE DO NOT TOUCH'));

  // T29 — parseLifecycleOverrides extracts overrides[] from YAML block
  const parsedOverrides = parseLifecycleOverrides(customFindingsMd);
  ok('T29 parseLifecycleOverrides extracts overrides with id + state + resolved_commit',
    parsedOverrides.overrides.length === 1 &&
    parsedOverrides.overrides[0].id === 'type-drift:.planning/domains/frontend/UI-SPEC.md:0' &&
    parsedOverrides.overrides[0].state === 'resolved' &&
    parsedOverrides.overrides[0].resolved_commit === 'abc1234');

  // T30 — readRequiredSpecs parses inline list-form required_specs
  const ctxWithSpecs = [
    '# Phase 05 — User dashboard',
    '',
    'required_specs:',
    '  - .planning/domains/frontend/UI-SPEC.md',
    '  - .planning/domains/backend/API-SPEC.md',
    '',
    '## Decisions',
  ].join('\n');
  const specs = readRequiredSpecs(ctxWithSpecs);
  ok('T30 readRequiredSpecs extracts both UI-SPEC and API-SPEC paths',
    specs.includes('.planning/domains/frontend/UI-SPEC.md') &&
    specs.includes('.planning/domains/backend/API-SPEC.md') &&
    specs.length === 2);

  // T31 — readDomainsField parses inline and block forms
  const ctxInline = '# Phase\n\ndomains: [frontend, backend]\n\n## Decisions';
  const ctxBlock = '# Phase\n\ndomains:\n  - frontend\n  - backend\n\n## Decisions';
  const inlineDoms = readDomainsField(ctxInline);
  const blockDoms = readDomainsField(ctxBlock);
  ok('T31 readDomainsField parses inline + block forms',
    inlineDoms.includes('frontend') && inlineDoms.includes('backend') &&
    blockDoms.includes('frontend') && blockDoms.includes('backend'));

  // T32 — shouldTriggerCrossDomainLayer: BOTH frontend + backend required
  ok('T32 shouldTriggerCrossDomainLayer fires on domains+specs, skips single-domain',
    shouldTriggerCrossDomainLayer(ctxInline) === true &&
    shouldTriggerCrossDomainLayer(ctxWithSpecs) === true &&
    shouldTriggerCrossDomainLayer('# Phase\n\ndomains: [backend]\n') === false &&
    shouldTriggerCrossDomainLayer('# Phase\n\nno domains here\n') === false);

  // T33 — isCrossDomainStale detects fresh vs stale
  const uiP = path.join(tmpDir, 'UI-SPEC.md');
  const apiP = path.join(tmpDir, 'API-SPEC.md');
  // uiP/apiP already written at T10. Generate a fresh CROSS-DOMAIN.md tracking them.
  const freshGen = generateCrossDomain({ ui, api });
  const freshCd = renderMarkdown({ crossDomainBlock: freshGen.crossDomainBlock, findingsCounts: null }, null).content;
  const cdPath = path.join(tmpDir, 'CROSS-DOMAIN.md');
  fs.writeFileSync(cdPath, freshCd);
  const freshStale = isCrossDomainStale(cdPath, [uiP, apiP]);
  // Now mutate UI-SPEC to force stale
  fs.writeFileSync(uiP, fs.readFileSync(uiP, 'utf8') + '\n<!-- mutated -->\n');
  const staleStale = isCrossDomainStale(cdPath, [uiP, apiP]);
  ok('T33 isCrossDomainStale: fresh=false, SHA-drift=true',
    freshStale === false && staleStale === true);

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
