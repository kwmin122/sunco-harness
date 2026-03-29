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
export { statusSkill, progressSkill } from './status.skill.js';
export { default as nextSkill } from './next.skill.js';
export { default as contextSkill } from './context.skill.js';
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

// Phase 6 execution + review skills
export { default as executeSkill } from './execute.skill.js';
export { default as reviewSkill } from './review.skill.js';

// Phase 7 verification pipeline skills
export { default as verifySkill } from './verify.skill.js';
export { default as validateSkill } from './validate.skill.js';
export { default as testGenSkill } from './test-gen.skill.js';

// Phase 8 shipping + milestones skills
export { default as shipSkill } from './ship.skill.js';
export { default as releaseSkill } from './release.skill.js';
export { default as milestoneSkill } from './milestone.skill.js';

// Phase 9 composition skills
export { default as quickSkill } from './quick.skill.js';
export { default as fastSkill } from './fast.skill.js';

// Phase 7 shared utilities
export type { VerifyFinding, VerifyReport, LayerResult, VerifyVerdict, CoverageMetric, FileCoverage, CoverageReport } from './shared/verify-types.js';
export { parseCoverageSummary } from './shared/coverage-parser.js';

// Phase 5 shared utilities
export { resolvePhaseDir, readPhaseArtifact, writePhaseArtifact } from './shared/phase-reader.js';

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

// Prompt builders (for extensibility)
export { buildResearchPrompt, buildSynthesisPrompt } from './prompts/index.js';
