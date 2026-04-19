import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const UI_REVIEW_CMD = path.resolve(REPO_ROOT, 'packages/cli/commands/sunco/ui-review.md');

describe('phase51 ui-review-regression fixture', () => {
  it('slash-command file exists', () => {
    expect(existsSync(UI_REVIEW_CMD)).toBe(true);
  });

  const cmdContent = (): string => readFileSync(UI_REVIEW_CMD, 'utf8');

  it('frontmatter declares name: sunco:ui-review', () => {
    expect(cmdContent()).toMatch(/^name:\s*sunco:ui-review\s*$/m);
  });

  it('argument-hint references <phase> and --surface cli|web', () => {
    const s = cmdContent();
    const match = s.match(/argument-hint:\s*"([^"]+)"/);
    expect(match, 'argument-hint frontmatter field must be present').toBeTruthy();
    expect(match![1]).toContain('<phase>');
    expect(match![1]).toContain('--surface cli|web');
  });

  it('frontmatter lists allowed-tools', () => {
    expect(cmdContent()).toMatch(/allowed-tools:/);
  });

  it('body mentions Phase 41 R1 regression guarantee', () => {
    expect(cmdContent()).toContain('R1 regression guarantee');
  });

  it('body preserves byte-identical default-path guarantee', () => {
    expect(cmdContent()).toContain('byte-identical');
  });

  it('body reserves explicit error for --surface native (Phase 41 R4)', () => {
    const s = cmdContent();
    expect(s).toContain('--surface native');
    expect(s).toContain('explicit error');
  });
});
