/**
 * Scan prompt: ARCHITECTURE.md
 *
 * Generates the agent prompt for analyzing a codebase's architecture.
 * Output: a markdown document describing system overview, patterns,
 * module boundaries, data flow, and entry points.
 */

import type { PreScanContext } from '../shared/pre-scan.js';
import { formatPreScan } from './format-pre-scan.js';

export function buildScanArchitecturePrompt(preScan: PreScanContext): string {
  return `You are analyzing an existing codebase to document its architecture.

${formatPreScan(preScan)}

## Task

Produce an **ARCHITECTURE.md** document with the following sections. Base your analysis on directory naming conventions, import patterns, README descriptions, config files, and the file tree structure.

### Required Sections

1. **System Overview** -- High-level description of what this system does. Infer from README, package.json description, directory structure.
2. **Key Patterns** -- Identify architectural patterns: MVC, layered, hexagonal, microservices, monorepo, plugin-based, etc. Cite evidence (directory names, file organization).
3. **Module Boundaries** -- Map the major modules/packages and their responsibilities. For monorepos, describe each package's role.
4. **Data Flow** -- How data moves through the system: entry points -> processing -> storage -> output. Trace from file structure and naming.
5. **Entry Points** -- CLI entry points, HTTP servers, lambda handlers, main files. Identify from package.json bin/main/exports fields, Dockerfile CMD, etc.

### Output Format

Produce pure markdown. The output IS the document -- no wrapping, no code fences around the whole thing. Start with \`# Architecture\` as the first line.

### Grounding Rule

Only report what the pre-scan data supports. Do NOT hallucinate. If a section has no evidence, write "No evidence found in pre-scan data." for that section.`;
}
