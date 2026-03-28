/**
 * @sunco/core - UI Module
 *
 * Re-exports all UI layers:
 * - Theme tokens (colors, symbols, spacing)
 * - Layer 1: Primitives (SunBox, SunText, Badge)
 * - Layer 2: Components (StatusSymbol, ErrorBox, RecommendationCard)
 * - Layer 3: Interaction Patterns (SkillEntry, InteractiveChoice, SkillProgress, SkillResult)
 * - Hooks: useSelection, useKeymap
 * - Session: StatusBar
 * - Adapters: UiAdapter, SkillUi interfaces + implementations
 */

// Theme
export { theme } from './theme/tokens.js';
export type { Theme, ThemeColors, ThemeSymbols, ThemeSpacing } from './theme/tokens.js';

// Layer 1: Primitives
export { SunBox, SunText, Badge } from './primitives/index.js';
export type { SunBoxProps, SunTextProps, BadgeProps } from './primitives/index.js';

// Layer 2: Components
export { StatusSymbol, ErrorBox, RecommendationCard } from './components/index.js';
export type { StatusType, StatusSymbolProps, ErrorBoxProps, RecommendationCardProps } from './components/index.js';

// Layer 3: Interaction Patterns
export { SkillEntry, InteractiveChoice, SkillProgress, SkillResult } from './patterns/index.js';
export type {
  SkillEntryProps,
  InteractiveChoiceProps,
  SkillProgressProps,
  SkillResultProps,
} from './patterns/index.js';

// Hooks
export { useSelection, useKeymap } from './hooks/index.js';
export type { UseSelectionOptions, UseSelectionResult } from './hooks/index.js';

// Session
export { StatusBar } from './session/StatusBar.js';
export type { StatusBarProps } from './session/StatusBar.js';

// Adapters (interfaces)
export type {
  SkillUi,
  SkillEntryInput,
  AskOption,
  AskInput,
  UiChoiceResult,
  ProgressInput,
  ProgressHandle,
  ResultInput,
} from './adapters/SkillUi.js';

export type {
  UiAdapter,
  UiPatternKind,
  UiPattern,
  UiOutcome,
  UiPatch,
} from './adapters/UiAdapter.js';

// Adapter implementations + factories
export { SilentUiAdapter } from './adapters/SilentUiAdapter.js';
export { InkUiAdapter } from './adapters/InkUiAdapter.js';
export { createSkillUi, createUiAdapter } from './adapters/index.js';
export type { CreateUiAdapterFlags } from './adapters/index.js';
