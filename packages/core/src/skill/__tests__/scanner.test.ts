/**
 * @sunco/core - Skill Scanner tests
 *
 * Tests convention-based *.skill.{ts,js,mjs} file discovery.
 * Uses temporary directories with fixture skill files.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanSkillFiles } from '../scanner.js';

describe('scanSkillFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sun-scanner-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty array for empty directory', async () => {
    const result = await scanSkillFiles([tempDir]);
    expect(result).toEqual([]);
  });

  it('returns empty array for non-existent path', async () => {
    const result = await scanSkillFiles(['/nonexistent/path/12345']);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty basePaths', async () => {
    const result = await scanSkillFiles([]);
    expect(result).toEqual([]);
  });

  it('discovers skill files and imports them', async () => {
    // Create a fixture skill file with a valid default export
    const skillContent = `
      export default {
        id: 'test.hello',
        command: 'hello',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'Test skill',
        execute: async () => ({ success: true }),
      };
    `;
    await writeFile(join(tempDir, 'hello.skill.mjs'), skillContent);

    const result = await scanSkillFiles([tempDir]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test.hello');
    expect(result[0].command).toBe('hello');
  });

  it('continues to support TypeScript skill files in dev test runners', async () => {
    const skillContent = `
      export default {
        id: 'test.typescript',
        command: 'typescript',
        kind: 'deterministic',
        stage: 'stable',
        category: 'test',
        routing: 'directExec',
        description: 'TypeScript skill',
        execute: async () => ({ success: true }),
      };
    `;
    await writeFile(join(tempDir, 'typescript.skill.ts'), skillContent);

    const result = await scanSkillFiles([tempDir]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test.typescript');
  });

  it('discovers nested skill files', async () => {
    const nestedDir = join(tempDir, 'harness');
    await mkdir(nestedDir, { recursive: true });

    const skillContent = `
      export default {
        id: 'harness.lint',
        command: 'lint',
        kind: 'deterministic',
        stage: 'stable',
        category: 'harness',
        routing: 'directExec',
        description: 'Lint skill',
        execute: async () => ({ success: true }),
      };
    `;
    await writeFile(join(nestedDir, 'lint.skill.mjs'), skillContent);

    const result = await scanSkillFiles([tempDir]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('harness.lint');
  });

  it('skips non-skill files', async () => {
    await writeFile(join(tempDir, 'utils.ts'), 'export const x = 1;');
    await writeFile(join(tempDir, 'README.md'), '# Hello');

    const result = await scanSkillFiles([tempDir]);
    expect(result).toEqual([]);
  });

  it('skips files without valid skill exports', async () => {
    // File exports a non-skill object
    const badContent = `export default { notASkill: true };`;
    await writeFile(join(tempDir, 'bad.skill.mjs'), badContent);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await scanSkillFiles([tempDir]);
    warnSpy.mockRestore();

    expect(result).toEqual([]);
  });

  it('scans multiple base paths', async () => {
    const dir1 = await mkdtemp(join(tmpdir(), 'sun-scan1-'));
    const dir2 = await mkdtemp(join(tmpdir(), 'sun-scan2-'));

    try {
      await writeFile(
        join(dir1, 'a.skill.mjs'),
        `export default { id: 'a', command: 'a', kind: 'deterministic', stage: 'stable', category: 'test', routing: 'directExec', description: 'A', execute: async () => ({ success: true }) };`,
      );
      await writeFile(
        join(dir2, 'b.skill.mjs'),
        `export default { id: 'b', command: 'b', kind: 'deterministic', stage: 'stable', category: 'test', routing: 'directExec', description: 'B', execute: async () => ({ success: true }) };`,
      );

      const result = await scanSkillFiles([dir1, dir2]);
      expect(result).toHaveLength(2);
      const ids = result.map((s) => s.id).sort();
      expect(ids).toEqual(['a', 'b']);
    } finally {
      await rm(dir1, { recursive: true, force: true });
      await rm(dir2, { recursive: true, force: true });
    }
  });
});
