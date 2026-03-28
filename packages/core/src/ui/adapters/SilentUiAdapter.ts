/**
 * @sunco/core - SilentUiAdapter
 *
 * No-op UI adapter for CI, testing, --json mode, and batch/non-interactive execution.
 * All patterns resolve immediately without rendering anything.
 * For 'ask' patterns, auto-selects defaultId or first option.
 *
 * Decisions: D-39 (adapter swappable), D-38 (two-layer separation)
 */

import type { UiAdapter, UiPattern, UiOutcome, UiPatch } from './UiAdapter.js';

interface AskPatternData {
  options: Array<{ id: string; label: string }>;
  defaultId?: string;
}

/**
 * SilentUiAdapter: renders nothing, resolves immediately.
 * Used in CI, tests, --json mode, and non-interactive contexts.
 */
export class SilentUiAdapter implements UiAdapter {
  async mountPattern(pattern: UiPattern): Promise<UiOutcome> {
    if (pattern.kind === 'ask') {
      const data = pattern.data as unknown as AskPatternData;
      const selected = data.defaultId
        ? data.options.find((o) => o.id === data.defaultId) ?? data.options[0]!
        : data.options[0]!;

      return {
        kind: 'ask',
        data: {
          selectedId: selected.id,
          selectedLabel: selected.label,
          source: 'noninteractive' as const,
        },
      };
    }

    // entry, progress, result: resolve with no output data
    return { kind: pattern.kind };
  }

  update(_handleId: string, _patch: UiPatch): void {
    // no-op: silent adapter does not render
  }

  dispose(_handleId: string): void {
    // no-op: nothing to clean up
  }
}
