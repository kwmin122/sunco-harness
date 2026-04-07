/**
 * Bug pattern classification — 9-pattern system with 2-tier taxonomy.
 *
 * Tier 1: Category (structural / behavioral / environmental)
 * Tier 2: Specific failure type (9 types)
 *
 * Phase 23a — Iron Law Engine
 */

import type { BugCategory, BugPattern, FailureType } from './debug-types.js';
import type { DiagnoseError } from './debug-types.js';

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

const PATTERNS: BugPattern[] = [
  // --- Structural ---
  {
    type: 'context_shortage',
    category: 'structural',
    description: 'Agent ran out of context or had incomplete information',
    indicators: [
      'undefined is not',
      'Cannot read propert',
      'is not defined',
      'missing import',
      'Cannot find module',
      'has no exported member',
    ],
    commonFixes: [
      'Increase context window or split task',
      'Ensure all referenced files are loaded',
      'Add missing imports explicitly',
    ],
  },
  {
    type: 'direction_error',
    category: 'structural',
    description: 'Agent took a fundamentally wrong approach',
    indicators: [
      'deprecated',
      'not a function',
      'wrong number of arguments',
      'Expected.*but got',
      'does not exist on type',
    ],
    commonFixes: [
      'Review API documentation for correct usage',
      'Check recent changelog for breaking changes',
      'Use a different approach entirely',
    ],
  },
  {
    type: 'structural_conflict',
    category: 'structural',
    description: 'Codebase architecture prevents the change',
    indicators: [
      'circular dependency',
      'Circular',
      'layer violation',
      'cannot import.*from',
      'Module.*cannot be used',
    ],
    commonFixes: [
      'Restructure imports to break circular dependency',
      'Move shared code to a lower-level module',
      'Introduce an interface to decouple layers',
    ],
  },
  {
    type: 'boundary_violation',
    category: 'structural',
    description: 'Cross-package imports or layer breaches',
    indicators: [
      'cross-package import',
      'not exported from',
      'private.*accessed',
      'internal module',
      'packages/.*packages/',
    ],
    commonFixes: [
      'Use the public API (barrel export) instead of deep imports',
      'Move the shared code to a common package',
      'Expose a proper API at the package boundary',
    ],
  },

  // --- Behavioral ---
  {
    type: 'state_corruption',
    category: 'behavioral',
    description: 'Stale cache, inconsistent state files, corrupted data',
    indicators: [
      'stale',
      'cache',
      'inconsistent',
      'corrupt',
      'mismatch.*state',
      'SQLITE_BUSY',
      'lock file',
    ],
    commonFixes: [
      'Clear caches and rebuild',
      'Reset state to a known good snapshot',
      'Add state validation at read boundaries',
    ],
  },
  {
    type: 'race_condition',
    category: 'behavioral',
    description: 'Timing-dependent intermittent failures',
    indicators: [
      'EBUSY',
      'EAGAIN',
      'timeout',
      'timed out',
      'intermittent',
      'flaky',
      'race',
      'concurrent',
    ],
    commonFixes: [
      'Add proper locking or serialization',
      'Increase timeout thresholds',
      'Use retry with exponential backoff',
    ],
  },
  {
    type: 'silent_failure',
    category: 'behavioral',
    description: 'No errors reported but output is wrong or side effects missing',
    indicators: [
      'expected.*but received',
      'toEqual',
      'toBe',
      'not.toContain',
      'assertion failed',
      'AssertionError',
    ],
    commonFixes: [
      'Add explicit assertions for expected side effects',
      'Check return values are propagated correctly',
      'Verify async operations complete before checking results',
    ],
  },

  // --- Environmental ---
  {
    type: 'type_mismatch',
    category: 'environmental',
    description: 'TypeScript type errors or schema validation failures',
    indicators: [
      'TS\\d{4}',
      'Type.*is not assignable',
      'Property.*does not exist',
      'Argument of type',
      'schema validation',
      'ZodError',
    ],
    commonFixes: [
      'Fix the type declaration to match usage',
      'Add missing properties to the interface',
      'Cast with assertion if types are known correct at runtime',
    ],
  },
  {
    type: 'dependency_conflict',
    category: 'environmental',
    description: 'Package version conflicts or peer dependency issues',
    indicators: [
      'peer dep',
      'ERESOLVE',
      'version.*conflict',
      'Could not resolve dependency',
      'incompatible',
      'npm ERR',
      'Module not found',
    ],
    commonFixes: [
      'Align dependency versions across packages',
      'Use overrides/resolutions in package.json',
      'Update the conflicting package to a compatible version',
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const patternMap = new Map<FailureType, BugPattern>(
  PATTERNS.map((p) => [p.type, p]),
);

/**
 * Get the bug pattern definition for a failure type.
 */
export function getBugPattern(type: FailureType): BugPattern | undefined {
  return patternMap.get(type);
}

/**
 * Get all bug patterns in a given category.
 */
export function getPatternsByCategory(category: BugCategory): BugPattern[] {
  return PATTERNS.filter((p) => p.category === category);
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a bug from diagnostic errors and context string.
 *
 * Scores each pattern by counting indicator matches across error messages
 * and context. Returns the highest-scoring pattern, defaulting to
 * 'context_shortage' if nothing matches.
 */
export function classifyBug(
  errors: DiagnoseError[],
  context: string,
): FailureType {
  const corpus = [
    ...errors.map((e) => `${e.message} ${e.code ?? ''} ${e.stack ?? ''}`),
    context,
  ].join('\n');

  let bestType: FailureType = 'context_shortage';
  let bestScore = 0;

  for (const pattern of PATTERNS) {
    let score = 0;
    for (const indicator of pattern.indicators) {
      const re = new RegExp(indicator, 'i');
      if (re.test(corpus)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = pattern.type;
    }
  }

  return bestType;
}
