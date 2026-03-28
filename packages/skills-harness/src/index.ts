/**
 * @sunco/skills-harness - Harness engineering skills
 *
 * Linting, validation, and enforcement skills that ensure
 * agents make fewer mistakes.
 *
 * Skills:
 *   - core.settings: View and manage TOML configuration (CFG-04)
 *   - sample.prompt: Sample skill demonstrating agent dispatch (SKL-05)
 *   - harness.agents: Analyze agent instruction files (HRN-12, HRN-13)
 *   - harness.health: Codebase health score (HRN-09, HRN-10, HRN-11)
 */

export { default as settingsSkill } from './settings.skill.js';
export { default as samplePromptSkill } from './sample-prompt.skill.js';
export { default as agentsSkill } from './agents.skill.js';
export { default as healthSkill } from './health.skill.js';
