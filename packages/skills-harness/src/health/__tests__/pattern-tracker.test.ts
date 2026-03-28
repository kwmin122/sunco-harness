/**
 * Tests for pattern tracker.
 * Uses temporary directories with fixture source files and mock StateApi.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { StateApi } from '@sunco/core';
import { trackPatterns, getPatternTrends } from '../pattern-tracker.js';

/** Create a mock StateApi backed by a plain Map */
function createMockState(): StateApi & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return store.get(key) as T | undefined;
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<boolean> {
      return store.delete(key);
    },
    async list(prefix?: string): Promise<string[]> {
      const keys = [...store.keys()];
      if (!prefix) return keys;
      return keys.filter((k) => k.startsWith(prefix));
    },
    async has(key: string): Promise<boolean> {
      return store.has(key);
    },
  };
}

describe('trackPatterns', () => {
  let tempDir: string;
  let state: ReturnType<typeof createMockState>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-patterns-'));
    state = createMockState();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('counts "any" type occurrences across .ts files', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(
      join(tempDir, 'src', 'foo.ts'),
      `const x: any = 1;\nconst y = z as any;\n`,
    );
    await writeFile(
      join(tempDir, 'src', 'bar.ts'),
      `function doSomething(input: any) { return input; }\n`,
    );

    const counts = await trackPatterns({ cwd: tempDir, state });

    const anyCount = counts.find((c) => c.pattern === 'any-type');
    expect(anyCount).toBeDefined();
    expect(anyCount!.count).toBeGreaterThanOrEqual(3);
    expect(anyCount!.files.length).toBeGreaterThanOrEqual(2);
  });

  it('stores snapshot via StateApi.set with ISO timestamp key', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'foo.ts'), 'const x = 1;\n');

    await trackPatterns({ cwd: tempDir, state });

    const keys = await state.list('health.snapshot.');
    expect(keys.length).toBe(1);
    expect(keys[0]).toMatch(/^health\.snapshot\.\d{4}-\d{2}-\d{2}T/);
  });
});

describe('getPatternTrends', () => {
  let state: ReturnType<typeof createMockState>;

  beforeEach(() => {
    state = createMockState();
  });

  it('returns trend "increasing" when current count > previous snapshot', async () => {
    // Store previous snapshot with lower counts
    const previousDate = new Date(Date.now() - 86400000).toISOString();
    await state.set(`health.snapshot.${previousDate}`, {
      date: previousDate,
      patterns: [
        { pattern: 'any-type', count: 5, files: ['a.ts'] },
        { pattern: 'console-log', count: 2, files: ['b.ts'] },
      ],
    });

    // Current counts are higher
    const currentCounts = [
      { pattern: 'any-type', count: 15, files: ['a.ts', 'c.ts'] },
      { pattern: 'console-log', count: 3, files: ['b.ts'] },
    ];

    const trends = await getPatternTrends(state, currentCounts);

    const anyTrend = trends.find((t) => t.pattern === 'any-type');
    expect(anyTrend).toBeDefined();
    expect(anyTrend!.trend).toBe('increasing');
    expect(anyTrend!.changePercent).toBeGreaterThan(10);
  });

  it('returns trend "stable" when count unchanged', async () => {
    const previousDate = new Date(Date.now() - 86400000).toISOString();
    await state.set(`health.snapshot.${previousDate}`, {
      date: previousDate,
      patterns: [
        { pattern: 'any-type', count: 10, files: ['a.ts'] },
      ],
    });

    const currentCounts = [
      { pattern: 'any-type', count: 10, files: ['a.ts'] },
    ];

    const trends = await getPatternTrends(state, currentCounts);

    const anyTrend = trends.find((t) => t.pattern === 'any-type');
    expect(anyTrend).toBeDefined();
    expect(anyTrend!.trend).toBe('stable');
    expect(anyTrend!.changePercent).toBe(0);
  });

  it('handles no previous snapshots (first run)', async () => {
    const currentCounts = [
      { pattern: 'any-type', count: 5, files: ['a.ts'] },
    ];

    const trends = await getPatternTrends(state, currentCounts);

    const anyTrend = trends.find((t) => t.pattern === 'any-type');
    expect(anyTrend).toBeDefined();
    expect(anyTrend!.trend).toBe('stable');
    expect(anyTrend!.previousCount).toBe(0);
  });
});
