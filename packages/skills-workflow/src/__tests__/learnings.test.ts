import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logLearning, readAllLearnings, searchLearnings, getLearningsCount } from '../shared/learnings.js';

describe('learnings (universal)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sun-learn-'));
  });

  describe('logLearning', () => {
    it('creates a learning with auto-generated id and timestamp', async () => {
      const result = await logLearning(tmpDir, {
        skill: 'workflow.debug',
        type: 'pitfall',
        key: 'sqlite-busy',
        insight: 'SQLITE_BUSY happens when two agents write concurrently',
        confidence: 8,
        source: 'observed',
      });
      expect(result.id).toMatch(/^learn-/);
      expect(result.createdAt).toBeTruthy();
      expect(result.hitCount).toBe(0);
    });

    it('persists to JSONL file', async () => {
      await logLearning(tmpDir, {
        skill: 'workflow.ship',
        type: 'pattern',
        key: 'version-bump',
        insight: 'Always bump version before changelog',
        confidence: 9,
        source: 'user-stated',
      });
      const all = await readAllLearnings(tmpDir);
      expect(all).toHaveLength(1);
      expect(all[0].key).toBe('version-bump');
    });

    it('deduplicates by key+type (latest wins)', async () => {
      await logLearning(tmpDir, {
        skill: 'workflow.debug',
        type: 'pitfall',
        key: 'cache-stale',
        insight: 'Old insight',
        confidence: 5,
        source: 'inferred',
      });
      await logLearning(tmpDir, {
        skill: 'workflow.debug',
        type: 'pitfall',
        key: 'cache-stale',
        insight: 'Updated insight',
        confidence: 8,
        source: 'observed',
      });
      const all = await readAllLearnings(tmpDir);
      expect(all).toHaveLength(1);
      expect(all[0].insight).toBe('Updated insight');
      expect(all[0].confidence).toBe(8);
    });

    it('allows same key with different type', async () => {
      await logLearning(tmpDir, { skill: 's', type: 'pitfall', key: 'k', insight: 'a', confidence: 5, source: 'observed' });
      await logLearning(tmpDir, { skill: 's', type: 'pattern', key: 'k', insight: 'b', confidence: 5, source: 'observed' });
      expect(await getLearningsCount(tmpDir)).toBe(2);
    });
  });

  describe('searchLearnings', () => {
    beforeEach(async () => {
      await logLearning(tmpDir, { skill: 'workflow.debug', type: 'pitfall', key: 'race', insight: 'Race condition in tests', confidence: 8, source: 'observed' });
      await logLearning(tmpDir, { skill: 'workflow.ship', type: 'pattern', key: 'pr-title', insight: 'Keep PR title under 72 chars', confidence: 9, source: 'user-stated' });
      await logLearning(tmpDir, { skill: 'workflow.debug', type: 'operational', key: 'vitest-json', insight: 'Use --reporter=json for parsing', confidence: 6, source: 'observed' });
    });

    it('filters by type', async () => {
      const results = await searchLearnings(tmpDir, { type: 'pitfall' });
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('race');
    });

    it('filters by skill', async () => {
      const results = await searchLearnings(tmpDir, { skill: 'workflow.debug' });
      expect(results).toHaveLength(2);
    });

    it('filters by minConfidence', async () => {
      const results = await searchLearnings(tmpDir, { minConfidence: 8 });
      expect(results).toHaveLength(2);
    });

    it('returns all sorted by confidence when no filter', async () => {
      const results = await searchLearnings(tmpDir);
      expect(results).toHaveLength(3);
      expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
    });

    it('returns empty for nonexistent dir', async () => {
      const results = await searchLearnings(join(tmpDir, 'nope'));
      expect(results).toEqual([]);
    });
  });
});
