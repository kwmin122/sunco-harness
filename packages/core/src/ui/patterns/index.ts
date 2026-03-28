/**
 * @sunco/core - UI Interaction Patterns (Layer 3)
 *
 * The 4 lifecycle patterns that map to the skill state machine:
 * idle -> entry -> choice? -> running -> result
 *
 * These patterns cover 80% of all skill UI needs (D-32).
 * Skills never import these directly -- they call ctx.ui.entry/ask/progress/result
 * which delegates through the adapter to these patterns (D-33).
 */

export { SkillEntry } from './SkillEntry.js';
export type { SkillEntryProps } from './SkillEntry.js';

export { InteractiveChoice } from './InteractiveChoice.js';
export type { InteractiveChoiceProps } from './InteractiveChoice.js';

export { SkillProgress } from './SkillProgress.js';
export type { SkillProgressProps } from './SkillProgress.js';

export { SkillResult } from './SkillResult.js';
export type { SkillResultProps } from './SkillResult.js';
