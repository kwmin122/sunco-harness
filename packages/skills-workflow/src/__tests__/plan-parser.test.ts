/**
 * Tests for PLAN.md parser - frontmatter + XML task extraction
 */

import { describe, it, expect } from 'vitest';
import {
  parsePlanMd,
  groupPlansByWave,
  type PlanFrontmatter,
  type PlanTask,
  type ParsedPlan,
} from '../shared/plan-parser.js';

const FULL_PLAN = `---
phase: 06-execution-review
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/skills-workflow/src/shared/plan-parser.ts
  - packages/skills-workflow/src/__tests__/plan-parser.test.ts
autonomous: true
requirements:
  - WF-14
---

<objective>
Build the shared infrastructure modules.
</objective>

<context>
Some context here about related files.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: PLAN.md parser</name>
  <files>packages/skills-workflow/src/shared/plan-parser.ts, packages/skills-workflow/src/__tests__/plan-parser.test.ts</files>
  <action>
    Create the plan parser with frontmatter extraction.
  </action>
  <verify>
    <automated>cd /Users/min-kyungwook/SUN && npx vitest run plan-parser.test.ts</automated>
  </verify>
  <done>
- parsePlanMd extracts frontmatter correctly
- All tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Worktree manager</name>
  <files>
packages/skills-workflow/src/shared/worktree-manager.ts
packages/skills-workflow/src/__tests__/worktree-manager.test.ts
  </files>
  <action>
    Create the worktree manager.
  </action>
  <verify>
    <automated>cd /Users/min-kyungwook/SUN && npx vitest run worktree-manager.test.ts</automated>
  </verify>
  <done>
- WorktreeManager works correctly
- All tests pass
  </done>
</task>

</tasks>
`;

const NO_FRONTMATTER = `
# Some Plan

No frontmatter here.
`;

const EMPTY_TASKS = `---
phase: 01-core
plan: 3
type: tdd
wave: 2
depends_on:
  - 1
  - 2
files_modified: []
autonomous: false
requirements: []
---

<objective>
Test empty tasks.
</objective>
`;

const INLINE_ARRAYS = `---
phase: 03-skills
plan: 5
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: []
---

<objective>
Test inline empty arrays.
</objective>
`;

const MULTILINE_ARRAYS = `---
phase: 04-init
plan: 2
type: execute
wave: 3
depends_on:
  - 1
  - 3
  - 5
files_modified:
  - src/a.ts
  - src/b.ts
  - src/c.ts
autonomous: false
requirements:
  - REQ-01
  - REQ-02
  - REQ-03
---

<objective>
Test multiline arrays.
</objective>
`;

describe('parsePlanMd', () => {
  it('extracts frontmatter fields from a valid PLAN.md', () => {
    const result = parsePlanMd(FULL_PLAN);

    expect(result.frontmatter.phase).toBe('06-execution-review');
    expect(result.frontmatter.plan).toBe(1);
    expect(result.frontmatter.type).toBe('execute');
    expect(result.frontmatter.wave).toBe(1);
    expect(result.frontmatter.depends_on).toEqual([]);
    expect(result.frontmatter.files_modified).toEqual([
      'packages/skills-workflow/src/shared/plan-parser.ts',
      'packages/skills-workflow/src/__tests__/plan-parser.test.ts',
    ]);
    expect(result.frontmatter.autonomous).toBe(true);
    expect(result.frontmatter.requirements).toEqual(['WF-14']);
  });

  it('extracts objective text from <objective> block', () => {
    const result = parsePlanMd(FULL_PLAN);
    expect(result.objective).toBe('Build the shared infrastructure modules.');
  });

  it('extracts context text from <context> block', () => {
    const result = parsePlanMd(FULL_PLAN);
    expect(result.context).toContain('Some context here');
  });

  it('extracts tasks from <task> blocks', () => {
    const result = parsePlanMd(FULL_PLAN);

    expect(result.tasks).toHaveLength(2);

    const task1 = result.tasks[0];
    expect(task1.name).toBe('Task 1: PLAN.md parser');
    expect(task1.files).toContain('packages/skills-workflow/src/shared/plan-parser.ts');
    expect(task1.files).toContain('packages/skills-workflow/src/__tests__/plan-parser.test.ts');
    expect(task1.action).toContain('Create the plan parser');
    expect(task1.verify).toContain('npx vitest run plan-parser.test.ts');
    expect(task1.done).toContain('parsePlanMd extracts frontmatter correctly');
    expect(task1.done).toContain('All tests pass');
  });

  it('handles files listed on multiple lines', () => {
    const result = parsePlanMd(FULL_PLAN);
    const task2 = result.tasks[1];
    expect(task2.files).toContain('packages/skills-workflow/src/shared/worktree-manager.ts');
    expect(task2.files).toContain('packages/skills-workflow/src/__tests__/worktree-manager.test.ts');
  });

  it('stores raw content for agent prompt passthrough', () => {
    const result = parsePlanMd(FULL_PLAN);
    expect(result.raw).toBe(FULL_PLAN);
  });

  it('throws on missing frontmatter (no --- delimiters)', () => {
    expect(() => parsePlanMd(NO_FRONTMATTER)).toThrow();
  });

  it('returns empty tasks array when no <task> blocks found', () => {
    const result = parsePlanMd(EMPTY_TASKS);
    expect(result.tasks).toEqual([]);
  });

  it('handles inline empty arrays (depends_on: [], files_modified: [])', () => {
    const result = parsePlanMd(INLINE_ARRAYS);
    expect(result.frontmatter.depends_on).toEqual([]);
    expect(result.frontmatter.files_modified).toEqual([]);
    expect(result.frontmatter.requirements).toEqual([]);
  });

  it('handles multiline arrays with - item format', () => {
    const result = parsePlanMd(MULTILINE_ARRAYS);
    expect(result.frontmatter.depends_on).toEqual([1, 3, 5]);
    expect(result.frontmatter.files_modified).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    expect(result.frontmatter.requirements).toEqual(['REQ-01', 'REQ-02', 'REQ-03']);
  });

  it('parses boolean autonomous field correctly', () => {
    const resultTrue = parsePlanMd(FULL_PLAN);
    expect(resultTrue.frontmatter.autonomous).toBe(true);

    const resultFalse = parsePlanMd(EMPTY_TASKS);
    expect(resultFalse.frontmatter.autonomous).toBe(false);
  });

  it('handles nested <automated> tag inside <verify>', () => {
    const result = parsePlanMd(FULL_PLAN);
    const task1 = result.tasks[0];
    expect(task1.verify).toBe('cd /Users/min-kyungwook/SUN && npx vitest run plan-parser.test.ts');
  });

  it('defaults wave to 1 when not present', () => {
    const noWavePlan = `---
phase: 01-core
plan: 1
type: execute
depends_on: []
files_modified: []
autonomous: true
requirements: []
---

<objective>No wave field.</objective>
`;
    const result = parsePlanMd(noWavePlan);
    expect(result.frontmatter.wave).toBe(1);
  });
});

describe('groupPlansByWave', () => {
  function makePlan(wave: number, plan: number): ParsedPlan {
    return {
      frontmatter: {
        phase: '01-core',
        plan,
        type: 'execute',
        wave,
        depends_on: [],
        files_modified: [],
        autonomous: true,
        requirements: [],
      },
      objective: `Plan ${plan}`,
      context: '',
      tasks: [],
      raw: '',
    };
  }

  it('groups plans by wave number', () => {
    const plans = [makePlan(1, 1), makePlan(2, 2), makePlan(1, 3), makePlan(3, 4)];
    const grouped = groupPlansByWave(plans);

    expect(grouped.size).toBe(3);
    expect(grouped.get(1)).toHaveLength(2);
    expect(grouped.get(2)).toHaveLength(1);
    expect(grouped.get(3)).toHaveLength(1);
  });

  it('returns Map with keys sorted ascending', () => {
    const plans = [makePlan(3, 1), makePlan(1, 2), makePlan(2, 3)];
    const grouped = groupPlansByWave(plans);

    const keys = [...grouped.keys()];
    expect(keys).toEqual([1, 2, 3]);
  });

  it('assigns wave 1 to plans with no wave field (default)', () => {
    const plan = makePlan(0, 1); // 0 means no wave set
    plan.frontmatter.wave = 0; // Simulate no wave
    // groupPlansByWave should handle wave=0 or NaN as wave=1
    const noWavePlan: ParsedPlan = {
      ...plan,
      frontmatter: { ...plan.frontmatter, wave: undefined as unknown as number },
    };

    const grouped = groupPlansByWave([noWavePlan]);
    expect(grouped.get(1)).toHaveLength(1);
  });

  it('handles empty plans array', () => {
    const grouped = groupPlansByWave([]);
    expect(grouped.size).toBe(0);
  });
});
