/**
 * Tests for new-skill.skill.ts (sunco new-skill meta-skill).
 *
 * Covers:
 *   - validateSkillName: rejects empty + non-kebab-case
 *   - toSkillId / toPascal: consistent id + class-name derivation
 *   - buildSkillTemplate: includes id, command, kind, description
 *   - buildTestTemplate: references the generated skill file
 *   - planScaffold: puts test under __tests__/ directory
 *   - scaffoldSkill: writes files and refuses to overwrite
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  validateSkillName,
  toSkillId,
  toPascal,
  buildSkillTemplate,
  buildTestTemplate,
  planScaffold,
  scaffoldSkill,
} from '../new-skill.skill.js';

describe('validateSkillName', () => {
  it('accepts lowercase kebab-case', () => {
    expect(validateSkillName('audit-secrets')).toBeNull();
    expect(validateSkillName('bundle-size')).toBeNull();
    expect(validateSkillName('a')).toBeNull();
  });

  it('rejects empty names', () => {
    expect(validateSkillName('')).toMatch(/required/);
  });

  it('rejects names with uppercase or underscores', () => {
    expect(validateSkillName('AuditSecrets')).toMatch(/kebab-case/);
    expect(validateSkillName('audit_secrets')).toMatch(/kebab-case/);
    expect(validateSkillName('1-leading-digit')).toMatch(/kebab-case/);
  });
});

describe('toSkillId and toPascal', () => {
  it('derives extension.<snake> id', () => {
    expect(toSkillId('audit-secrets')).toBe('extension.audit_secrets');
    expect(toSkillId('single')).toBe('extension.single');
  });

  it('derives PascalCase from kebab-case', () => {
    expect(toPascal('audit-secrets')).toBe('AuditSecrets');
    expect(toPascal('a-b-c')).toBe('ABC');
    expect(toPascal('single')).toBe('Single');
  });
});

describe('buildSkillTemplate', () => {
  const opts = {
    name: 'bundle-size',
    kind: 'deterministic' as const,
    tier: 'user' as const,
    description: 'Measure bundle size',
    targetDir: 'x',
    withTest: true,
  };

  it('includes id, command, kind, and description', () => {
    const src = buildSkillTemplate(opts);
    expect(src).toContain("id: 'extension.bundle_size'");
    expect(src).toContain("command: 'bundle-size'");
    expect(src).toContain("kind: 'deterministic'");
    expect(src).toContain("description: 'Measure bundle size'");
    expect(src).toContain('BundleSize');
  });

  it('escapes single quotes in description', () => {
    const src = buildSkillTemplate({
      ...opts,
      description: "user's skill",
    });
    expect(src).toContain("user\\'s skill");
  });
});

describe('buildTestTemplate', () => {
  it('imports and asserts metadata on the generated skill', () => {
    const src = buildTestTemplate({
      name: 'bundle-size',
      kind: 'prompt',
      tier: 'user',
      description: 'x',
      targetDir: 'x',
      withTest: true,
    });
    expect(src).toContain("from '../bundle-size.skill.js'");
    expect(src).toContain("toBe('extension.bundle_size')");
    expect(src).toContain("toBe('prompt')");
  });
});

describe('planScaffold', () => {
  it('places test under __tests__ directory', () => {
    const plan = planScaffold('/repo', {
      name: 'x',
      kind: 'prompt',
      tier: 'user',
      description: 'd',
      targetDir: 'src',
      withTest: true,
    });
    expect(plan.skillPath).toBe('/repo/src/x.skill.ts');
    expect(plan.testPath).toBe('/repo/src/__tests__/x.skill.test.ts');
  });

  it('omits testPath when withTest is false', () => {
    const plan = planScaffold('/repo', {
      name: 'x',
      kind: 'prompt',
      tier: 'user',
      description: 'd',
      targetDir: 'src',
      withTest: false,
    });
    expect(plan.testPath).toBeUndefined();
  });

  it('resolves absolute targetDir as-is', () => {
    const plan = planScaffold('/repo', {
      name: 'x',
      kind: 'prompt',
      tier: 'user',
      description: 'd',
      targetDir: '/abs/path',
      withTest: true,
    });
    expect(plan.skillPath).toBe('/abs/path/x.skill.ts');
  });
});

describe('scaffoldSkill (I/O)', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'sunco-new-skill-'));
  });
  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('writes both skill and test file on a fresh target', async () => {
    const result = await scaffoldSkill(workDir, {
      name: 'fresh',
      kind: 'prompt',
      tier: 'user',
      description: 'fresh desc',
      targetDir: 'packages/skills-extension/src',
      withTest: true,
    });
    expect(result.written).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);

    const skill = await readFile(
      join(workDir, 'packages/skills-extension/src/fresh.skill.ts'),
      'utf-8',
    );
    expect(skill).toContain('extension.fresh');
    const test = await readFile(
      join(workDir, 'packages/skills-extension/src/__tests__/fresh.skill.test.ts'),
      'utf-8',
    );
    expect(test).toContain("from '../fresh.skill.js'");
  });

  it('refuses to overwrite an existing skill file', async () => {
    const dir = join(workDir, 'src');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'dup.skill.ts'), '// existing', 'utf-8');

    const result = await scaffoldSkill(workDir, {
      name: 'dup',
      kind: 'prompt',
      tier: 'user',
      description: 'd',
      targetDir: 'src',
      withTest: false,
    });

    expect(result.written).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    const content = await readFile(join(dir, 'dup.skill.ts'), 'utf-8');
    expect(content).toBe('// existing');
  });

  it('honors withTest=false', async () => {
    const result = await scaffoldSkill(workDir, {
      name: 'no-test',
      kind: 'prompt',
      tier: 'user',
      description: 'd',
      targetDir: 'src',
      withTest: false,
    });
    expect(result.written).toHaveLength(1);
    expect(result.written[0]).toMatch(/no-test\.skill\.ts$/);
  });
});
