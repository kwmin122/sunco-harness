/**
 * Scan prompt: CONCERNS.md
 *
 * Generates the agent prompt for analyzing a codebase's technical concerns.
 * Output: a markdown document with an honest assessment of technical debt,
 * missing tests, outdated deps, security, performance, and maintenance risks.
 */

import type { PreScanContext } from '../shared/pre-scan.js';
import { formatPreScan } from './format-pre-scan.js';

export function buildScanConcernsPrompt(preScan: PreScanContext): string {
  return `You are analyzing an existing codebase to produce an honest assessment of its technical concerns and risks.

${formatPreScan(preScan)}

## Task

Produce a **CONCERNS.md** document with the following sections. Be honest and constructive. This document helps teams prioritize improvements. Base all assessments on evidence from the pre-scan data.

### Required Sections

1. **Technical Debt Indicators** -- Signs of accumulated debt: large files, deep nesting, inconsistent patterns, TODO/FIXME density, disabled linting rules, any-type usage. Evidence from file tree structure and config files.
2. **Missing Tests** -- Areas with no apparent test coverage. Compare source directories to test directories. Note any test config that suggests partial coverage.
3. **Outdated Dependencies** -- Dependencies with known major version gaps (if version info is available in package.json). Note deprecated packages.
4. **Security Concerns** -- Potential security issues: hardcoded secrets patterns, missing security headers config, no rate limiting setup, outdated auth libraries. Evidence from config files and dependencies.
5. **Performance Risks** -- Potential performance issues: no caching layer, missing database indexes (if schema files visible), large bundle indicators, missing lazy loading patterns.
6. **Maintenance Concerns** -- Bus factor indicators: single contributor patterns, no CI config, missing documentation, no contributing guide, no changelog.

### Output Format

Produce pure markdown. The output IS the document -- no wrapping, no code fences around the whole thing. Start with \`# Technical Concerns\` as the first line.

### Severity Rating

For each finding, rate severity as: **Critical** (blocks production), **High** (should fix soon), **Medium** (plan to address), **Low** (nice to have).

### Grounding Rule

Only report what the pre-scan data supports. Do NOT hallucinate. If a section has no evidence, write "No evidence found in pre-scan data." for that section.`;
}
