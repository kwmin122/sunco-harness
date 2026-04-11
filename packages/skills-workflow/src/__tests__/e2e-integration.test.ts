/**
 * E2E Integration Tests — Deterministic Skill Chain
 *
 * Tests the real CLI binary end-to-end using execFile.
 * Does NOT mock anything — exercises the actual distribution artifact.
 *
 * Covers:
 *   1. --help shows all expected commands
 *   2. --version outputs a valid semver string
 *   3. CLI boots in under 2000ms (target <500ms)
 *   4. query returns without crashing (deterministic, no LLM)
 *   5. graph --stats works on a minimal project
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '..', '..', '..', 'cli', 'dist', 'cli.js');

describe('E2E: deterministic skill chain', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create a minimal temp project with package.json + tsconfig + src/
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-e2e-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        type: 'module',
        dependencies: { typescript: '^6.0.0' },
      }),
    );
    await writeFile(
      join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { target: 'es2022', module: 'nodenext', strict: true },
      }),
    );
    await mkdir(join(tempDir, 'src'));
    await writeFile(join(tempDir, 'src', 'index.ts'), 'export const hello = "world";\n');
  }, 30_000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('sunco --help shows redirect to help command (D-06)', async () => {
    const { stdout } = await execFileAsync('node', [CLI_PATH, '--help'], {
      cwd: tempDir,
    });
    expect(stdout).toContain('sunco help');
  }, 10_000);

  it('sunco with no args outputs help content (D-10, D-12)', async () => {
    // No-arg routing: `sunco` (no subcommand) should invoke harness.help
    // which outputs task cards or help text. Must work regardless of argv structure.
    const { stdout } = await execFileAsync('node', [CLI_PATH], {
      cwd: tempDir,
    });
    // harness.help renders task cards containing 'sunco' references
    expect(stdout).toContain('sunco');
  }, 10_000);

  it('sunco --version outputs a valid semver string', async () => {
    const { stdout } = await execFileAsync('node', [CLI_PATH, '--version'], {
      cwd: tempDir,
    });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  }, 10_000);

  it('CLI boots in under 3000ms (target <500ms)', async () => {
    const start = performance.now();
    await execFileAsync('node', [CLI_PATH, '--help'], { cwd: tempDir });
    const elapsed = performance.now() - start;
    // Generous CI budget — GitHub Actions runners are ~2-3x slower than local
    // warm hardware (local warm: ~750ms; CI observed: ~2150ms with all
    // Phase 27/28 modules loaded). Actual target is <500ms on warm hardware.
    expect(elapsed).toBeLessThan(3000);
  }, 10_000);

  it('sunco query completes without crashing (no LLM required)', async () => {
    // query is deterministic — reads .sun/ state and returns a JSON snapshot
    // On a fresh project with no .sun/ dir it should still return gracefully
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'query'], {
      cwd: tempDir,
      timeout: 15_000,
    });
    // query always exits 0 and outputs at minimum the Query result line
    expect(stdout).toBeDefined();
    expect(stdout.length).toBeGreaterThan(0);
  }, 20_000);

  it('sunco graph --stats works on a minimal project', async () => {
    // graph --stats is deterministic — scans source files and reports node/edge counts
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'graph', '--stats'], {
      cwd: tempDir,
      timeout: 20_000,
    });
    expect(stdout).toBeDefined();
    expect(stdout.length).toBeGreaterThan(0);
  }, 25_000);
});
