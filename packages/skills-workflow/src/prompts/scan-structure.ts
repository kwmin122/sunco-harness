/**
 * Scan prompt: STRUCTURE.md
 *
 * Generates the agent prompt for analyzing a codebase's directory structure.
 * Output: a markdown document describing layout, module boundaries,
 * file organization pattern, and build output structure.
 */

import type { PreScanContext } from '../shared/pre-scan.js';
import { formatPreScan } from './format-pre-scan.js';

export function buildScanStructurePrompt(preScan: PreScanContext): string {
  return `You are analyzing an existing codebase to document its directory structure and file organization.

${formatPreScan(preScan)}

## Task

Produce a **STRUCTURE.md** document with the following sections. Use the full file tree from the pre-scan data as primary evidence.

### Required Sections

1. **Directory Layout** -- Annotated tree showing top-level directories and their purposes. Use a code block with tree-style formatting and inline comments.
2. **Module Boundaries** -- How the codebase is divided into logical modules. For monorepos: package boundaries. For single projects: source directory divisions (e.g., src/controllers, src/models).
3. **File Organization Pattern** -- Identify the organizing principle: by feature, by layer, by type, hybrid. Cite concrete examples from the file tree.
4. **Build Output Structure** -- Where compiled/bundled output goes (dist/, build/, .next/, target/). Identify from config files and .gitignore patterns.

### Output Format

Produce pure markdown. The output IS the document -- no wrapping, no code fences around the whole thing. Start with \`# Project Structure\` as the first line.

### Grounding Rule

Only report what the pre-scan data supports. Do NOT hallucinate. If a section has no evidence, write "No evidence found in pre-scan data." for that section.`;
}
