#!/usr/bin/env node

// Phase 38/M2.1 — Context Injector (skeleton)
// SUNCO-authored wrapper. Translates SUNCO's canonical
// .planning/domains/frontend/DESIGN-CONTEXT.md into a structured object
// matching what vendored Impeccable skills expect in place of an
// in-project .impeccable.md file.
//
// Phase 38/M2.1 scope:  contract skeleton (returns raw markdown + metadata).
// Phase 39/M2.2 scope:  populate sections parser (audience, useCases, brand)
//                       alongside discuss-frontend-teach.
//
// Upstream is vendored pristine in ../source/skills/impeccable/ — this file
// does NOT touch any vendored content. Wrapper-not-patch (spec R5).

import fs from 'node:fs';
import path from 'node:path';

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
    version: '1.0-skeleton',
    populated_in: 'Phase 39/M2.2',
    raw_markdown: raw,
    sections: null, // Phase 39/M2.2 populates { audience, useCases, brand }
  };
}

// ---------------------------------------------------------------------------
// Fixture smoke test — invoked via `--test` flag.
// Builds a temp project with DESIGN-CONTEXT.md, exercises loader in both
// present-and-absent cases, asserts contract shape.
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
      '# Design Context (fixture)',
      '',
      '## Target audience',
      'Power users of CLI tools.',
      '',
      '## Primary use cases',
      '1. Scaffold new skills',
      '2. Audit existing UI',
      '3. Regenerate design contracts',
      '',
      '## Brand personality',
      'Calm, precise, emerald.',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(contextDir, 'DESIGN-CONTEXT.md'), fixtureContent, 'utf8');

    const result = loadDesignContext(tmpRoot);
    tally('loader returns non-null for fixture', result !== null);
    tally('result.source points to canonical path',
      result && result.source === '.planning/domains/frontend/DESIGN-CONTEXT.md');
    tally('result.version is 1.0-skeleton (Phase 38)',
      result && result.version === '1.0-skeleton');
    tally('result.populated_in references Phase 39/M2.2',
      result && result.populated_in === 'Phase 39/M2.2');
    tally('result.raw_markdown contains fixture marker',
      result && result.raw_markdown.includes('Calm, precise, emerald.'));
    tally('result.sections is null (Phase 38 skeleton)',
      result && result.sections === null);

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
