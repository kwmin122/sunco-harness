/**
 * @sunco/core - Recommendation Rules
 *
 * 30+ deterministic rules that map (state, lastResult) to recommendations.
 * Grouped by category: workflow transitions, harness transitions,
 * session state, error recovery, milestone, context-aware, and fallback.
 *
 * Requirements: REC-03 (state-based routing), REC-04 (20-50 rules, sub-ms)
 */

import type {
  Recommendation,
  RecommendationPriority,
  RecommendationRule,
  RecommendationState,
} from './types.js';

// ---------------------------------------------------------------------------
// Helper: create a rule concisely
// ---------------------------------------------------------------------------

function rule(
  id: string,
  description: string,
  matchFn: (s: RecommendationState) => boolean,
  recommendFn: (s: RecommendationState) => Recommendation[],
): RecommendationRule {
  return { id, description, matches: matchFn, recommend: recommendFn };
}

function rec(
  skillId: string,
  title: string,
  reason: string,
  priority: RecommendationPriority,
): Recommendation {
  return { skillId, title, reason, priority };
}

// ---------------------------------------------------------------------------
// Match helpers
// ---------------------------------------------------------------------------

function lastWas(state: RecommendationState, skillId: string): boolean {
  return state.lastSkillId === skillId;
}

function lastSucceeded(state: RecommendationState): boolean {
  return state.lastResult?.success === true;
}

function lastFailed(state: RecommendationState): boolean {
  return state.lastResult?.success === false;
}

function hasProjectState(state: RecommendationState, key: string, value?: unknown): boolean {
  if (value === undefined) {
    return key in state.projectState;
  }
  return state.projectState[key] === value;
}

// ---------------------------------------------------------------------------
// Category 1: Workflow Chain Transitions (rules 1-7)
// Core workflow: discuss -> plan -> execute -> verify -> ship
// ---------------------------------------------------------------------------

const workflowTransitionRules: RecommendationRule[] = [
  // Rule 1: After execute success -> verify (recommended), ship
  rule(
    'after-execute-success',
    'After successful execution, verify agent output',
    (s) => lastWas(s, 'workflow.execute') && lastSucceeded(s),
    () => [
      rec('workflow.verify', 'Verify output', 'Verify agent output before shipping', 'high'),
      rec('workflow.ship', 'Ship changes', 'Ship if confident in the output', 'low'),
    ],
  ),

  // Rule 2: After verify success (full 7-layer) -> ship
  // Phase 33 Wave 1: excludes coverage-only runs (verify --coverage → handled by Rule 30/31)
  rule(
    'after-verify-success',
    'After successful full verification, ship the changes',
    (s) => lastWas(s, 'workflow.verify') && lastSucceeded(s) && !lastWasVerifyCoverage(s),
    () => [
      rec('workflow.ship', 'Ship changes', 'Verification passed -- ready to ship', 'high'),
    ],
  ),

  // Rule 3: After verify failure (full 7-layer) -> debug (recommended), execute
  // Phase 33 Wave 1: excludes coverage-only runs (verify --coverage → handled by Rule 32)
  rule(
    'after-verify-failure',
    'After failed full verification, debug or re-execute',
    (s) => lastWas(s, 'workflow.verify') && lastFailed(s) && !lastWasVerifyCoverage(s),
    () => [
      rec('workflow.debug', 'Debug issues', 'Verification failed -- investigate the issues', 'high'),
      rec('workflow.execute', 'Re-execute', 'Re-execute with fixes applied', 'medium'),
    ],
  ),

  // Rule 4: After plan success -> execute
  rule(
    'after-plan-success',
    'After successful planning, execute the plan',
    (s) => lastWas(s, 'workflow.plan') && lastSucceeded(s),
    () => [
      rec('workflow.execute', 'Execute plan', 'Plan is ready -- execute it', 'high'),
    ],
  ),

  // Rule 5: After discuss success -> plan (recommended), research
  rule(
    'after-discuss-success',
    'After discussion, create a plan or research further',
    (s) => lastWas(s, 'workflow.discuss') && lastSucceeded(s),
    () => [
      rec('workflow.plan', 'Create plan', 'Discussion complete -- create an execution plan', 'high'),
      rec('workflow.research', 'Research more', 'Research the domain further before planning', 'medium'),
    ],
  ),

  // Rule 6: After research success -> plan or discuss
  rule(
    'after-research-success',
    'After research, create a plan or discuss findings',
    (s) => lastWas(s, 'workflow.research') && lastSucceeded(s),
    () => [
      rec('workflow.plan', 'Create plan', 'Research complete -- create an execution plan', 'high'),
      rec('workflow.discuss', 'Discuss findings', 'Discuss research findings before planning', 'medium'),
    ],
  ),

  // Rule 7: After ship success -> milestone audit
  rule(
    'after-ship-success',
    'After shipping, audit milestone progress',
    (s) => lastWas(s, 'workflow.ship') && lastSucceeded(s),
    () => [
      rec('workflow.milestone', 'Audit milestone', 'Check milestone progress after shipping', 'medium'),
      rec('core.status', 'Check status', 'Review project status after shipping', 'low'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 2: Harness Skill Transitions (rules 8-12)
// ---------------------------------------------------------------------------

const harnessTransitionRules: RecommendationRule[] = [
  // Rule 8: After init success -> lint (recommended), health
  rule(
    'after-init-success',
    'After initialization, run lint and health checks',
    (s) => lastWas(s, 'harness.init') && lastSucceeded(s),
    () => [
      rec('harness.lint', 'Run lint', 'Check architecture compliance after initialization', 'high'),
      rec('harness.health', 'Run health check', 'Check project health after initialization', 'medium'),
    ],
  ),

  // Rule 9: After lint success -> health or guard
  rule(
    'after-lint-success',
    'After successful lint, check health or enable guard',
    (s) => lastWas(s, 'harness.lint') && lastSucceeded(s),
    () => [
      rec('harness.health', 'Run health check', 'Lint passed -- check project health', 'high'),
      rec('harness.guard', 'Enable guard', 'Enable continuous monitoring', 'medium'),
    ],
  ),

  // Rule 10: After lint failure -> fix and re-lint
  rule(
    'after-lint-failure',
    'After lint failure, debug the issues',
    (s) => lastWas(s, 'harness.lint') && lastFailed(s),
    () => [
      rec('workflow.debug', 'Debug lint issues', 'Lint found violations -- investigate and fix', 'high'),
      rec('harness.lint', 'Re-run lint', 'Re-run lint after fixing issues', 'medium'),
    ],
  ),

  // Rule 11: After health success -> guard
  rule(
    'after-health-success',
    'After health check, enable guard monitoring',
    (s) => lastWas(s, 'harness.health') && lastSucceeded(s),
    () => [
      rec('harness.guard', 'Enable guard', 'Health is good -- enable continuous monitoring', 'medium'),
    ],
  ),

  // Rule 12: After health failure -> debug
  rule(
    'after-health-failure',
    'After health check failure, investigate issues',
    (s) => lastWas(s, 'harness.health') && lastFailed(s),
    () => [
      rec('workflow.debug', 'Debug health issues', 'Health check found problems -- investigate', 'high'),
      rec('harness.health', 'Re-check health', 'Re-run health check after fixes', 'medium'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 3: Session State Rules (rules 13-16)
// ---------------------------------------------------------------------------

const sessionStateRules: RecommendationRule[] = [
  // Rule 13: Fresh session (no lastSkillId) -> next (primary), do (secondary), status (tertiary)
  rule(
    'fresh-session',
    'Start a fresh session — next recommended action, or describe a task',
    (s) => s.lastSkillId === undefined || s.lastSkillId === null,
    () => [
      rec('workflow.next', 'Get next action', 'See the next recommended task for this project', 'high'),
      rec('workflow.do', 'Describe what you need', 'Describe your task in natural language', 'medium'),
      rec('core.status', 'Check status', 'Review current project status', 'low'),
    ],
  ),

  // Rule 14: No current phase -> new or scan
  rule(
    'no-current-phase',
    'No active phase -- start a new project or scan existing one',
    (s) => hasProjectState(s, 'currentPhase', null) || hasProjectState(s, 'currentPhase', undefined),
    () => [
      rec('core.new', 'Start new project', 'No active phase -- initialize a new project', 'high'),
      rec('core.scan', 'Scan existing project', 'No active phase -- scan the existing codebase', 'high'),
    ],
  ),

  // Rule 15: Uncommitted changes after execute -> ship urgently
  rule(
    'uncommitted-after-execute',
    'Uncommitted changes detected after execution -- ship or verify',
    (s) =>
      lastWas(s, 'workflow.execute') &&
      lastSucceeded(s) &&
      hasProjectState(s, 'hasUncommittedChanges', true),
    () => [
      rec('workflow.verify', 'Verify output', 'Verify agent output before committing', 'high'),
      rec('workflow.ship', 'Ship changes', 'Uncommitted changes detected -- ship them', 'high'),
    ],
  ),

  // Rule 16: Uncommitted changes (generic) -> ship
  rule(
    'uncommitted-changes-generic',
    'Uncommitted changes exist -- consider shipping',
    (s) => hasProjectState(s, 'hasUncommittedChanges', true),
    () => [
      rec('workflow.ship', 'Ship changes', 'Uncommitted changes detected -- consider shipping', 'medium'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 4: Error Recovery Rules (rules 17-20)
// ---------------------------------------------------------------------------

const errorRecoveryRules: RecommendationRule[] = [
  // Rule 17: Execute failure -> debug (recommended)
  rule(
    'after-execute-failure',
    'After execution failure, debug the issues',
    (s) => lastWas(s, 'workflow.execute') && lastFailed(s),
    () => [
      rec('workflow.debug', 'Debug execution', 'Execution failed -- investigate the issues', 'high'),
      rec('workflow.execute', 'Retry execution', 'Retry execution after reviewing the errors', 'medium'),
    ],
  ),

  // Rule 18: Plan failure -> discuss or research
  rule(
    'after-plan-failure',
    'After planning failure, discuss or research more',
    (s) => lastWas(s, 'workflow.plan') && lastFailed(s),
    () => [
      rec('workflow.discuss', 'Discuss approach', 'Planning failed -- revisit the approach', 'high'),
      rec('workflow.research', 'Research more', 'Research the domain further', 'medium'),
    ],
  ),

  // Rule 19: Discuss failure -> retry discuss
  rule(
    'after-discuss-failure',
    'After discussion failure, retry or research',
    (s) => lastWas(s, 'workflow.discuss') && lastFailed(s),
    () => [
      rec('workflow.discuss', 'Retry discussion', 'Retry the discussion with different approach', 'high'),
      rec('workflow.research', 'Research first', 'Research before another discussion', 'medium'),
    ],
  ),

  // Rule 20: Generic failure -> debug
  rule(
    'generic-failure',
    'After any failure, suggest debugging',
    (s) => s.lastResult !== undefined && lastFailed(s),
    () => [
      rec('workflow.debug', 'Debug issues', 'Something failed -- investigate the issues', 'medium'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 5: Milestone + Shipping Rules (rules 21-29)
// ---------------------------------------------------------------------------

const milestoneRules: RecommendationRule[] = [
  // Rule 21: After milestone audit success -> status or plan
  rule(
    'after-milestone-success',
    'After milestone audit, check status or plan next',
    (s) => lastWas(s, 'workflow.milestone') && lastSucceeded(s),
    () => [
      rec('core.status', 'Review status', 'Milestone audited -- review overall status', 'high'),
      rec('workflow.plan', 'Plan next', 'Plan the next milestone', 'medium'),
    ],
  ),

  // Rule 22: After milestone audit failure -> review or debug
  rule(
    'after-milestone-failure',
    'After milestone audit failure, investigate gaps',
    (s) => lastWas(s, 'workflow.milestone') && lastFailed(s),
    () => [
      rec('workflow.debug', 'Investigate gaps', 'Milestone audit found gaps -- investigate', 'high'),
      rec('workflow.execute', 'Execute fixes', 'Execute remaining work for the milestone', 'medium'),
    ],
  ),

  // Rule 23: After debug success -> re-execute or verify
  rule(
    'after-debug-success',
    'After successful debugging, re-execute or verify',
    (s) => lastWas(s, 'workflow.debug') && lastSucceeded(s),
    () => [
      rec('workflow.execute', 'Re-execute', 'Debug complete -- re-execute with fixes', 'high'),
      rec('workflow.verify', 'Verify fix', 'Verify the fix is correct', 'medium'),
    ],
  ),

  // Rule 24: After debug failure -> escalate
  rule(
    'after-debug-failure',
    'After debug failure, research or discuss',
    (s) => lastWas(s, 'workflow.debug') && lastFailed(s),
    () => [
      rec('workflow.research', 'Research solution', 'Debugging stuck -- research for solutions', 'high'),
      rec('workflow.discuss', 'Discuss with team', 'Discuss the issue for fresh perspective', 'medium'),
    ],
  ),

  // Rule 25: After ship failure -> debug and verify (Phase 8)
  rule(
    'after-ship-failure',
    'After ship failure, investigate or re-verify',
    (s) => lastWas(s, 'workflow.ship') && lastFailed(s),
    () => [
      rec('workflow.debug', 'Debug failure', 'Investigate ship failure', 'high'),
      rec('workflow.verify', 'Re-verify', 'Re-run verification before retrying ship', 'medium'),
    ],
  ),

  // Rule 26: After release success -> milestone complete (Phase 8)
  rule(
    'after-release-success',
    'After successful release, consider completing the milestone',
    (s) => lastWas(s, 'workflow.release') && lastSucceeded(s),
    () => [
      rec('workflow.milestone', 'Complete milestone', 'Archive and tag this milestone', 'medium'),
      rec('core.status', 'Check status', 'Review status after release', 'low'),
    ],
  ),

  // Rule 27: After release failure -> debug (Phase 8)
  rule(
    'after-release-failure',
    'After release failure, investigate',
    (s) => lastWas(s, 'workflow.release') && lastFailed(s),
    () => [
      rec('workflow.debug', 'Debug failure', 'Investigate release failure', 'high'),
    ],
  ),

  // Rule 28: After milestone complete -> start new milestone (Phase 8)
  rule(
    'after-milestone-complete',
    'After completing a milestone, start the next one',
    (s) => lastWas(s, 'workflow.milestone') && lastSucceeded(s) && hasProjectState(s, 'lastMilestoneAction', 'complete'),
    () => [
      rec('workflow.milestone', 'New milestone', 'Start the next milestone', 'high'),
      rec('core.status', 'Check status', 'Review project status', 'medium'),
    ],
  ),

  // Rule 29: After milestone gaps -> plan catch-up (Phase 8)
  rule(
    'after-milestone-gaps',
    'After identifying gaps, plan catch-up work',
    (s) => lastWas(s, 'workflow.milestone') && lastSucceeded(s) && hasProjectState(s, 'lastMilestoneAction', 'gaps'),
    () => [
      rec('workflow.plan', 'Plan catch-up', 'Plan the newly created catch-up phases', 'high'),
      rec('workflow.execute', 'Execute catch-up', 'Execute catch-up phases', 'medium'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 6: Context-Aware Rules (rules 25-28)
// ---------------------------------------------------------------------------

const contextAwareRules: RecommendationRule[] = [
  // Rule 25: After guard success -> status
  rule(
    'after-guard-success',
    'After enabling guard, check overall status',
    (s) => lastWas(s, 'harness.guard') && lastSucceeded(s),
    () => [
      rec('core.status', 'Check status', 'Guard enabled -- review overall project status', 'medium'),
    ],
  ),

  // Rule 26: After guard failure -> lint
  rule(
    'after-guard-failure',
    'After guard failure, run lint to identify issues',
    (s) => lastWas(s, 'harness.guard') && lastFailed(s),
    () => [
      rec('harness.lint', 'Run lint', 'Guard setup failed -- check lint compliance first', 'high'),
    ],
  ),

  // Rule 27: After scan success -> init or discuss
  rule(
    'after-scan-success',
    'After scanning project, initialize harness or discuss',
    (s) => lastWas(s, 'core.scan') && lastSucceeded(s),
    () => [
      rec('harness.init', 'Initialize harness', 'Scan complete -- initialize project harness', 'high'),
      rec('workflow.discuss', 'Discuss project', 'Discuss the scanned project context', 'medium'),
    ],
  ),

  // Rule 28: After new project success -> discuss or research
  rule(
    'after-new-success',
    'After new project creation, discuss or research',
    (s) => lastWas(s, 'core.new') && lastSucceeded(s),
    () => [
      rec('workflow.discuss', 'Discuss vision', 'New project created -- discuss the vision', 'high'),
      rec('workflow.research', 'Research domain', 'Research the project domain', 'medium'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 7: Verification Pipeline Rules (rules 29-40)
// Transitions for verify, validate, test-gen skills (D-19, D-20)
// ---------------------------------------------------------------------------

/** Helper: check if lastResult.data has a specific verdict */
function lastVerdict(state: RecommendationState, verdict: string): boolean {
  const data = state.lastResult?.data as Record<string, unknown> | undefined;
  return data?.verdict === verdict;
}

/** Helper: check if validate coverage is below threshold */
function coverageBelow(state: RecommendationState, threshold: number): boolean {
  const data = state.lastResult?.data as Record<string, unknown> | undefined;
  const overall = data?.overall as Record<string, unknown> | undefined;
  const lines = overall?.lines as Record<string, unknown> | undefined;
  const pct = lines?.pct;
  return typeof pct === 'number' && pct < threshold;
}

/** Helper: check if validate coverage is at or above threshold */
function coverageAtOrAbove(state: RecommendationState, threshold: number): boolean {
  const data = state.lastResult?.data as Record<string, unknown> | undefined;
  const overall = data?.overall as Record<string, unknown> | undefined;
  const lines = overall?.lines as Record<string, unknown> | undefined;
  const pct = lines?.pct;
  return typeof pct === 'number' && pct >= threshold;
}

/**
 * Phase 33 Wave 1: Helper to detect "verify --coverage" (absorbed from validate skill).
 * Distinguishes coverage runs from full 7-layer verify runs by checking
 * if the result data has a CoverageReport shape (data.overall.lines.pct)
 * vs a VerifyReport shape (data.verdict).
 */
function lastWasVerifyCoverage(state: RecommendationState): boolean {
  if (!lastWas(state, 'workflow.verify')) return false;
  const data = state.lastResult?.data as Record<string, unknown> | undefined;
  // CoverageReport has data.overall; VerifyReport has data.verdict
  return typeof (data?.overall as Record<string, unknown> | undefined)?.lines !== 'undefined';
}

/**
 * Phase 33 Wave 2: Helper to detect "verify --generate-tests" (absorbed from test-gen skill).
 * Distinguishes test-gen runs from full 7-layer verify runs by checking
 * if the result data has a TestGenResult shape (data.generatedFiles array).
 */
function lastWasVerifyTestGen(state: RecommendationState): boolean {
  if (!lastWas(state, 'workflow.verify')) return false;
  const data = state.lastResult?.data as Record<string, unknown> | undefined;
  // TestGenResult has data.generatedFiles array
  return Array.isArray(data?.generatedFiles);
}

const verificationPipelineRules: RecommendationRule[] = [
  // Rule 29: After verify WARN -> suggest review for human analysis
  rule(
    'after-verify-warn-review',
    'After verify WARN verdict, suggest human review',
    (s) => lastWas(s, 'workflow.verify') && lastSucceeded(s) && lastVerdict(s, 'WARN'),
    () => [
      rec('workflow.review', 'Review warnings', 'Verify found warnings -- review them before shipping', 'medium'),
      rec('workflow.ship', 'Ship anyway', 'Ship if warnings are acceptable', 'low'),
    ],
  ),

  // Rule 30: After verify --coverage with low coverage -> suggest verify --generate-tests
  // Phase 33 Wave 1: workflow.validate → workflow.verify (coverage mode)
  // Phase 33 Wave 2: workflow.test-gen → workflow.verify --generate-tests
  rule(
    'after-validate-low-coverage',
    'After verify --coverage with low coverage, generate more tests',
    (s) => lastWasVerifyCoverage(s) && lastSucceeded(s) && coverageBelow(s, 80),
    () => [
      rec('workflow.verify', 'Generate tests', 'Coverage is below 80% -- generate more tests with verify --generate-tests', 'high'),
      rec('workflow.verify', 'Verify anyway', 'Run verification despite low coverage', 'low'),
    ],
  ),

  // Rule 31: After verify --coverage with good coverage -> suggest full verify
  // Phase 33 Wave 1: workflow.validate → workflow.verify (coverage mode)
  rule(
    'after-validate-high-coverage',
    'After verify --coverage with good coverage, proceed to full verify',
    (s) => lastWasVerifyCoverage(s) && lastSucceeded(s) && coverageAtOrAbove(s, 80),
    () => [
      rec('workflow.verify', 'Verify output', 'Good coverage -- proceed to full verification', 'medium'),
    ],
  ),

  // Rule 32: After verify --coverage failure -> suggest debug
  // Phase 33 Wave 1: workflow.validate → workflow.verify (coverage mode)
  rule(
    'after-validate-fail',
    'After verify --coverage failure, debug the coverage issues',
    (s) => lastWasVerifyCoverage(s) && lastFailed(s),
    () => [
      rec('workflow.debug', 'Debug coverage', 'Verify --coverage failed -- investigate the issue', 'medium'),
      rec('workflow.verify', 'Retry verify --coverage', 'Retry coverage audit after fixing issues', 'low'),
    ],
  ),

  // Rule 33: After verify --generate-tests success -> suggest verify --coverage to re-check coverage
  // Phase 33 Wave 1: workflow.validate → workflow.verify (coverage mode)
  // Phase 33 Wave 2: workflow.test-gen → workflow.verify --generate-tests
  rule(
    'after-test-gen-success',
    'After successful test generation (verify --generate-tests), re-check coverage',
    (s) => lastWas(s, 'workflow.verify') && lastSucceeded(s) && lastWasVerifyTestGen(s),
    () => [
      rec('workflow.verify', 'Re-check coverage', 'Tests generated -- re-check coverage with verify --coverage', 'high'),
    ],
  ),

  // Rule 34: After verify --generate-tests failure -> suggest debug
  // Phase 33 Wave 2: workflow.test-gen → workflow.verify --generate-tests
  rule(
    'after-test-gen-fail',
    'After test generation failure (verify --generate-tests), debug the issues',
    (s) => lastWas(s, 'workflow.verify') && lastFailed(s) && lastWasVerifyTestGen(s),
    () => [
      rec('workflow.debug', 'Debug test-gen', 'Test generation failed -- investigate', 'medium'),
      rec('workflow.verify', 'Retry verify --generate-tests', 'Retry test generation with verify --generate-tests', 'low'),
    ],
  ),

  // Rule 35: After review success -> suggest execute
  rule(
    'after-review-success-execute',
    'After successful review, execute the reviewed plan',
    (s) => lastWas(s, 'workflow.review') && lastSucceeded(s),
    () => [
      rec('workflow.execute', 'Execute plan', 'Review passed -- execute the plan', 'high'),
    ],
  ),

  // Rule 36: After review failure -> suggest plan revision
  rule(
    'after-review-failure',
    'After review failure, revise the plan',
    (s) => lastWas(s, 'workflow.review') && lastFailed(s),
    () => [
      rec('workflow.plan', 'Revise plan', 'Review found issues -- revise the plan', 'high'),
      rec('workflow.discuss', 'Discuss issues', 'Discuss the review findings', 'medium'),
    ],
  ),

  // Rule 37: After verify PASS with warnings -> suggest verify --coverage for coverage check
  // Phase 33 Wave 1: workflow.validate → workflow.verify (coverage mode)
  rule(
    'after-verify-pass-with-warnings',
    'After verify PASS with warnings, check coverage with verify --coverage',
    (s) =>
      lastWas(s, 'workflow.verify') &&
      lastSucceeded(s) &&
      lastVerdict(s, 'PASS') &&
      Array.isArray(s.lastResult?.warnings) &&
      s.lastResult!.warnings!.length > 0,
    () => [
      rec('workflow.verify', 'Check coverage', 'Verify passed with warnings -- check test coverage with --coverage', 'low'),
    ],
  ),

  // Rule 38: After guard with promotion suggestions -> suggest verify
  rule(
    'verify-after-guard-promotion',
    'After guard success with promotions, run full verification',
    (s) => {
      if (!lastWas(s, 'harness.guard') || !lastSucceeded(s)) return false;
      const data = s.lastResult?.data as Record<string, unknown> | undefined;
      return Array.isArray(data?.promotions) && (data!.promotions as unknown[]).length > 0;
    },
    () => [
      rec('workflow.verify', 'Run verification', 'Guard found promotion candidates -- verify against full pipeline', 'low'),
    ],
  ),

  // Rule 39: After plan success -> also suggest review (lower than execute)
  rule(
    'after-plan-success-review',
    'After planning, optionally review before executing',
    (s) => lastWas(s, 'workflow.plan') && lastSucceeded(s),
    () => [
      rec('workflow.review', 'Review plan', 'Review the plan before executing', 'medium'),
    ],
  ),

  // Rule 40: After plan success -> suggest ultraplan for browser-based visual review
  rule(
    'after-plan-suggest-ultraplan',
    'After planning, optionally review via ultraplan in browser',
    (s) => lastWas(s, 'workflow.plan') && lastSucceeded(s),
    () => [
      rec('workflow.ultraplan', 'Visual review via Ultraplan', 'Review plan in browser with inline comments before executing', 'low'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 9: Composition Skill Rules (Phase 9)
// Transitions for auto/quick/fast/do composition skills
// ---------------------------------------------------------------------------

const compositionRules: RecommendationRule[] = [
  // After milestone new -> suggest running auto pipeline
  rule(
    'suggest-auto-after-milestone-new',
    'After creating a new milestone, run auto pipeline',
    (s) => lastWas(s, 'workflow.milestone') && lastSucceeded(s) && hasProjectState(s, 'lastMilestoneAction', 'new'),
    () => [
      rec('workflow.auto', 'Run Auto Pipeline', 'New milestone created -- run auto to execute all phases', 'high'),
    ],
  ),

  // Fresh session with no previous skill -> suggest next (primary) then do (secondary)
  rule(
    'suggest-next-idle',
    'Suggest next recommended action for fresh sessions (primary over do)',
    (s) => s.lastSkillId === undefined || s.lastSkillId === '',
    () => [
      rec('workflow.next', 'Get next action', 'See what to work on next', 'medium'),
      rec('workflow.do', 'Describe what you need', 'Describe your task in natural language', 'low'),
    ],
  ),

  // No context -> suggest do as secondary option after next
  rule(
    'suggest-do-generic',
    'Suggest natural language task description as secondary option',
    (s) => !s.lastSkillId,
    () => [
      rec('workflow.do', 'Describe What You Need', 'Describe your task in natural language', 'low'),
    ],
  ),

  // After auto success -> suggest shipping results
  rule(
    'after-auto-success',
    'After auto pipeline completes, ship the results',
    (s) => lastWas(s, 'workflow.auto') && lastSucceeded(s),
    () => [
      rec('workflow.ship', 'Ship Results', 'Auto pipeline complete -- ship the PR', 'high'),
    ],
  ),

  // After auto failure -> retry or check status
  rule(
    'after-auto-failure',
    'After auto pipeline failure, retry or check status',
    (s) => lastWas(s, 'workflow.auto') && !lastSucceeded(s),
    () => [
      rec('workflow.auto', 'Retry Auto', 'Resume auto pipeline from where it stopped', 'high'),
      rec('core.status', 'Check Status', 'See what phase failed', 'medium'),
    ],
  ),

  // After quick success -> suggest verifying changes
  rule(
    'after-quick-success',
    'After quick task completes, verify the changes',
    (s) => lastWas(s, 'workflow.quick') && lastSucceeded(s),
    () => [
      rec('workflow.verify', 'Verify Changes', 'Run verification on the quick task output', 'medium'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 10: Debugging Skill Rules (Phase 10)
// Transitions for diagnose -> debug -> forensics escalation chain
// ---------------------------------------------------------------------------

const debuggingRules: RecommendationRule[] = [
  // Rule 36: After diagnose success with errors -> suggest debug
  rule(
    'after-diagnose-errors',
    'After diagnose finds errors, suggest debug for analysis',
    (s) => lastWas(s, 'workflow.diagnose') && lastSucceeded(s) && hasProjectState(s, 'diagnose.lastResult'),
    (s) => {
      const result = s.projectState['diagnose.lastResult'] as { total_errors?: number } | undefined;
      if (result && (result.total_errors ?? 0) > 0) {
        return [
          rec('workflow.debug', 'Debug issues', 'Diagnose found errors -- get AI analysis of root cause', 'high'),
          rec('workflow.lint', 'Run lint', 'Check for architecture violations', 'medium'),
        ];
      }
      return [
        rec('workflow.verify', 'Verify', 'No errors found -- proceed with verification', 'medium'),
      ];
    },
  ),

  // Rule 37: After diagnose with zero errors -> verify or continue
  rule(
    'after-diagnose-clean',
    'After clean diagnose, suggest verify or continue',
    (s) => lastWas(s, 'workflow.diagnose') && lastSucceeded(s) && !hasProjectState(s, 'diagnose.lastResult'),
    () => [
      rec('workflow.verify', 'Verify', 'Build is clean -- proceed with verification', 'high'),
      rec('workflow.execute', 'Continue executing', 'No issues found -- continue work', 'medium'),
    ],
  ),

  // Rule 38: After forensics -> suggest plan or discuss to address findings
  rule(
    'after-forensics',
    'After forensics analysis, suggest planning corrective action',
    (s) => lastWas(s, 'workflow.forensics') && lastSucceeded(s),
    () => [
      rec('workflow.plan', 'Plan fix', 'Forensics identified root cause -- plan corrective action', 'high'),
      rec('workflow.discuss', 'Discuss approach', 'Review forensics findings and discuss next steps', 'medium'),
    ],
  ),

  // Rule 39: After forensics failure -> try debug instead
  rule(
    'after-forensics-failure',
    'After forensics failure, fall back to debug',
    (s) => lastWas(s, 'workflow.forensics') && lastFailed(s),
    () => [
      rec('workflow.debug', 'Try debug', 'Forensics failed -- try targeted debugging instead', 'high'),
      rec('workflow.diagnose', 'Run diagnose', 'Get deterministic error analysis first', 'medium'),
    ],
  ),

  // Rule 40: After repeated debug failures -> escalate to forensics
  rule(
    'debug-escalate-forensics',
    'After debug failure, suggest deeper forensics analysis',
    (s) => lastWas(s, 'workflow.debug') && lastFailed(s),
    () => [
      rec('workflow.forensics', 'Run forensics', 'Debug failed -- try full post-mortem analysis', 'high'),
      rec('workflow.diagnose', 'Run diagnose', 'Get fresh diagnostic data', 'medium'),
      rec('workflow.research', 'Research the issue', 'Complex problem -- research before fixing', 'low'),
    ],
  ),

  // Rule 41 (Phase 23a): After debug with environmental failure -> suggest dependency/type fix
  rule(
    'debug-environmental-failure',
    'After debug identifies environmental issue, suggest targeted fix',
    (s) => {
      if (!lastWas(s, 'workflow.debug') || !lastSucceeded(s)) return false;
      const data = s.lastResult?.data as Record<string, unknown> | undefined;
      const ft = data?.failure_type as string | undefined;
      return ft === 'type_mismatch' || ft === 'dependency_conflict';
    },
    (s) => {
      const data = s.lastResult?.data as Record<string, unknown> | undefined;
      const ft = data?.failure_type as string;
      if (ft === 'dependency_conflict') {
        return [
          rec('workflow.execute', 'Fix dependencies', 'Dependency conflict identified -- execute fix', 'high'),
          rec('harness.health', 'Check health', 'Verify project health after dependency fix', 'medium'),
        ];
      }
      return [
        rec('workflow.execute', 'Fix types', 'Type mismatch identified -- execute fix', 'high'),
        rec('workflow.verify', 'Verify fix', 'Verify the type fix is correct', 'medium'),
      ];
    },
  ),

  // Rule 42 (Phase 23a): After debug with behavioral failure -> suggest deeper investigation
  rule(
    'debug-behavioral-failure',
    'After debug identifies behavioral issue, suggest investigation',
    (s) => {
      if (!lastWas(s, 'workflow.debug') || !lastSucceeded(s)) return false;
      const data = s.lastResult?.data as Record<string, unknown> | undefined;
      const ft = data?.failure_type as string | undefined;
      return ft === 'state_corruption' || ft === 'race_condition' || ft === 'silent_failure';
    },
    () => [
      rec('workflow.forensics', 'Deep investigation', 'Behavioral bug detected -- run forensics for root cause', 'high'),
      rec('workflow.verify', 'Verify state', 'Check state integrity after fix', 'medium'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 8: Fallback Rules (rules 41-42)
// ---------------------------------------------------------------------------

const fallbackRules: RecommendationRule[] = [
  // Rule 29: After status -> suggest next action based on context
  rule(
    'after-status',
    'After status check, suggest continuing work',
    (s) => lastWas(s, 'core.status') && lastSucceeded(s),
    () => [
      rec('workflow.plan', 'Create plan', 'Continue by planning next work', 'medium'),
      rec('harness.health', 'Check health', 'Run a health check on the project', 'low'),
    ],
  ),

  // Rule 30: Generic fallback -- always matches, lowest priority
  rule(
    'generic-fallback',
    'Generic fallback: suggest checking status',
    () => true,
    () => [
      rec('core.status', 'Check status', 'Review current project status', 'low'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Category 11: Active-Work Rules (Phase 27 Plan B)
// ---------------------------------------------------------------------------

const activeWorkRules: RecommendationRule[] = [
  rule(
    'category_detected_quick',
    'Category classifier detected quick -- suggest /sunco:quick',
    (s) => {
      const data = s.lastResult?.data as Record<string, unknown> | undefined;
      return data?.category === 'quick' && lastWas(s, 'workflow.do');
    },
    () => [
      rec('workflow.quick', 'Quick fix', 'Category classifier identified a quick task', 'high'),
    ],
  ),

  rule(
    'background_work_stale',
    'Background agent stale for >5min -- suggest checking status',
    (s) => {
      const data = s.projectState['activeWork.backgroundStale'] as boolean | undefined;
      return data === true;
    },
    () => [
      rec('workflow.status', 'Check status', 'Background work running >5min -- check progress', 'medium'),
    ],
  ),

  rule(
    'blocked_but_no_advisor',
    'Blocked >30min with no advisor available (stub for Phase 28)',
    (s) => {
      const data = s.projectState['activeWork.blockedMinutes'] as number | undefined;
      return typeof data === 'number' && data >= 30;
    },
    () => [
      rec('workflow.discuss', 'Discuss blocker', 'Blocked for >30min -- discuss to unblock', 'high'),
    ],
  ),

  rule(
    'next_action_ambiguous',
    'STATE.md unclear on next action -- suggest /sunco:discuss',
    (s) => {
      const ambiguous = s.projectState['nextActionAmbiguous'] as boolean | undefined;
      return ambiguous === true;
    },
    () => [
      rec('workflow.discuss', 'Discuss next step', 'Next action unclear from STATE.md -- discuss to clarify', 'high'),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Export: all rules combined
// ---------------------------------------------------------------------------

/**
 * All recommendation rules, ordered by specificity.
 * More specific rules (workflow transitions) come before
 * generic fallback rules.
 */
export const RECOMMENDATION_RULES: RecommendationRule[] = [
  ...workflowTransitionRules,
  ...harnessTransitionRules,
  ...sessionStateRules,
  ...errorRecoveryRules,
  ...milestoneRules,
  ...contextAwareRules,
  ...verificationPipelineRules,
  ...compositionRules,
  ...debuggingRules,
  ...activeWorkRules,
  ...fallbackRules,
];
