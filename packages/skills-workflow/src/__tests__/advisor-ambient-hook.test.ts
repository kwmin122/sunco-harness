/**
 * Tests for packages/cli/hooks/sunco-advisor-ambient.cjs
 *
 * The hook is CJS. We require() it via createRequire and exercise its
 * exported __test__ functions so the behavior is pinned without
 * spawning a child process.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

const hookPath = resolve(
  __dirname,
  '../../../cli/hooks/sunco-advisor-ambient.cjs',
);

function loadHook() {
  // Evict from CJS cache so HOME env changes take effect per-test.
  const require = createRequire(import.meta.url);
  const resolved = require.resolve(hookPath);
  delete require.cache[resolved];
  return require(hookPath) as {
    __test__: {
      readAdvisorConfig: () => Record<string, unknown>;
      classifyPrompt: (p: string) => { bucket: string; signals: string[] };
      shouldSurface: (
        cfg: Record<string, unknown>,
        budget: { lastSurfaced: Record<string, number>; visibleCount: number },
        key: string,
      ) => { show: boolean; reason?: string };
      buildMessage: (bucket: string, signals: string[]) => string;
      buildInjection: (bucket: string, signals: string[], cfg: Record<string, unknown>) => string;
    };
  };
}

// ---------------------------------------------------------------------------
// Fake HOME fixture
// ---------------------------------------------------------------------------

let origHome: string | undefined;
let fakeHome: string;

beforeEach(() => {
  origHome = process.env.HOME;
  fakeHome = mkdtempSync(resolve(tmpdir(), 'advisor-ambient-'));
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

function writeConfig(body: string) {
  const dir = resolve(fakeHome, '.sun');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'config.toml'), body, 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sunco-advisor-ambient — config reader', () => {
  it('returns defaults when config.toml is absent', () => {
    const hook = loadHook();
    const cfg = hook.__test__.readAdvisorConfig();
    expect(cfg).toMatchObject({
      enabled: true,
      prompt_injection: true,
      blocking: false,
      max_visible_per_session: 5,
      suppress_same_key_minutes: 30,
    });
  });

  it('parses [advisor] block with booleans and numbers', () => {
    writeConfig(`
[other]
ignored = true

[advisor]
enabled = false
prompt_injection = true
blocking = true
max_visible_per_session = 2
suppress_same_key_minutes = 15
model = "claude-sonnet-4-6"
`);
    const hook = loadHook();
    const cfg = hook.__test__.readAdvisorConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.blocking).toBe(true);
    expect(cfg.max_visible_per_session).toBe(2);
    expect(cfg.suppress_same_key_minutes).toBe(15);
  });

  it('falls back to defaults on malformed config', () => {
    writeConfig('[advisor\nbroken');
    const hook = loadHook();
    const cfg = hook.__test__.readAdvisorConfig();
    expect(cfg.enabled).toBe(true);
  });
});

describe('sunco-advisor-ambient — classifier', () => {
  const hook = loadHook();

  it('detects destructive intent → blocker', () => {
    const r = hook.__test__.classifyPrompt('rm -rf the dist folder');
    expect(r.bucket).toBe('blocker');
    expect(r.signals).toContain('destructiveIntent');
  });

  it('detects deploy intent → blocker', () => {
    const r = hook.__test__.classifyPrompt('deploy this to prod now');
    expect(r.bucket).toBe('blocker');
  });

  it('detects auth mention → guarded', () => {
    const r = hook.__test__.classifyPrompt('fix the login session bug');
    expect(r.bucket).toBe('guarded');
  });

  it('detects Korean deploy intent (배포)', () => {
    const r = hook.__test__.classifyPrompt('이거 배포하자');
    expect(r.bucket).toBe('blocker');
  });

  it('returns silent for casual prompts', () => {
    const r = hook.__test__.classifyPrompt('make the button text shorter');
    expect(r.bucket).toBe('silent');
  });
});

describe('sunco-advisor-ambient — surface budget', () => {
  const hook = loadHook();
  const cfg = { max_visible_per_session: 3, suppress_same_key_minutes: 30 };

  it('allows first surface', () => {
    const budget = { lastSurfaced: {}, visibleCount: 0 };
    expect(hook.__test__.shouldSurface(cfg, budget, 'k').show).toBe(true);
  });

  it('blocks recently surfaced same key', () => {
    const budget = { lastSurfaced: { k: Date.now() }, visibleCount: 1 };
    const r = hook.__test__.shouldSurface(cfg, budget, 'k');
    expect(r.show).toBe(false);
    expect(r.reason).toBe('recently-surfaced');
  });

  it('blocks once session cap is reached', () => {
    const budget = { lastSurfaced: {}, visibleCount: 3 };
    const r = hook.__test__.shouldSurface(cfg, budget, 'k');
    expect(r.show).toBe(false);
    expect(r.reason).toBe('session-cap-reached');
  });
});

describe('sunco-advisor-ambient — injection XML', () => {
  const hook = loadHook();

  it('guarded bucket renders XML with level=guarded', () => {
    const xml = hook.__test__.buildInjection(
      'guarded',
      ['touchesAuth'],
      { blocking: false },
    );
    expect(xml).toContain('<sunco_advisor');
    expect(xml).toContain('level="guarded"');
    expect(xml).toContain('</sunco_advisor>');
    expect(xml).not.toContain('confirmation="required"');
  });

  it('blocker bucket downgrades to guarded when blocking=false', () => {
    const xml = hook.__test__.buildInjection(
      'blocker',
      ['destructiveIntent'],
      { blocking: false },
    );
    expect(xml).toContain('level="guarded"');
    expect(xml).not.toContain('confirmation="required"');
  });

  it('blocker stays blocker + confirmation required when blocking=true', () => {
    const xml = hook.__test__.buildInjection(
      'blocker',
      ['destructiveIntent'],
      { blocking: true },
    );
    expect(xml).toContain('level="blocker"');
    expect(xml).toContain('confirmation="required"');
  });

  it('message follows Risk / Suggestion template', () => {
    const msg = hook.__test__.buildMessage('guarded', ['touchesAuth']);
    expect(msg).toMatch(/^Risk:/);
    expect(msg).toContain('Suggestion:');
  });
});
