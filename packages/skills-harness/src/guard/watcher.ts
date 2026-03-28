/**
 * @sunco/skills-harness - Guard File Watcher
 *
 * Creates a chokidar file watcher for real-time file change detection.
 * Used by `sunco guard --watch` for continuous mode.
 *
 * Configuration per research Pattern 4:
 * - ignoreInitial: true (no initial scan flood)
 * - awaitWriteFinish: 300ms stabilityThreshold (debounce rapid saves)
 * - persistent: true (keep process alive)
 *
 * Decisions: D-20 (chokidar 5.0.0), D-23 (watch mode)
 */

import { watch, type FSWatcher } from 'chokidar';
import type { WatchEvent } from './types.js';

export type { FSWatcher };

/**
 * Create a chokidar file watcher for the guard skill.
 *
 * Watches specified file patterns for changes and invokes the callback
 * on each file event. The watcher instance is returned for lifecycle
 * management (stopWatcher).
 *
 * @param opts - Watch configuration: cwd, patterns, ignored dirs, and callback
 * @returns chokidar FSWatcher instance
 */
export function createWatcher(opts: {
  cwd: string;
  patterns: string[];
  ignored: string[];
  onFileChange: (event: WatchEvent) => Promise<void>;
}): FSWatcher {
  const { cwd, patterns, ignored, onFileChange } = opts;

  const watcher = watch(patterns, {
    cwd,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
    ignored: [
      '**/node_modules/**',
      '**/.sun/**',
      '**/.git/**',
      ...ignored.map((dir) => `**/${dir}/**`),
    ],
  });

  // Register event handlers for file changes
  const handleEvent = (type: WatchEvent['type']) => (path: string) => {
    const event: WatchEvent = {
      type,
      path,
      timestamp: new Date().toISOString(),
    };
    // Fire and forget -- errors are handled within the callback
    void onFileChange(event).catch(() => {
      // Swallow errors in the callback to prevent watcher crash
    });
  };

  watcher.on('change', handleEvent('change'));
  watcher.on('add', handleEvent('add'));
  watcher.on('unlink', handleEvent('unlink'));

  return watcher;
}

/**
 * Stop the file watcher and release all resources.
 *
 * @param watcher - chokidar FSWatcher instance to stop
 */
export async function stopWatcher(watcher: FSWatcher): Promise<void> {
  await watcher.close();
}
