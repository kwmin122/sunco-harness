/**
 * Tests for ecosystem detector.
 * Uses temporary directories with fixture files.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectEcosystems } from '../ecosystem-detector.js';

describe('detectEcosystems', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-eco-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns nodejs + typescript when package.json and tsconfig.json exist', async () => {
    await writeFile(join(tempDir, 'package.json'), '{}');
    await writeFile(join(tempDir, 'tsconfig.json'), '{}');

    const result = await detectEcosystems({ cwd: tempDir });

    expect(result.ecosystems).toContain('nodejs');
    expect(result.ecosystems).toContain('typescript');
    expect(result.markers.length).toBeGreaterThanOrEqual(2);
  });

  it('returns rust when Cargo.toml exists', async () => {
    await writeFile(join(tempDir, 'Cargo.toml'), '[package]\nname = "test"');

    const result = await detectEcosystems({ cwd: tempDir });

    expect(result.ecosystems).toEqual(['rust']);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0]!.ecosystem).toBe('rust');
  });

  it('returns empty for a bare directory', async () => {
    const result = await detectEcosystems({ cwd: tempDir });

    expect(result.ecosystems).toEqual([]);
    expect(result.markers).toEqual([]);
    expect(result.primaryEcosystem).toBeNull();
  });

  it('returns multiple ecosystems (e.g., nodejs + typescript + python)', async () => {
    await writeFile(join(tempDir, 'package.json'), '{}');
    await writeFile(join(tempDir, 'tsconfig.json'), '{}');
    await writeFile(join(tempDir, 'requirements.txt'), 'flask');

    const result = await detectEcosystems({ cwd: tempDir });

    expect(result.ecosystems).toContain('nodejs');
    expect(result.ecosystems).toContain('typescript');
    expect(result.ecosystems).toContain('python');
    // Deduplicated
    const uniqueCount = new Set(result.ecosystems).size;
    expect(result.ecosystems.length).toBe(uniqueCount);
  });

  it('primaryEcosystem picks the first high-confidence match', async () => {
    await writeFile(join(tempDir, 'package.json'), '{}');
    await writeFile(join(tempDir, 'requirements.txt'), 'flask');

    const result = await detectEcosystems({ cwd: tempDir });

    // package.json is high-confidence nodejs, requirements.txt is medium-confidence python
    expect(result.primaryEcosystem).toBe('nodejs');
  });

  it('handles .csproj glob pattern for dotnet detection', async () => {
    await writeFile(join(tempDir, 'MyApp.csproj'), '<Project/>');

    const result = await detectEcosystems({ cwd: tempDir });

    expect(result.ecosystems).toContain('dotnet');
  });
});
