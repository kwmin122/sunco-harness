/**
 * Tests for context-zones.ts — 4-tier context utilization zone system.
 * Requirements: LH-01, LH-02
 */

import { describe, it, expect } from 'vitest';
import { classifyContextZone } from '../shared/context-zones.js';

describe('classifyContextZone', () => {
  it('classifies 0-49% as green zone', () => {
    const result = classifyContextZone(30);
    expect(result.zone).toBe('green');
    expect(result.suggestPause).toBe(false);
    expect(result.suggestCompact).toBe(false);
    expect(result.message).toBeNull();
  });

  it('classifies 50-69% as yellow zone', () => {
    const result = classifyContextZone(60);
    expect(result.zone).toBe('yellow');
    expect(result.suggestPause).toBe(false);
    expect(result.suggestCompact).toBe(false);
    expect(result.message).toContain('moderate');
  });

  it('classifies 70-84% as orange zone', () => {
    const result = classifyContextZone(75);
    expect(result.zone).toBe('orange');
    expect(result.suggestPause).toBe(true);
    expect(result.suggestCompact).toBe(false);
    expect(result.message).toContain('pause');
  });

  it('classifies 85%+ as red zone', () => {
    const result = classifyContextZone(90);
    expect(result.zone).toBe('red');
    expect(result.suggestPause).toBe(true);
    expect(result.suggestCompact).toBe(true);
    expect(result.message).toContain('critical');
  });

  it('handles boundary values correctly', () => {
    expect(classifyContextZone(0).zone).toBe('green');
    expect(classifyContextZone(49).zone).toBe('green');
    expect(classifyContextZone(50).zone).toBe('yellow');
    expect(classifyContextZone(69).zone).toBe('yellow');
    expect(classifyContextZone(70).zone).toBe('orange');
    expect(classifyContextZone(84).zone).toBe('orange');
    expect(classifyContextZone(85).zone).toBe('red');
    expect(classifyContextZone(100).zone).toBe('red');
  });

  it('clamps negative values to green', () => {
    const result = classifyContextZone(-10);
    expect(result.zone).toBe('green');
    expect(result.usedPercent).toBe(0);
  });

  it('clamps values above 100 to red', () => {
    const result = classifyContextZone(150);
    expect(result.zone).toBe('red');
    expect(result.usedPercent).toBe(100);
  });
});
