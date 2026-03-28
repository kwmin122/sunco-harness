/**
 * Tests for guard file watcher.
 * Uses vi.mock('chokidar') to avoid real filesystem watching.
 *
 * Decision: D-20 (chokidar 5.0.0 with awaitWriteFinish and ignoreInitial)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WatchEvent } from '../types.js';

// Mock chokidar before importing watcher
const mockOn = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockWatchInstance = {
  on: mockOn,
  close: mockClose,
};

vi.mock('chokidar', () => ({
  watch: vi.fn(() => mockWatchInstance),
}));

// Import after mock setup
const { createWatcher, stopWatcher } = await import('../watcher.js');
const chokidarModule = await import('chokidar');

describe('createWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mockOn to record calls properly
    mockOn.mockReturnValue(mockWatchInstance);
  });

  it('calls chokidar.watch with correct patterns and awaitWriteFinish options', () => {
    const onFileChange = vi.fn<(event: WatchEvent) => Promise<void>>().mockResolvedValue(undefined);

    createWatcher({
      cwd: '/test/project',
      patterns: ['**/*.ts', '**/*.tsx'],
      ignored: ['dist'],
      onFileChange,
    });

    expect(chokidarModule.watch).toHaveBeenCalledWith(
      ['**/*.ts', '**/*.tsx'],
      expect.objectContaining({
        cwd: '/test/project',
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: expect.objectContaining({
          stabilityThreshold: 300,
          pollInterval: 100,
        }),
      }),
    );
  });

  it('onFileChange callback is invoked when a file change event fires', async () => {
    const onFileChange = vi.fn<(event: WatchEvent) => Promise<void>>().mockResolvedValue(undefined);

    createWatcher({
      cwd: '/test/project',
      patterns: ['**/*.ts'],
      ignored: [],
      onFileChange,
    });

    // Find the 'change' handler registered via .on()
    const changeCall = mockOn.mock.calls.find((call) => call[0] === 'change');
    expect(changeCall).toBeDefined();

    // Invoke the handler
    const handler = changeCall![1] as (path: string) => void;
    handler('src/index.ts');

    // Wait for async callback
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onFileChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'change',
        path: 'src/index.ts',
      }),
    );
  });

  it('registers handlers for change, add, and unlink events', () => {
    const onFileChange = vi.fn<(event: WatchEvent) => Promise<void>>().mockResolvedValue(undefined);

    createWatcher({
      cwd: '/test/project',
      patterns: ['**/*.ts'],
      ignored: [],
      onFileChange,
    });

    const eventTypes = mockOn.mock.calls.map((call) => call[0]);
    expect(eventTypes).toContain('change');
    expect(eventTypes).toContain('add');
    expect(eventTypes).toContain('unlink');
  });
});

describe('stopWatcher', () => {
  it('calls watcher.close() and resolves', async () => {
    const mockWatcher = {
      close: vi.fn().mockResolvedValue(undefined),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await stopWatcher(mockWatcher as any);

    expect(mockWatcher.close).toHaveBeenCalledOnce();
  });
});
