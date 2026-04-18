#!/usr/bin/env node

// Phase 38/M2.1 — Context Injector (skeleton), Phase 40/M2.3 — sections parser populated.
// SUNCO-authored wrapper. Translates SUNCO's canonical
// .planning/domains/frontend/DESIGN-CONTEXT.md into a structured object
// matching what vendored Impeccable skills expect in place of an
// in-project .impeccable.md file.
//
// Phase 38/M2.1 scope:  contract skeleton (returns raw markdown + metadata).
// Phase 39/M2.2 scope:  DESIGN-CONTEXT.md schema finalized by discuss-frontend-teach
//                       (## Target audience / ## Primary use cases / ## Brand personality / tone).
// Phase 40/M2.3 scope:  sections parser populated per Gate 40 A2=α decision.
//                       Strict-match Phase 39 canonical headings; tolerant of leading/trailing
//                       whitespace and body-content shape (prose, numbered list, or mixed).
//
// Upstream is vendored pristine in ../source/skills/impeccable/ — this file
// does NOT touch any vendored content. Wrapper-not-patch (spec R5).

import fs from 'node:fs';
import path from 'node:path';

const CANONICAL_HEADINGS = {
  audience: 'Target audience',
  useCases: 'Primary use cases',
  brand: 'Brand personality / tone',
};

/**
 * Extract the body of a `## <heading>` section from markdown.
 * Body spans from the line after the heading up to the next `## ` heading
 * (or end of file). Trims leading/trailing whitespace.
 *
 * Strict-match per Gate 40 A2=α: the heading line must equal `## <heading>`
 * exactly (after optional trailing whitespace). This enforces the Phase 39
 * canonical format produced by /sunco:discuss --domain frontend.
 *
 * @param {string} markdown
 * @param {string} heading
 * @returns {string|null}
 */
function extractSection(markdown, heading) {
  const lines = markdown.split('\n');
  const target = `## ${heading}`;
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === target) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let i = startIdx; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  const body = lines.slice(startIdx, endIdx).join('\n').trim();
  return body.length === 0 ? null : body;
}

/**
 * Parse the three canonical sections from DESIGN-CONTEXT.md markdown.
 * Returns null if none of the three headings match (treated as malformed).
 *
 * @param {string} markdown
 * @returns {{audience: string|null, useCases: string|null, brand: string|null}|null}
 */
export function parseSections(markdown) {
  const audience = extractSection(markdown, CANONICAL_HEADINGS.audience);
  const useCases = extractSection(markdown, CANONICAL_HEADINGS.useCases);
  const brand = extractSection(markdown, CANONICAL_HEADINGS.brand);
  if (audience === null && useCases === null && brand === null) return null;
  return { audience, useCases, brand };
}

/**
 * Load frontend design context from SUNCO's canonical location.
 *
 * @param {string} projectRoot - Absolute path to the target project root.
 * @returns {object|null} Structured context, or null if DESIGN-CONTEXT.md is absent.
 */
export function loadDesignContext(projectRoot) {
  const contextPath = path.join(projectRoot, '.planning', 'domains', 'frontend', 'DESIGN-CONTEXT.md');
  if (!fs.existsSync(contextPath)) return null;
  const raw = fs.readFileSync(contextPath, 'utf8');
  return {
    source: '.planning/domains/frontend/DESIGN-CONTEXT.md',
    version: '1.0',
    populated_in: 'Phase 40/M2.3',
    raw_markdown: raw,
    sections: parseSections(raw),
  };
}

// ---------------------------------------------------------------------------
// Fixture smoke test — invoked via `--test` flag.
// Builds a temp project with DESIGN-CONTEXT.md, exercises loader in both
// present-and-absent cases, asserts contract shape + sections parser.
// ---------------------------------------------------------------------------

function runFixtureTest() {
  const tmpBase = process.env.TMPDIR || '/tmp';
  const tmpRoot = fs.mkdtempSync(path.join(tmpBase, 'impeccable-injector-fixture-'));
  const absentRoot = fs.mkdtempSync(path.join(tmpBase, 'impeccable-injector-absent-'));
  let passed = 0;
  let failed = 0;
  const tally = (name, cond) => {
    if (cond) {
      console.log(`  PASS  ${name}`);
      passed++;
    } else {
      console.log(`  FAIL  ${name}`);
      failed++;
    }
  };

  try {
    const contextDir = path.join(tmpRoot, '.planning', 'domains', 'frontend');
    fs.mkdirSync(contextDir, { recursive: true });
    const fixtureContent = [
      '# Design Context',
      '',
      '**Source**: SUNCO /sunco:discuss --domain frontend (fixture)',
      '',
      '## Target audience',
      'Power users of CLI tools who also manage web frontends.',
      '',
      '## Primary use cases',
      '1. Scaffold new skills',
      '2. Audit existing UI',
      '3. Regenerate design contracts',
      '',
      '## Brand personality / tone',
      'Calm, precise, emerald.',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(contextDir, 'DESIGN-CONTEXT.md'), fixtureContent, 'utf8');

    const result = loadDesignContext(tmpRoot);
    tally('loader returns non-null for fixture', result !== null);
    tally('result.source points to canonical path',
      result && result.source === '.planning/domains/frontend/DESIGN-CONTEXT.md');
    tally('result.version is 1.0 (Phase 40)',
      result && result.version === '1.0');
    tally('result.populated_in references Phase 40/M2.3',
      result && result.populated_in === 'Phase 40/M2.3');
    tally('result.raw_markdown contains fixture marker',
      result && result.raw_markdown.includes('Calm, precise, emerald.'));
    tally('result.sections is non-null object (Phase 40 parser active)',
      result && result.sections !== null && typeof result.sections === 'object');
    tally('result.sections.audience parsed from ## Target audience',
      result && result.sections && result.sections.audience === 'Power users of CLI tools who also manage web frontends.');
    tally('result.sections.useCases parsed from ## Primary use cases',
      result && result.sections && result.sections.useCases
      && result.sections.useCases.includes('1. Scaffold new skills')
      && result.sections.useCases.includes('3. Regenerate design contracts'));
    tally('result.sections.brand parsed from ## Brand personality / tone',
      result && result.sections && result.sections.brand === 'Calm, precise, emerald.');

    const absentResult = loadDesignContext(absentRoot);
    tally('loader returns null when DESIGN-CONTEXT.md absent', absentResult === null);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.rmSync(absentRoot, { recursive: true, force: true });
  }

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

if (process.argv.includes('--test')) {
  runFixtureTest();
}
