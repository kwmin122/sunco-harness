import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  logTimelineEvent,
  getRecentTimeline,
  getBranchTimeline,
  getLastSession,
  detectSkillPattern,
} from '../shared/skill-timeline.js';

describe('skill-timeline', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sun-timeline-'));
  });

  describe('logTimelineEvent + getRecentTimeline', () => {
    it('round-trips an event', async () => {
      await logTimelineEvent(tmpDir, {
        skill: 'workflow.debug',
        event: 'completed',
        branch: 'main',
        outcome: 'success',
        durationMs: 5000,
        session: 'sess-1',
        timestamp: new Date().toISOString(),
      });
      const entries = await getRecentTimeline(tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0].skill).toBe('workflow.debug');
    });

    it('returns empty for missing file', async () => {
      const entries = await getRecentTimeline(join(tmpDir, 'nope'));
      expect(entries).toEqual([]);
    });
  });

  describe('getBranchTimeline', () => {
    it('filters by branch', async () => {
      await logTimelineEvent(tmpDir, { skill: 'a', event: 'completed', branch: 'main', session: 's1', timestamp: '2026-01-01' });
      await logTimelineEvent(tmpDir, { skill: 'b', event: 'completed', branch: 'feat', session: 's2', timestamp: '2026-01-02' });
      const main = await getBranchTimeline(tmpDir, 'main');
      expect(main).toHaveLength(1);
      expect(main[0].skill).toBe('a');
    });
  });

  describe('getLastSession', () => {
    it('returns last completed event on branch', async () => {
      await logTimelineEvent(tmpDir, { skill: 'a', event: 'started', branch: 'main', session: 's', timestamp: '2026-01-01' });
      await logTimelineEvent(tmpDir, { skill: 'a', event: 'completed', branch: 'main', outcome: 'success', session: 's', timestamp: '2026-01-02' });
      await logTimelineEvent(tmpDir, { skill: 'b', event: 'started', branch: 'main', session: 's2', timestamp: '2026-01-03' });
      const last = await getLastSession(tmpDir, 'main');
      expect(last?.skill).toBe('a');
      expect(last?.outcome).toBe('success');
    });

    it('returns null when no completed events', async () => {
      const last = await getLastSession(tmpDir, 'main');
      expect(last).toBeNull();
    });
  });

  describe('detectSkillPattern', () => {
    it('detects 2-skill cycle', async () => {
      for (const s of ['workflow.review', 'workflow.ship', 'workflow.review', 'workflow.ship']) {
        await logTimelineEvent(tmpDir, { skill: s, event: 'completed', branch: 'main', outcome: 'success', session: 'x', timestamp: new Date().toISOString() });
      }
      const pattern = await detectSkillPattern(tmpDir, 'main');
      expect(pattern.prediction).toBe('workflow.review');
      expect(pattern.confidence).toBe(0.8);
    });

    it('predicts workflow chain next step', async () => {
      for (const s of ['workflow.discuss', 'workflow.plan', 'workflow.execute']) {
        await logTimelineEvent(tmpDir, { skill: s, event: 'completed', branch: 'main', outcome: 'success', session: 'x', timestamp: new Date().toISOString() });
      }
      const pattern = await detectSkillPattern(tmpDir, 'main');
      expect(pattern.prediction).toBe('workflow.verify');
    });

    it('returns null prediction with insufficient data', async () => {
      await logTimelineEvent(tmpDir, { skill: 'a', event: 'completed', branch: 'main', outcome: 'success', session: 'x', timestamp: new Date().toISOString() });
      const pattern = await detectSkillPattern(tmpDir, 'main');
      expect(pattern.prediction).toBeNull();
    });
  });
});
