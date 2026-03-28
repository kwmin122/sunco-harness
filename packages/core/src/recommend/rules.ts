/**
 * @sunco/core - Recommendation Rules
 *
 * 25+ deterministic rules that map (state, lastResult) to recommendations.
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

  // Rule 2: After verify success -> ship
  rule(
    'after-verify-success',
    'After successful verification, ship the changes',
    (s) => lastWas(s, 'workflow.verify') && lastSucceeded(s),
    () => [
      rec('workflow.ship', 'Ship changes', 'Verification passed -- ready to ship', 'high'),
    ],
  ),

  // Rule 3: After verify failure -> debug (recommended), execute
  rule(
    'after-verify-failure',
    'After failed verification, debug or re-execute',
    (s) => lastWas(s, 'workflow.verify') && lastFailed(s),
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
  // Rule 13: Fresh session (no lastSkillId) -> status
  rule(
    'fresh-session',
    'Start a fresh session by checking status',
    (s) => s.lastSkillId === undefined || s.lastSkillId === null,
    () => [
      rec('core.status', 'Check status', 'Start by reviewing current project status', 'high'),
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
// Category 5: Milestone Rules (rules 21-24)
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
// Category 7: Fallback Rules (rules 29-30)
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
  ...fallbackRules,
];
