/**
 * @sunco/core - InkUiAdapter
 *
 * Ink-based interactive UI adapter for terminal rendering.
 * Renders Layer 3 pattern components (SkillEntry, InteractiveChoice,
 * SkillProgress, SkillResult) via Ink's render() API.
 *
 * For non-TTY environments or when Ink is unavailable, falls back to
 * console.log output that mimics pattern behavior.
 *
 * Decisions: D-38 (two-layer separation), D-39 (adapter swappable)
 */

import React from 'react';
import type { UiAdapter, UiPattern, UiOutcome, UiPatch } from './UiAdapter.js';

interface AskPatternData {
  message: string;
  options: Array<{ id: string; label: string; isRecommended?: boolean }>;
  defaultId?: string;
}

interface ProgressState {
  completed?: number;
  message?: string;
}

/**
 * Active Ink render instance for progress patterns that need updating.
 */
interface ActiveProgress {
  /** Ink instance for re-rendering */
  rerender: (element: React.ReactElement) => void;
  /** Unmount function */
  unmount: () => void;
  /** Current progress data */
  data: { title: string; total?: number };
  /** Current state */
  state: ProgressState;
}

/**
 * InkUiAdapter: Interactive terminal UI via Ink (React).
 *
 * Renders pattern components via Ink's render() API:
 * - entry: renders SkillEntry, auto-completes
 * - ask: renders InteractiveChoice, waits for selection (non-TTY: auto-select)
 * - progress: renders SkillProgress, supports update/dispose
 * - result: renders SkillResult, auto-completes
 *
 * In non-TTY contexts (CI, tests), falls back to non-interactive behavior.
 */
export class InkUiAdapter implements UiAdapter {
  private activeProgress = new Map<string, ActiveProgress>();
  private isTTY = Boolean(process.stdout.isTTY);

  async mountPattern(pattern: UiPattern): Promise<UiOutcome> {
    switch (pattern.kind) {
      case 'entry':
        return this.renderEntry(pattern);

      case 'ask':
        return this.renderAsk(pattern);

      case 'progress':
        return this.renderProgress(pattern);

      case 'result':
        return this.renderResult(pattern);

      default:
        return { kind: pattern.kind };
    }
  }

  update(handleId: string, patch: UiPatch): void {
    const active = this.activeProgress.get(handleId);
    if (!active) return;

    // Merge patch into state
    const patchData = patch.data as ProgressState;
    if (patchData.completed !== undefined) {
      active.state.completed = patchData.completed;
    }
    if (patchData.message !== undefined) {
      active.state.message = patchData.message;
    }

    // Re-render with updated state
    if (this.isTTY) {
      this.rerenderProgress(active);
    }
  }

  dispose(handleId: string): void {
    const active = this.activeProgress.get(handleId);
    if (active) {
      try {
        active.unmount();
      } catch {
        // Ignore unmount errors in non-TTY
      }
      this.activeProgress.delete(handleId);
    }
  }

  // -------------------------------------------------------------------------
  // Pattern Renderers
  // -------------------------------------------------------------------------

  private async renderEntry(pattern: UiPattern): Promise<UiOutcome> {
    const data = pattern.data as { title: string; description?: string; subtitle?: string };

    if (this.isTTY) {
      try {
        const { render } = await import('ink');
        const { SkillEntry } = await import('../patterns/SkillEntry.js');

        await new Promise<void>((resolve) => {
          const instance = render(
            React.createElement(SkillEntry, {
              title: data.title,
              description: data.description,
              subtitle: data.subtitle,
              onComplete: () => {
                instance.unmount();
                resolve();
              },
            }),
          );
        });
      } catch {
        // Fallback to console output
        this.consoleEntry(data);
      }
    } else {
      this.consoleEntry(data);
    }

    return { kind: 'entry' };
  }

  private async renderAsk(pattern: UiPattern): Promise<UiOutcome> {
    const data = pattern.data as unknown as AskPatternData;

    // In non-TTY or non-interactive environments, auto-select
    if (!this.isTTY) {
      return this.autoSelectAsk(data);
    }

    try {
      const { render } = await import('ink');
      const { InteractiveChoice } = await import('../patterns/InteractiveChoice.js');

      const result = await new Promise<UiOutcome>((resolve) => {
        const instance = render(
          React.createElement(InteractiveChoice, {
            message: data.message,
            options: data.options,
            defaultId: data.defaultId,
            onSelect: (choiceResult) => {
              instance.unmount();
              resolve({
                kind: 'ask',
                data: choiceResult as unknown as Record<string, unknown>,
              });
            },
          }),
        );
      });

      return result;
    } catch {
      // Fallback to auto-select
      return this.autoSelectAsk(data);
    }
  }

  private async renderProgress(pattern: UiPattern): Promise<UiOutcome> {
    const data = pattern.data as { title: string; total?: number; message?: string };
    const state: ProgressState = { completed: 0, message: data.message };

    if (this.isTTY) {
      try {
        const { render } = await import('ink');
        const { SkillProgress } = await import('../patterns/SkillProgress.js');

        const instance = render(
          React.createElement(SkillProgress, {
            title: data.title,
            total: data.total,
            completed: state.completed,
            message: state.message,
          }),
        );

        this.activeProgress.set(pattern.handleId, {
          rerender: instance.rerender,
          unmount: instance.unmount,
          data: { title: data.title, total: data.total },
          state,
        });
      } catch {
        // Fallback: just log
        console.log(`\n${data.title}`);
      }
    } else {
      console.log(`\n${data.title}`);
    }

    return { kind: 'progress' };
  }

  private async renderResult(pattern: UiPattern): Promise<UiOutcome> {
    const data = pattern.data as {
      success: boolean;
      title: string;
      summary?: string;
      details?: string[];
      warnings?: string[];
      recommendations?: unknown[];
    };

    if (this.isTTY) {
      try {
        const { render } = await import('ink');
        const { SkillResult } = await import('../patterns/SkillResult.js');

        const instance = render(
          React.createElement(SkillResult, {
            success: data.success,
            title: data.title,
            summary: data.summary,
            details: data.details,
            warnings: data.warnings,
            recommendations: data.recommendations as any,
          }),
        );

        // Brief display then unmount
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            instance.unmount();
            resolve();
          }, 100);
        });
      } catch {
        // Fallback to console output
        this.consoleResult(data);
      }
    } else {
      this.consoleResult(data);
    }

    return { kind: 'result' };
  }

  // -------------------------------------------------------------------------
  // Re-render helpers
  // -------------------------------------------------------------------------

  private rerenderProgress(active: ActiveProgress): void {
    void import('../patterns/SkillProgress.js').then(({ SkillProgress }) => {
      active.rerender(
        React.createElement(SkillProgress, {
          title: active.data.title,
          total: active.data.total,
          completed: active.state.completed,
          message: active.state.message,
        }),
      );
    });
  }

  // -------------------------------------------------------------------------
  // Console Fallbacks (non-TTY)
  // -------------------------------------------------------------------------

  private consoleEntry(data: { title: string; description?: string }): void {
    console.log(`\n${data.title}${data.description ? ` - ${data.description}` : ''}`);
  }

  private autoSelectAsk(data: AskPatternData): UiOutcome {
    const selected = data.defaultId
      ? data.options.find((o) => o.id === data.defaultId) ?? data.options[0]!
      : data.options[0]!;

    return {
      kind: 'ask',
      data: {
        selectedId: selected.id,
        selectedLabel: selected.label,
        source: 'default' as const,
      },
    };
  }

  private consoleResult(data: {
    success: boolean;
    title: string;
    summary?: string;
  }): void {
    const icon = data.success ? '\u2714' : '\u2718';
    console.log(`\n${icon} ${data.title}${data.summary ? `\n  ${data.summary}` : ''}`);
  }
}
