/**
 * Tests for changelog-writer.ts (Phase 8, SHP-01, SHP-02)
 *
 * Verifies:
 * - generateChangelog groups entries by type (feat/fix/docs/refactor/test/chore)
 * - generateChangelog formats each entry as "- description (hash7)"
 * - generateChangelog produces heading "## [version] - date"
 * - parseGitLog parses conventional commit format from git log
 * - parseGitLog assigns unmatched entries to 'chore'
 * - prependChangelog prepends new entry to existing CHANGELOG.md content
 * - prependChangelog creates fresh content when existing is empty
 */

import { describe, it, expect } from 'vitest';

import {
  generateChangelog,
  parseGitLog,
  prependChangelog,
  type ChangelogEntry,
} from '../shared/changelog-writer.js';

// ---------------------------------------------------------------------------
// generateChangelog tests
// ---------------------------------------------------------------------------

describe('generateChangelog', () => {
  it('groups entries by type with correct heading labels', () => {
    const entries: ChangelogEntry[] = [
      { type: 'feat', description: 'add auth module', hash: 'abc1234' },
      { type: 'fix', description: 'fix login crash', hash: 'def5678' },
      { type: 'feat', description: 'add user profile', hash: '1234567' },
      { type: 'docs', description: 'update README', hash: '7654321' },
    ];

    const result = generateChangelog(entries, '1.0.0', '2026-03-28');

    expect(result).toContain('## [1.0.0] - 2026-03-28');
    expect(result).toContain('### Features');
    expect(result).toContain('- add auth module (abc1234)');
    expect(result).toContain('- add user profile (1234567)');
    expect(result).toContain('### Bug Fixes');
    expect(result).toContain('- fix login crash (def5678)');
    expect(result).toContain('### Documentation');
    expect(result).toContain('- update README (7654321)');
  });

  it('formats each entry as "- description (hash7)"', () => {
    const entries: ChangelogEntry[] = [
      { type: 'feat', description: 'add widget', hash: 'abcdefg' },
    ];

    const result = generateChangelog(entries, '0.1.0', '2026-01-01');

    expect(result).toContain('- add widget (abcdefg)');
  });

  it('produces heading with version and date', () => {
    const entries: ChangelogEntry[] = [
      { type: 'chore', description: 'bump deps', hash: '1111111' },
    ];

    const result = generateChangelog(entries, '2.0.0', '2026-12-25');

    expect(result).toMatch(/^## \[2\.0\.0\] - 2026-12-25/);
  });

  it('handles all standard types', () => {
    const entries: ChangelogEntry[] = [
      { type: 'feat', description: 'new feature', hash: 'aaaaaaa' },
      { type: 'fix', description: 'bug fix', hash: 'bbbbbbb' },
      { type: 'docs', description: 'docs update', hash: 'ccccccc' },
      { type: 'refactor', description: 'code cleanup', hash: 'ddddddd' },
      { type: 'test', description: 'add tests', hash: 'eeeeeee' },
      { type: 'chore', description: 'maintenance', hash: 'fffffff' },
    ];

    const result = generateChangelog(entries, '1.0.0', '2026-03-28');

    expect(result).toContain('### Features');
    expect(result).toContain('### Bug Fixes');
    expect(result).toContain('### Documentation');
    expect(result).toContain('### Refactoring');
    expect(result).toContain('### Tests');
    expect(result).toContain('### Maintenance');
  });

  it('returns heading only for empty entries', () => {
    const result = generateChangelog([], '1.0.0', '2026-03-28');

    expect(result).toContain('## [1.0.0] - 2026-03-28');
    expect(result).not.toContain('###');
  });
});

// ---------------------------------------------------------------------------
// parseGitLog tests
// ---------------------------------------------------------------------------

describe('parseGitLog', () => {
  it('parses conventional commit format with scope', () => {
    const log = 'abc1234 feat(auth): add login endpoint\ndef5678 fix(ui): fix button color';

    const entries = parseGitLog(log);

    expect(entries).toEqual([
      { type: 'feat', description: 'add login endpoint', hash: 'abc1234' },
      { type: 'fix', description: 'fix button color', hash: 'def5678' },
    ]);
  });

  it('parses conventional commit format without scope', () => {
    const log = 'abc1234 feat: add login endpoint';

    const entries = parseGitLog(log);

    expect(entries).toEqual([
      { type: 'feat', description: 'add login endpoint', hash: 'abc1234' },
    ]);
  });

  it('assigns unmatched entries to chore', () => {
    const log = 'abc1234 random commit message';

    const entries = parseGitLog(log);

    expect(entries).toEqual([
      { type: 'chore', description: 'random commit message', hash: 'abc1234' },
    ]);
  });

  it('handles mixed conventional and non-conventional entries', () => {
    const log = [
      'aaa1111 feat: add widget',
      'bbb2222 some random change',
      'ccc3333 fix(core): fix crash',
    ].join('\n');

    const entries = parseGitLog(log);

    expect(entries).toHaveLength(3);
    expect(entries[0].type).toBe('feat');
    expect(entries[1].type).toBe('chore');
    expect(entries[2].type).toBe('fix');
  });

  it('returns empty array for empty input', () => {
    expect(parseGitLog('')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// prependChangelog tests
// ---------------------------------------------------------------------------

describe('prependChangelog', () => {
  it('prepends new section after # Changelog heading', () => {
    const existing = `# Changelog

## [0.1.0] - 2026-01-01

### Features

- initial release (abc1234)
`;

    const newSection = `## [1.0.0] - 2026-03-28

### Features

- add auth (def5678)`;

    const result = prependChangelog(existing, newSection);

    expect(result).toContain('# Changelog');
    // New section should come before old section
    const newIdx = result.indexOf('[1.0.0]');
    const oldIdx = result.indexOf('[0.1.0]');
    expect(newIdx).toBeLessThan(oldIdx);
  });

  it('creates fresh content when existing is empty', () => {
    const newSection = `## [1.0.0] - 2026-03-28

### Features

- add auth (def5678)`;

    const result = prependChangelog('', newSection);

    expect(result).toContain('# Changelog');
    expect(result).toContain('[1.0.0]');
  });

  it('creates heading if missing from existing content', () => {
    const existing = `## [0.1.0] - 2026-01-01

- old entry (aaa1111)
`;

    const newSection = `## [1.0.0] - 2026-03-28

- new entry (bbb2222)`;

    const result = prependChangelog(existing, newSection);

    expect(result).toContain('# Changelog');
    const newIdx = result.indexOf('[1.0.0]');
    const oldIdx = result.indexOf('[0.1.0]');
    expect(newIdx).toBeLessThan(oldIdx);
  });
});
