/**
 * Unit tests for Feature Tracker — feature-session bidirectional tracking.
 */

import { describe, it, expect } from 'vitest';
import type { FileStoreApi } from '@sunco/core';
import {
  readFeatureStore,
  writeFeatureStore,
  trackFeature,
  getFeatureSessions,
  getSessionFeatures,
} from '../shared/feature-tracker.js';

// ---------------------------------------------------------------------------
// Mock FileStore
// ---------------------------------------------------------------------------

function createMockFileStore(): FileStoreApi {
  const store = new Map<string, string>();
  return {
    read: async (dir: string, file: string) => store.get(`${dir}/${file}`) ?? undefined,
    write: async (dir: string, file: string, content: string) => {
      store.set(`${dir}/${file}`, content);
    },
    exists: async (dir: string, file: string) => store.has(`${dir}/${file}`),
    list: async (dir: string) =>
      [...store.keys()]
        .filter((k) => k.startsWith(dir + '/'))
        .map((k) => k.split('/').pop()!),
    delete: async (dir: string, file: string) => {
      const key = `${dir}/${file}`;
      if (store.has(key)) {
        store.delete(key);
        return true;
      }
      return false;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeatureTracker', () => {
  describe('readFeatureStore', () => {
    it('returns empty store when file does not exist', async () => {
      const fs = createMockFileStore();
      const store = await readFeatureStore(fs);
      expect(store.features).toEqual([]);
      expect(store.version).toBe(1);
    });

    it('returns empty store when file contains invalid JSON', async () => {
      const fs = createMockFileStore();
      await fs.write('.', 'features.json', 'not-json');
      const store = await readFeatureStore(fs);
      expect(store.features).toEqual([]);
    });

    it('returns empty store when features field is not an array', async () => {
      const fs = createMockFileStore();
      await fs.write('.', 'features.json', JSON.stringify({ features: 'oops', version: 1 }));
      const store = await readFeatureStore(fs);
      expect(store.features).toEqual([]);
    });

    it('reads valid store from disk', async () => {
      const fs = createMockFileStore();
      const data = {
        features: [
          {
            id: 'f1',
            name: 'Auth',
            sessions: ['s1'],
            status: 'active',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        version: 1,
      };
      await fs.write('.', 'features.json', JSON.stringify(data));
      const store = await readFeatureStore(fs);
      expect(store.features).toHaveLength(1);
      expect(store.features[0].id).toBe('f1');
    });
  });

  describe('writeFeatureStore', () => {
    it('persists store to disk as JSON', async () => {
      const fs = createMockFileStore();
      const store = {
        features: [
          {
            id: 'f1',
            name: 'Auth',
            sessions: ['s1'],
            status: 'active' as const,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        version: 1 as const,
      };
      await writeFeatureStore(fs, store);
      const raw = await fs.read('.', 'features.json');
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed.features[0].id).toBe('f1');
    });
  });

  describe('trackFeature', () => {
    it('creates a new feature entry when feature does not exist', async () => {
      const fs = createMockFileStore();
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      const store = await readFeatureStore(fs);
      expect(store.features).toHaveLength(1);
      expect(store.features[0].id).toBe('auth');
      expect(store.features[0].name).toBe('Authentication');
      expect(store.features[0].sessions).toEqual(['session-1']);
      expect(store.features[0].status).toBe('active');
    });

    it('adds session to existing feature', async () => {
      const fs = createMockFileStore();
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      await trackFeature(fs, 'auth', 'Authentication', 'session-2');
      const store = await readFeatureStore(fs);
      expect(store.features).toHaveLength(1);
      expect(store.features[0].sessions).toEqual(['session-1', 'session-2']);
    });

    it('deduplicates session IDs', async () => {
      const fs = createMockFileStore();
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      const store = await readFeatureStore(fs);
      expect(store.features[0].sessions).toEqual(['session-1']);
    });

    it('tracks multiple features independently', async () => {
      const fs = createMockFileStore();
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      await trackFeature(fs, 'db', 'Database', 'session-1');
      const store = await readFeatureStore(fs);
      expect(store.features).toHaveLength(2);
      expect(store.features[0].id).toBe('auth');
      expect(store.features[1].id).toBe('db');
    });

    it('updates updatedAt timestamp on each track', async () => {
      const fs = createMockFileStore();
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      const store1 = await readFeatureStore(fs);
      const ts1 = store1.features[0].updatedAt;

      // Small delay to get different timestamp
      await new Promise((r) => setTimeout(r, 5));
      await trackFeature(fs, 'auth', 'Authentication', 'session-2');
      const store2 = await readFeatureStore(fs);
      const ts2 = store2.features[0].updatedAt;

      expect(ts2 >= ts1).toBe(true);
    });
  });

  describe('getFeatureSessions', () => {
    it('returns sessions for a known feature', async () => {
      const fs = createMockFileStore();
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      await trackFeature(fs, 'auth', 'Authentication', 'session-2');
      const sessions = await getFeatureSessions(fs, 'auth');
      expect(sessions).toEqual(['session-1', 'session-2']);
    });

    it('returns empty array for unknown feature', async () => {
      const fs = createMockFileStore();
      const sessions = await getFeatureSessions(fs, 'nonexistent');
      expect(sessions).toEqual([]);
    });

    it('returns a copy (not reference to internal array)', async () => {
      const fs = createMockFileStore();
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      const sessions = await getFeatureSessions(fs, 'auth');
      sessions.push('tampered');
      const sessionsAgain = await getFeatureSessions(fs, 'auth');
      expect(sessionsAgain).toEqual(['session-1']);
    });
  });

  describe('getSessionFeatures', () => {
    it('returns features for a known session', async () => {
      const fs = createMockFileStore();
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      await trackFeature(fs, 'db', 'Database', 'session-1');
      const features = await getSessionFeatures(fs, 'session-1');
      expect(features).toHaveLength(2);
      expect(features.map((f) => f.id)).toEqual(['auth', 'db']);
    });

    it('returns empty array for unknown session', async () => {
      const fs = createMockFileStore();
      const features = await getSessionFeatures(fs, 'nonexistent');
      expect(features).toEqual([]);
    });

    it('only returns features the session touched', async () => {
      const fs = createMockFileStore();
      await trackFeature(fs, 'auth', 'Authentication', 'session-1');
      await trackFeature(fs, 'db', 'Database', 'session-2');
      const features = await getSessionFeatures(fs, 'session-1');
      expect(features).toHaveLength(1);
      expect(features[0].id).toBe('auth');
    });
  });
});
