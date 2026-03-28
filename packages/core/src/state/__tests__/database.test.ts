/**
 * @sunco/core - SQLite Database Tests
 *
 * Tests for SQLite WAL mode database backing the StateApi.
 * Covers: STE-02 (SQLite WAL), STE-04 (parallel safety), STE-05 (StateApi)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { createDatabase } from '../database.js';
import type { StateApi } from '../types.js';

describe('createDatabase', () => {
  let tempDir: string;
  let db: ReturnType<typeof createDatabase>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sunco-db-test-'));
    db = createDatabase(path.join(tempDir, 'state.db'));
  });

  afterEach(async () => {
    db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('opens database in WAL mode', () => {
    expect(db.journalMode).toBe('wal');
  });

  it('sets busy_timeout to 5000', () => {
    expect(db.busyTimeout).toBe(5000);
  });

  it('sets synchronous to NORMAL', () => {
    expect(db.synchronous).toBe(1); // NORMAL = 1
  });
});

describe('StateDatabase (StateApi)', () => {
  let tempDir: string;
  let db: ReturnType<typeof createDatabase>;
  let state: StateApi;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'sunco-db-test-'));
    db = createDatabase(path.join(tempDir, 'state.db'));
    state = db;
  });

  afterEach(async () => {
    db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('get', () => {
    it('returns undefined for nonexistent key', async () => {
      const result = await state.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('returns stored value after set', async () => {
      await state.set('key1', { a: 1 });
      const result = await state.get<{ a: number }>('key1');
      expect(result).toEqual({ a: 1 });
    });

    it('handles string values', async () => {
      await state.set('str', 'hello');
      const result = await state.get<string>('str');
      expect(result).toBe('hello');
    });

    it('handles number values', async () => {
      await state.set('num', 42);
      const result = await state.get<number>('num');
      expect(result).toBe(42);
    });

    it('handles boolean values', async () => {
      await state.set('bool', true);
      const result = await state.get<boolean>('bool');
      expect(result).toBe(true);
    });

    it('handles array values', async () => {
      await state.set('arr', [1, 2, 3]);
      const result = await state.get<number[]>('arr');
      expect(result).toEqual([1, 2, 3]);
    });

    it('handles nested object values', async () => {
      const nested = { a: { b: { c: 'deep' } } };
      await state.set('nested', nested);
      const result = await state.get<typeof nested>('nested');
      expect(result).toEqual(nested);
    });
  });

  describe('set', () => {
    it('upserts -- overwrites existing value', async () => {
      await state.set('key1', 'v1');
      await state.set('key1', 'v2');
      const result = await state.get<string>('key1');
      expect(result).toBe('v2');
    });
  });

  describe('delete', () => {
    it('returns true when key existed', async () => {
      await state.set('key1', 'value');
      const deleted = await state.delete('key1');
      expect(deleted).toBe(true);
    });

    it('returns false when key did not exist', async () => {
      const deleted = await state.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('makes key return undefined after deletion', async () => {
      await state.set('key1', 'value');
      await state.delete('key1');
      const result = await state.get('key1');
      expect(result).toBeUndefined();
    });
  });

  describe('list', () => {
    it('returns all keys when no prefix given', async () => {
      await state.set('a.1', 'v1');
      await state.set('b.1', 'v2');
      await state.set('c.1', 'v3');
      const keys = await state.list();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('a.1');
      expect(keys).toContain('b.1');
      expect(keys).toContain('c.1');
    });

    it('returns only keys matching prefix', async () => {
      await state.set('agent.name', 'claude');
      await state.set('agent.model', 'opus');
      await state.set('config.theme', 'dark');
      const keys = await state.list('agent.');
      expect(keys).toHaveLength(2);
      expect(keys).toContain('agent.name');
      expect(keys).toContain('agent.model');
    });

    it('returns empty array when no keys exist', async () => {
      const keys = await state.list();
      expect(keys).toEqual([]);
    });

    it('returns empty array when no keys match prefix', async () => {
      await state.set('a.1', 'v1');
      const keys = await state.list('z.');
      expect(keys).toEqual([]);
    });
  });

  describe('has', () => {
    it('returns true for existing key', async () => {
      await state.set('key1', 'value');
      expect(await state.has('key1')).toBe(true);
    });

    it('returns false for nonexistent key', async () => {
      expect(await state.has('nonexistent')).toBe(false);
    });
  });

  describe('concurrent access (STE-04)', () => {
    it('handles 10 simultaneous set() calls without error', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        state.set(`concurrent.${i}`, `value-${i}`),
      );
      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Verify all were written
      for (let i = 0; i < 10; i++) {
        const val = await state.get<string>(`concurrent.${i}`);
        expect(val).toBe(`value-${i}`);
      }
    });

    it('handles interleaved reads and writes', async () => {
      await state.set('shared', 0);

      const ops = Array.from({ length: 20 }, (_, i) =>
        i % 2 === 0
          ? state.set('shared', i)
          : state.get<number>('shared'),
      );

      await expect(Promise.all(ops)).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    it('closes without error', () => {
      // Close is called in afterEach, but test explicit close
      db.close();
      // Second close should not throw
      expect(() => db.close()).not.toThrow();
    });
  });
});
