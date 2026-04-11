/**
 * @sunco/skills-workflow - Dashboard TUI
 *
 * Read-only Ink dashboard for `.sun/active-work.json`.
 * Entry: `sunco status --live`
 *
 * Polls active-work at 1 Hz and renders a five-section live view.
 * No writes. No skill dispatch. No file watchers. No network.
 *
 * Requirements: DASH-01 through DASH-05
 * Decisions: D-01 (status --live entry), D-02 (1 Hz polling), D-04 (TTY guard),
 * D-05 (no OMO agent-zoo names), D-06 (one .tsx file, no new skill)
 *
 * TODO: inject real version from packages/cli/package.json instead of hardcoded const
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { readActiveWork } from '@sunco/core';
import type { ActiveWork } from '@sunco/core';
import { filterVisibleBackgroundWork } from './shared/active-work-display.js';

// ---------------------------------------------------------------------------
// Version (TODO: inject from packages/cli/package.json)
// ---------------------------------------------------------------------------

const DASHBOARD_VERSION = 'v1.3';

// ---------------------------------------------------------------------------
// Formatter helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Format an ISO timestamp as a human-readable relative time string.
 * Returns "just now" for < 5s, "{N}s ago" for seconds, "{N}m ago" for minutes < 60,
 * "{N}h ago" for hours >= 60 min, or "(pending)" for epoch-0 / default timestamp.
 */
export function formatRelativeTime(iso: string, now?: Date): string {
  const epoch0 = '1970-01-01T00:00:00.000Z';
  if (iso === epoch0 || iso === '1970-01-01T00:00:00Z') return '(pending)';

  const then = new Date(iso).getTime();
  if (isNaN(then)) return '(pending)';

  const ref = now ? now.getTime() : Date.now();
  const deltaMs = ref - then;
  const deltaSec = Math.floor(deltaMs / 1000);

  if (deltaSec < 5) return 'just now';
  if (deltaSec < 60) return `${deltaSec}s ago`;

  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;

  const deltaHr = Math.floor(deltaMin / 60);
  return `${deltaHr}h ago`;
}

/**
 * Format a duration in milliseconds as "M:SS".
 * For values >= 60 minutes, renders as "MM:SS" (e.g. "60:00" for exactly 1 hour).
 */
export function formatDurationMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const paddedSec = String(seconds).padStart(2, '0');
  return `${minutes}:${paddedSec}`;
}

// ---------------------------------------------------------------------------
// Dashboard React Component
// ---------------------------------------------------------------------------

interface DashboardProps {
  cwd: string;
  onExit: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ cwd, onExit }) => {
  const { exit } = useApp();
  const [work, setWork] = useState<ActiveWork | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [lastPollTime, setLastPollTime] = useState<Date>(new Date());

  const columns = process.stdout.columns ?? 80;
  const isCompact = columns < 80;

  // Initial load + polling
  useEffect(() => {
    let cancelled = false;

    const poll = async (): Promise<void> => {
      try {
        const next = await readActiveWork(cwd);
        if (!cancelled) {
          setWork((prev) => {
            if (prev === null || prev.updated_at !== next.updated_at) {
              return next;
            }
            return prev;
          });
          setReadError(null);
          setLastPollTime(new Date());
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setReadError(String(err));
        }
      }
    };

    void poll();
    const intervalId = setInterval(() => { void poll(); }, 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [cwd]);

  // Keyboard: q / Q / Escape → exit cleanly; Ctrl+C handled by Ink by default
  useInput((input, key) => {
    if (input === 'q' || input === 'Q' || key.escape) {
      onExit();
      exit();
    }
  });

  if (work === null) {
    return (
      <Box flexDirection="column">
        <Text color="#9CA3AF">Loading…</Text>
      </Box>
    );
  }

  if (isCompact) {
    return <CompactView work={work} />;
  }

  return <FullView work={work} readError={readError} lastPollTime={lastPollTime} />;
};

// ---------------------------------------------------------------------------
// Full layout (>= 80 cols)
// ---------------------------------------------------------------------------

interface FullViewProps {
  work: ActiveWork;
  readError: string | null;
  lastPollTime: Date;
}

const FullView: React.FC<FullViewProps> = ({ work, readError, lastPollTime }) => {
  const updatedRel = formatRelativeTime(work.updated_at, lastPollTime);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="#9CA3AF" paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold color="#5B8AF5">SUNCO Dashboard</Text>
        <Text color="#9CA3AF">{DASHBOARD_VERSION}</Text>
      </Box>

      <Text> </Text>

      {/* Active Phase */}
      {work.active_phase && (
        <Box flexDirection="column">
          <Text bold color="#E5E7EB">{'  \u25B6 Active Phase'}</Text>
          <Text color="#E5E7EB">
            {'    Phase '}{work.active_phase.id}{' ('}{work.active_phase.slug}{')'}{' \u00B7 '}{work.active_phase.state}{' \u00B7 ['}{work.active_phase.category}{']'}
          </Text>
          {work.active_phase.plan_id && (
            <Text color="#9CA3AF">
              {'    plan '}{work.active_phase.plan_id}{' \u00B7 step '}{work.active_phase.current_step}
            </Text>
          )}
          {!work.active_phase.plan_id && (
            <Text color="#9CA3AF">
              {'    step '}{work.active_phase.current_step}
            </Text>
          )}
          <Text> </Text>
        </Box>
      )}

      {/* Background Work */}
      <BackgroundSection work={work} />

      {/* Blocked */}
      <BlockedSection work={work} />

      {/* Next */}
      <NextSection work={work} />

      {/* Recent Skill Calls */}
      <RecentSection work={work} />

      {/* Footer */}
      <Box flexDirection="row">
        <Text color="#9CA3AF">
          {'  updated '}{updatedRel}{' \u00B7 polling 1s \u00B7 q to quit'}
          {readError ? ' \u00B7 \u26A0 read error' : ''}
        </Text>
      </Box>
    </Box>
  );
};

interface SectionProps {
  work: ActiveWork;
}

const BackgroundSection: React.FC<SectionProps> = ({ work }) => {
  const visible = filterVisibleBackgroundWork(work.background_work);
  if (visible.length === 0) return null;

  return (
    <Box flexDirection="column">
      <Text bold color="#E5E7EB">{'  \u2699 Background work ('}{visible.length}{')'}</Text>
      {visible.map((item) => {
        const shortId = item.agent_id.slice(0, 5);
        const timeRef = item.completed_at ?? item.started_at;
        const rel = formatRelativeTime(timeRef);
        return (
          <Text key={item.agent_id} color="#9CA3AF">
            {'    - '}{item.kind}{' ('}{shortId}{'\u2026) '}{item.description}{' \u00B7 '}{item.state}{' \u00B7 '}{rel}
          </Text>
        );
      })}
      <Text> </Text>
    </Box>
  );
};

const BlockedSection: React.FC<SectionProps> = ({ work }) => (
  <Box flexDirection="column">
    <Text bold color="#E5E7EB">{'  \u26A0 Blocked'}</Text>
    {work.blocked_on ? (
      <Text color="#FBBF24">
        {'    '}{work.blocked_on.reason}{' \u00B7 since '}{formatRelativeTime(work.blocked_on.since)}
      </Text>
    ) : (
      <Text color="#9CA3AF">{'    (none)'}</Text>
    )}
    <Text> </Text>
  </Box>
);

const NextSection: React.FC<SectionProps> = ({ work }) => (
  <Box flexDirection="column">
    <Text bold color="#E5E7EB">{'  \u2192 Next'}</Text>
    {work.next_recommended_action ? (
      <Text color="#4ADE80">
        {'    '}{work.next_recommended_action.command}{' \u00B7 '}{work.next_recommended_action.reason}
      </Text>
    ) : (
      <Text color="#9CA3AF">{'    (no recommendation)'}</Text>
    )}
    <Text> </Text>
  </Box>
);

const RecentSection: React.FC<SectionProps> = ({ work }) => {
  const recent = work.recent_skill_calls.slice(-3).reverse();
  if (recent.length === 0) return null;

  return (
    <Box flexDirection="column">
      <Text bold color="#E5E7EB">{'  \u23F1 Recent skill calls'}</Text>
      {recent.map((call, idx) => (
        <Text key={idx} color="#9CA3AF">
          {'    '}{call.skill}{' \u00B7 '}{formatDurationMs(call.duration_ms)}{' \u00B7 '}{formatRelativeTime(call.at)}
        </Text>
      ))}
      <Text> </Text>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Compact layout (< 80 cols)
// ---------------------------------------------------------------------------

interface CompactViewProps {
  work: ActiveWork;
}

const CompactView: React.FC<CompactViewProps> = ({ work }) => {
  const bgVisible = filterVisibleBackgroundWork(work.background_work);
  const running = bgVisible.filter((i) => i.state === 'running').length;

  return (
    <Box flexDirection="column">
      {work.active_phase ? (
        <Text color="#5B8AF5">
          {'SUNCO \u00B7 Phase '}{work.active_phase.id}{' \u00B7 '}{work.active_phase.category}{' \u00B7 '}{work.active_phase.state}
        </Text>
      ) : (
        <Text color="#5B8AF5">{'SUNCO \u00B7 no active phase'}</Text>
      )}
      <Text color="#9CA3AF">
        {'BG ('}{bgVisible.length}{')'}{' \u00B7 '}{running}{' running \u00B7 '}{work.blocked_on ? '1 blocked' : '0 blocked'}
      </Text>
      {work.next_recommended_action && (
        <Text color="#4ADE80">
          {'Next: '}{work.next_recommended_action.command}
        </Text>
      )}
      <Text color="#9CA3AF">{'[q to quit]'}</Text>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Mount the dashboard TUI and poll active-work until the user exits.
 * Validates TTY before mounting; writes to stderr and sets exitCode=2 if not a TTY.
 * The returned promise resolves when the user exits (q / Q / Esc / Ctrl+C).
 */
export async function renderDashboardTui(cwd: string): Promise<void> {
  if (!process.stdout.isTTY) {
    process.stderr.write(
      "sunco status --live requires a TTY. Use 'sunco status' for a one-shot snapshot.\n",
    );
    process.exitCode = 2;
    return;
  }

  const { render } = await import('ink');

  await new Promise<void>((resolve) => {
    const instance = render(
      React.createElement(Dashboard, {
        cwd,
        onExit: () => {
          resolve();
        },
      }),
    );

    // Handle Ctrl+C at the process level (Ink forwards SIGINT as Ctrl+C key input,
    // but also catches it internally — resolve the outer promise on unmount)
    const originalWaitUntilExit = instance.waitUntilExit;
    void originalWaitUntilExit().then(() => {
      resolve();
    });
  });
}
