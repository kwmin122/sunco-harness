/**
 * @sunco/core - active-work.json read/write API tests (Phase 27 Plan A, task 27-01-03).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  readActiveWork,
  writeActiveWork,
  appendBackgroundWork,
  appendRoutingMiss,
  DEFAULT_ACTIVE_WORK,
  ACTIVE_WORK_PATH,
} from '../active-work.js';

import type { ActiveWork, BackgroundWorkItem, RoutingMiss } from '../active-work.types.js';

function makeBackgroundItem(i: number, overrides?: Partial<BackgroundWorkItem>): BackgroundWorkItem {
  return {
    kind: `agent_${i}`,
    agent_id: `id_${i}`,
    started_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    description: `desc_${i}`,
    state: 'running',
    ...overrides,
  };
}

function makeRoutingMiss(i: number): RoutingMiss {
  return {
    at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    input: `input_${i}`,
    classified_as: null,
    fallback_reason: 'no_match',
    user_correction: null,
  };
}

describe('active-work API', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-aw-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ── 1 ────────────────────────────────────────────────────────────────
  it('readActiveWork returns DEFAULT_ACTIVE_WORK on missing file', async () => {
    const result = await readActiveWork(tempDir);
    expect(result).toEqual(DEFAULT_ACTIVE_WORK);
  });

  // ── 2 ────────────────────────────────────────────────────────────────
  it('writeActiveWork creates the file atomically and sets updated_at', async () => {
    const before = Date.now();
    await writeActiveWork(tempDir, { blocked_on: { reason: 'test', since: '2026-01-01T00:00:00.000Z' } });
    const after = Date.now();

    const raw = await readFile(join(tempDir, ACTIVE_WORK_PATH), 'utf-8');
    const doc = JSON.parse(raw) as ActiveWork;

    expect(doc.blocked_on?.reason).toBe('test');
    const ts = new Date(doc.updated_at).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  // ── 3 ────────────────────────────────────────────────────────────────
  it('writeActiveWork merges patch preserving unrelated fields', async () => {
    await writeActiveWork(tempDir, {
      blocked_on: { reason: 'first', since: '2026-01-01T00:00:00.000Z' },
      active_phase: {
        id: '27', slug: 'test', state: 'in_progress',
        current_step: 'execute', category: 'deep',
      },
    });
    await writeActiveWork(tempDir, {
      blocked_on: { reason: 'second', since: '2026-01-02T00:00:00.000Z' },
    });

    const result = await readActiveWork(tempDir);
    expect(result.blocked_on?.reason).toBe('second');
    expect(result.active_phase?.id).toBe('27');
  });

  // ── 4 ────────────────────────────────────────────────────────────────
  it('writeActiveWork truncates background_work to 100 (oldest trimmed)', async () => {
    const items = Array.from({ length: 105 }, (_, i) => makeBackgroundItem(i));
    await writeActiveWork(tempDir, { background_work: items });

    const result = await readActiveWork(tempDir);
    expect(result.background_work).toHaveLength(100);
    expect(result.background_work[0].kind).toBe('agent_5');
  });

  // ── 5 ────────────────────────────────────────────────────────────────
  it('writeActiveWork truncates recent_skill_calls to 50', async () => {
    const calls = Array.from({ length: 55 }, (_, i) => ({
      skill: `s_${i}`,
      at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      duration_ms: 100,
    }));
    await writeActiveWork(tempDir, { recent_skill_calls: calls });

    const result = await readActiveWork(tempDir);
    expect(result.recent_skill_calls).toHaveLength(50);
    expect(result.recent_skill_calls[0].skill).toBe('s_5');
  });

  // ── 6 ────────────────────────────────────────────────────────────────
  it('writeActiveWork truncates routing_misses to 100', async () => {
    const misses = Array.from({ length: 105 }, (_, i) => makeRoutingMiss(i));
    await writeActiveWork(tempDir, { routing_misses: misses });

    const result = await readActiveWork(tempDir);
    expect(result.routing_misses).toHaveLength(100);
    expect(result.routing_misses[0].input).toBe('input_5');
  });

  // ── 7 ────────────────────────────────────────────────────────────────
  it('appendBackgroundWork pushes a single item and keeps others', async () => {
    const first = makeBackgroundItem(1);
    await writeActiveWork(tempDir, { background_work: [first] });

    const second = makeBackgroundItem(2);
    await appendBackgroundWork(tempDir, second);

    const result = await readActiveWork(tempDir);
    expect(result.background_work).toHaveLength(2);
    expect(result.background_work[0].kind).toBe('agent_1');
    expect(result.background_work[1].kind).toBe('agent_2');
  });

  // ── 8 ────────────────────────────────────────────────────────────────
  it('appendRoutingMiss pushes a single miss and keeps others', async () => {
    const first = makeRoutingMiss(1);
    await writeActiveWork(tempDir, { routing_misses: [first] });

    const second = makeRoutingMiss(2);
    await appendRoutingMiss(tempDir, second);

    const result = await readActiveWork(tempDir);
    expect(result.routing_misses).toHaveLength(2);
    expect(result.routing_misses[0].input).toBe('input_1');
    expect(result.routing_misses[1].input).toBe('input_2');
  });

  // ── 9 ────────────────────────────────────────────────────────────────
  it('readActiveWork returns DEFAULT and logs to stderr on corrupt JSON', async () => {
    const filePath = join(tempDir, ACTIVE_WORK_PATH);
    await mkdir(join(tempDir, '.sun'), { recursive: true });
    await writeFile(filePath, '{ not valid json!!!', 'utf-8');

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const result = await readActiveWork(tempDir);

    expect(result).toEqual(DEFAULT_ACTIVE_WORK);
    expect(stderrSpy).toHaveBeenCalled();
    const written = stderrSpy.mock.calls.map(c => String(c[0])).join('');
    expect(written).toContain('[sunco:active-work]');

    stderrSpy.mockRestore();
  });

  // ── 10 ───────────────────────────────────────────────────────────────
  it('writeActiveWork rejects an invalid category value (Zod throws)', async () => {
    await expect(
      writeActiveWork(tempDir, {
        active_phase: {
          id: '1', slug: 'bad', state: 'x',
          current_step: 'y', category: 'INVALID' as never,
        },
      }),
    ).rejects.toThrow();
  });
});
