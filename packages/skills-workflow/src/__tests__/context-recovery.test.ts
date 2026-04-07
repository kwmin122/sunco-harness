import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recoverContext, formatWelcomeBriefing } from '../shared/context-recovery.js';
import { logTimelineEvent } from '../shared/skill-timeline.js';
import { logLearning } from '../shared/learnings.js';

describe('context-recovery', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sun-recovery-'));
  });

  it('returns fresh session message when no data', async () => {
    const ctx = await recoverContext(tmpDir, 'main');
    expect(ctx.briefing).toContain('Fresh session');
    expect(ctx.lastSession).toBeNull();
    expect(ctx.recentSkills).toEqual([]);
  });

  it('includes last session in briefing', async () => {
    await logTimelineEvent(tmpDir, {
      skill: 'workflow.ship',
      event: 'completed',
      branch: 'main',
      outcome: 'success',
      durationMs: 12000,
      session: 's1',
      timestamp: new Date().toISOString(),
    });
    const ctx = await recoverContext(tmpDir, 'main');
    expect(ctx.briefing).toContain('ship');
    expect(ctx.briefing).toContain('success');
    expect(ctx.lastSession?.skill).toBe('workflow.ship');
  });

  it('includes recent skills sequence', async () => {
    for (const s of ['workflow.discuss', 'workflow.plan', 'workflow.execute']) {
      await logTimelineEvent(tmpDir, {
        skill: s, event: 'completed', branch: 'main', outcome: 'success',
        session: 'x', timestamp: new Date().toISOString(),
      });
    }
    const ctx = await recoverContext(tmpDir, 'main');
    expect(ctx.recentSkills).toHaveLength(3);
    expect(ctx.briefing).toContain('discuss → plan → execute');
  });

  it('includes relevant learnings', async () => {
    await logLearning(tmpDir, {
      skill: 'workflow.debug',
      type: 'pitfall',
      key: 'important-thing',
      insight: 'Important insight',
      confidence: 9,
      source: 'user-stated',
    });
    const ctx = await recoverContext(tmpDir, 'main');
    expect(ctx.relevantLearnings).toHaveLength(1);
    expect(ctx.briefing).toContain('important-thing');
  });

  it('formatWelcomeBriefing returns the briefing string', async () => {
    const ctx = await recoverContext(tmpDir, 'main');
    expect(formatWelcomeBriefing(ctx)).toBe(ctx.briefing);
  });
});
