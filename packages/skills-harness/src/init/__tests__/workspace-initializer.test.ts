/**
 * Tests for workspace initialization.
 * Uses in-memory FileStoreApi mock.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import { initializeWorkspace } from '../workspace-initializer.js';
import type { InitResult } from '../types.js';
import type { FileStoreApi } from '@sunco/core';

/**
 * In-memory mock for FileStoreApi.
 * Stores files as Map<"category/filename", content>.
 */
function createMockFileStore(): FileStoreApi & { files: Map<string, string> } {
  const files = new Map<string, string>();

  return {
    files,
    async read(category: string, filename: string): Promise<string | undefined> {
      const key = category ? `${category}/${filename}` : filename;
      return files.get(key);
    },
    async write(category: string, filename: string, content: string): Promise<void> {
      const key = category ? `${category}/${filename}` : filename;
      files.set(key, content);
    },
    async delete(category: string, filename: string): Promise<boolean> {
      const key = category ? `${category}/${filename}` : filename;
      return files.delete(key);
    },
    async list(category: string): Promise<string[]> {
      const prefix = category ? `${category}/` : '';
      return [...files.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length));
    },
    async exists(category: string, filename: string): Promise<boolean> {
      const key = category ? `${category}/${filename}` : filename;
      return files.has(key);
    },
  };
}

/** Fixture InitResult for a TypeScript/Node.js project */
function createFixtureInitResult(): InitResult {
  return {
    ecosystems: {
      ecosystems: ['nodejs', 'typescript'],
      markers: [
        { file: 'package.json', ecosystem: 'nodejs', confidence: 'high' },
        { file: 'tsconfig.json', ecosystem: 'typescript', confidence: 'high' },
      ],
      primaryEcosystem: 'nodejs',
    },
    layers: {
      layers: [
        {
          name: 'types',
          pattern: 'src/types/*',
          dirPatterns: ['types', 'typings', 'interfaces'],
          canImportFrom: [],
        },
        {
          name: 'domain',
          pattern: 'src/services/*',
          dirPatterns: ['domain', 'models', 'entities', 'services', 'core'],
          canImportFrom: ['types', 'config', 'utils'],
        },
      ],
      sourceRoot: 'src',
    },
    conventions: {
      naming: 'camelCase',
      importStyle: 'relative',
      exportStyle: 'named',
      testOrganization: '__tests__',
      sampleSize: 25,
    },
    projectRoot: '/tmp/test-project',
    timestamp: '2026-03-28T00:00:00.000Z',
  };
}

describe('initializeWorkspace', () => {
  let fileStore: ReturnType<typeof createMockFileStore>;
  let initResult: InitResult;

  beforeEach(() => {
    fileStore = createMockFileStore();
    initResult = createFixtureInitResult();
  });

  it('writes config.toml to root via FileStoreApi', async () => {
    await initializeWorkspace({ initResult, fileStore });

    expect(fileStore.files.has('config.toml')).toBe(true);
    const content = fileStore.files.get('config.toml')!;
    expect(content).toBeTruthy();
    // Verify it's valid TOML
    expect(() => parseToml(content)).not.toThrow();
  });

  it('config.toml contains [stack] section with detected ecosystems', async () => {
    await initializeWorkspace({ initResult, fileStore });

    const content = fileStore.files.get('config.toml')!;
    const parsed = parseToml(content) as Record<string, unknown>;

    expect(parsed['stack']).toBeDefined();
    const stack = parsed['stack'] as Record<string, unknown>;
    expect(stack['ecosystems']).toEqual(['nodejs', 'typescript']);
    expect(stack['primary']).toBe('nodejs');
    expect(stack['preset']).toBe('typescript-node');
  });

  it('config.toml contains [layers] section with detected layer names + patterns', async () => {
    await initializeWorkspace({ initResult, fileStore });

    const content = fileStore.files.get('config.toml')!;
    const parsed = parseToml(content) as Record<string, unknown>;

    expect(parsed['layers']).toBeDefined();
    const layers = parsed['layers'] as Record<string, unknown>;
    expect(layers['source_root']).toBe('src');
    expect(Array.isArray(layers['detected'])).toBe(true);
    const detected = layers['detected'] as Array<Record<string, unknown>>;
    expect(detected.length).toBe(2);
    expect(detected[0]!['name']).toBe('types');
    expect(detected[0]!['pattern']).toBe('src/types/*');
    expect(detected[1]!['name']).toBe('domain');
  });

  it('writes boundary lint rule JSON to .sun/rules/arch-layers.json', async () => {
    await initializeWorkspace({ initResult, fileStore });

    expect(fileStore.files.has('rules/arch-layers.json')).toBe(true);
    const content = fileStore.files.get('rules/arch-layers.json')!;
    const rule = JSON.parse(content) as Record<string, unknown>;
    expect(rule['id']).toBe('arch-layers');
  });

  it('lint rule JSON has correct structure with boundaries/dependencies', async () => {
    await initializeWorkspace({ initResult, fileStore });

    const content = fileStore.files.get('rules/arch-layers.json')!;
    const rule = JSON.parse(content) as Record<string, unknown>;

    expect(rule['source']).toBe('init-generated');
    expect(rule['createdAt']).toBeTruthy();

    const eslintConfig = rule['eslintConfig'] as Record<string, unknown>;
    expect(eslintConfig).toBeDefined();

    const settings = eslintConfig['settings'] as Record<string, unknown>;
    expect(settings['boundaries/elements']).toBeDefined();
    const elements = settings['boundaries/elements'] as Array<Record<string, unknown>>;
    expect(elements.length).toBeGreaterThan(0);
    // Verify each element has type and pattern
    for (const el of elements) {
      expect(el['type']).toBeTruthy();
      expect(el['pattern']).toBeTruthy();
    }

    const rules = eslintConfig['rules'] as Record<string, unknown>;
    expect(rules['boundaries/dependencies']).toBeDefined();
  });

  it('creates placeholder .gitkeep files for tribal, scenarios, planning directories', async () => {
    await initializeWorkspace({ initResult, fileStore });

    expect(fileStore.files.has('tribal/.gitkeep')).toBe(true);
    expect(fileStore.files.has('scenarios/.gitkeep')).toBe(true);
    expect(fileStore.files.has('planning/.gitkeep')).toBe(true);
  });

  it('returns early with warning when force=false and config.toml exists', async () => {
    // Pre-populate config.toml
    await fileStore.write('', 'config.toml', '# existing config');

    const result = await initializeWorkspace({ initResult, fileStore, force: false });

    // Should not overwrite existing config
    expect(fileStore.files.get('config.toml')).toBe('# existing config');
    expect(result.rulesGenerated).toBe(0);
  });

  it('overwrites existing config when force=true', async () => {
    await fileStore.write('', 'config.toml', '# existing config');

    const result = await initializeWorkspace({ initResult, fileStore, force: true });

    // Should overwrite
    const content = fileStore.files.get('config.toml')!;
    expect(content).not.toBe('# existing config');
    expect(result.rulesGenerated).toBeGreaterThan(0);
  });

  it('returns rulesGenerated count and resolved preset', async () => {
    const result = await initializeWorkspace({ initResult, fileStore });

    expect(result.rulesGenerated).toBeGreaterThanOrEqual(1);
    expect(result.preset.id).toBe('typescript-node');
    expect(result.configPath).toBe('config.toml');
  });
});
