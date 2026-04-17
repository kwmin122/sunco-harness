/**
 * Tests for shared/gates.ts specApprovalGate.
 *
 * Verifies:
 *   - PASS when .planning/PROJECT.md exists (SUNCO standard path)
 *   - PASS when docs/superpowers/specs/ has any *.md
 *   - PASS when .sun/designs/ has a file with "Status: APPROVED"
 *   - BLOCKED when none of the above exist
 *   - BYPASS when opts.bypassSpecApproval=true
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { specApprovalGate } from '../shared/gates.js';
import type { SkillContext } from '@sunco/core';

function makeCtx(cwd: string): SkillContext {
  return {
    cwd,
    state: {
      get: async () => null,
      set: async () => undefined,
    } as unknown as SkillContext['state'],
    log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as SkillContext;
}

describe('specApprovalGate', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'sunco-spec-gate-'));
  });
  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('BLOCKS when no spec/design exists', async () => {
    const result = await specApprovalGate(makeCtx(workDir));
    expect(result.passed).toBe(false);
    expect(result.verdict).toBe('BLOCKED');
    expect(result.reason).toMatch(/no approved spec/);
    expect(result.findings?.length).toBeGreaterThan(0);
  });

  it('PASSES when .planning/PROJECT.md exists', async () => {
    await mkdir(join(workDir, '.planning'), { recursive: true });
    await writeFile(join(workDir, '.planning/PROJECT.md'), '# Project', 'utf-8');
    const result = await specApprovalGate(makeCtx(workDir));
    expect(result.passed).toBe(true);
    expect(result.reason).toMatch(/PROJECT\.md/);
  });

  it('PASSES when docs/superpowers/specs/ has any *.md', async () => {
    await mkdir(join(workDir, 'docs/superpowers/specs'), { recursive: true });
    await writeFile(
      join(workDir, 'docs/superpowers/specs/2026-04-17-x-design.md'),
      '# Spec',
      'utf-8',
    );
    const result = await specApprovalGate(makeCtx(workDir));
    expect(result.passed).toBe(true);
    expect(result.reason).toMatch(/Superpowers spec/);
  });

  it('PASSES when .sun/designs has APPROVED design', async () => {
    await mkdir(join(workDir, '.sun/designs'), { recursive: true });
    await writeFile(
      join(workDir, '.sun/designs/2026-04-17-auth.md'),
      'Status: APPROVED\n\n# Auth',
      'utf-8',
    );
    const result = await specApprovalGate(makeCtx(workDir));
    expect(result.passed).toBe(true);
    expect(result.reason).toMatch(/approved office-hours design/);
  });

  it('ignores non-approved designs', async () => {
    await mkdir(join(workDir, '.sun/designs'), { recursive: true });
    await writeFile(
      join(workDir, '.sun/designs/2026-04-17-draft.md'),
      'Status: DRAFT\n\n# Auth',
      'utf-8',
    );
    const result = await specApprovalGate(makeCtx(workDir));
    expect(result.passed).toBe(false);
  });

  it('BYPASS with explicit opt-out records the reason', async () => {
    const result = await specApprovalGate(makeCtx(workDir), {
      bypassSpecApproval: true,
      bypassReason: 'one-line doc fix',
    });
    expect(result.passed).toBe(true);
    expect(result.reason).toMatch(/BYPASSED/);
    expect(result.reason).toContain('one-line doc fix');
  });
});
