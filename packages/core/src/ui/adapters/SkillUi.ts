/**
 * @sunco/core - Skill-facing UI Contract
 *
 * The SkillUi interface is what skills see via ctx.ui.
 * Intent-based pattern API: entry(), ask(), progress(), result().
 * Skills never import Ink directly (D-33).
 *
 * Decisions: D-33 (ctx.ui only), D-34 (intent-based API),
 * D-35 (ProgressHandle), D-36 (UiChoiceResult), D-38 (two-layer separation)
 */

import type { Recommendation } from '../../recommend/types.js';

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

/** Input for ctx.ui.entry() -- skill startup display */
export interface SkillEntryInput {
  /** Skill title (e.g., 'Settings', 'Health Check') */
  title: string;

  /** Brief description of what this skill does */
  description?: string;

  /** Optional subtitle (e.g., version, target info) */
  subtitle?: string;
}

/** A single option in an interactive choice */
export interface AskOption {
  /** Unique option ID */
  id: string;

  /** Display label */
  label: string;

  /** Optional description shown below the label */
  description?: string;

  /** Whether this option has the "Recommended" badge (UX-01) */
  isRecommended?: boolean;
}

/** Input for ctx.ui.ask() -- interactive choice prompt (D-34, D-36) */
export interface AskInput {
  /** Question/prompt message */
  message: string;

  /** Available choices (2-4 options + Recommended tag per UX-01) */
  options: AskOption[];

  /** Default option ID (used in non-interactive mode) */
  defaultId?: string;
}

/** Result from ctx.ui.ask() (D-36) */
export interface UiChoiceResult {
  /** ID of the selected option */
  selectedId: string;

  /** Display label of the selected option */
  selectedLabel: string;

  /** How the selection was made */
  source: 'keyboard' | 'default' | 'noninteractive';
}

/** Input for ctx.ui.askText() -- freeform text prompt */
export interface AskTextInput {
  /** Question/prompt message */
  message: string;

  /** Placeholder text shown in input field */
  placeholder?: string;

  /** Default value (used in non-interactive mode) */
  defaultValue?: string;
}

/** Result from ctx.ui.askText() */
export interface UiTextResult {
  /** User-entered text */
  text: string;

  /** How the text was obtained */
  source: 'keyboard' | 'default' | 'noninteractive' | 'cli-arg';
}

/** Input for ctx.ui.progress() -- long-running operation display (D-35) */
export interface ProgressInput {
  /** Progress title (e.g., 'Scanning...') */
  title: string;

  /** Total number of items (undefined for indeterminate) */
  total?: number;

  /** Initial message */
  message?: string;
}

/**
 * Handle returned by ctx.ui.progress() for updating progress (D-35).
 * Must call done() when the operation completes.
 */
export interface ProgressHandle {
  /** Update progress state */
  update(patch: { completed?: number; message?: string }): void;

  /** Mark progress as complete */
  done(result: { summary: string }): void;
}

/** Input for ctx.ui.result() -- skill completion display */
export interface ResultInput {
  /** Whether the skill succeeded */
  success: boolean;

  /** Result title */
  title: string;

  /** Summary message */
  summary?: string;

  /** Detailed output lines */
  details?: string[];

  /** Warnings to display */
  warnings?: string[];

  /** Recommendations for next actions (from recommender) */
  recommendations?: Recommendation[];
}

// ---------------------------------------------------------------------------
// SkillUi Interface (D-33, D-34, D-38: skill-facing contract)
// ---------------------------------------------------------------------------

/**
 * Skill-facing UI interface.
 * Maps to the skill state machine: idle -> entry -> choice? -> running -> result (D-32).
 *
 * Skills access this via ctx.ui. The implementation is provided by a UiAdapter
 * (InkUiAdapter for interactive, SilentUiAdapter for CI/test/JSON mode).
 */
export interface SkillUi {
  /** Display skill entry (title, description). Called at skill start. */
  entry(input: SkillEntryInput): Promise<void>;

  /** Present an interactive choice to the user. Returns the selection. */
  ask(input: AskInput): Promise<UiChoiceResult>;

  /** Present a freeform text input prompt to the user. Returns the entered text. */
  askText(input: AskTextInput): Promise<UiTextResult>;

  /** Start a progress display. Returns a handle for updates. */
  progress(input: ProgressInput): ProgressHandle;

  /** Display skill result. Called at skill completion. */
  result(input: ResultInput): Promise<void>;
}
