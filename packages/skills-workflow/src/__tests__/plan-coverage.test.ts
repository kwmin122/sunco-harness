import { describe, it, expect } from 'vitest';

// Extract the coverage logic into a testable function first
// For now, test the regex patterns used in coverage gate

describe('plan requirements coverage', () => {
  it('extracts requirements from YAML array format', () => {
    const planText = `---
phase: test-phase
plan: 01
requirements: [PQP-01, PQP-02, PQP-03]
---`;
    const reqMatch = planText.match(/requirements:\s*\[([^\]]*)\]/);
    expect(reqMatch).not.toBeNull();
    const reqs = reqMatch![1]!.split(',').map(r => r.trim().replace(/['"]/g, '')).filter(Boolean);
    expect(reqs).toEqual(['PQP-01', 'PQP-02', 'PQP-03']);
  });

  it('extracts requirements from quoted array format', () => {
    const planText = `---
requirements: ["WF-01", "WF-02"]
---`;
    const reqMatch = planText.match(/requirements:\s*\[([^\]]*)\]/);
    expect(reqMatch).not.toBeNull();
    const reqs = reqMatch![1]!.split(',').map(r => r.trim().replace(/['"]/g, '')).filter(Boolean);
    expect(reqs).toEqual(['WF-01', 'WF-02']);
  });

  it('returns empty for plans without requirements field', () => {
    const planText = `---
phase: test
plan: 01
---`;
    const reqMatch = planText.match(/requirements:\s*\[([^\]]*)\]/);
    expect(reqMatch).toBeNull();
  });

  it('identifies uncovered requirements', () => {
    const phaseReqs = ['PQP-01', 'PQP-02', 'PQP-03', 'PQP-04', 'PQP-05'];
    const coveredReqs = new Set(['PQP-01', 'PQP-02', 'PQP-03']);
    const uncovered = phaseReqs.filter(r => !coveredReqs.has(r));
    expect(uncovered).toEqual(['PQP-04', 'PQP-05']);
  });

  it('handles empty requirements list', () => {
    const phaseReqs: string[] = [];
    const coveredReqs = new Set<string>();
    const uncovered = phaseReqs.filter(r => !coveredReqs.has(r));
    expect(uncovered).toEqual([]);
  });
});
