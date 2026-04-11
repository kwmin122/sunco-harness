/**
 * @sunco/skills-workflow - Workflow orchestration skills
 *
 * Skills for agent context, planning, execution,
 * and verification workflows.
 */

// Shared types
export type {
  ParsedPhase,
  ParsedProgress,
  ParsedState,
  GitState,
  TodoItem,
  SeedItem,
  BacklogItem,
} from './shared/types.js';

// Shared utilities
export { parseRoadmap } from './shared/roadmap-parser.js';
export { addPhase, insertPhase, removePhase } from './shared/roadmap-writer.js';
export { parseStateMd } from './shared/state-reader.js';
export { HandoffSchema, readHandoff, writeHandoff } from './shared/handoff.js';
export type { Handoff } from './shared/handoff.js';
export { captureGitState } from './shared/git-state.js';

// Skills
// Phase 32: progressSkill export removed — 'progress' is now an alias declared on statusSkill
// Phase 33 Wave 1: context export removed — 'context' is now an alias declared on statusSkill
export { statusSkill } from './status.skill.js';
export { default as nextSkill } from './next.skill.js';
export { default as pauseSkill } from './pause.skill.js';
export { default as resumeSkill } from './resume.skill.js';
export { default as noteSkill } from './note.skill.js';
export { default as todoSkill } from './todo.skill.js';
export { default as seedSkill } from './seed.skill.js';
export { default as backlogSkill } from './backlog.skill.js';
export { default as phaseSkill } from './phase.skill.js';
export { default as settingsSkill } from './settings.skill.js';
export { default as newSkill } from './new.skill.js';
export { default as scanSkill } from './scan.skill.js';

// Phase 5 context + planning skills
export { default as discussSkill } from './discuss.skill.js';
export { default as assumeSkill } from './assume.skill.js';
export { default as researchSkill } from './research.skill.js';
export { default as planSkill } from './plan.skill.js';

// Phase 5.5 ultraplan (browser-based visual plan review)
export { default as ultraplanSkill } from './ultraplan.skill.js';

// Phase 6 execution + review skills
export { default as executeSkill } from './execute.skill.js';
export { default as reviewSkill } from './review.skill.js';

// Phase 24d compound learning skill
export { default as compoundSkill } from './compound.skill.js';

// Phase 24d review arsenal skills
export { default as ceoReviewSkill } from './ceo-review.skill.js';
export { default as engReviewSkill } from './eng-review.skill.js';
export { default as designReviewSkill } from './design-review.skill.js';

// Phase 7 verification pipeline skills
export { default as verifySkill } from './verify.skill.js';
export { default as validateSkill } from './validate.skill.js';
export { default as testGenSkill } from './test-gen.skill.js';

// Phase 8 shipping + milestones skills
export { default as shipSkill } from './ship.skill.js';
export { default as releaseSkill } from './release.skill.js';
export { default as milestoneSkill } from './milestone.skill.js';

// Phase 9 composition skills
export { default as autoSkill } from './auto.skill.js';
export { default as quickSkill } from './quick.skill.js';
// Phase 32: fastSkill removed — 'fast' is now an alias on quickSkill (see quick.skill.ts aliases[])
export { default as doSkill } from './do.skill.js';

// Phase 10 debugging skills
export { default as debugSkill } from './debug.skill.js';
export { default as diagnoseSkill } from './diagnose.skill.js';
export { default as forensicsSkill } from './forensics.skill.js';

// Phase 13 headless CI/CD skills
// Phase 33 Wave 1: querySkill export removed — 'query' is now an alias declared on statusSkill
export { default as exportSkill } from './export.skill.js';

// Phase 14 context optimization skills
export { default as graphSkill } from './graph.skill.js';

// Phase 15 document generation skills
export { default as docSkill } from './doc.skill.js';

// Phase 10 shared types
export type { FailureType, DiagnoseError, DiagnoseResult, DebugAnalysis, ForensicsReport } from './shared/debug-types.js';
export { parseTestOutput, parseTypeErrors, parseLintErrors } from './diagnose.skill.js';

// Phase 23a Iron Law Engine utilities
export type { IronLawState, BugPattern, BugCategory, DebugLearning, SanitizeResult, IronLawDebugAnalysis, DebugStuckResult } from './shared/debug-types.js';
export { classifyBug, getBugPattern, getPatternsByCategory } from './shared/bug-patterns.js';
export { sanitizeForSearch } from './shared/error-sanitizer.js';
export { saveLearning, searchLearnings, readAllLearnings, incrementHitCount } from './shared/debug-learnings.js';
export { createIronLawGate, createIronLawState, confirmRootCause, rejectHypothesis, addHypothesis, isEditBlocked, HookAbortError } from './shared/iron-law-gate.js';
export { buildDebugIronLawPrompt } from './prompts/debug-ironlaw.js';
export type { IronLawPromptParams } from './prompts/debug-ironlaw.js';

// Phase 23b Review Army utilities
export { evaluateSpecialistGate, updateSpecialistRecord, createSpecialistRecord, ALL_SPECIALISTS } from './shared/specialist-gate.js';
export type { SpecialistId, SpecialistGateResult, SpecialistRecord } from './shared/specialist-gate.js';
export { applyConfidenceGate, formatConfidenceGateSummary } from './shared/confidence-gate.js';
export type { ConfidenceGateResult } from './shared/confidence-gate.js';
export { generateTestStubs, formatTestStubSummary } from './shared/test-stub-generator.js';
export type { TestStub } from './shared/test-stub-generator.js';

// Phase 23b specialist prompts
export { buildVerifyTestingPrompt } from './prompts/verify-testing.js';
export { buildVerifyApiPrompt } from './prompts/verify-api.js';
export { buildVerifyMigrationPrompt } from './prompts/verify-migration.js';
export { buildVerifyMaintainabilityPrompt } from './prompts/verify-maintainability.js';

// Phase 24a universal learnings + timeline
export { logLearning, readAllLearnings as readAllUniversalLearnings, searchLearnings as searchUniversalLearnings, getLearningsCount } from './shared/learnings.js';
export type { Learning, LearningType, LearningSource } from './shared/learnings.js';
export { logTimelineEvent, getRecentTimeline, getBranchTimeline, getLastSession, detectSkillPattern } from './shared/skill-timeline.js';
export type { TimelineEntry, SkillPattern } from './shared/skill-timeline.js';
export { recoverContext, formatWelcomeBriefing } from './shared/context-recovery.js';
export type { RecoveryContext } from './shared/context-recovery.js';

// Phase 24c routing + proactive
export { loadRoutingRules, matchRoute, parseRoutingSection, generateRoutingSection, DEFAULT_ROUTING_RULES } from './shared/skill-router.js';
export type { RoutingRule, RouteMatch } from './shared/skill-router.js';
export { detectProactiveSuggestion, formatProactiveSuggestion } from './shared/keyword-matcher.js';
export type { ProactiveSuggestion } from './shared/keyword-matcher.js';

// Phase 24b smart review
export { extractIntent, detectDrift } from './shared/scope-drift-detector.js';
export type { DriftVerdict, DriftResult } from './shared/scope-drift-detector.js';
export { extractPlanTasks, auditPlanCompletion } from './shared/plan-completion-auditor.js';
export type { PlanTask as CompletionPlanTask, TaskStatus, CompletionAudit } from './shared/plan-completion-auditor.js';

// Phase 7 shared utilities
export type { VerifyFinding, VerifyReport, LayerResult, VerifyVerdict, CoverageMetric, FileCoverage, CoverageReport } from './shared/verify-types.js';
export { parseCoverageSummary } from './shared/coverage-parser.js';

// Phase 5 shared utilities
export { resolvePhaseDir, readPhaseArtifact, readPhaseArtifactSmart, writePhaseArtifact } from './shared/phase-reader.js';

// Phase 17 context intelligence utilities
export { classifyContextZone, readContextZone, CONTEXT_ZONE_FILENAME } from './shared/context-zones.js';
export type { ContextZone, ContextZoneResult, ContextZoneFile } from './shared/context-zones.js';
export { summarizeArtifact, planArtifactLoading } from './shared/artifact-summarizer.js';
export type { ArtifactSummary, ArtifactLoadPlan } from './shared/artifact-summarizer.js';

// Phase 18 smart routing utilities
export { classifyIntent } from './shared/intent-classifier.js';
export type { IntentType, IntentResult } from './shared/intent-classifier.js';
export { selectModelTier } from './shared/model-selector.js';
export type { ModelTier, ModelSelectionResult } from './shared/model-selector.js';
export { recordRouting, getRoutingStats } from './shared/routing-tracker.js';
export type { RoutingRecord, RoutingStats } from './shared/routing-tracker.js';

// Phase 6 shared utilities
export { parsePlanMd, groupPlansByWave } from './shared/plan-parser.js';
export type { PlanFrontmatter, PlanTask, ParsedPlan } from './shared/plan-parser.js';
export { WorktreeManager } from './shared/worktree-manager.js';
export type { WorktreeInfo } from './shared/worktree-manager.js';

// Phase 8 shared utilities
export { bumpVersion, updateAllVersions } from './shared/version-bumper.js';
export { generateChangelog, parseGitLog, prependChangelog } from './shared/changelog-writer.js';
export type { ChangelogEntry } from './shared/changelog-writer.js';
export { archiveMilestone, resetStateForNewMilestone, parseMilestoneAudit, buildGapPhases } from './shared/milestone-helpers.js';

// Phase 19 lifecycle hooks
export { createHookRunner, createDefaultHookRunner, registerActiveWorkHook } from './shared/lifecycle-hooks.js';
export type { HookEvent, HookDefinition, HookContext, HookRunner } from './shared/lifecycle-hooks.js';
export { limitHookOutput, HOOK_OUTPUT_LIMIT } from './shared/hook-output-limiter.js';
export { parseCatchRules, applyCatchRules } from './shared/catch-rules.js';
export type { CatchRule } from './shared/catch-rules.js';

// Phase 20 infinite execution utilities
export { evaluateRotation } from './shared/context-rotator.js';
export type { RotationConfig, RotationResult } from './shared/context-rotator.js';
export { getAdaptiveTimeout, DEFAULT_TIMEOUTS } from './shared/adaptive-timeout.js';
export type { TimeoutProfile, TimeoutConfig } from './shared/adaptive-timeout.js';
export { startSession, endSession, getRecentSessions, recordSessionActivity } from './shared/session-recorder.js';
export type { SessionRecord } from './shared/session-recorder.js';

// Phase 21 cross-session intelligence utilities
export { readFeatureStore, writeFeatureStore, trackFeature, getFeatureSessions, getSessionFeatures } from './shared/feature-tracker.js';
export type { FeatureEntry, FeatureStore } from './shared/feature-tracker.js';
export { recordSkillUsage, getSkillProfile } from './shared/skill-profile.js';
export type { SkillUsageEntry, SkillProfile } from './shared/skill-profile.js';
export { checkHarnessBudget, HARNESS_BUDGET_PERCENT } from './shared/harness-budget.js';
export type { HarnessBudgetResult } from './shared/harness-budget.js';

// Ultraplan prompt builders
export { buildUltraplanReviewPrompt, buildUltraplanDraftPrompt, parseUltraplanOutput } from './prompts/ultraplan.js';
export type { UltraplanReviewParams, UltraplanDraftParams } from './prompts/ultraplan.js';

// Product-level planning prompt builders (Phase 24d)
export { buildProductSpecPrompt } from './prompts/product-spec.js';
export type { ProductSpecParams } from './prompts/product-spec.js';
export { buildSliceContractPrompt } from './prompts/slice-contract.js';
export type { SliceContractParams } from './prompts/slice-contract.js';

// Prompt builders (for extensibility)
export { buildResearchPrompt, buildSynthesisPrompt } from './prompts/index.js';
