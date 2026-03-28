import { describe, it, expect } from 'vitest';
import { addPhase, insertPhase, removePhase } from '../roadmap-writer.js';

const SAMPLE_ROADMAP = `# Roadmap: SUN (sunco)

## Phases

- [x] **Phase 1: Core Platform** - CLI engine, config
- [ ] **Phase 2: Harness Skills** - init, lint
- [ ] **Phase 3: Standalone TS Skills** - session, ideas

## Phase Details

### Phase 1: Core Platform
**Goal**: Working CLI
**Requirements**: CLI-01

### Phase 2: Harness Skills
**Goal**: Deterministic backbone
**Requirements**: HRN-01

### Phase 3: Standalone TS Skills
**Goal**: Session management
**Requirements**: SES-01

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Platform | 12/12 | Complete |  |
| 2. Harness Skills | 0/8 | Not started | - |
| 3. Standalone TS Skills | 0/6 | Not started | - |
`;

describe('addPhase', () => {
  it('appends a new phase with next sequential number', () => {
    const result = addPhase(SAMPLE_ROADMAP, 'Debugging', 'debug, diagnose');
    expect(result).toContain('**Phase 4: Debugging**');
    expect(result).toContain('- [ ] **Phase 4: Debugging** - debug, diagnose');
  });

  it('adds a detail section for the new phase', () => {
    const result = addPhase(SAMPLE_ROADMAP, 'Debugging', 'debug tools');
    expect(result).toContain('### Phase 4: Debugging');
  });

  it('adds a progress table row', () => {
    const result = addPhase(SAMPLE_ROADMAP, 'Debugging', 'debug tools');
    expect(result).toContain('| 4. Debugging | 0/? | Not started | - |');
  });
});

describe('insertPhase', () => {
  it('inserts a phase as decimal after the specified phase', () => {
    const result = insertPhase(SAMPLE_ROADMAP, 'Hotfix', 'urgent fix', 2);
    expect(result).toContain('**Phase 2.1: Hotfix**');
  });

  it('inserts the phase line after the specified phase in the list', () => {
    const result = insertPhase(SAMPLE_ROADMAP, 'Hotfix', 'urgent fix', 2);
    const lines = result.split('\n');
    const p2Line = lines.findIndex((l) => l.includes('Phase 2: Harness'));
    const p21Line = lines.findIndex((l) => l.includes('Phase 2.1: Hotfix'));
    const p3Line = lines.findIndex((l) => l.includes('Phase 3: Standalone'));
    expect(p21Line).toBeGreaterThan(p2Line);
    expect(p21Line).toBeLessThan(p3Line);
  });

  it('adds a detail section for the inserted phase', () => {
    const result = insertPhase(SAMPLE_ROADMAP, 'Hotfix', 'urgent', 2);
    expect(result).toContain('### Phase 2.1: Hotfix');
  });

  it('increments decimal suffix for multiple insertions', () => {
    const first = insertPhase(SAMPLE_ROADMAP, 'Hotfix 1', 'first', 2);
    const second = insertPhase(first, 'Hotfix 2', 'second', 2);
    expect(second).toContain('Phase 2.1: Hotfix 1');
    expect(second).toContain('Phase 2.2: Hotfix 2');
  });
});

describe('removePhase', () => {
  it('removes an uncompleted phase with no progress', () => {
    const result = removePhase(SAMPLE_ROADMAP, 3);
    expect(result.removed).toBe(true);
    expect(result.content).not.toContain('Phase 3: Standalone');
  });

  it('refuses to remove a completed phase', () => {
    const result = removePhase(SAMPLE_ROADMAP, 1);
    expect(result.removed).toBe(false);
    expect(result.reason).toContain('complete');
  });

  it('renumbers subsequent integer phases after removal', () => {
    const fourPhases = addPhase(SAMPLE_ROADMAP, 'Debugging', 'debug');
    const result = removePhase(fourPhases, 3);
    expect(result.removed).toBe(true);
    // Old Phase 4 (Debugging) should become Phase 3
    expect(result.content).toContain('Phase 3: Debugging');
    expect(result.content).not.toContain('Phase 4: Debugging');
  });

  it('removes the progress table row', () => {
    const result = removePhase(SAMPLE_ROADMAP, 3);
    expect(result.removed).toBe(true);
    expect(result.content).not.toContain('3. Standalone TS Skills');
  });

  it('removes the detail section', () => {
    const result = removePhase(SAMPLE_ROADMAP, 3);
    expect(result.removed).toBe(true);
    expect(result.content).not.toContain('### Phase 3: Standalone TS Skills');
  });

  it('returns removed:false with reason for non-existent phase', () => {
    const result = removePhase(SAMPLE_ROADMAP, 99);
    expect(result.removed).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
