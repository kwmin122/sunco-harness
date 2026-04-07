import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveLearning, searchLearnings, readAllLearnings, incrementHitCount } from '../shared/debug-learnings.js';
import type { DebugLearning } from '../shared/debug-types.js';

describe('debug-learnings', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sun-learnings-'));
  });

  const makeLearning = (overrides: Partial<DebugLearning> = {}): DebugLearning => ({
    id: 'learn-001',
    pattern: 'type_mismatch',
    symptom: 'TS2322 Type string not assignable to number',
    rootCause: 'Interface changed without updating callers',
    fix: 'Update callers to use new interface',
    files: ['src/types.ts', 'src/handler.ts'],
    createdAt: '2026-04-07T10:00:00Z',
    hitCount: 0,
    ...overrides,
  });

  describe('saveLearning + readAllLearnings', () => {
    it('round-trips a learning to disk', async () => {
      const learning = makeLearning();
      await saveLearning(tmpDir, learning);

      const all = await readAllLearnings(tmpDir);
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(learning);
    });

    it('saves multiple learnings', async () => {
      await saveLearning(tmpDir, makeLearning({ id: 'a' }));
      await saveLearning(tmpDir, makeLearning({ id: 'b' }));

      const all = await readAllLearnings(tmpDir);
      expect(all).toHaveLength(2);
    });

    it('returns empty array when directory does not exist', async () => {
      const all = await readAllLearnings(join(tmpDir, 'nonexistent'));
      expect(all).toEqual([]);
    });
  });

  describe('searchLearnings', () => {
    beforeEach(async () => {
      await saveLearning(tmpDir, makeLearning({ id: 'a', pattern: 'type_mismatch', files: ['src/foo.ts'] }));
      await saveLearning(tmpDir, makeLearning({ id: 'b', pattern: 'race_condition', symptom: 'timeout in tests', files: ['src/bar.ts'] }));
      await saveLearning(tmpDir, makeLearning({ id: 'c', pattern: 'type_mismatch', files: ['src/baz.ts'], symptom: 'ZodError parsing config' }));
    });

    it('filters by pattern', async () => {
      const results = await searchLearnings(tmpDir, { pattern: 'type_mismatch' });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.pattern === 'type_mismatch')).toBe(true);
    });

    it('filters by file overlap', async () => {
      const results = await searchLearnings(tmpDir, { files: ['src/foo.ts'] });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('a');
    });

    it('filters by symptom substring', async () => {
      const results = await searchLearnings(tmpDir, { symptom: 'timeout' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('b');
    });

    it('combines criteria (AND)', async () => {
      const results = await searchLearnings(tmpDir, { pattern: 'type_mismatch', symptom: 'Zod' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('c');
    });

    it('returns all when no criteria', async () => {
      const results = await searchLearnings(tmpDir, {});
      expect(results).toHaveLength(3);
    });
  });

  describe('incrementHitCount', () => {
    it('increments hit count by 1', async () => {
      await saveLearning(tmpDir, makeLearning({ id: 'x', hitCount: 0 }));
      await incrementHitCount(tmpDir, 'x');

      const all = await readAllLearnings(tmpDir);
      expect(all[0].hitCount).toBe(1);
    });

    it('handles missing learning gracefully', async () => {
      await expect(incrementHitCount(tmpDir, 'nonexistent')).resolves.not.toThrow();
    });
  });
});
