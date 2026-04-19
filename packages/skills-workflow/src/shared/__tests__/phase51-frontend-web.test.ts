import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
// @ts-expect-error — vendored .mjs has no type declarations.
import { runDetector } from '../../../../../packages/cli/references/impeccable/wrapper/detector-adapter.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const FIXTURE = path.resolve(REPO_ROOT, 'test/fixtures/frontend-web-sample');

describe('phase51 frontend-web-sample fixture', () => {
  it('Impeccable detector fires at least 7 unique rules (spec §9 L782)', () => {
    const result = runDetector(FIXTURE);
    const rules = new Set<string>();
    for (const f of result.findings ?? []) {
      const id = (f as { rule?: string; antipattern?: string }).rule
        ?? (f as { rule?: string; antipattern?: string }).antipattern;
      if (id) rules.add(id);
    }
    expect(rules.size, `unique rules fired: ${[...rules].sort().join(', ')}`).toBeGreaterThanOrEqual(7);
  });

  it('detector returns normalized findings array without throwing', () => {
    const result = runDetector(FIXTURE);
    expect(Array.isArray(result.findings)).toBe(true);
    expect((result.findings ?? []).length).toBeGreaterThan(0);
  });
});
