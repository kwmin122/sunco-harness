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

// Prompt builders (for extensibility)
export { buildResearchPrompt, buildSynthesisPrompt } from './prompts/index.js';
