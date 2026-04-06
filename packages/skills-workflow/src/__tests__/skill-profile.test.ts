/**
 * Unit tests for Skill Profile — user skill usage pattern analysis.
 */

import { describe, it, expect } from 'vitest';
import type { StateApi } from '@sunco/core';
import { recordSkillUsage, getSkillProfile } from '../shared/skill-profile.js';

// ---------------------------------------------------------------------------
// Mock StateApi
// ---------------------------------------------------------------------------

function createMockState(): StateApi {
  const store = new Map<string, unknown>();
  return {
    get: async <T = unknown>(key: string) => (store.get(key) as T) ?? undefined,
    set: async <T = unknown>(key: string, value: T) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      if (store.has(key)) {
        store.delete(key);
        return true;
      }
      return false;
    },
    list: async (prefix?: string) => {
      const keys = [...store.keys()];
      return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
    },
    has: async (key: string) => store.has(key),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillProfile', () => {
  describe('recordSkillUsage', () => {
    it('records a new skill invocation', async () => {
      const state = createMockState();
      await recordSkillUsage(state, 'workflow.status', 150);
      const profile = await getSkillProfile(state);
      expect(profile.entries).toHaveLength(1);
      expect(profile.entries[0].skillId).toBe('workflow.status');
      expect(profile.entries[0].count).toBe(1);
      expect(profile.entries[0].avgDurationMs).toBe(150);
    });

    it('increments count for repeated skill usage', async () => {
      const state = createMockState();
      await recordSkillUsage(state, 'workflow.status', 100);
      await recordSkillUsage(state, 'workflow.status', 200);
      const profile = await getSkillProfile(state);
      expect(profile.entries[0].count).toBe(2);
    });

    it('computes correct average duration', async () => {
      const state = createMockState();
      await recordSkillUsage(state, 'workflow.plan', 100);
      await recordSkillUsage(state, 'workflow.plan', 300);
      const profile = await getSkillProfile(state);
      expect(profile.entries[0].avgDurationMs).toBe(200);
    });

    it('tracks multiple skills independently', async () => {
      const state = createMockState();
      await recordSkillUsage(state, 'workflow.status', 100);
      await recordSkillUsage(state, 'workflow.plan', 500);
      const profile = await getSkillProfile(state);
      expect(profile.entries).toHaveLength(2);
      const ids = profile.entries.map((e) => e.skillId);
      expect(ids).toContain('workflow.status');
      expect(ids).toContain('workflow.plan');
    });

    it('updates lastUsed timestamp', async () => {
      const state = createMockState();
      await recordSkillUsage(state, 'workflow.status', 100);
      const profile1 = await getSkillProfile(state);
      const ts1 = profile1.entries[0].lastUsed;

      await new Promise((r) => setTimeout(r, 5));
      await recordSkillUsage(state, 'workflow.status', 200);
      const profile2 = await getSkillProfile(state);
      const ts2 = profile2.entries[0].lastUsed;

      expect(ts2 >= ts1).toBe(true);
    });
  });

  describe('getSkillProfile', () => {
    it('returns empty profile when no skills recorded', async () => {
      const state = createMockState();
      const profile = await getSkillProfile(state);
      expect(profile.entries).toEqual([]);
      expect(profile.totalInvocations).toBe(0);
      expect(profile.topSkills).toEqual([]);
    });

    it('computes totalInvocations across all skills', async () => {
      const state = createMockState();
      await recordSkillUsage(state, 'a', 10);
      await recordSkillUsage(state, 'a', 10);
      await recordSkillUsage(state, 'b', 10);
      const profile = await getSkillProfile(state);
      expect(profile.totalInvocations).toBe(3);
    });

    it('returns top 5 skills by count', async () => {
      const state = createMockState();
      // Record 6 skills with varying counts
      for (let i = 0; i < 6; i++) await recordSkillUsage(state, 'skill-a', 10);
      for (let i = 0; i < 5; i++) await recordSkillUsage(state, 'skill-b', 10);
      for (let i = 0; i < 4; i++) await recordSkillUsage(state, 'skill-c', 10);
      for (let i = 0; i < 3; i++) await recordSkillUsage(state, 'skill-d', 10);
      for (let i = 0; i < 2; i++) await recordSkillUsage(state, 'skill-e', 10);
      for (let i = 0; i < 1; i++) await recordSkillUsage(state, 'skill-f', 10);

      const profile = await getSkillProfile(state);
      expect(profile.topSkills).toHaveLength(5);
      expect(profile.topSkills).toEqual([
        'skill-a',
        'skill-b',
        'skill-c',
        'skill-d',
        'skill-e',
      ]);
    });

    it('returns fewer than 5 when less than 5 skills exist', async () => {
      const state = createMockState();
      await recordSkillUsage(state, 'only-one', 50);
      const profile = await getSkillProfile(state);
      expect(profile.topSkills).toEqual(['only-one']);
    });

    it('rounds avgDurationMs to integer', async () => {
      const state = createMockState();
      await recordSkillUsage(state, 'skill-x', 100);
      await recordSkillUsage(state, 'skill-x', 101);
      await recordSkillUsage(state, 'skill-x', 102);
      const profile = await getSkillProfile(state);
      // (100 + 101 + 102) / 3 = 101
      expect(profile.entries[0].avgDurationMs).toBe(101);
    });

    it('includes updatedAt timestamp', async () => {
      const state = createMockState();
      await recordSkillUsage(state, 'skill-x', 10);
      const profile = await getSkillProfile(state);
      expect(profile.updatedAt).toBeDefined();
      // Should be valid ISO string
      expect(() => new Date(profile.updatedAt)).not.toThrow();
    });
  });
});
