/**
 * Tests for packages/cli/hooks/sunco-advisor-postaction.cjs
 *
 * Covers the queue state machine: enqueue, dedupe, scavenge, cap.
 * Also covers the ambient hook's queue promotion path.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const postActionPath = resolve(
  __dirname,
  '../../../cli/hooks/sunco-advisor-postaction.cjs',
);
const ambientPath = resolve(
  __dirname,
  '../../../cli/hooks/sunco-advisor-ambient.cjs',
);

function loadPost() {
  const require = createRequire(import.meta.url);
  delete require.cache[require.resolve(postActionPath)];
  return require(postActionPath) as {
    __test__: {
      classifyFile: (p: string) => { bucket: string; signals: string[]; file: string } | null;
      itemId: (b: string, f: string, s: string[]) => string;
      suppressionKey: (b: string, s: string[]) => string;
      gatesFor: (b: string) => Array<{ gate: string; scope?: string }>;
      enqueue: (q: { items: unknown[] }, cls: unknown, now: number) => boolean;
      scavengeExpired: (q: { items: Array<{ status: string; createdAt: string }> }, now: number) => void;
      enforceCap: (q: { items: unknown[] }) => void;
    };
  };
}

function loadAmbient() {
  const require = createRequire(import.meta.url);
  delete require.cache[require.resolve(ambientPath)];
  return require(ambientPath) as {
    __test__: {
      readQueue: () => { items: Array<{ status: string; id: string }> };
      writeQueue: (q: unknown) => void;
      promoteOldestPending: (q: { items: Array<{ status: string }> }) => { status: string } | null;
      renderQueueInjection: (item: unknown) => string;
    };
  };
}

let origHome: string | undefined;
let fakeHome: string;

beforeEach(() => {
  origHome = process.env.HOME;
  fakeHome = mkdtempSync(resolve(tmpdir(), 'advisor-post-'));
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

describe('sunco-advisor-postaction — classifyFile', () => {
  const hook = loadPost();

  it('returns null for generated, docs, and test files', () => {
    expect(hook.__test__.classifyFile('dist/cli.js')).toBe(null);
    expect(hook.__test__.classifyFile('docs/intro.md')).toBe(null);
    expect(hook.__test__.classifyFile('src/foo.test.ts')).toBe(null);
  });

  it('flags auth files as guarded', () => {
    const r = hook.__test__.classifyFile('src/auth/session.ts')!;
    expect(r.bucket).toBe('guarded');
    expect(r.signals).toContain('touchesAuth');
  });

  it('flags secrets as blocker', () => {
    const r = hook.__test__.classifyFile('.env')!;
    expect(r.bucket).toBe('blocker');
    expect(r.signals).toContain('touchesSecrets');
  });

  it('flags prisma schema as guarded', () => {
    const r = hook.__test__.classifyFile('prisma/schema.prisma')!;
    expect(r.bucket).toBe('guarded');
    expect(r.signals).toContain('touchesSchema');
  });

  it('returns null on unrelated files', () => {
    expect(hook.__test__.classifyFile('src/components/Button.tsx')).toBe(null);
  });
});

describe('sunco-advisor-postaction — queue state machine', () => {
  const hook = loadPost();

  it('enqueue inserts a new item', () => {
    const q = { items: [] as unknown[] };
    const cls = hook.__test__.classifyFile('src/auth/session.ts')!;
    const added = hook.__test__.enqueue(q, cls, Date.now());
    expect(added).toBe(true);
    expect(q.items).toHaveLength(1);
    expect((q.items[0] as { status: string }).status).toBe('pending');
  });

  it('enqueue dedupes identical pending items', () => {
    const q = { items: [] as unknown[] };
    const cls = hook.__test__.classifyFile('src/auth/session.ts')!;
    hook.__test__.enqueue(q, cls, Date.now());
    const second = hook.__test__.enqueue(q, cls, Date.now());
    expect(second).toBe(false);
    expect(q.items).toHaveLength(1);
  });

  it('scavengeExpired marks old pending items as expired', () => {
    const now = Date.now();
    const oldCreated = new Date(now - 3 * 60 * 60 * 1000).toISOString(); // 3h ago
    const q = {
      items: [
        { status: 'pending', createdAt: oldCreated },
        { status: 'resolved', createdAt: oldCreated },
      ],
    };
    hook.__test__.scavengeExpired(q, now);
    expect(q.items[0]!.status).toBe('expired');
    expect(q.items[1]!.status).toBe('resolved'); // resolved unaffected
  });

  it('enforceCap trims to MAX_QUEUE_ITEMS', () => {
    const q = { items: [] as Array<{ status: string; createdAt: string }> };
    for (let i = 0; i < 55; i++) {
      q.items.push({
        status: i % 5 === 0 ? 'pending' : 'resolved',
        createdAt: new Date(Date.now() - (55 - i) * 1000).toISOString(),
      });
    }
    hook.__test__.enforceCap(q as unknown as { items: unknown[] });
    expect(q.items.length).toBe(50);
  });

  it('gatesFor produces the right recipe per bucket', () => {
    expect(hook.__test__.gatesFor('blocker').map((g) => g.gate)).toEqual(
      expect.arrayContaining(['verify', 'review', 'proceed']),
    );
    expect(hook.__test__.gatesFor('guarded').map((g) => g.gate)).toEqual(
      expect.arrayContaining(['lint', 'test']),
    );
    expect(hook.__test__.gatesFor('notice').map((g) => g.gate)).toContain('lint');
  });

  it('suppressionKey is stable for same bucket+signals regardless of order', () => {
    const a = hook.__test__.suppressionKey('guarded', ['touchesAuth', 'touchesSchema']);
    const b = hook.__test__.suppressionKey('guarded', ['touchesSchema', 'touchesAuth']);
    expect(a).toBe(b);
  });

  it('itemId is stable for same input and differs by file', () => {
    const a = hook.__test__.itemId('guarded', 'a.ts', ['touchesAuth']);
    const b = hook.__test__.itemId('guarded', 'a.ts', ['touchesAuth']);
    const c = hook.__test__.itemId('guarded', 'b.ts', ['touchesAuth']);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('sunco-advisor-ambient — queue promotion', () => {
  it('promoteOldestPending flips pending → surfaced and returns the item', () => {
    const hook = loadAmbient();
    const q = {
      items: [
        { id: 'x', status: 'pending', signals: ['touchesAuth'], files: ['src/auth/session.ts'], requiredGates: [{ gate: 'lint', scope: 'changed' }] },
        { id: 'y', status: 'resolved', signals: [], files: [], requiredGates: [] },
      ],
    };
    const surfaced = hook.__test__.promoteOldestPending(q as unknown as { items: Array<{ status: string }> });
    expect(surfaced).not.toBeNull();
    expect(q.items[0]!.status).toBe('surfaced');
  });

  it('promoteOldestPending returns null when no pending items', () => {
    const hook = loadAmbient();
    const q = { items: [{ id: 'x', status: 'resolved' }] };
    const surfaced = hook.__test__.promoteOldestPending(q as unknown as { items: Array<{ status: string }> });
    expect(surfaced).toBeNull();
  });

  it('renderQueueInjection produces a post-action-queue XML block', () => {
    const hook = loadAmbient();
    const item = {
      id: 'abc',
      signals: ['touchesAuth'],
      files: ['src/auth/session.ts'],
      requiredGates: [{ gate: 'lint', scope: 'changed' }, { gate: 'test', scope: 'targeted' }],
    };
    const xml = hook.__test__.renderQueueInjection(item);
    expect(xml).toContain('source="post-action-queue"');
    expect(xml).toContain('src/auth/session.ts');
    expect(xml).toContain('lint(changed)');
    expect(xml).toContain('test(targeted)');
  });
});
