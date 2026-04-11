/**
 * Unit tests for dashboard-tui formatters and TTY guard.
 *
 * These tests are PURE — no Ink mounting, no filesystem, no network.
 * Formatter helpers are deterministic; TTY guard is tested via process mocks.
 *
 * Test cases: 30-01-03 (10 cases per plan spec)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, formatDurationMs, renderDashboardTui } from '../dashboard-tui.js';

// ---------------------------------------------------------------------------
// formatRelativeTime tests (cases 1-5)
// ---------------------------------------------------------------------------

describe('formatRelativeTime', () => {
  it('returns "just now" for delta < 5 seconds', () => {
    const now = new Date('2026-04-10T12:00:04.000Z');
    const iso = '2026-04-10T12:00:00.000Z'; // 4 s ago
    expect(formatRelativeTime(iso, now)).toBe('just now');
  });

  it('returns "{N}s ago" for seconds (e.g. 42s ago)', () => {
    const now = new Date('2026-04-10T12:00:42.000Z');
    const iso = '2026-04-10T12:00:00.000Z'; // 42 s ago
    expect(formatRelativeTime(iso, now)).toBe('42s ago');
  });

  it('returns "{N}m ago" for minutes < 60', () => {
    const now = new Date('2026-04-10T12:15:00.000Z');
    const iso = '2026-04-10T12:00:00.000Z'; // 15 m ago
    expect(formatRelativeTime(iso, now)).toBe('15m ago');
  });

  it('returns "{N}h ago" for hours >= 60 min', () => {
    const now = new Date('2026-04-10T14:30:00.000Z');
    const iso = '2026-04-10T12:00:00.000Z'; // 2.5 h ago → 2h ago
    expect(formatRelativeTime(iso, now)).toBe('2h ago');
  });

  it('returns "(pending)" for epoch-0 / default timestamp', () => {
    expect(formatRelativeTime('1970-01-01T00:00:00.000Z')).toBe('(pending)');
  });
});

// ---------------------------------------------------------------------------
// formatDurationMs tests (cases 6-9)
// ---------------------------------------------------------------------------

describe('formatDurationMs', () => {
  it('formats 48_000 ms as "0:48"', () => {
    expect(formatDurationMs(48_000)).toBe('0:48');
  });

  it('formats 252_000 ms as "4:12"', () => {
    expect(formatDurationMs(252_000)).toBe('4:12');
  });

  it('formats 0 ms as "0:00"', () => {
    expect(formatDurationMs(0)).toBe('0:00');
  });

  it('formats 3_600_000 ms as "60:00" (minutes-only, no hours rollover)', () => {
    // Implementation renders as MM:SS — 3600s = 60m 0s
    expect(formatDurationMs(3_600_000)).toBe('60:00');
  });
});

// ---------------------------------------------------------------------------
// renderDashboardTui non-TTY refusal test (case 10)
// ---------------------------------------------------------------------------

describe('renderDashboardTui', () => {
  let originalIsTTY: boolean | undefined;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    // @ts-expect-error — override read-only in test
    process.stdout.isTTY = false;
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    // Reset exitCode
    process.exitCode = 0;
  });

  afterEach(() => {
    // Restore
    // @ts-expect-error — restore read-only
    process.stdout.isTTY = originalIsTTY;
    stderrSpy.mockRestore();
    process.exitCode = 0;
  });

  it('writes refusal message to stderr and sets exitCode=2 in non-TTY env', async () => {
    await renderDashboardTui('/tmp');

    // Should have written the refusal message
    expect(stderrSpy).toHaveBeenCalled();
    const calls = stderrSpy.mock.calls.map((c) => String(c[0]));
    const written = calls.join('');
    expect(written).toContain('requires a TTY');

    // exit code should be 2
    expect(process.exitCode).toBe(2);
  });
});
