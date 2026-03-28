/**
 * @sunco/core - UI Module
 *
 * Re-exports all UI layers:
 * - Theme tokens (colors, symbols, spacing)
 * - Layer 1: Primitives (SunBox, SunText, Badge)
 * - Layer 2: Components (StatusSymbol, ErrorBox, RecommendationCard)
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
