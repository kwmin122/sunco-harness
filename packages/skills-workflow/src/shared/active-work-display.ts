/**
 * Shared helpers for rendering active-work dashboard sections (D-14 visibility rules).
 * Used by status.skill.ts and next.skill.ts.
 */

import type { BackgroundWorkItem } from '@sunco/core';

const THIRTY_MINUTES_MS = 30 * 60_000;
const MAX_VISIBLE = 3;

export function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function filterVisibleBackgroundWork(items: BackgroundWorkItem[]): BackgroundWorkItem[] {
  const thirtyMinsAgo = Date.now() - THIRTY_MINUTES_MS;
  return items
    .filter(item =>
      item.state === 'running' ||
      (item.state === 'completed' && item.completed_at && new Date(item.completed_at).getTime() > thirtyMinsAgo),
    )
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, MAX_VISIBLE);
}
