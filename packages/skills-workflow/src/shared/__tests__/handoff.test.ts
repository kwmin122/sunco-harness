import { describe, it, expect, vi } from 'vitest';
import { HandoffSchema, readHandoff, writeHandoff } from '../handoff.js';
import type { Handoff } from '../handoff.js';
import type { FileStoreApi } from '@sunco/core';

function createMockFileStore(store: Record<string, string> = {}): FileStoreApi {
  return {
    read: vi.fn(async (_category: string, filename: string) => store[filename] ?? undefined),
    write: vi.fn(async (_category: string, filename: string, content: string) => {
      store[filename] = content;
    }),
    delete: vi.fn(async (_category: string, filename: string) => {
      const existed = filename in store;
      delete store[filename];
      return existed;
    }),
    list: vi.fn(async () => Object.keys(store)),
    exists: vi.fn(async (_category: string, filename: string) => filename in store),
  };
}

const VALID_HANDOFF: Handoff = {
  version: 1,
  timestamp: '2026-03-28T09:00:00Z',
  currentPhase: 3,
  currentPhaseName: 'Standalone TS Skills',
  currentPlan: '03-01',
  completedTasks: ['task-1'],
  inProgressTask: 'task-2',
  pendingDecisions: [],
  blockers: [],
  branch: 'main',
  uncommittedChanges: false,
  uncommittedFiles: [],
  lastSkillId: 'status',
  lastSkillResult: 'success',
};

describe('HandoffSchema', () => {
  it('validates a correct handoff object', () => {
    const result = HandoffSchema.safeParse(VALID_HANDOFF);
    expect(result.success).toBe(true);
  });

  it('rejects invalid version', () => {
    const result = HandoffSchema.safeParse({ ...VALID_HANDOFF, version: 2 });
    expect(result.success).toBe(false);
  });

  it('allows nullable fields', () => {
    const result = HandoffSchema.safeParse({
      ...VALID_HANDOFF,
      currentPhase: null,
      currentPhaseName: null,
      currentPlan: null,
      inProgressTask: null,
      lastSkillId: null,
      lastSkillResult: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid lastSkillResult enum value', () => {
    const result = HandoffSchema.safeParse({ ...VALID_HANDOFF, lastSkillResult: 'error' });
    expect(result.success).toBe(false);
  });
});

describe('writeHandoff', () => {
  it('writes JSON to fileStore with empty category', async () => {
    const store: Record<string, string> = {};
    const fileStore = createMockFileStore(store);
    await writeHandoff(fileStore, VALID_HANDOFF);
    expect(fileStore.write).toHaveBeenCalledWith('', 'HANDOFF.json', expect.any(String));
    expect(store['HANDOFF.json']).toBeDefined();
    const parsed = JSON.parse(store['HANDOFF.json']);
    expect(parsed.version).toBe(1);
  });

  it('produces pretty-printed JSON with 2-space indent', async () => {
    const store: Record<string, string> = {};
    const fileStore = createMockFileStore(store);
    await writeHandoff(fileStore, VALID_HANDOFF);
    const content = store['HANDOFF.json'];
    // 2-space indent means lines start with "  "
    expect(content).toContain('\n  "version"');
  });
});

describe('readHandoff', () => {
  it('reads and validates HANDOFF.json', async () => {
    const store = { 'HANDOFF.json': JSON.stringify(VALID_HANDOFF) };
    const fileStore = createMockFileStore(store);
    const result = await readHandoff(fileStore);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.currentPhase).toBe(3);
  });

  it('returns null if file not found', async () => {
    const fileStore = createMockFileStore({});
    const result = await readHandoff(fileStore);
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    const store = { 'HANDOFF.json': 'not json' };
    const fileStore = createMockFileStore(store);
    const result = await readHandoff(fileStore);
    expect(result).toBeNull();
  });

  it('returns null for schema-invalid data', async () => {
    const store = { 'HANDOFF.json': JSON.stringify({ version: 99, garbage: true }) };
    const fileStore = createMockFileStore(store);
    const result = await readHandoff(fileStore);
    expect(result).toBeNull();
  });
});
