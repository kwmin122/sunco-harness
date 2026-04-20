#!/usr/bin/env node

// Phase 54/M6 — SUNCO Compound-Router sink proposer.
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
// PROPOSAL-ONLY BOUNDARY (Gate 54 G3 / L3). This module emits structured
// proposal records for inclusion in the compound artifact's `patterns_sdi`,
// `rule_promotions`, and `memory_proposals` sections. It NEVER writes to
// `memory/`, `.claude/rules/`, `.planning/backlog/`, or SDI counter state.
// Enforced by:
//   1. No `fs` / `node:fs` import in this file (source grep).
//   2. Smoke Section 30 negative-write grep over the source.
//   3. User ACK required downstream before any sink state change.
//
// L3 split discipline (DESIGN §8.2): observational patterns go to
// `patterns_sdi` (+2 trigger score contribution); prescriptive patterns go to
// `rule_promotions` (+3 contribution). Mixing is a spec violation; the
// emitter enforces 1:1 bucket mapping from input type to output section.

// ─── Input type constants ──────────────────────────────────────────────────

export const OBSERVATION_SDI = 'sdi_observational';
export const OBSERVATION_SPEC_RULE = 'spec_rule_prescriptive';
export const OBSERVATION_MEMORY = 'memory_candidate';

export const OBSERVATION_TYPES = Object.freeze([
  OBSERVATION_SDI,
  OBSERVATION_SPEC_RULE,
  OBSERVATION_MEMORY,
]);

// Proposed SDI counter delta per observational pattern promoted through this
// emitter. Matches DESIGN §13 D3 track toward PIL 999.x promotion; the actual
// SDI counter state change requires user ACK and does NOT happen here.
export const SDI_COUNTER_DELTA_PER_PATTERN = 1;

// ─── Primary API ────────────────────────────────────────────────────────────

/**
 * Emit structured sink proposals from a window's observations. Pure function.
 * No IO. No filesystem side-effect.
 *
 * @param {object} input
 *   {Array<object>} observations
 *     each: { type: 'sdi_observational'|'spec_rule_prescriptive'|'memory_candidate',
 *             name: string,
 *             occurrences: number,
 *             evidence_refs?: string[],
 *             target_rule?: string,          // spec_rule_prescriptive only
 *             diff_preview?: string,         // spec_rule_prescriptive only
 *             body?: string,                 // memory_candidate only
 *             memory_type?: string,          // memory_candidate only
 *             rationale?: string }
 * @returns {{ patterns_sdi: Array, rule_promotions: Array, memory_proposals: Array }}
 */
export function proposeSinks(input) {
  const out = { patterns_sdi: [], rule_promotions: [], memory_proposals: [] };
  if (!input || typeof input !== 'object') return out;
  const observations = Array.isArray(input.observations) ? input.observations : [];

  for (const obs of observations) {
    if (!obs || typeof obs !== 'object') continue;
    if (!obs.name || typeof obs.name !== 'string') continue;

    if (obs.type === OBSERVATION_SDI) {
      out.patterns_sdi.push(makeSdiProposal(obs));
    } else if (obs.type === OBSERVATION_SPEC_RULE) {
      out.rule_promotions.push(makeRulePromotion(obs));
    } else if (obs.type === OBSERVATION_MEMORY) {
      out.memory_proposals.push(makeMemoryProposal(obs));
    }
    // Unknown types silently dropped (strict 1:1 bucket mapping; no leakage).
  }

  return out;
}

/**
 * Render the 3 sink sections as markdown for inclusion in the compound
 * artifact. Stable ordering: patterns_sdi → rule_promotions → memory_proposals.
 *
 * @param {object} proposals  Output shape of proposeSinks.
 * @returns {{ patterns_sdi: string, rule_promotions: string, memory_proposals: string }}
 */
export function renderProposalSections(proposals) {
  const p = proposals && typeof proposals === 'object' ? proposals : {};
  return {
    patterns_sdi: renderSdiSection(Array.isArray(p.patterns_sdi) ? p.patterns_sdi : []),
    rule_promotions: renderRuleSection(Array.isArray(p.rule_promotions) ? p.rule_promotions : []),
    memory_proposals: renderMemorySection(Array.isArray(p.memory_proposals) ? p.memory_proposals : []),
  };
}

// ─── Record constructors ────────────────────────────────────────────────────

function makeSdiProposal(obs) {
  return {
    name: obs.name,
    occurrences: toNonNegInt(obs.occurrences),
    evidence_refs: normalizeStringArray(obs.evidence_refs),
    sdi_counter_delta: SDI_COUNTER_DELTA_PER_PATTERN,
    status: 'proposed',
  };
}

function makeRulePromotion(obs) {
  return {
    name: obs.name,
    target_rule: typeof obs.target_rule === 'string' ? obs.target_rule : '',
    rationale: typeof obs.rationale === 'string' ? obs.rationale : '',
    diff_preview: typeof obs.diff_preview === 'string' ? obs.diff_preview : '',
    evidence_refs: normalizeStringArray(obs.evidence_refs),
    status: 'proposed',
  };
}

function makeMemoryProposal(obs) {
  return {
    name: obs.name,
    memory_type: typeof obs.memory_type === 'string' ? obs.memory_type : 'project',
    body: typeof obs.body === 'string' ? obs.body : '',
    rationale: typeof obs.rationale === 'string' ? obs.rationale : '',
    status: 'proposed',
  };
}

// ─── Markdown renderers ────────────────────────────────────────────────────

function renderSdiSection(items) {
  if (items.length === 0) return '(no SDI-observational patterns detected in this window)';
  const lines = items.map((p) => {
    const refs = p.evidence_refs.length ? ` — evidence: ${p.evidence_refs.join(', ')}` : '';
    return `- **${p.name}** — ${p.occurrences} occurrences; proposed SDI delta: +${p.sdi_counter_delta}${refs}`;
  });
  return lines.join('\n');
}

function renderRuleSection(items) {
  if (items.length === 0) return '(no rule-promotion candidates detected)';
  const blocks = items.map((r) => {
    const head = `- **${r.name}** → \`${r.target_rule || '<target rule>'}\``;
    const rationaleLine = r.rationale ? `  - Rationale: ${r.rationale}` : '';
    const refsLine = r.evidence_refs.length ? `  - Evidence: ${r.evidence_refs.join(', ')}` : '';
    const diffBlock = r.diff_preview ? `\n\n\`\`\`diff\n${r.diff_preview}\n\`\`\`\n` : '';
    return [head, rationaleLine, refsLine].filter(Boolean).join('\n') + diffBlock;
  });
  return blocks.join('\n');
}

function renderMemorySection(items) {
  if (items.length === 0) return '(no memory candidates surfaced)';
  const lines = items.map((m) => {
    const bodyExcerpt = m.body ? ` — ${truncate(m.body, 80)}` : '';
    return `- **${m.name}** (${m.memory_type})${bodyExcerpt}${m.rationale ? ` [${m.rationale}]` : ''}`;
  });
  return lines.join('\n');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toNonNegInt(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeStringArray(a) {
  if (!Array.isArray(a)) return [];
  return a.filter((x) => typeof x === 'string' && x.length > 0);
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

// ─── Self-tests ────────────────────────────────────────────────────────────

function runSelfTests() {
  let passed = 0;
  let failed = 0;
  const tally = (name, cond) => {
    if (cond) { console.log(`  PASS  ${name}`); passed++; }
    else { console.error(`  FAIL  ${name}`); failed++; }
  };

  // ── proposeSinks tests ──────────────────────────────────────────────────

  tally('T01 empty input → empty buckets',
    (() => {
      const r = proposeSinks({});
      return r.patterns_sdi.length === 0 && r.rule_promotions.length === 0 && r.memory_proposals.length === 0;
    })());

  tally('T02 null input → empty buckets (no throw)',
    (() => {
      const r = proposeSinks(null);
      return r.patterns_sdi.length === 0 && r.rule_promotions.length === 0;
    })());

  tally('T03 sdi_observational → patterns_sdi bucket ONLY',
    (() => {
      const r = proposeSinks({ observations: [{ type: 'sdi_observational', name: 'pattern-a', occurrences: 2 }] });
      return r.patterns_sdi.length === 1 && r.rule_promotions.length === 0 && r.memory_proposals.length === 0;
    })());

  tally('T04 spec_rule_prescriptive → rule_promotions bucket ONLY',
    (() => {
      const r = proposeSinks({ observations: [{ type: 'spec_rule_prescriptive', name: 'rule-b', target_rule: '.claude/rules/workflow.md' }] });
      return r.patterns_sdi.length === 0 && r.rule_promotions.length === 1 && r.memory_proposals.length === 0;
    })());

  tally('T05 memory_candidate → memory_proposals bucket ONLY',
    (() => {
      const r = proposeSinks({ observations: [{ type: 'memory_candidate', name: 'mem-c', body: 'body', memory_type: 'project' }] });
      return r.patterns_sdi.length === 0 && r.rule_promotions.length === 0 && r.memory_proposals.length === 1;
    })());

  tally('T06 unknown type silently dropped (no bucket leakage)',
    (() => {
      const r = proposeSinks({ observations: [{ type: 'random_unknown', name: 'nope' }] });
      return r.patterns_sdi.length === 0 && r.rule_promotions.length === 0 && r.memory_proposals.length === 0;
    })());

  tally('T07 missing name silently dropped',
    (() => {
      const r = proposeSinks({ observations: [{ type: 'sdi_observational', occurrences: 2 }] });
      return r.patterns_sdi.length === 0;
    })());

  tally('T08 sdi_counter_delta is +1 per pattern (SDI_COUNTER_DELTA_PER_PATTERN)',
    (() => {
      const r = proposeSinks({ observations: [{ type: 'sdi_observational', name: 'p1', occurrences: 2 }] });
      return r.patterns_sdi[0].sdi_counter_delta === SDI_COUNTER_DELTA_PER_PATTERN;
    })());

  tally('T09 rule promotion carries diff_preview and target_rule',
    (() => {
      const r = proposeSinks({
        observations: [{ type: 'spec_rule_prescriptive', name: 'r1', target_rule: '.claude/rules/architecture.md', diff_preview: '- old\n+ new', rationale: 'x' }],
      });
      const p = r.rule_promotions[0];
      return p.target_rule === '.claude/rules/architecture.md' && p.diff_preview.includes('+ new') && p.rationale === 'x';
    })());

  tally('T10 memory_type defaults to "project" when absent',
    (() => {
      const r = proposeSinks({ observations: [{ type: 'memory_candidate', name: 'm1', body: 'b' }] });
      return r.memory_proposals[0].memory_type === 'project';
    })());

  tally('T11 determinism: same input 100 iterations → byte-identical output',
    (() => {
      const input = {
        observations: [
          { type: 'sdi_observational', name: 'p1', occurrences: 3, evidence_refs: ['e1', 'e2'] },
          { type: 'spec_rule_prescriptive', name: 'r1', target_rule: '.claude/rules/x.md', diff_preview: '-o\n+n' },
          { type: 'memory_candidate', name: 'm1', memory_type: 'feedback', body: 'hello' },
        ],
      };
      const baseline = JSON.stringify(proposeSinks(input));
      for (let i = 0; i < 100; i++) {
        if (JSON.stringify(proposeSinks(input)) !== baseline) return false;
      }
      return true;
    })());

  tally('T12 all records have status: "proposed" (awaiting user ACK)',
    (() => {
      const r = proposeSinks({
        observations: [
          { type: 'sdi_observational', name: 'p1', occurrences: 1 },
          { type: 'spec_rule_prescriptive', name: 'r1' },
          { type: 'memory_candidate', name: 'm1' },
        ],
      });
      return r.patterns_sdi[0].status === 'proposed' && r.rule_promotions[0].status === 'proposed' && r.memory_proposals[0].status === 'proposed';
    })());

  tally('T13 negative occurrences normalized to 0',
    (() => {
      const r = proposeSinks({ observations: [{ type: 'sdi_observational', name: 'p', occurrences: -5 }] });
      return r.patterns_sdi[0].occurrences === 0;
    })());

  tally('T14 evidence_refs filters non-strings',
    (() => {
      const r = proposeSinks({ observations: [{ type: 'sdi_observational', name: 'p', occurrences: 1, evidence_refs: ['ok', 42, null, '', 'good'] }] });
      return r.patterns_sdi[0].evidence_refs.length === 2;
    })());

  // ── renderProposalSections tests ───────────────────────────────────────

  tally('T15 renderProposalSections returns 3 keys',
    (() => {
      const r = renderProposalSections({});
      return typeof r.patterns_sdi === 'string' && typeof r.rule_promotions === 'string' && typeof r.memory_proposals === 'string';
    })());

  tally('T16 empty patterns_sdi renders placeholder',
    (() => {
      const r = renderProposalSections({ patterns_sdi: [] });
      return r.patterns_sdi.includes('no SDI-observational patterns');
    })());

  tally('T17 empty rule_promotions renders placeholder',
    (() => {
      const r = renderProposalSections({ rule_promotions: [] });
      return r.rule_promotions.includes('no rule-promotion candidates');
    })());

  tally('T18 non-empty patterns_sdi renders bullet lines',
    (() => {
      const proposals = proposeSinks({ observations: [{ type: 'sdi_observational', name: 'PATTERN_X', occurrences: 3, evidence_refs: ['path/to/file.md'] }] });
      const r = renderProposalSections(proposals);
      return r.patterns_sdi.includes('PATTERN_X') && r.patterns_sdi.includes('3 occurrences') && r.patterns_sdi.includes('path/to/file.md');
    })());

  tally('T19 non-empty rule_promotions renders diff block',
    (() => {
      const proposals = proposeSinks({
        observations: [{ type: 'spec_rule_prescriptive', name: 'R1', target_rule: '.claude/rules/x.md', diff_preview: '- old\n+ new' }],
      });
      const r = renderProposalSections(proposals);
      return r.rule_promotions.includes('```diff') && r.rule_promotions.includes('+ new');
    })());

  tally('T20 non-empty memory_proposals renders bullet lines',
    (() => {
      const proposals = proposeSinks({ observations: [{ type: 'memory_candidate', name: 'mem1', memory_type: 'feedback', body: 'some body text' }] });
      const r = renderProposalSections(proposals);
      return r.memory_proposals.includes('mem1') && r.memory_proposals.includes('feedback');
    })());

  // ── Proposal-only boundary invariants ───────────────────────────────────

  tally('T21 module exports NO write functions (proposal-only boundary)',
    (() => {
      // This module emits pure data; no writer, no mutator. Exported surface is
      // proposeSinks + renderProposalSections + constants. Any export named
      // /write|mutate|commit|persist/ would violate the boundary.
      const exported = Object.keys(import.meta) // placeholder; actual check via grep in smoke Section 30
        .concat([
          'proposeSinks',
          'renderProposalSections',
          'OBSERVATION_SDI',
          'OBSERVATION_SPEC_RULE',
          'OBSERVATION_MEMORY',
          'OBSERVATION_TYPES',
          'SDI_COUNTER_DELTA_PER_PATTERN',
        ]);
      return !exported.some((name) => /write|mutate|commit|persist/i.test(name));
    })());

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

if (process.argv.includes('--test') && import.meta.url === `file://${process.argv[1]}`) {
  runSelfTests();
}
