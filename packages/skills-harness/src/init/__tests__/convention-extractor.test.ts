/**
 * Tests for convention extractor.
 * Uses temporary directories with sample source files.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractConventions } from '../convention-extractor.js';

describe('extractConventions', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-conv-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('detects camelCase naming from sample .ts files', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(
      join(tempDir, 'src', 'userService.ts'),
      `export function getUserById(id: string) { return id; }
export const fetchUserList = () => [];
export function createUserSession() {}
`,
    );
    await writeFile(
      join(tempDir, 'src', 'authHelper.ts'),
      `export function validateToken(token: string) { return true; }
export const refreshAccessToken = () => {};
`,
    );

    const result = await extractConventions({ cwd: tempDir });

    expect(result.naming).toBe('camelCase');
    expect(result.sampleSize).toBeGreaterThan(0);
  });

  it('detects relative import style', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(
      join(tempDir, 'src', 'index.ts'),
      `import { foo } from './foo.js';
import { bar } from '../bar.js';
import { baz } from './utils/baz.js';
export const main = () => foo() + bar() + baz();
`,
    );
    await writeFile(
      join(tempDir, 'src', 'foo.ts'),
      `import { helper } from './helper.js';
export const foo = () => helper();
`,
    );

    const result = await extractConventions({ cwd: tempDir });

    expect(result.importStyle).toBe('relative');
  });

  it('detects named exports as dominant pattern', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(
      join(tempDir, 'src', 'a.ts'),
      `export function doSomething() {}
export const VALUE = 42;
export type Config = { key: string };
`,
    );
    await writeFile(
      join(tempDir, 'src', 'b.ts'),
      `export function anotherThing() {}
export interface MyInterface {}
`,
    );

    const result = await extractConventions({ cwd: tempDir });

    expect(result.exportStyle).toBe('named');
  });

  it('detects __tests__/ organization', async () => {
    await mkdir(join(tempDir, 'src', '__tests__'), { recursive: true });
    await writeFile(join(tempDir, 'src', '__tests__', 'foo.test.ts'), 'test("foo", () => {});');
    await writeFile(join(tempDir, 'src', 'foo.ts'), 'export const foo = 1;');

    const result = await extractConventions({ cwd: tempDir });

    expect(result.testOrganization).toBe('__tests__');
  });

  it('detects co-located test organization', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'foo.ts'), 'export const foo = 1;');
    await writeFile(join(tempDir, 'src', 'foo.test.ts'), 'test("foo", () => {});');
    await writeFile(join(tempDir, 'src', 'bar.ts'), 'export const bar = 2;');
    await writeFile(join(tempDir, 'src', 'bar.test.ts'), 'test("bar", () => {});');

    const result = await extractConventions({ cwd: tempDir });

    expect(result.testOrganization).toBe('co-located');
  });

  it('excludes node_modules, dist, .next from sampling', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await mkdir(join(tempDir, 'node_modules', 'pkg'), { recursive: true });
    await mkdir(join(tempDir, 'dist'), { recursive: true });
    await mkdir(join(tempDir, '.next'), { recursive: true });

    // Only this file should be sampled
    await writeFile(
      join(tempDir, 'src', 'main.ts'),
      `export function mainEntry() { return 'hello'; }
`,
    );

    // These should NOT be sampled
    await writeFile(
      join(tempDir, 'node_modules', 'pkg', 'index.ts'),
      `export default class SomeLib {}`,
    );
    await writeFile(join(tempDir, 'dist', 'bundle.ts'), `export default class Bundle {}`);
    await writeFile(join(tempDir, '.next', 'build.ts'), `export default class Build {}`);

    const result = await extractConventions({ cwd: tempDir });

    // Only 1 file sampled (from src/)
    expect(result.sampleSize).toBe(1);
    // Named exports from the only valid file
    expect(result.exportStyle).toBe('named');
  });

  it('returns unknown test organization when no test files found', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'index.ts'), 'export const x = 1;');

    const result = await extractConventions({ cwd: tempDir });

    expect(result.testOrganization).toBe('unknown');
  });
});
