/**
 * @sunco/skills-harness - Convention Scorer
 *
 * Compares current codebase conventions against the expected baseline
 * (from init result). Reports deviations with human-readable descriptions.
 *
 * Decision: D-14 (convention adherence scoring)
 */

import { extractConventions } from '../init/convention-extractor.js';
import type { ConventionResult } from '../init/types.js';

/** Points deducted per convention mismatch */
const MISMATCH_PENALTY = 25;

/** Convention category labels for human-readable output */
const CATEGORY_LABELS: Record<string, string> = {
  naming: 'Naming convention',
  importStyle: 'Import style',
  exportStyle: 'Export style',
  testOrganization: 'Test organization',
};

/**
 * Score convention adherence by comparing current conventions against expected baseline.
 *
 * Re-runs convention extraction on the current codebase and compares each
 * category (naming, importStyle, exportStyle, testOrganization) against expected.
 * Score starts at 100, deducts 25 per mismatch.
 *
 * @param opts - Options with cwd and expected conventions from init result
 * @returns Score (0-100) and human-readable deviation descriptions
 */
export async function scoreConventions(opts: {
  cwd: string;
  expectedConventions: ConventionResult;
}): Promise<{ score: number; deviations: string[] }> {
  const { cwd, expectedConventions } = opts;

  // Re-extract current conventions
  const current = await extractConventions({ cwd });

  const deviations: string[] = [];
  let penalty = 0;

  // Compare each category
  const categories: Array<keyof Pick<ConventionResult, 'naming' | 'importStyle' | 'exportStyle' | 'testOrganization'>> = [
    'naming',
    'importStyle',
    'exportStyle',
    'testOrganization',
  ];

  for (const cat of categories) {
    const expected = expectedConventions[cat];
    const actual = current[cat];

    if (expected !== actual) {
      penalty += MISMATCH_PENALTY;
      const label = CATEGORY_LABELS[cat] ?? cat;
      deviations.push(`${label} drift: expected ${String(expected)}, found ${String(actual)}`);
    }
  }

  return {
    score: Math.max(0, 100 - penalty),
    deviations,
  };
}
