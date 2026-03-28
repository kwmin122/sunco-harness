/**
 * Scan prompt: TESTS.md
 *
 * Generates the agent prompt for analyzing a codebase's test infrastructure.
 * Output: a markdown document describing test framework, organization,
 * patterns, coverage, and utilities.
 */

import type { PreScanContext } from '../shared/pre-scan.js';
import { formatPreScan } from './format-pre-scan.js';

export function buildScanTestsPrompt(preScan: PreScanContext): string {
  return `You are analyzing an existing codebase to document its testing infrastructure and practices.

${formatPreScan(preScan)}

## Task

Produce a **TESTS.md** document with the following sections. Look for test config files (vitest.config.ts, jest.config.js, .mocharc, cypress.json, playwright.config.ts), test directories (__tests__/, test/, tests/, spec/), and test utilities.

### Required Sections

1. **Test Framework** -- Primary test runner and assertion library. Version if determinable from package.json. Configuration file location.
2. **Test Organization** -- How tests are structured: colocated (__tests__/ next to source), separate (test/ directory), or mixed. Naming conventions for test files (.test.ts, .spec.ts, _test.go).
3. **Test Patterns** -- Types of tests present: unit, integration, e2e, snapshot, performance. Evidence from directory names, config files, test file naming.
4. **Coverage Configuration** -- Coverage tool (v8, istanbul, c8), thresholds if configured, report formats, CI integration.
5. **Test Utilities / Helpers** -- Shared test setup, fixtures, factories, mocks. Look for files named helpers, fixtures, mocks, factories, setup in test directories.

### Output Format

Produce pure markdown. The output IS the document -- no wrapping, no code fences around the whole thing. Start with \`# Testing\` as the first line.

### Grounding Rule

Only report what the pre-scan data supports. Do NOT hallucinate. If a section has no evidence, write "No evidence found in pre-scan data." for that section.`;
}
