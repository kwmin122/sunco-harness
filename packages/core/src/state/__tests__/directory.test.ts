/**
 * @sunco/core - Directory Structure Tests
 *
 * Tests for .sun/ directory initialization and management.
 * Covers: STE-01 (.sun/ directory structure)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { initSunDirectory, ensureSunDir } from '../directory.js';
import { SUN_DIR_STRUCTURE } from '../types.js';

describe('initSunDirectory', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sunco-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates .sun/ root directory', async () => {
    await initSunDirectory(tempDir);

    const sunDir = path.join(tempDir, SUN_DIR_STRUCTURE.root);
    const stat = await fs.stat(sunDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('creates rules/ subdirectory', async () => {
    await initSunDirectory(tempDir);

    const rulesDir = path.join(tempDir, SUN_DIR_STRUCTURE.rules);
    const stat = await fs.stat(rulesDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('creates tribal/ subdirectory', async () => {
    await initSunDirectory(tempDir);

    const tribalDir = path.join(tempDir, SUN_DIR_STRUCTURE.tribal);
    const stat = await fs.stat(tribalDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('creates scenarios/ subdirectory', async () => {
    await initSunDirectory(tempDir);

    const scenariosDir = path.join(tempDir, SUN_DIR_STRUCTURE.scenarios);
    const stat = await fs.stat(scenariosDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('creates planning/ subdirectory', async () => {
    await initSunDirectory(tempDir);

    const planningDir = path.join(tempDir, SUN_DIR_STRUCTURE.planning);
    const stat = await fs.stat(planningDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('creates logs/ subdirectory', async () => {
    await initSunDirectory(tempDir);

    const logsDir = path.join(tempDir, SUN_DIR_STRUCTURE.logs);
    const stat = await fs.stat(logsDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('creates .gitignore with db file patterns', async () => {
    await initSunDirectory(tempDir);

    const gitignorePath = path.join(tempDir, SUN_DIR_STRUCTURE.gitignore);
    const content = await fs.readFile(gitignorePath, 'utf-8');

    expect(content).toContain('state.db');
    expect(content).toContain('state.db-wal');
    expect(content).toContain('state.db-shm');
  });

  it('is idempotent -- calling twice does not error', async () => {
    await initSunDirectory(tempDir);
    await expect(initSunDirectory(tempDir)).resolves.not.toThrow();

    // Verify structure still intact after second call
    const sunDir = path.join(tempDir, SUN_DIR_STRUCTURE.root);
    const stat = await fs.stat(sunDir);
    expect(stat.isDirectory()).toBe(true);
  });
});

describe('ensureSunDir', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sunco-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns full path to .sun/ directory', async () => {
    const sunDir = await ensureSunDir(tempDir);
    expect(sunDir).toBe(path.join(tempDir, '.sun'));
  });

  it('creates .sun/ if it does not exist', async () => {
    const sunDir = await ensureSunDir(tempDir);
    const stat = await fs.stat(sunDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('does not error if .sun/ already exists', async () => {
    await initSunDirectory(tempDir);
    const sunDir = await ensureSunDir(tempDir);
    expect(sunDir).toBe(path.join(tempDir, '.sun'));
  });
});
