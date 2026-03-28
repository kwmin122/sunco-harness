/**
 * @sunco/skills-harness - Harness engineering skills
 *
 * Linting, validation, and enforcement skills that ensure
 * agents make fewer mistakes.
 *
 * Skills:
 *   - core.settings: View and manage TOML configuration (CFG-04)
 *   - sample.prompt: Sample skill demonstrating agent dispatch (SKL-05)
 */

export { default as settingsSkill } from './settings.skill.js';
export { default as samplePromptSkill } from './sample-prompt.skill.js';
