/**
 * Tests for freshness checker.
 * Uses temporary directories with fixture files and controlled mtimes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkFreshness } from '../freshness-checker.js';

describe('checkFreshness', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-freshness-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('flags README.md as stale when code files were modified more recently', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });

    // Write README and code file
    await writeFile(join(tempDir, 'README.md'), '# Project\nSome docs');
    await writeFile(join(tempDir, 'src', 'index.ts'), 'export const x = 1;');

    // Set README mtime to 30 days ago, code to now
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await utimes(join(tempDir, 'README.md'), thirtyDaysAgo, thirtyDaysAgo);
    await utimes(join(tempDir, 'src', 'index.ts'), now, now);

    const result = await checkFreshness({ cwd: tempDir });

    expect(result.staleDocuments.length).toBeGreaterThan(0);
    const staleReadme = result.staleDocuments.find((d) => d.docPath.includes('README.md'));
    expect(staleReadme).toBeDefined();
    expect(staleReadme!.staleDays).toBeGreaterThanOrEqual(7);
    expect(result.score).toBeLessThan(100);
  });

  it('detects broken cross-references (link to non-existent file)', async () => {
    await writeFile(
      join(tempDir, 'README.md'),
      '# Project\n\nSee [guide](./docs/guide.md) for more info.\n',
    );

    const result = await checkFreshness({ cwd: tempDir });

    expect(result.brokenReferences.length).toBeGreaterThan(0);
    expect(result.brokenReferences[0]!.reference).toContain('docs/guide.md');
    expect(result.brokenReferences[0]!.reason).toContain('not found');
  });

  it('returns score 100 when all docs are fresh', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'README.md'), '# Fresh project docs');
    await writeFile(join(tempDir, 'src', 'index.ts'), 'export const x = 1;');

    // Both files at the same time (now), no staleness
    const now = new Date();
    await utimes(join(tempDir, 'README.md'), now, now);
    await utimes(join(tempDir, 'src', 'index.ts'), now, now);

    const result = await checkFreshness({ cwd: tempDir });

    expect(result.score).toBe(100);
    expect(result.staleDocuments).toHaveLength(0);
    expect(result.brokenReferences).toHaveLength(0);
  });

  it('returns lower score proportional to stale doc count', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await mkdir(join(tempDir, 'docs'), { recursive: true });

    // Create 4 docs, 2 stale, 2 fresh
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    await writeFile(join(tempDir, 'README.md'), '# Readme');
    await writeFile(join(tempDir, 'docs', 'api.md'), '# API');
    await writeFile(join(tempDir, 'docs', 'guide.md'), '# Guide');
    await writeFile(join(tempDir, 'docs', 'changelog.md'), '# Changelog');
    await writeFile(join(tempDir, 'src', 'index.ts'), 'export const x = 1;');

    // 2 stale, 2 fresh
    await utimes(join(tempDir, 'README.md'), thirtyDaysAgo, thirtyDaysAgo);
    await utimes(join(tempDir, 'docs', 'api.md'), thirtyDaysAgo, thirtyDaysAgo);
    await utimes(join(tempDir, 'docs', 'guide.md'), now, now);
    await utimes(join(tempDir, 'docs', 'changelog.md'), now, now);
    await utimes(join(tempDir, 'src', 'index.ts'), now, now);

    const result = await checkFreshness({ cwd: tempDir });

    // Score should be ~50 (2 of 4 stale)
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
    expect(result.staleDocuments.length).toBe(2);
    expect(result.totalDocuments).toBe(4);
  });
});
