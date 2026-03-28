/**
 * @sunco/core - FileStore Tests
 *
 * Tests for flat file read/write operations in .sun/ subdirectories.
 * Covers: STE-03 (flat file artifacts)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { FileStore } from '../file-store.js';
import { initSunDirectory } from '../directory.js';

describe('FileStore', () => {
  let tempDir: string;
  let sunDir: string;
  let store: FileStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sunco-fs-test-'));
    await initSunDirectory(tempDir);
    sunDir = path.join(tempDir, '.sun');
    store = new FileStore(sunDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('read', () => {
    it('returns file content when file exists', async () => {
      // Manually write a file for the test
      await fs.writeFile(
        path.join(sunDir, 'rules', 'arch.md'),
        '# Architecture Rules\n',
      );

      const content = await store.read('rules', 'arch.md');
      expect(content).toBe('# Architecture Rules\n');
    });

    it('returns undefined when file does not exist', async () => {
      const content = await store.read('rules', 'nonexistent.md');
      expect(content).toBeUndefined();
    });

    it('returns undefined when category directory does not exist', async () => {
      const content = await store.read('nonexistent-category', 'file.md');
      expect(content).toBeUndefined();
    });
  });

  describe('write', () => {
    it('writes file to the correct location', async () => {
      await store.write('rules', 'arch.md', '# Architecture Rules\n');

      const filePath = path.join(sunDir, 'rules', 'arch.md');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('# Architecture Rules\n');
    });

    it('creates category directory if it does not exist', async () => {
      await store.write('custom', 'data.txt', 'some data');

      const filePath = path.join(sunDir, 'custom', 'data.txt');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('some data');
    });

    it('overwrites existing file', async () => {
      await store.write('rules', 'arch.md', 'v1');
      await store.write('rules', 'arch.md', 'v2');

      const content = await store.read('rules', 'arch.md');
      expect(content).toBe('v2');
    });
  });

  describe('exists', () => {
    it('returns true when file exists', async () => {
      await store.write('rules', 'arch.md', 'content');
      expect(await store.exists('rules', 'arch.md')).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      expect(await store.exists('rules', 'nonexistent.md')).toBe(false);
    });

    it('returns false when category does not exist', async () => {
      expect(await store.exists('nonexistent', 'file.md')).toBe(false);
    });
  });

  describe('delete', () => {
    it('returns true when file existed and was deleted', async () => {
      await store.write('rules', 'arch.md', 'content');
      const result = await store.delete('rules', 'arch.md');
      expect(result).toBe(true);
    });

    it('returns false when file did not exist', async () => {
      const result = await store.delete('rules', 'nonexistent.md');
      expect(result).toBe(false);
    });

    it('file is gone after deletion', async () => {
      await store.write('rules', 'arch.md', 'content');
      await store.delete('rules', 'arch.md');
      expect(await store.exists('rules', 'arch.md')).toBe(false);
    });
  });

  describe('list', () => {
    it('returns filenames in a category directory', async () => {
      await store.write('rules', 'arch.md', 'content1');
      await store.write('rules', 'naming.md', 'content2');

      const files = await store.list('rules');
      expect(files).toHaveLength(2);
      expect(files).toContain('arch.md');
      expect(files).toContain('naming.md');
    });

    it('returns empty array when category is empty', async () => {
      const files = await store.list('scenarios');
      expect(files).toEqual([]);
    });

    it('returns empty array when category does not exist', async () => {
      const files = await store.list('nonexistent');
      expect(files).toEqual([]);
    });
  });

  describe('path traversal protection', () => {
    it('throws on category with ../', async () => {
      await expect(store.read('../../../etc', 'passwd')).rejects.toThrow();
    });

    it('throws on filename with ../', async () => {
      await expect(store.read('rules', '../../../etc/passwd')).rejects.toThrow();
    });

    it('throws on category that resolves outside via ..', async () => {
      await expect(store.read('rules/../../..', 'passwd')).rejects.toThrow();
    });

    it('throws on write with path traversal', async () => {
      await expect(
        store.write('../../../tmp', 'evil.txt', 'malicious'),
      ).rejects.toThrow();
    });

    it('throws on exists with path traversal', async () => {
      await expect(store.exists('..', 'passwd')).rejects.toThrow();
    });

    it('throws on delete with path traversal', async () => {
      await expect(store.delete('..', 'something')).rejects.toThrow();
    });

    it('throws on list with path traversal', async () => {
      await expect(store.list('../../..')).rejects.toThrow();
    });
  });
});
