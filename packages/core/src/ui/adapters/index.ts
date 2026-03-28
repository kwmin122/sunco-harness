/**
 * @sunco/core - UI Adapter Exports
 *
 * Factory functions for creating UI adapters and the SkillUi bridge.
 * - createUiAdapter(flags): selects SilentUiAdapter or InkUiAdapter
 * - createSkillUi(adapter): wraps a UiAdapter into the SkillUi interface
 *
 * Decisions: D-38 (two-layer), D-39 (adapter swappable)
 */

import type { UiAdapter, UiPattern, UiOutcome } from './UiAdapter.js';
import type {
  SkillUi,
  SkillEntryInput,
  AskInput,
  UiChoiceResult,
  AskTextInput,
  UiTextResult,
  ProgressInput,
  ProgressHandle,
  ResultInput,
} from './SkillUi.js';
import { SilentUiAdapter } from './SilentUiAdapter.js';
import { InkUiAdapter } from './InkUiAdapter.js';

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { SilentUiAdapter } from './SilentUiAdapter.js';
export { InkUiAdapter } from './InkUiAdapter.js';
export type { UiAdapter, UiPattern, UiOutcome, UiPatch } from './UiAdapter.js';
export type {
  SkillUi,
  SkillEntryInput,
  AskInput,
  AskOption,
  UiChoiceResult,
  AskTextInput,
  UiTextResult,
  ProgressInput,
  ProgressHandle,
  ResultInput,
} from './SkillUi.js';

// ---------------------------------------------------------------------------
// Handle ID Generator
// ---------------------------------------------------------------------------

let handleCounter = 0;

function nextHandleId(): string {
  handleCounter += 1;
  return `ui-${handleCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// createSkillUi: Bridge UiAdapter -> SkillUi
// ---------------------------------------------------------------------------

/**
 * Create a SkillUi implementation that delegates to a UiAdapter.
 * This is the bridge between the skill-facing intent API and the renderer.
 */
export function createSkillUi(adapter: UiAdapter): SkillUi {
  return {
    async entry(input: SkillEntryInput): Promise<void> {
      const pattern: UiPattern = {
        handleId: nextHandleId(),
        kind: 'entry',
        data: input as unknown as Record<string, unknown>,
      };
      await adapter.mountPattern(pattern);
    },

    async ask(input: AskInput): Promise<UiChoiceResult> {
      const pattern: UiPattern = {
        handleId: nextHandleId(),
        kind: 'ask',
        data: input as unknown as Record<string, unknown>,
      };
      const outcome: UiOutcome = await adapter.mountPattern(pattern);
      // Extract UiChoiceResult from the outcome data
      const data = outcome.data as unknown as UiChoiceResult;
      return {
        selectedId: data.selectedId,
        selectedLabel: data.selectedLabel,
        source: data.source,
      };
    },

    async askText(input: AskTextInput): Promise<UiTextResult> {
      const pattern: UiPattern = {
        handleId: nextHandleId(),
        kind: 'askText',
        data: input as unknown as Record<string, unknown>,
      };
      const outcome = await adapter.mountPattern(pattern);
      const data = outcome.data as unknown as UiTextResult;
      return { text: data.text, source: data.source };
    },

    progress(input: ProgressInput): ProgressHandle {
      const handleId = nextHandleId();
      const pattern: UiPattern = {
        handleId,
        kind: 'progress',
        data: input as unknown as Record<string, unknown>,
      };

      // Fire-and-forget: mount the progress pattern
      void adapter.mountPattern(pattern);

      return {
        update(patch: { completed?: number; message?: string }): void {
          adapter.update(handleId, { data: patch as unknown as Record<string, unknown> });
        },
        done(result: { summary: string }): void {
          adapter.dispose(handleId);
          // Optionally could log result.summary but handled by adapter
          void result;
        },
      };
    },

    async result(input: ResultInput): Promise<void> {
      const pattern: UiPattern = {
        handleId: nextHandleId(),
        kind: 'result',
        data: input as unknown as Record<string, unknown>,
      };
      await adapter.mountPattern(pattern);
    },
  };
}

// ---------------------------------------------------------------------------
// createUiAdapter: Factory
// ---------------------------------------------------------------------------

export interface CreateUiAdapterFlags {
  /** Use SilentUiAdapter (CI/batch mode) */
  silent?: boolean;
  /** Use SilentUiAdapter (JSON output mode) */
  json?: boolean;
}

/**
 * Factory: select the appropriate UI adapter based on flags.
 * - json=true or silent=true -> SilentUiAdapter
 * - Otherwise -> InkUiAdapter (interactive terminal)
 */
export function createUiAdapter(flags: CreateUiAdapterFlags = {}): UiAdapter {
  if (flags.json || flags.silent) {
    return new SilentUiAdapter();
  }
  return new InkUiAdapter();
}
