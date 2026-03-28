/**
 * @sunco/core - loadConfig tests
 *
 * Tests three-layer TOML config loading:
 *   global (~/.sun/config.toml) <- project (.sun/config.toml) <- directory (.sun.toml)
 *
 * Uses temp directories to simulate the three layers.
 * Tests: defaults, single layer, three-layer merge priority, invalid TOML,
 * immutable result (Object.freeze), and missing files silently skipped.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../loader.js';
import { ConfigError } from '../../errors/index.js';

describe('loadConfig', () => {
  let tmpDir: string;
  let homeDir: string;
  let projectDir: string;
  let subDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sunco-config-test-'));
    // Simulate home directory
    homeDir = join(tmpDir, 'home');
    await mkdir(join(homeDir, '.sun'), { recursive: true });
    // Simulate project directory with .sun/ marker
    projectDir = join(tmpDir, 'project');
    await mkdir(join(projectDir, '.sun'), { recursive: true });
    // Simulate subdirectory inside the project
    subDir = join(projectDir, 'src', 'deep');
    await mkdir(subDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when no TOML files exist', async () => {
    const emptyDir = join(tmpDir, 'empty');
    await mkdir(emptyDir, { recursive: true });
    const config = await loadConfig(emptyDir, { homeDir });
    expect(config.skills).toEqual({ preset: 'none', add: [], remove: [] });
    expect(config.agent.timeout).toBe(120_000);
    expect(config.ui.theme).toBe('default');
    expect(config.state.dbPath).toBe('.sun/state.db');
  });

  it('loads global config only', async () => {
    await writeFile(
      join(homeDir, '.sun', 'config.toml'),
      '[agent]\ntimeout = 30000\n',
    );
    const config = await loadConfig(projectDir, { homeDir });
    expect(config.agent.timeout).toBe(30_000);
    expect(config.agent.defaultProvider).toBe('claude-code-cli'); // default
  });

  it('project config overrides global config', async () => {
    await writeFile(
      join(homeDir, '.sun', 'config.toml'),
      '[agent]\ntimeout = 30000\n',
    );
    await writeFile(
      join(projectDir, '.sun', 'config.toml'),
      '[agent]\ntimeout = 60000\n',
    );
    const config = await loadConfig(projectDir, { homeDir });
    expect(config.agent.timeout).toBe(60_000);
  });

  it('directory config overrides project config (3-layer merge)', async () => {
    await writeFile(
      join(homeDir, '.sun', 'config.toml'),
      '[ui]\ntheme = "global"\n',
    );
    await writeFile(
      join(projectDir, '.sun', 'config.toml'),
      '[ui]\ntheme = "project"\n',
    );
    await writeFile(
      join(projectDir, '.sun.toml'),
      '[ui]\ntheme = "directory"\n',
    );
    const config = await loadConfig(projectDir, { homeDir });
    expect(config.ui.theme).toBe('directory');
  });

  it('subdirectory finds project root by walking up', async () => {
    await writeFile(
      join(projectDir, '.sun', 'config.toml'),
      '[agent]\ntimeout = 99000\n',
    );
    const config = await loadConfig(subDir, { homeDir });
    expect(config.agent.timeout).toBe(99_000);
  });

  it('throws ConfigError on invalid TOML syntax', async () => {
    await writeFile(
      join(projectDir, '.sun', 'config.toml'),
      'this is [[[not valid toml',
    );
    await expect(loadConfig(projectDir, { homeDir })).rejects.toThrow(
      ConfigError,
    );
  });

  it('ConfigError for TOML syntax includes file path', async () => {
    const badPath = join(projectDir, '.sun', 'config.toml');
    await writeFile(badPath, 'this is [[[not valid toml');
    try {
      await loadConfig(projectDir, { homeDir });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const configErr = err as ConfigError;
      expect(configErr.message).toContain(badPath);
    }
  });

  it('result is frozen (immutable)', async () => {
    const config = await loadConfig(projectDir, { homeDir });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('arrays replace across layers (not concatenate)', async () => {
    await writeFile(
      join(homeDir, '.sun', 'config.toml'),
      '[skills]\nadd = ["lint", "health"]\n',
    );
    await writeFile(
      join(projectDir, '.sun', 'config.toml'),
      '[skills]\nadd = ["guard"]\n',
    );
    const config = await loadConfig(projectDir, { homeDir });
    expect(config.skills.add).toEqual(['guard']);
  });

  it('merges different sections across layers', async () => {
    await writeFile(
      join(homeDir, '.sun', 'config.toml'),
      '[agent]\ntimeout = 5000\n',
    );
    await writeFile(
      join(projectDir, '.sun', 'config.toml'),
      '[ui]\ntheme = "dark"\n',
    );
    const config = await loadConfig(projectDir, { homeDir });
    expect(config.agent.timeout).toBe(5_000);
    expect(config.ui.theme).toBe('dark');
  });

  it('throws ConfigError on invalid values after merge', async () => {
    await writeFile(
      join(projectDir, '.sun', 'config.toml'),
      '[agent]\ntimeout = "slow"\n',
    );
    await expect(loadConfig(projectDir, { homeDir })).rejects.toThrow(
      ConfigError,
    );
  });
});
