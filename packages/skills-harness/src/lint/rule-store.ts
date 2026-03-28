/**
 * @sunco/skills-harness - Lint Rule Store
 *
 * Reads and writes SunLintRule JSON files from .sun/rules/ via FileStoreApi.
 * Rules are the persistent configuration for the lint engine, created by:
 * - init detection (init-generated)
 * - guard pattern promotion (guard-promoted)
 * - manual user definition (user-defined)
 *
 * Decision: D-10 (lint rules in .sun/rules/ as JSON)
 */

import type { FileStoreApi } from '@sunco/core';
import type { SunLintRule } from './types.js';

/** Category name for rules in the FileStore (.sun/rules/) */
const RULES_CATEGORY = 'rules';

/**
 * Load all lint rules from .sun/rules/.
 * Only parses files with .json extension; skips other files.
 *
 * @param fileStore - FileStore API for reading .sun/ artifacts
 * @returns Array of parsed SunLintRule objects
 */
export async function loadRules(fileStore: FileStoreApi): Promise<SunLintRule[]> {
  const filenames = await fileStore.list(RULES_CATEGORY);
  const jsonFiles = filenames.filter((f) => f.endsWith('.json'));

  const rules: SunLintRule[] = [];

  for (const filename of jsonFiles) {
    const content = await fileStore.read(RULES_CATEGORY, filename);
    if (content === undefined) continue;

    try {
      const parsed = JSON.parse(content) as SunLintRule;
      rules.push(parsed);
    } catch {
      // Skip malformed JSON files silently
      // In production, this could log a warning via the logger
    }
  }

  return rules;
}

/**
 * Save a lint rule to .sun/rules/ as JSON.
 * Creates or overwrites the file named `{rule.id}.json`.
 *
 * @param fileStore - FileStore API for writing .sun/ artifacts
 * @param rule - The rule to persist
 */
export async function saveRule(fileStore: FileStoreApi, rule: SunLintRule): Promise<void> {
  const filename = `${rule.id}.json`;
  const content = JSON.stringify(rule, null, 2);
  await fileStore.write(RULES_CATEGORY, filename, content);
}
