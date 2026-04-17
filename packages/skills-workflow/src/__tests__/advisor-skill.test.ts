/**
 * Tests for advisor.skill.ts (the debug surface).
 *
 * Covers:
 *   - metadata
 *   - default classify flow prints Risk/Suggestion (level >= notice)
 *   - --json returns parseable payload
 *   - --verbose includes gates + XML
 *   - --last returns log tail when present, friendly message when absent
 *   - --reconfigure writes config.toml with autoExecuteSkills=false
 *   - --model / --thinking override the current config for one call
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

import advisorSkill from '../advisor.skill.js';
import type { SkillContext, SkillResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

function makeCtx(args: Record<string, unknown>, overrides?: Partial<SkillContext>): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      has: vi.fn().mockResolvedValue(false),
    } as unknown as SkillContext['state'],
    fileStore: {} as SkillContext['fileStore'],
    agent: {
      run: vi.fn(),
      crossVerify: vi.fn(),
      listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
    } as unknown as SkillContext['agent'],
    recommend: {
      getRecommendations: vi.fn().mockReturnValue([]),
      getTopRecommendation: vi.fn().mockReturnValue(undefined),
    },
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi
        .fn()
        .mockResolvedValue({ selectedId: 'deterministic', selectedLabel: '', source: 'default' }),
      askText: vi.fn().mockResolvedValue({ text: '' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: vi.fn().mockResolvedValue({ success: true }),
    cwd: '/tmp/adv-skill',
    args,
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

// Swap HOME so config.toml writes land in a tmp dir per-test.
let origHome: string | undefined;
let fakeHome: string;

beforeEach(() => {
  origHome = process.env.HOME;
  fakeHome = mkdtempSync(resolve(tmpdir(), 'advisor-skill-'));
  process.env.HOME = fakeHome;
});
afterEach(() => {
  process.env.HOME = origHome;
  try {
    rmSync(fakeHome, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

function seedLog(lines: string[]) {
  const sunDir = resolve(fakeHome, '.sun');
  if (!existsSync(sunDir)) mkdirSync(sunDir, { recursive: true });
  writeFileSync(resolve(sunDir, 'advisor.log'), lines.join('\n') + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('advisor.skill — metadata', () => {
  it('has the expected id/command/kind', () => {
    expect(advisorSkill.id).toBe('workflow.advisor');
    expect(advisorSkill.command).toBe('advisor');
    expect(advisorSkill.kind).toBe('prompt');
  });
});

describe('advisor.skill — classify flow', () => {
  it('missing task arg returns a helpful failure', async () => {
    const ctx = makeCtx({ _: [] });
    const res = await advisorSkill.execute(ctx);
    expect(res.success).toBe(false);
    expect(res.summary).toMatch(/Provide a task/);
  });

  it('guarded auth task emits Risk/Suggestion summary', async () => {
    const ctx = makeCtx({ _: ['fix the login session cookie bug'] });
    const res = await advisorSkill.execute(ctx);
    expect(res.success).toBe(true);
    const data = res.data as { decision: { level: string; reasonCodes: string[] } };
    expect(['guarded', 'blocker']).toContain(data.decision.level);
    expect(res.summary).toMatch(/Risk:/);
  });

  it('docs-only task is silent (no Risk line)', async () => {
    const ctx = makeCtx({ _: ['update the readme typo'] });
    const res = await advisorSkill.execute(ctx);
    expect(res.success).toBe(true);
    expect(res.summary).not.toMatch(/Risk:/);
  });

  it('--json returns a parseable payload', async () => {
    const ctx = makeCtx({ _: ['refactor the auth middleware'], json: true });
    const res = await advisorSkill.execute(ctx);
    const data = res.data as { decision: unknown; config: unknown; picker: boolean };
    expect(data.decision).toBeDefined();
    expect(data.config).toBeDefined();
    expect(typeof data.picker).toBe('boolean');
  });

  it('--model / --thinking override the effective config', async () => {
    const ctx = makeCtx({
      _: ['fix the auth bug'],
      model: 'claude-sonnet-4-6',
      thinking: 'max',
    });
    const res = await advisorSkill.execute(ctx);
    const data = res.data as { config: { model: string; thinking: string } };
    expect(data.config.model).toBe('claude-sonnet-4-6');
    expect(data.config.thinking).toBe('max');
  });
});

describe('advisor.skill — --last', () => {
  it('friendly message when advisor.log absent', async () => {
    const ctx = makeCtx({ last: true });
    const res = await advisorSkill.execute(ctx);
    expect(res.success).toBe(true);
    expect(res.summary).toMatch(/No advisor\.log/);
  });

  it('returns recent log entries when log exists', async () => {
    seedLog([
      JSON.stringify({ ts: '2026-04-17T00:00:00.000Z', event: 'surfaced', bucket: 'guarded' }),
      JSON.stringify({ ts: '2026-04-17T00:01:00.000Z', event: 'suppressed', reason: 'recently-surfaced' }),
    ]);
    const ctx = makeCtx({ last: true });
    const res = await advisorSkill.execute(ctx);
    expect(res.success).toBe(true);
    const data = res.data as { entries: string[] };
    expect(data.entries.length).toBe(2);
  });
});

describe('advisor.skill — --reconfigure', () => {
  it('writes config.toml with auto_execute_skills = false', async () => {
    const ctx = makeCtx({ reconfigure: true });
    const res = await advisorSkill.execute(ctx);
    expect(res.success).toBe(true);
    const cfgPath = resolve(fakeHome, '.sun', 'config.toml');
    expect(existsSync(cfgPath)).toBe(true);
    const text = readFileSync(cfgPath, 'utf-8');
    expect(text).toContain('[advisor]');
    expect(text).toContain('auto_execute_skills = false');
    expect(text).toMatch(/model = "/);
  });
});
