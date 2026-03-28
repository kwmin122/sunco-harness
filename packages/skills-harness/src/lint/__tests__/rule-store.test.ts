/**
 * Tests for lint rule store.
 * Uses in-memory mock of FileStoreApi.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { FileStoreApi } from '@sunco/core';
import type { SunLintRule } from '../types.js';
import { loadRules, saveRule } from '../rule-store.js';

/** In-memory mock of FileStoreApi */
function createMockFileStore(): FileStoreApi {
  const storage = new Map<string, Map<string, string>>();

  return {
    async read(category: string, filename: string): Promise<string | undefined> {
      return storage.get(category)?.get(filename);
    },
    async write(category: string, filename: string, content: string): Promise<void> {
      if (!storage.has(category)) {
        storage.set(category, new Map());
      }
      storage.get(category)!.set(filename, content);
    },
    async delete(category: string, filename: string): Promise<boolean> {
      const cat = storage.get(category);
      if (!cat?.has(filename)) return false;
      cat.delete(filename);
      return true;
    },
    async list(category: string): Promise<string[]> {
      const cat = storage.get(category);
      return cat ? Array.from(cat.keys()) : [];
    },
    async exists(category: string, filename: string): Promise<boolean> {
      return storage.get(category)?.has(filename) ?? false;
    },
  };
}

describe('rule-store', () => {
  let fileStore: FileStoreApi;

  beforeEach(() => {
    fileStore = createMockFileStore();
  });

  it('loadRules returns empty array when .sun/rules/ has no JSON files', async () => {
    const rules = await loadRules(fileStore);
    expect(rules).toEqual([]);
  });

  it('loadRules parses valid SunLintRule JSON from fileStore', async () => {
    const rule: SunLintRule = {
      id: 'boundary-ui-infra',
      source: 'init-generated',
      createdAt: '2026-03-28T00:00:00Z',
      pattern: 'UI layer must not import from infra layer',
      eslintConfig: {
        rules: { 'boundaries/dependencies': [2] },
      },
    };
    await fileStore.write('rules', 'boundary-ui-infra.json', JSON.stringify(rule));

    const rules = await loadRules(fileStore);

    expect(rules).toHaveLength(1);
    expect(rules[0]!.id).toBe('boundary-ui-infra');
    expect(rules[0]!.source).toBe('init-generated');
    expect(rules[0]!.pattern).toBe('UI layer must not import from infra layer');
  });

  it('saveRule writes JSON to fileStore with correct category "rules"', async () => {
    const rule: SunLintRule = {
      id: 'no-direct-db',
      source: 'guard-promoted',
      createdAt: '2026-03-28T12:00:00Z',
      pattern: 'Handlers must not directly access database',
      eslintConfig: {
        rules: { 'no-restricted-imports': ['error', { patterns: ['**/db/**'] }] },
      },
    };

    await saveRule(fileStore, rule);

    const content = await fileStore.read('rules', 'no-direct-db.json');
    expect(content).toBeDefined();
    const parsed = JSON.parse(content!);
    expect(parsed.id).toBe('no-direct-db');
    expect(parsed.source).toBe('guard-promoted');
  });

  it('loadRules skips non-JSON files in .sun/rules/', async () => {
    const rule: SunLintRule = {
      id: 'valid-rule',
      source: 'user-defined',
      createdAt: '2026-03-28T00:00:00Z',
      pattern: 'Test rule',
      eslintConfig: { rules: {} },
    };
    await fileStore.write('rules', 'valid-rule.json', JSON.stringify(rule));
    await fileStore.write('rules', 'README.md', '# Rules documentation');
    await fileStore.write('rules', 'backup.bak', 'some backup data');

    const rules = await loadRules(fileStore);

    expect(rules).toHaveLength(1);
    expect(rules[0]!.id).toBe('valid-rule');
  });
});
