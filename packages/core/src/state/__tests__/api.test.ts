/**
 * @sunco/core - StateEngine Integration Tests
 *
 * Tests for the combined StateEngine created by createStateEngine().
 * Verifies end-to-end: directory init + db + file store working together.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { createStateEngine } from '../api.js';
import type { StateEngine } from '../types.js';

describe('createStateEngine', () => {
  let tempDir: string;
  let engine: StateEngine;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sunco-engine-test-'));
    engine = createStateEngine();
  });

  afterEach(async () => {
    await engine.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('throws if state accessed before initialize', () => {
    expect(() => engine.state).toThrow('not initialized');
  });

  it('throws if fileStore accessed before initialize', () => {
    expect(() => engine.fileStore).toThrow('not initialized');
  });

  it('initializes .sun/ directory structure', async () => {
    await engine.initialize(tempDir);

    const sunDir = path.join(tempDir, '.sun');
    const stat = await fs.stat(sunDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('creates SQLite database at .sun/state.db', async () => {
    await engine.initialize(tempDir);

    const dbPath = path.join(tempDir, '.sun', 'state.db');
    const stat = await fs.stat(dbPath);
    expect(stat.isFile()).toBe(true);
  });

  it('state API works after initialize', async () => {
    await engine.initialize(tempDir);

    await engine.state.set('test.key', { value: 42 });
    const result = await engine.state.get<{ value: number }>('test.key');
    expect(result).toEqual({ value: 42 });
  });

  it('file store works after initialize', async () => {
    await engine.initialize(tempDir);

    await engine.fileStore.write('rules', 'test.md', '# Test Rule\n');
    const content = await engine.fileStore.read('rules', 'test.md');
    expect(content).toBe('# Test Rule\n');
  });

  it('state and file store work together', async () => {
    await engine.initialize(tempDir);

    // Write a rule file
    await engine.fileStore.write('rules', 'arch.md', '# Architecture\nNo circular deps');

    // Track rule metadata in state
    await engine.state.set('rules.arch', {
      path: 'rules/arch.md',
      createdAt: '2026-03-28',
      enabled: true,
    });

    // Verify both
    const metadata = await engine.state.get<{ enabled: boolean }>('rules.arch');
    expect(metadata?.enabled).toBe(true);

    const content = await engine.fileStore.read('rules', 'arch.md');
    expect(content).toContain('No circular deps');
  });

  it('close is idempotent', async () => {
    await engine.initialize(tempDir);
    await engine.close();
    await expect(engine.close()).resolves.not.toThrow();
  });

  it('close cleans up resources', async () => {
    await engine.initialize(tempDir);
    await engine.close();

    // After close, accessing state should throw
    expect(() => engine.state).toThrow('not initialized');
  });
});
