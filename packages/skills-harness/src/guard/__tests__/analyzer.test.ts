/**
 * Tests for guard analyzer.
 * Validates combined lint + anti-pattern + tribal knowledge analysis.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { StateApi, FileStoreApi } from '@sunco/core';
import type { BoundariesConfig } from '../../lint/types.js';
import { analyzeFile, analyzeProject } from '../analyzer.js';
import type { TribalPattern } from '../types.js';

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

/** Create a mock FileStoreApi */
function createMockFileStore(files: Map<string, Map<string, string>> = new Map()): FileStoreApi {
  return {
    async read(category: string, filename: string): Promise<string | undefined> {
      return files.get(category)?.get(filename);
    },
    async write(category: string, filename: string, content: string): Promise<void> {
      if (!files.has(category)) files.set(category, new Map());
      files.get(category)!.set(filename, content);
    },
    async delete(category: string, filename: string): Promise<boolean> {
      return files.get(category)?.delete(filename) ?? false;
    },
    async list(category: string): Promise<string[]> {
      const categoryFiles = files.get(category);
      return categoryFiles ? [...categoryFiles.keys()] : [];
    },
    async exists(category: string, filename: string): Promise<boolean> {
      return files.get(category)?.has(filename) ?? false;
    },
  };
}

/** Empty boundaries config for basic tests */
const emptyBoundariesConfig: BoundariesConfig = {
  elements: [],
  dependencyRules: [],
};

describe('analyzeFile', () => {
  it('combines lint results + anti-pattern detection for one file', async () => {
    const fileContent = `
const x: any = 1;
console.log(x);
// TODO: fix this
export {};
`;

    const result = await analyzeFile({
      filePath: 'src/test.ts',
      fileContent,
      boundariesConfig: emptyBoundariesConfig,
      tribalPatterns: [],
      cwd: process.cwd(),
    });

    expect(result).toHaveProperty('violations');
    expect(result).toHaveProperty('antiPatterns');
    expect(result).toHaveProperty('tribalWarnings');
    expect(Array.isArray(result.antiPatterns)).toBe(true);

    // Should detect anti-patterns: any-type, console-log, todo-comment
    const patternIds = result.antiPatterns.map((a) => a.pattern);
    expect(patternIds).toContain('any-type');
    expect(patternIds).toContain('console-log');
    expect(patternIds).toContain('todo-comment');
  });

  it('includes tribal pattern matches as warnings', async () => {
    const tribalPatterns: TribalPattern[] = [
      {
        id: 'no-direct-db',
        pattern: /import.*from.*database/,
        message: 'Use repository pattern instead of direct database imports',
        source: 'db-patterns.tribal',
      },
    ];

    const fileContent = `import { query } from '../database/connection';\nexport {};\n`;

    const result = await analyzeFile({
      filePath: 'src/service.ts',
      fileContent,
      boundariesConfig: emptyBoundariesConfig,
      tribalPatterns,
      cwd: process.cwd(),
    });

    expect(result.tribalWarnings.length).toBeGreaterThan(0);
    expect(result.tribalWarnings[0]!.source).toBe('db-patterns.tribal');
    expect(result.tribalWarnings[0]!.message).toContain('repository pattern');
  });
});

describe('analyzeProject', () => {
  let state: ReturnType<typeof createMockState>;
  let fileStore: FileStoreApi;
  let tempDir: string | undefined;

  beforeEach(() => {
    state = createMockState();
    fileStore = createMockFileStore();
    tempDir = undefined;
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns a GuardResult with all expected fields', async () => {
    // Note: analyzeProject uses file system scanning, which may find no files
    // in a random cwd. We test the shape of the result.
    const result = await analyzeProject({
      cwd: '/tmp/nonexistent-test-dir',
      fileStore,
      state,
      boundariesConfig: emptyBoundariesConfig,
    });

    expect(result).toHaveProperty('filesAnalyzed');
    expect(result).toHaveProperty('lintViolations');
    expect(result).toHaveProperty('antiPatterns');
    expect(result).toHaveProperty('promotionSuggestions');
    expect(result).toHaveProperty('tribalWarnings');
    expect(typeof result.filesAnalyzed).toBe('number');
  });

  it('scopes analysis to explicitly provided source files', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-guard-scope-'));
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'changed.ts'), 'const changed: any = 1;\nexport {};\n');
    await writeFile(join(tempDir, 'src', 'unchanged.ts'), 'console.log("noise");\nexport {};\n');

    const result = await analyzeProject({
      cwd: tempDir,
      fileStore,
      state,
      boundariesConfig: emptyBoundariesConfig,
      files: ['src/changed.ts'],
    });

    expect(result.filesAnalyzed).toBe(1);
    expect(result.antiPatterns.some((pattern) => pattern.file === 'src/changed.ts')).toBe(true);
    expect(result.antiPatterns.some((pattern) => pattern.file === 'src/unchanged.ts')).toBe(false);
  });
});
