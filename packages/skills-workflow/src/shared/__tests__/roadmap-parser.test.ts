import { describe, it, expect } from 'vitest';
import { parseRoadmap } from '../roadmap-parser.js';

const SAMPLE_ROADMAP = `# Roadmap: SUN (sunco)

## Phases

- [x] **Phase 1: Core Platform** - CLI engine, config, skill system
- [x] **Phase 2: Harness Skills** - init, lint, health, agents, guard
- [ ] **Phase 3: Standalone TS Skills** - Session, ideas, phase management
- [ ] **Phase 4: Project Initialization** - new and scan
- [ ] **Phase 10: Debugging** - debug, diagnose, forensics

## Phase Details

### Phase 1: Core Platform
**Requirements**: CLI-01, CLI-02, CFG-01
**Plans:** 12 plans

Plans:
- [x] 01-01-PLAN.md -- Monorepo scaffold
- [x] 01-02-PLAN.md -- Config System

### Phase 2: Harness Skills
**Requirements**: HRN-01, HRN-02
**Plans:** 8 plans

Plans:
- [x] 02-01-PLAN.md -- Dependencies and test infra
- [ ] 02-02-PLAN.md -- Init presets

### Phase 3: Standalone TS Skills
**Requirements**: SES-01, SES-02
**Plans:** 6 plans

Plans:
- [ ] 03-01-PLAN.md -- Package scaffold
- [ ] 03-02-PLAN.md -- Status skills

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Platform | 12/12 | Complete |  |
| 2. Harness Skills | 1/8 | In Progress | - |
| 3. Standalone TS Skills | 0/6 | Not started | - |
| 4. Project Initialization | 0/? | Not started | - |
| 10. Debugging | 0/? | Not started | - |
`;

describe('parseRoadmap', () => {
  it('extracts all phases from the phase list', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    expect(result.phases).toHaveLength(5);
  });

  it('parses completed phases correctly', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const phase1 = result.phases.find((p) => p.number === 1);
    expect(phase1).toBeDefined();
    expect(phase1!.completed).toBe(true);
    expect(phase1!.name).toBe('Core Platform');
    expect(phase1!.description).toBe('CLI engine, config, skill system');
  });

  it('parses incomplete phases correctly', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const phase3 = result.phases.find((p) => p.number === 3);
    expect(phase3).toBeDefined();
    expect(phase3!.completed).toBe(false);
    expect(phase3!.name).toBe('Standalone TS Skills');
  });

  it('extracts plan lists for each phase', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const phase1 = result.phases.find((p) => p.number === 1);
    expect(phase1!.plans).toHaveLength(2);
    expect(phase1!.plans[0]).toEqual({ name: '01-01-PLAN.md -- Monorepo scaffold', completed: true });
    expect(phase1!.plans[1]).toEqual({ name: '01-02-PLAN.md -- Config System', completed: true });
  });

  it('extracts requirements from phase details', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const phase1 = result.phases.find((p) => p.number === 1);
    expect(phase1!.requirements).toEqual(['CLI-01', 'CLI-02', 'CFG-01']);
  });

  it('counts completed plans', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const phase2 = result.phases.find((p) => p.number === 2);
    expect(phase2!.completedCount).toBe(1);
  });

  it('extracts progress table rows', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    expect(result.progress).toHaveLength(5);

    const p1 = result.progress.find((p) => p.phaseNumber === 1);
    expect(p1).toBeDefined();
    expect(p1!.phaseName).toBe('Core Platform');
    expect(p1!.plansComplete).toBe(12);
    expect(p1!.plansTotal).toBe(12);
    expect(p1!.status).toBe('Complete');
  });

  it('handles ? for unknown plan totals in progress', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const p4 = result.progress.find((p) => p.phaseNumber === 4);
    expect(p4).toBeDefined();
    expect(p4!.plansTotal).toBeNull();
  });

  it('handles decimal phase numbers', () => {
    const decimal = `## Phases

- [ ] **Phase 2.1: Hotfix** - urgent fix

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 2.1. Hotfix | 0/1 | Planned | - |
`;
    const result = parseRoadmap(decimal);
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0].number).toBe('2.1');
  });

  it('returns empty arrays for malformed input', () => {
    const result = parseRoadmap('nothing here');
    expect(result.phases).toEqual([]);
    expect(result.progress).toEqual([]);
  });

  it('returns empty arrays for empty string', () => {
    const result = parseRoadmap('');
    expect(result.phases).toEqual([]);
    expect(result.progress).toEqual([]);
  });

  it('trims whitespace from captured groups', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const phase1 = result.phases.find((p) => p.number === 1);
    expect(phase1!.name).toBe('Core Platform');
    expect(phase1!.description).not.toMatch(/^\s/);
    expect(phase1!.description).not.toMatch(/\s$/);
  });
});
