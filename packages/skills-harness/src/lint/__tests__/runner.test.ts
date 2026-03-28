/**
 * Tests for ESLint programmatic runner.
 * Integration tests using real ESLint with temporary fixture files.
 *
 * NOTE: ESLint initialization can be slow on first run.
 * Tests use a longer timeout (30s) to account for this.
 *
 * Important: eslint-plugin-boundaries resolves import paths literally.
 * For TypeScript files, imports must use `.ts` extension (not `.js`) so
 * the plugin can resolve them to the correct element type.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLint } from '../runner.js';
import { generateBoundariesConfig } from '../config-generator.js';
import type { DetectedLayer } from '../../init/types.js';

/**
 * Fixture layers for testing boundary violations.
 * Uses folder paths (not globs) because eslint-plugin-boundaries uses mode:'folder'.
 */
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
  {
    name: 'infra',
    pattern: 'src/infra',
    dirPatterns: ['infra'],
    canImportFrom: ['types', 'domain'],
  },
];

describe('runner', { timeout: 30000 }, () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-lint-'));
    // Create directory structure
    await mkdir(join(tempDir, 'src', 'types'), { recursive: true });
    await mkdir(join(tempDir, 'src', 'domain'), { recursive: true });
    await mkdir(join(tempDir, 'src', 'ui'), { recursive: true });
    await mkdir(join(tempDir, 'src', 'infra'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty violations when no files are provided', async () => {
    const config = generateBoundariesConfig(TEST_LAYERS);
    const result = await runLint({
      files: [],
      boundariesConfig: config,
      cwd: tempDir,
    });

    expect(result.violations).toEqual([]);
    expect(result.filesLinted).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.fixApplied).toBe(false);
  });

  it('detects a dependency direction violation (ui importing from infra)', async () => {
    // Create a types file that both can import
    await writeFile(
      join(tempDir, 'src', 'types', 'index.ts'),
      'export interface User { name: string; }\n',
    );

    // Create an infra file
    await writeFile(
      join(tempDir, 'src', 'infra', 'db.ts'),
      'export const connect = () => "connected";\n',
    );

    // Create a UI file that imports from infra (VIOLATION: ui cannot import infra)
    // Use .ts extension so eslint-plugin-boundaries can resolve the import path
    await writeFile(
      join(tempDir, 'src', 'ui', 'component.ts'),
      'import { connect } from "../infra/db.ts";\nexport const Component = () => connect();\n',
    );

    const config = generateBoundariesConfig(TEST_LAYERS);
    const result = await runLint({
      files: [join(tempDir, 'src', 'ui', 'component.ts')],
      boundariesConfig: config,
      cwd: tempDir,
    });

    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.errorCount).toBeGreaterThan(0);

    // At least one violation should reference the boundaries rule
    const boundaryViolation = result.violations.find((v) =>
      v.rule.includes('boundaries'),
    );
    expect(boundaryViolation).toBeDefined();
    expect(boundaryViolation!.file).toContain('component.ts');
  });

  it('returns correct filesLinted count', async () => {
    // Create valid files (no violations -- domain can import from types)
    await writeFile(
      join(tempDir, 'src', 'types', 'user.ts'),
      'export interface User { name: string; }\n',
    );
    await writeFile(
      join(tempDir, 'src', 'domain', 'service.ts'),
      'import type { User } from "../types/user.ts";\nexport const greet = (u: User) => u.name;\n',
    );

    const config = generateBoundariesConfig(TEST_LAYERS);
    const result = await runLint({
      files: [
        join(tempDir, 'src', 'types', 'user.ts'),
        join(tempDir, 'src', 'domain', 'service.ts'),
      ],
      boundariesConfig: config,
      cwd: tempDir,
    });

    expect(result.filesLinted).toBe(2);
  });

  it('handles ESLint parse errors gracefully (returns as violations, not throws)', async () => {
    // Create a file with invalid syntax
    await writeFile(
      join(tempDir, 'src', 'domain', 'broken.ts'),
      'export const x: = {\n  this is not valid typescript\n};\n',
    );

    const config = generateBoundariesConfig(TEST_LAYERS);

    // Should NOT throw
    const result = await runLint({
      files: [join(tempDir, 'src', 'domain', 'broken.ts')],
      boundariesConfig: config,
      cwd: tempDir,
    });

    // Parse errors should appear as violations, not as unhandled exceptions
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.filesLinted).toBe(1);
  });
});
