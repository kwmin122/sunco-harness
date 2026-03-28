/**
 * @sunco/core - InkUiAdapter
 *
 * Ink-based interactive UI adapter for terminal rendering.
 * Scaffold implementation: renders basic text output for each pattern kind.
 * Full Ink component rendering connected in Plan 07 (Layer 3 patterns).
 *
 * Decisions: D-38 (two-layer separation), D-39 (adapter swappable)
 */

import type { UiAdapter, UiPattern, UiOutcome, UiPatch } from './UiAdapter.js';

interface AskPatternData {
  message: string;
  options: Array<{ id: string; label: string; isRecommended?: boolean }>;
  defaultId?: string;
}

/**
 * InkUiAdapter: Interactive terminal UI via Ink (React).
 *
 * NOTE: This is the scaffold. Full Ink rendering (Layer 3 patterns)
 * is connected in Plan 07. Currently uses console.log fallbacks.
 */
export class InkUiAdapter implements UiAdapter {
  async mountPattern(pattern: UiPattern): Promise<UiOutcome> {
    switch (pattern.kind) {
      case 'entry': {
        const data = pattern.data as { title: string; description?: string };
        // Scaffold: basic console output until Ink components connected
        console.log(`\n${data.title}${data.description ? ` - ${data.description}` : ''}`);
        return { kind: 'entry' };
      }

      case 'ask': {
        const data = pattern.data as unknown as AskPatternData;
        // Scaffold: auto-select default/first until interactive Ink choice connected
        const selected = data.defaultId
          ? data.options.find((o) => o.id === data.defaultId) ?? data.options[0]!
          : data.options[0]!;

        console.log(`\n${data.message}`);
        for (const opt of data.options) {
          const marker = opt.id === selected.id ? '>' : ' ';
          const badge = opt.isRecommended ? ' (Recommended)' : '';
          console.log(`  ${marker} ${opt.label}${badge}`);
        }

        return {
          kind: 'ask',
          data: {
            selectedId: selected.id,
            selectedLabel: selected.label,
            source: 'default' as const,
          },
        };
      }

      case 'progress': {
        const data = pattern.data as { title: string };
        console.log(`\n${data.title}`);
        return { kind: 'progress' };
      }

      case 'result': {
        const data = pattern.data as { success: boolean; title: string; summary?: string };
        const icon = data.success ? '\u2714' : '\u2718';
        console.log(`\n${icon} ${data.title}${data.summary ? `\n  ${data.summary}` : ''}`);
        return { kind: 'result' };
      }

      default:
        return { kind: pattern.kind };
    }
  }

  update(_handleId: string, _patch: UiPatch): void {
    // Scaffold: no-op until Ink progress components connected in Plan 07
  }

  dispose(_handleId: string): void {
    // Scaffold: no-op until Ink cleanup logic connected in Plan 07
  }
}
