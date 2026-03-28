/**
 * Tests for phase-reader.ts
 *
 * Verifies:
 * - resolvePhaseDir finds existing phase directories by padded number
 * - resolvePhaseDir returns null for non-existent phases
 * - readPhaseArtifact reads file content from phase directory
 * - readPhaseArtifact returns null for missing files
 * - writePhaseArtifact creates directory and writes file
 * - writePhaseArtifact rejects path traversal attempts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolvePhaseDir,
  readPhaseArtifact,
  writePhaseArtifact,
} from '../phase-reader.js';

// ---------------------------------------------------------------------------
// Temp directory lifecycle
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'phase-reader-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// resolvePhaseDir
// ---------------------------------------------------------------------------

describe('resolvePhaseDir', () => {
  it('returns path when phase directory exists (padded number)', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '05-context-planning');
    await mkdir(phaseDir, { recursive: true });

    const result = await resolvePhaseDir(tmpDir, 5);
    expect(result).toBe(phaseDir);
  });

  it('returns null when no matching phase directory exists', async () => {
    await mkdir(join(tmpDir, '.planning', 'phases'), { recursive: true });

    const result = await resolvePhaseDir(tmpDir, 99);
    expect(result).toBeNull();
  });

  it('handles single-digit phase numbers with zero padding', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '03-standalone-ts-skills');
    await mkdir(phaseDir, { recursive: true });

    const result = await resolvePhaseDir(tmpDir, 3);
    expect(result).toBe(phaseDir);
  });

  it('handles double-digit phase numbers', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '10-debug-workflows');
    await mkdir(phaseDir, { recursive: true });

    const result = await resolvePhaseDir(tmpDir, 10);
    expect(result).toBe(phaseDir);
  });

  it('returns null when phases directory does not exist', async () => {
    const result = await resolvePhaseDir(tmpDir, 5);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readPhaseArtifact
// ---------------------------------------------------------------------------

describe('readPhaseArtifact', () => {
  it('reads file content from phase directory', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '05-context-planning');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, '05-CONTEXT.md'), 'context content', 'utf-8');

    const result = await readPhaseArtifact(tmpDir, 5, '05-CONTEXT.md');
    expect(result).toBe('context content');
  });

  it('returns null for nonexistent file', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '05-context-planning');
    await mkdir(phaseDir, { recursive: true });

    const result = await readPhaseArtifact(tmpDir, 5, 'nonexistent.md');
    expect(result).toBeNull();
  });

  it('returns null when phase directory does not exist', async () => {
    const result = await readPhaseArtifact(tmpDir, 5, '05-CONTEXT.md');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// writePhaseArtifact
// ---------------------------------------------------------------------------

describe('writePhaseArtifact', () => {
  it('creates directory and writes file', async () => {
    const path = await writePhaseArtifact(
      tmpDir,
      5,
      'context-planning',
      '05-CONTEXT.md',
      'test content',
    );

    expect(path).toContain('05-context-planning');
    expect(path).toContain('05-CONTEXT.md');

    const content = await readFile(path, 'utf-8');
    expect(content).toBe('test content');
  });

  it('creates directory if missing', async () => {
    await writePhaseArtifact(
      tmpDir,
      7,
      'verification',
      '07-CONTEXT.md',
      'verification content',
    );

    const expectedDir = join(tmpDir, '.planning', 'phases', '07-verification');
    const content = await readFile(join(expectedDir, '07-CONTEXT.md'), 'utf-8');
    expect(content).toBe('verification content');
  });

  it('rejects path traversal attempts', async () => {
    await expect(
      writePhaseArtifact(tmpDir, 5, 'context-planning', '../../../etc/passwd', 'evil'),
    ).rejects.toThrow(/path traversal/i);
  });

  it('returns full path to written file', async () => {
    const result = await writePhaseArtifact(
      tmpDir,
      5,
      'context-planning',
      '05-CONTEXT.md',
      'content',
    );

    expect(result).toBe(
      join(tmpDir, '.planning', 'phases', '05-context-planning', '05-CONTEXT.md'),
    );
  });
});
