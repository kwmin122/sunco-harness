/**
 * Changelog writer for sunco ship release flow.
 *
 * Generates grouped conventional-commit-format changelog sections,
 * parses git log output into structured entries, and manages
 * CHANGELOG.md content via prepend operations.
 *
 * Requirements: SHP-01, SHP-02
 */

/** A single changelog entry extracted from git log. */
export interface ChangelogEntry {
  /** Conventional commit type (feat, fix, docs, refactor, test, chore) */
  type: string;
  /** Commit description */
  description: string;
  /** Short commit hash (7 chars) */
  hash: string;
}

/** Map of commit types to human-readable heading labels. */
const TYPE_LABELS: Record<string, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  refactor: 'Refactoring',
  test: 'Tests',
  chore: 'Maintenance',
};

/** Ordered list of types for consistent section ordering. */
const TYPE_ORDER = ['feat', 'fix', 'docs', 'refactor', 'test', 'chore'];

/**
 * Generate a markdown changelog section from structured entries.
 *
 * Groups entries by type, produces heading labels, and formats each
 * entry as `- description (hash7)`.
 *
 * @param entries - Changelog entries to format
 * @param version - Release version string
 * @param date - Release date string (YYYY-MM-DD)
 * @returns Formatted markdown string
 */
export function generateChangelog(entries: ChangelogEntry[], version: string, date: string): string {
  const lines: string[] = [];
  lines.push(`## [${version}] - ${date}`);

  // Group entries by type
  const grouped = new Map<string, ChangelogEntry[]>();
  for (const entry of entries) {
    const key = entry.type;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  // Output in consistent order
  for (const type of TYPE_ORDER) {
    const group = grouped.get(type);
    if (!group || group.length === 0) continue;

    const label = TYPE_LABELS[type] ?? type;
    lines.push('');
    lines.push(`### ${label}`);
    lines.push('');
    for (const entry of group) {
      lines.push(`- ${entry.description} (${entry.hash})`);
    }
  }

  // Handle any types not in TYPE_ORDER
  for (const [type, group] of grouped) {
    if (TYPE_ORDER.includes(type)) continue;
    const label = TYPE_LABELS[type] ?? type;
    lines.push('');
    lines.push(`### ${label}`);
    lines.push('');
    for (const entry of group) {
      lines.push(`- ${entry.description} (${entry.hash})`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse git log --oneline output into structured changelog entries.
 *
 * Recognizes conventional commit format:
 *   `hash type(scope): description`
 *   `hash type: description`
 *
 * Entries that don't match the pattern are assigned type 'chore'.
 *
 * @param log - Raw git log --oneline output
 * @returns Array of parsed changelog entries
 */
export function parseGitLog(log: string): ChangelogEntry[] {
  if (!log.trim()) return [];

  const lines = log.trim().split('\n');
  const entries: ChangelogEntry[] = [];

  // Pattern: hash type(scope): description  OR  hash type: description
  const conventionalRe = /^(\w+)\s+(\w+)(?:\([^)]*\))?:\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = conventionalRe.exec(trimmed);
    if (match) {
      entries.push({
        hash: match[1],
        type: match[2],
        description: match[3],
      });
    } else {
      // Non-conventional: extract hash and treat rest as chore
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx > 0) {
        entries.push({
          hash: trimmed.slice(0, spaceIdx),
          type: 'chore',
          description: trimmed.slice(spaceIdx + 1),
        });
      }
    }
  }

  return entries;
}

/**
 * Prepend a new changelog section to existing CHANGELOG.md content.
 *
 * Inserts the new section after the `# Changelog` heading. If the heading
 * is missing, it creates one. If existing content is empty, creates fresh
 * content with the heading.
 *
 * @param existingContent - Current CHANGELOG.md content
 * @param newSection - New changelog section to prepend
 * @returns Updated CHANGELOG.md content
 */
export function prependChangelog(existingContent: string, newSection: string): string {
  if (!existingContent.trim()) {
    return `# Changelog\n\n${newSection}\n`;
  }

  const headingRe = /^# Changelog\s*$/m;
  const headingMatch = headingRe.exec(existingContent);

  if (headingMatch) {
    // Insert new section after the # Changelog heading
    const insertPoint = headingMatch.index + headingMatch[0].length;
    return (
      existingContent.slice(0, insertPoint) +
      '\n\n' +
      newSection +
      '\n' +
      existingContent.slice(insertPoint)
    );
  }

  // No heading found -- prepend heading + new section before existing content
  return `# Changelog\n\n${newSection}\n\n${existingContent}`;
}
