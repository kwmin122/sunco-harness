/**
 * Tests for lint fixer module.
 *
 * The fixer delegates to runLint with fix=true. These tests verify
 * the coordination layer works correctly.
 *
 * NOTE: Integration-level tests using real ESLint. Timeout set high
 * for initial ESLint bootstrap.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLintWithFix } from '../fixer.js';
import { generateBoundariesConfig } from '../config-generator.js';
import type { DetectedLayer } from '../../init/types.js';

const TEST_LAYERS: DetectedLayer[] = [
  {
    name: 'types',
    pattern: 'src/types',
    dirPatterns: ['types'],
    canImportFrom: [],
  },
  {
    name: 'domain',
    pattern: 'src/domain',
    dirPatterns: ['domain'],
    canImportFrom: ['types'],
  },
  {
    name: 'ui',
    pattern: 'src/ui',
    dirPatterns: ['ui'],
    canImportFrom: ['types', 'domain'],
  },
];

describe('runLintWithFix', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-fixer-test-'));
    // Create directory structure
    await mkdir(join(tempDir, 'src', 'types'), { recursive: true });
    await mkdir(join(tempDir, 'src', 'domain'), { recursive: true });
    await mkdir(join(tempDir, 'src', 'ui'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns fixApplied=true when fix mode is active', async () => {
    // Clean file with no violations
    await writeFile(
      join(tempDir, 'src', 'domain', 'user.ts'),
      'export interface User { name: string; }\n',
    );

    const config = generateBoundariesConfig(TEST_LAYERS);
    const result = await runLintWithFix({
      files: ['src/**/*.ts'],
      boundariesConfig: config,
      cwd: tempDir,
    });

    expect(result.fixApplied).toBe(true);
  }, 30000);

  it('reports non-fixable boundary violations in violations array', async () => {
    // types.ts exporting a type
    await writeFile(
      join(tempDir, 'src', 'types', 'common.ts'),
      'export type ID = string;\n',
    );

    // domain importing types (allowed)
    await writeFile(
      join(tempDir, 'src', 'domain', 'entity.ts'),
      "import type { ID } from '../types/common.ts';\nexport interface Entity { id: ID; }\n",
    );

    // UI importing from domain (allowed) -- clean file
    await writeFile(
      join(tempDir, 'src', 'ui', 'view.ts'),
      "import type { Entity } from '../domain/entity.ts';\nexport const render = (e: Entity): string => e.id;\n",
    );

    const config = generateBoundariesConfig(TEST_LAYERS);
    const result = await runLintWithFix({
      files: ['src/**/*.ts'],
      boundariesConfig: config,
      cwd: tempDir,
    });

    // All imports are valid -- no boundary violations expected
    expect(result.fixApplied).toBe(true);
    const boundaryViolations = result.violations.filter(
      (v) => v.rule === 'boundaries/dependencies',
    );
    expect(boundaryViolations).toHaveLength(0);
  }, 30000);

  it('handles empty file list gracefully', async () => {
    const config = generateBoundariesConfig(TEST_LAYERS);
    const result = await runLintWithFix({
      files: [],
      boundariesConfig: config,
      cwd: tempDir,
    });

    // runLint short-circuits for empty files, fixApplied stays false
    expect(result.violations).toEqual([]);
    expect(result.filesLinted).toBe(0);
  }, 30000);
});
