/**
 * Tests for layer detector.
 * Uses temporary directories with fixture directory structures.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectLayers } from '../layer-detector.js';

describe('detectLayers', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-layer-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('finds domain layer when src/services/ directory exists', async () => {
    await mkdir(join(tempDir, 'src', 'services'), { recursive: true });

    const result = await detectLayers({ cwd: tempDir });

    const domainLayer = result.layers.find((l) => l.name === 'domain');
    expect(domainLayer).toBeDefined();
    expect(domainLayer!.pattern).toContain('services');
  });

  it('finds ui layer when src/components/ directory exists', async () => {
    await mkdir(join(tempDir, 'src', 'components'), { recursive: true });

    const result = await detectLayers({ cwd: tempDir });

    const uiLayer = result.layers.find((l) => l.name === 'ui');
    expect(uiLayer).toBeDefined();
    expect(uiLayer!.pattern).toContain('components');
  });

  it('returns empty layers for a flat src/ with no recognized directories', async () => {
    await mkdir(join(tempDir, 'src', 'stuff'), { recursive: true });

    const result = await detectLayers({ cwd: tempDir });

    expect(result.layers).toEqual([]);
    expect(result.sourceRoot).toBe('src');
  });

  it('sets correct canImportFrom based on COMMON_LAYER_PATTERNS', async () => {
    await mkdir(join(tempDir, 'src', 'types'), { recursive: true });
    await mkdir(join(tempDir, 'src', 'utils'), { recursive: true });
    await mkdir(join(tempDir, 'src', 'services'), { recursive: true });

    const result = await detectLayers({ cwd: tempDir });

    const typesLayer = result.layers.find((l) => l.name === 'types');
    const utilsLayer = result.layers.find((l) => l.name === 'utils');
    const domainLayer = result.layers.find((l) => l.name === 'domain');

    expect(typesLayer!.canImportFrom).toEqual([]);
    expect(utilsLayer!.canImportFrom).toContain('types');
    expect(utilsLayer!.canImportFrom).toContain('config');
    expect(domainLayer!.canImportFrom).toContain('types');
    expect(domainLayer!.canImportFrom).toContain('config');
    expect(domainLayer!.canImportFrom).toContain('utils');
  });

  it('discovers sourceRoot as src when src/ directory exists', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });

    const result = await detectLayers({ cwd: tempDir });

    expect(result.sourceRoot).toBe('src');
  });

  it('returns null sourceRoot when no standard source directory exists', async () => {
    // bare temp directory with nothing
    const result = await detectLayers({ cwd: tempDir });

    expect(result.sourceRoot).toBeNull();
    expect(result.layers).toEqual([]);
  });
});
