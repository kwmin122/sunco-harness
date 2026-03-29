/**
 * Unit tests for StuckDetector — sliding window pattern detection.
 */

import { describe, it, expect } from 'vitest';
import { StuckDetector } from '../shared/stuck-detector.js';
import type { InvocationRecord } from '../shared/stuck-detector.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function record(skillId: string, success: boolean): InvocationRecord {
  return { skillId, success, timestamp: new Date().toISOString() };
}

const detector = new StuckDetector(3);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StuckDetector', () => {
  it('returns not stuck for empty history', () => {
    const result = detector.analyze([]);
    expect(result.stuck).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.failedSkillId).toBeNull();
  });

  it('returns not stuck when all invocations succeed', () => {
    const history = [
      record('workflow.execute', true),
      record('workflow.verify', true),
      record('workflow.execute', true),
    ];
    const result = detector.analyze(history);
    expect(result.stuck).toBe(false);
  });

  it('returns not stuck for mixed success/failure across different skills', () => {
    const history = [
      record('skill.a', false),
      record('skill.b', true),
      record('skill.c', false),
      record('skill.d', true),
    ];
    const result = detector.analyze(history);
    expect(result.stuck).toBe(false);
  });

  it('returns not stuck for 2 consecutive failures of the same skill (below threshold)', () => {
    const history = [
      record('workflow.execute', true),
      record('workflow.execute', false),
      record('workflow.execute', false),
    ];
    const result = detector.analyze(history);
    expect(result.stuck).toBe(false);
    expect(result.consecutiveFailures).toBe(2);
  });

  it('returns stuck when same skill fails 3 consecutive times', () => {
    const history = [
      record('workflow.execute', true),
      record('workflow.execute', false),
      record('workflow.execute', false),
      record('workflow.execute', false),
    ];
    const result = detector.analyze(history);
    expect(result.stuck).toBe(true);
    expect(result.failedSkillId).toBe('workflow.execute');
    expect(result.consecutiveFailures).toBe(3);
    expect(result.reason).toMatch(/workflow\.execute/);
  });

  it('returns stuck when same skill fails more than threshold consecutive times', () => {
    const history = [
      record('skill.a', false),
      record('skill.a', false),
      record('skill.a', false),
      record('skill.a', false),
    ];
    const result = detector.analyze(history);
    expect(result.stuck).toBe(true);
    expect(result.failedSkillId).toBe('skill.a');
  });

  it('returns stuck for oscillation pattern (A fail, B fail, A fail, B fail)', () => {
    const history = [
      record('skill.a', false),
      record('skill.b', false),
      record('skill.a', false),
      record('skill.b', false),
    ];
    const result = detector.analyze(history);
    expect(result.stuck).toBe(true);
    expect(result.reason).toMatch(/Oscillation/);
  });

  it('returns stuck for oscillation with preceding entries', () => {
    const history = [
      record('other.skill', true),
      record('skill.x', true),
      record('skill.a', false),
      record('skill.b', false),
      record('skill.a', false),
      record('skill.b', false),
    ];
    const result = detector.analyze(history);
    expect(result.stuck).toBe(true);
    expect(result.reason).toMatch(/Oscillation/);
  });

  it('returns not stuck for only 2 oscillation cycles (below 4 entries)', () => {
    const history = [
      record('skill.x', true),
      record('skill.a', false),
      record('skill.b', false),
    ];
    const result = detector.analyze(history);
    expect(result.stuck).toBe(false);
  });

  it('consecutive failure streak is broken by a success in between', () => {
    const history = [
      record('workflow.execute', false),
      record('workflow.execute', false),
      record('workflow.execute', true),   // success breaks streak
      record('workflow.execute', false),
      record('workflow.execute', false),
    ];
    const result = detector.analyze(history);
    expect(result.stuck).toBe(false);
  });

  it('uses custom maxConsecutiveFailures threshold', () => {
    const strictDetector = new StuckDetector(2);
    const history = [
      record('skill.a', false),
      record('skill.a', false),
    ];
    const result = strictDetector.analyze(history);
    expect(result.stuck).toBe(true);
    expect(result.consecutiveFailures).toBe(2);
  });
});
