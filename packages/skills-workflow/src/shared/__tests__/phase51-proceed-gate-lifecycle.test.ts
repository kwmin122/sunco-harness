import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
// @ts-expect-error — vendored .mjs has no type declarations.
import { countOpenFindingsFromAudit, parseLifecycleOverrides } from '../../../../../packages/cli/references/cross-domain/src/extract-spec-block.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const AUDIT = path.resolve(REPO_ROOT, 'test/fixtures/proceed-gate-lifecycle/BACKEND-AUDIT.md');
const FINDINGS = path.resolve(REPO_ROOT, 'test/fixtures/proceed-gate-lifecycle/CROSS-DOMAIN-FINDINGS.md');

describe('phase51 proceed-gate-lifecycle fixture', () => {
  it('BACKEND-AUDIT surface counts: HIGH:1, MEDIUM:2, LOW:1 on API surface', () => {
    const content = readFileSync(AUDIT, 'utf8');
    const counts = countOpenFindingsFromAudit(content);
    expect(counts.API).toEqual({ HIGH: 1, MEDIUM: 2, LOW: 1 });
    expect(counts.Data).toEqual({ HIGH: 0, MEDIUM: 0, LOW: 0 });
  });

  it('lifecycle overrides parse 4 entries covering resolved / dismissed / open states', () => {
    const content = readFileSync(FINDINGS, 'utf8');
    const { overrides } = parseLifecycleOverrides(content);
    expect(overrides).toHaveLength(4);
    const byState: Record<string, number> = {};
    for (const o of overrides as Array<{ state: string }>) {
      byState[o.state] = (byState[o.state] ?? 0) + 1;
    }
    expect(byState.resolved).toBe(1);
    expect(byState.dismissed).toBe(1);
    expect(byState.open).toBe(2);
  });

  it('resolved override carries resolved_commit hex', () => {
    const content = readFileSync(FINDINGS, 'utf8');
    const { overrides } = parseLifecycleOverrides(content);
    const resolved = (overrides as Array<Record<string, string>>).find(o => o.state === 'resolved');
    expect(resolved).toBeDefined();
    expect(resolved!.resolved_commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('dismissed override carries rationale ≥50 chars (Phase 49 hard-block threshold)', () => {
    const content = readFileSync(FINDINGS, 'utf8');
    const { overrides } = parseLifecycleOverrides(content);
    const dismissed = (overrides as Array<Record<string, string>>).find(o => o.state === 'dismissed');
    expect(dismissed).toBeDefined();
    expect(dismissed!.dismissed_rationale.length).toBeGreaterThanOrEqual(50);
  });
});
