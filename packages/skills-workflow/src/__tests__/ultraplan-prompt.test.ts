/**
 * Tests for ultraplan prompt builders and output parser.
 */

import { describe, it, expect } from 'vitest';
import {
  buildUltraplanReviewPrompt,
  buildUltraplanDraftPrompt,
  parseUltraplanOutput,
} from '../prompts/ultraplan.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SAMPLE_PLAN = `---
phase: 05-context-planning
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/foo.ts
autonomous: true
requirements:
  - WF-12
---

<objective>
Build the plan parser.
</objective>

<context>
Some context.
</context>

<tasks>
<task type="auto">
  <name>Task 1: Parser</name>
  <read_first>src/foo.ts</read_first>
  <files>src/foo.ts</files>
  <action>Create the parser.</action>
  <acceptance_criteria>file contains export function parsePlan</acceptance_criteria>
  <verify>
    <automated>npm test</automated>
  </verify>
  <done>
- Parser works
  </done>
</task>
</tasks>

<verification>npm test</verification>
<success_criteria>Parser complete.</success_criteria>`;

const SAMPLE_PLAN_2 = `---
phase: 05-context-planning
plan: 02
type: execute
wave: 2
depends_on: [1]
files_modified:
  - src/bar.ts
autonomous: true
requirements:
  - WF-13
---

<objective>
Build the bar module.
</objective>

<context>
Depends on plan 01.
</context>

<tasks>
<task type="auto">
  <name>Task 1: Bar</name>
  <read_first>src/bar.ts</read_first>
  <files>src/bar.ts</files>
  <action>Create bar module.</action>
  <acceptance_criteria>file contains export function bar</acceptance_criteria>
  <verify>
    <automated>npm test</automated>
  </verify>
  <done>
- Bar works
  </done>
</task>
</tasks>

<verification>npm test</verification>
<success_criteria>Bar complete.</success_criteria>`;

// ---------------------------------------------------------------------------
// buildUltraplanReviewPrompt
// ---------------------------------------------------------------------------

describe('buildUltraplanReviewPrompt', () => {
  it('includes all plan files in output', () => {
    const result = buildUltraplanReviewPrompt({
      planFiles: [
        { filename: '05-01-PLAN.md', content: SAMPLE_PLAN },
        { filename: '05-02-PLAN.md', content: SAMPLE_PLAN_2 },
      ],
      contextMd: 'Phase context here.',
      researchMd: 'Research findings.',
      phaseGoal: 'Context + Planning',
      requirements: ['WF-12', 'WF-13'],
      phaseSlug: 'context-planning',
      paddedPhase: '05',
    });

    expect(result).toContain('05-01-PLAN.md');
    expect(result).toContain('05-02-PLAN.md');
    expect(result).toContain('Build the plan parser');
    expect(result).toContain('Build the bar module');
  });

  it('includes phase goal and requirements', () => {
    const result = buildUltraplanReviewPrompt({
      planFiles: [{ filename: '05-01-PLAN.md', content: SAMPLE_PLAN }],
      contextMd: '',
      researchMd: '',
      phaseGoal: 'Test goal',
      requirements: ['REQ-01', 'REQ-02'],
      phaseSlug: 'test',
      paddedPhase: '05',
    });

    expect(result).toContain('Test goal');
    expect(result).toContain('- REQ-01');
    expect(result).toContain('- REQ-02');
  });

  it('includes PLAN.md format spec for output compatibility', () => {
    const result = buildUltraplanReviewPrompt({
      planFiles: [{ filename: '05-01-PLAN.md', content: SAMPLE_PLAN }],
      contextMd: '',
      researchMd: '',
      phaseGoal: 'Test',
      requirements: [],
      phaseSlug: 'test',
      paddedPhase: '05',
    });

    expect(result).toContain('PLAN_SEPARATOR');
    // Format spec now describes both delivery-slice and execution-packet formats
    expect(result).toContain('Delivery Slice');
    expect(result).toContain('Execution Packet');
  });

  it('handles missing research gracefully', () => {
    const result = buildUltraplanReviewPrompt({
      planFiles: [{ filename: '05-01-PLAN.md', content: SAMPLE_PLAN }],
      contextMd: 'Context.',
      researchMd: '',
      phaseGoal: 'Test',
      requirements: [],
      phaseSlug: 'test',
      paddedPhase: '05',
    });

    expect(result).toContain('(Not available)');
  });
});

// ---------------------------------------------------------------------------
// buildUltraplanDraftPrompt
// ---------------------------------------------------------------------------

describe('buildUltraplanDraftPrompt', () => {
  it('includes all input documents', () => {
    const result = buildUltraplanDraftPrompt({
      contextMd: 'My context.',
      researchMd: 'My research.',
      requirementsMd: 'My requirements.',
      roadmapMd: 'My roadmap.',
      phaseGoal: 'Draft goal',
      requirements: ['WF-01'],
      phaseSlug: 'draft-test',
      paddedPhase: '03',
    });

    expect(result).toContain('My context.');
    expect(result).toContain('My research.');
    expect(result).toContain('My requirements.');
    expect(result).toContain('My roadmap.');
    expect(result).toContain('Draft goal');
    expect(result).toContain('- WF-01');
  });

  it('includes format spec', () => {
    const result = buildUltraplanDraftPrompt({
      contextMd: 'C',
      researchMd: '',
      requirementsMd: '',
      roadmapMd: '',
      phaseGoal: 'G',
      requirements: [],
      phaseSlug: 's',
      paddedPhase: '01',
    });

    expect(result).toContain('PLAN_SEPARATOR');
  });
});

// ---------------------------------------------------------------------------
// parseUltraplanOutput
// ---------------------------------------------------------------------------

describe('parseUltraplanOutput', () => {
  it('splits by PLAN_SEPARATOR', () => {
    const input = `${SAMPLE_PLAN}\n---PLAN_SEPARATOR---\n${SAMPLE_PLAN_2}`;
    const result = parseUltraplanOutput(input, 5, 'context-planning');

    expect(result).toHaveLength(2);
    expect(result[0]).toContain('plan: 01');
    expect(result[1]).toContain('plan: 02');
  });

  it('returns empty array for empty input', () => {
    expect(parseUltraplanOutput('', 5, 'test')).toHaveLength(0);
    expect(parseUltraplanOutput('  \n  ', 5, 'test')).toHaveLength(0);
  });

  it('handles single plan with frontmatter + XML', () => {
    const result = parseUltraplanOutput(SAMPLE_PLAN, 5, 'context-planning');

    expect(result).toHaveLength(1);
    expect(result[0]).toContain('plan: 01');
    expect(result[0]).toContain('<objective>');
  });

  it('rejects unstructured markdown to prevent accidental overwrite', () => {
    const input = '# My Plan\n\nDo something interesting.\n\n## Steps\n\n1. Step one\n2. Step two';
    const result = parseUltraplanOutput(input, 3, 'my-phase');

    expect(result).toHaveLength(0);
  });

  it('rejects "looks good" summary responses', () => {
    const input = 'The plans look good. All requirements are covered and wave assignments are correct.';
    const result = parseUltraplanOutput(input, 5, 'test');

    expect(result).toHaveLength(0);
  });
});
