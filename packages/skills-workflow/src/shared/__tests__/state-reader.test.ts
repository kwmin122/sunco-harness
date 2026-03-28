import { describe, it, expect } from 'vitest';
import { parseStateMd } from '../state-reader.js';

const SAMPLE_STATE = `---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 3 context gathered
last_updated: "2026-03-28T09:11:55.198Z"
last_activity: 2026-03-28 -- Phase 03 execution started
progress:
  total_phases: 10
  completed_phases: 2
  total_plans: 26
  completed_plans: 20
  percent: 0
---

# Project State

## Current Position

Phase: 03 (standalone-ts-skills) -- EXECUTING
Plan: 1 of 6
Status: Executing Phase 03
Last activity: 2026-03-28 -- Phase 03 execution started

Progress: [##########] 0%
`;

describe('parseStateMd', () => {
  it('extracts phase number from body', () => {
    const result = parseStateMd(SAMPLE_STATE);
    expect(result.phase).toBe(3);
  });

  it('extracts plan from body', () => {
    const result = parseStateMd(SAMPLE_STATE);
    expect(result.plan).toBe('1 of 6');
  });

  it('extracts status from frontmatter', () => {
    const result = parseStateMd(SAMPLE_STATE);
    expect(result.status).toBe('executing');
  });

  it('extracts lastActivity from frontmatter', () => {
    const result = parseStateMd(SAMPLE_STATE);
    expect(result.lastActivity).toContain('Phase 03 execution started');
  });

  it('extracts progress block', () => {
    const result = parseStateMd(SAMPLE_STATE);
    expect(result.progress.totalPhases).toBe(10);
    expect(result.progress.completedPhases).toBe(2);
    expect(result.progress.totalPlans).toBe(26);
    expect(result.progress.completedPlans).toBe(20);
    expect(result.progress.percent).toBe(0);
  });

  it('handles empty content gracefully', () => {
    const result = parseStateMd('');
    expect(result.phase).toBeNull();
    expect(result.plan).toBeNull();
    expect(result.status).toBe('');
    expect(result.progress.totalPhases).toBe(0);
  });

  it('handles content without frontmatter', () => {
    const result = parseStateMd('# Just a title\nSome text');
    expect(result.phase).toBeNull();
    expect(result.status).toBe('');
  });

  it('parses frontmatter between --- delimiters', () => {
    const minimal = `---
status: planning
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 10
  completed_plans: 3
  percent: 30
---

# State
`;
    const result = parseStateMd(minimal);
    expect(result.status).toBe('planning');
    expect(result.progress.totalPhases).toBe(5);
    expect(result.progress.percent).toBe(30);
  });
});
