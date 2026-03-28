/**
 * @sunco/skills-harness - Guard Subsystem Types
 *
 * Types for the guard engine: anti-pattern detection, lint rule promotion,
 * tribal knowledge warnings, file watching, and configuration.
 *
 * Decisions: D-20 (chokidar watch), D-21 (promotion suggest-only),
 * D-22 (incremental linting), D-23 (two modes), D-24 (tribal knowledge)
 */

import type { SunLintViolation, SunLintRule } from '../lint/types.js';

// ---------------------------------------------------------------------------
// Guard Result
// ---------------------------------------------------------------------------

/** Aggregated result from a guard scan (single-run or per-file) */
export interface GuardResult {
  /** Number of files analyzed */
  readonly filesAnalyzed: number;
  /** ESLint lint violations found */
  readonly lintViolations: SunLintViolation[];
  /** Anti-pattern matches detected by regex scanning */
  readonly antiPatterns: AntiPatternMatch[];
  /** Suggested lint rule promotions */
  readonly promotionSuggestions: PromotionSuggestion[];
  /** Warnings from tribal knowledge patterns */
  readonly tribalWarnings: TribalWarning[];
}

// ---------------------------------------------------------------------------
// Anti-pattern Detection
// ---------------------------------------------------------------------------

/** A single anti-pattern match found in source code */
export interface AntiPatternMatch {
  /** Pattern identifier (e.g., 'any-type', 'console-log') */
  readonly pattern: string;
  /** File path where the pattern was found */
  readonly file: string;
  /** Line number (1-based) */
  readonly line: number;
  /** The matching text */
  readonly match: string;
}

// ---------------------------------------------------------------------------
// Promotion Suggestions (D-21: suggest-only)
// ---------------------------------------------------------------------------

/**
 * A suggestion to promote a recurring anti-pattern to a permanent lint rule.
 * Guard suggests but does NOT auto-add rules to .sun/rules/ (D-21).
 */
export interface PromotionSuggestion {
  /** Pattern identifier */
  readonly pattern: string;
  /** Total occurrences across all files */
  readonly occurrences: number;
  /** Files where the pattern was found */
  readonly files: string[];
  /** Pre-built SunLintRule JSON the user can confirm */
  readonly suggestedRule: SunLintRule;
  /** Human-readable promotion message */
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Tribal Knowledge (D-24: soft warnings)
// ---------------------------------------------------------------------------

/** A warning from a tribal knowledge pattern match */
export interface TribalWarning {
  /** Source filename in .sun/tribal/ */
  readonly source: string;
  /** Pattern identifier */
  readonly pattern: string;
  /** File path where the pattern matched */
  readonly file: string;
  /** Line number (1-based) */
  readonly line: number;
  /** Human-readable warning message */
  readonly message: string;
}

/** A tribal knowledge pattern loaded from .sun/tribal/ */
export interface TribalPattern {
  /** Pattern identifier */
  readonly id: string;
  /** Compiled regex for matching */
  readonly pattern: RegExp;
  /** Warning message to display on match */
  readonly message: string;
  /** Source filename in .sun/tribal/ */
  readonly source: string;
}

// ---------------------------------------------------------------------------
// Watch Events (D-20: chokidar)
// ---------------------------------------------------------------------------

/** File system event from chokidar watcher */
export interface WatchEvent {
  /** Event type */
  readonly type: 'change' | 'add' | 'unlink';
  /** Relative file path */
  readonly path: string;
  /** ISO 8601 timestamp of the event */
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// Guard Configuration
// ---------------------------------------------------------------------------

/** Configuration for the guard skill */
export interface GuardConfig {
  /** Glob patterns for files to watch (default: TS/JS files) */
  readonly watchPatterns: string[];
  /** Directories to ignore */
  readonly ignored: string[];
  /** Occurrences threshold before suggesting promotion (default: 3) */
  readonly promotionThreshold: number;
}

/** Default guard configuration */
export const DEFAULT_GUARD_CONFIG: GuardConfig = {
  watchPatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  ignored: ['node_modules', 'dist', '.sun', '.git'],
  promotionThreshold: 3,
};
