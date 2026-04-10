import { describe, expect, it, vi } from 'vitest';
import type { SkillContext } from '@sunco/core';
import { runLayer2Deterministic } from '../shared/verify-layers.js';

describe('runLayer2Deterministic', () => {
  it('passes multiple changed files as an array to lint and guard', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce({ data: { violations: [] } })
      .mockResolvedValueOnce({ data: { antiPatterns: [], tribalWarnings: [] } });

    const ctx = {
      run,
      log: { warn: vi.fn() },
    } as unknown as SkillContext;

    await runLayer2Deterministic(ctx, ['src/a.ts', 'src/b.ts']);

    expect(run).toHaveBeenCalledWith('harness.lint', {
      json: true,
      files: ['src/a.ts', 'src/b.ts'],
    });
    expect(run).toHaveBeenCalledWith('harness.guard', {
      json: true,
      files: ['src/a.ts', 'src/b.ts'],
    });
  });
});
