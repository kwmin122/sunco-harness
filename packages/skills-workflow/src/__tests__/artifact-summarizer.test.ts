/**
 * Tests for artifact-summarizer.ts — deterministic artifact compression.
 * Requirements: LH-03, LH-05
 */

import { describe, it, expect } from 'vitest';
import { summarizeArtifact, planArtifactLoading } from '../shared/artifact-summarizer.js';

const SAMPLE_CONTEXT_MD = `# Phase 5: Context + Planning

## Vision
Users can refine vision, preview agent approaches, research domains, and create BDD-driven execution plans before any code is written. This phase delivers the complete planning workflow chain that transforms a rough idea into a validated execution plan with BDD acceptance criteria.

## Key Decisions

- D-100: Plan-checker validation loop with MAX_ITERATIONS=3 and separate verification agent
- D-101: Separate research-domain.ts and research-synthesize.ts from Phase 4 prompts
- D-102: Topic auto-derivation via planning agent with 5-topic cap; synthesis fallback writes raw results

## Acceptance Criteria

1. User runs sunco discuss and extracts vision, design decisions, and acceptance criteria into CONTEXT.md with holdout scenarios written to .sun/scenarios/
2. User runs sunco assume and sees what the agent would do before it does it, with an opportunity to correct the approach before execution begins
3. User runs sunco plan and gets an execution plan with BDD scenario-based completion criteria that passes the built-in plan-checker validation loop
4. Research runs automatically before planning, producing RESEARCH.md that feeds into the planner
5. Plan-checker validates plan quality and iterates up to 3 times (planner/checker) until VERIFICATION PASSED

## Implementation Notes

The discuss skill uses a multi-step conversation protocol:
1. Read existing roadmap and requirements to understand context
2. Present structured questions (5-8 adaptive questions based on answers)
3. Generate CONTEXT.md with vision, decisions, acceptance criteria
4. Generate holdout scenarios in .sun/scenarios/ that verification agents can access but coding agents cannot

The plan skill orchestrates:
1. Optional research phase (auto-triggered when RESEARCH.md is missing)
2. Planner agent generates PLAN.md with tasks, dependencies, acceptance criteria
3. Plan-checker validates against 7 dimensions (completeness, correctness, etc.)
4. Iteration loop (max 3 attempts) until checker passes

## Architecture Considerations

- Phase-reader utility is shared across discuss/plan/execute/verify
- Commander.js flags for skill options: flags format is '-p, --phase <number>'
- Text fallback mode when agent output lacks parseable JSON gray areas
- Partial failure pattern: scenario gen failure still writes CONTEXT.md with warnings
- research-skill subpath to avoid confusion with existing research.ts prompt file

## Testing Strategy

- Unit tests for phase-reader with mock filesystem
- Integration tests for discuss flow with mock agent responses
- Plan-checker dimension validation tested independently
- Coverage of error paths (missing roadmap, invalid phase numbers)

## References
- GSD v2 planning pipeline (conceptual reference only, clean room implementation)
- BDD scenario format from Cucumber/Gherkin
- ETH Zurich research on agent instruction effectiveness
`;

describe('summarizeArtifact', () => {
  it('creates a 3-line summary from CONTEXT.md', () => {
    const result = summarizeArtifact(SAMPLE_CONTEXT_MD, 5, '05-CONTEXT.md');
    expect(result.phaseNumber).toBe(5);
    expect(result.filename).toBe('05-CONTEXT.md');
    expect(result.summary.split('\n')).toHaveLength(3);
    expect(result.summary).toContain('[Phase 5]');
  });

  it('extracts decision entries', () => {
    const result = summarizeArtifact(SAMPLE_CONTEXT_MD, 5, '05-CONTEXT.md');
    expect(result.keyDecisions).toHaveLength(3);
    expect(result.keyDecisions[0]).toContain('D-100');
  });

  it('achieves >= 70% reduction for typical artifacts', () => {
    const result = summarizeArtifact(SAMPLE_CONTEXT_MD, 5, '05-CONTEXT.md');
    expect(result.reductionPercent).toBeGreaterThanOrEqual(70);
  });

  it('handles empty content gracefully', () => {
    const result = summarizeArtifact('', 1, 'empty.md');
    expect(result.summary).toContain('[Phase 1]');
    expect(result.keyDecisions).toHaveLength(0);
    expect(result.reductionPercent).toBe(0);
  });

  it('handles content with no heading', () => {
    const result = summarizeArtifact('Just some plain text\nwith lines.', 3, 'plain.md');
    expect(result.summary).toContain('[Phase 3]');
    expect(result.summary).toContain('Just some plain text');
  });
});

describe('planArtifactLoading', () => {
  const phases = [
    { number: 1, completed: true, artifacts: ['01-CONTEXT.md', '01-01-PLAN.md'] },
    { number: 2, completed: true, artifacts: ['02-CONTEXT.md'] },
    { number: 3, completed: true, artifacts: ['03-CONTEXT.md'] },
    { number: 4, completed: true, artifacts: ['04-CONTEXT.md'] },
    { number: 5, completed: false, artifacts: ['05-CONTEXT.md'] },
  ];

  it('loads everything in green zone', () => {
    const plan = planArtifactLoading(phases, 5, 'green');
    const allModes = plan.phases.flatMap((p) => p.artifacts.map((a) => a.mode));
    expect(allModes.every((m) => m === 'full')).toBe(true);
  });

  it('summarizes completed phases in orange zone', () => {
    const plan = planArtifactLoading(phases, 5, 'orange');
    // Current phase (5) should be full
    const phase5 = plan.phases.find((p) => p.phaseNumber === 5)!;
    expect(phase5.artifacts[0]!.mode).toBe('full');
    // Completed phases should be summary
    const phase1 = plan.phases.find((p) => p.phaseNumber === 1)!;
    expect(phase1.artifacts[0]!.mode).toBe('summary');
  });

  it('skips completed phases in red zone', () => {
    const plan = planArtifactLoading(phases, 5, 'red');
    // Current phase still full
    const phase5 = plan.phases.find((p) => p.phaseNumber === 5)!;
    expect(phase5.artifacts[0]!.mode).toBe('full');
    // Completed phases should be skipped
    const phase1 = plan.phases.find((p) => p.phaseNumber === 1)!;
    expect(phase1.artifacts[0]!.mode).toBe('skip');
  });

  it('achieves >= 78% reduction with 10 completed phases in red zone', () => {
    const manyPhases = Array.from({ length: 10 }, (_, i) => ({
      number: i + 1,
      completed: true,
      artifacts: ['CONTEXT.md', 'PLAN.md'],
    }));
    manyPhases.push({ number: 11, completed: false, artifacts: ['CONTEXT.md'] });

    const plan = planArtifactLoading(manyPhases, 11, 'red');
    expect(plan.reductionPercent).toBeGreaterThanOrEqual(78);
  });

  it('respects maxTokenBudget by downgrading oldest first', () => {
    const plan = planArtifactLoading(phases, 5, 'green', 1000);
    // Should have downgraded some phases to summary or skip
    const totalTokens = plan.totalEstimatedTokens;
    expect(totalTokens).toBeLessThanOrEqual(1000);
  });

  it('never downgrades current phase', () => {
    const plan = planArtifactLoading(phases, 5, 'green', 100);
    const phase5 = plan.phases.find((p) => p.phaseNumber === 5)!;
    expect(phase5.artifacts[0]!.mode).toBe('full');
  });
});
