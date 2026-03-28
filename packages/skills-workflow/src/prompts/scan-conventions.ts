/**
 * Scan prompt: CONVENTIONS.md
 *
 * Generates the agent prompt for analyzing a codebase's coding conventions.
 * Output: a markdown document describing naming, imports, error handling,
 * state management, and code organization patterns.
 */

import type { PreScanContext } from '../shared/pre-scan.js';
import { formatPreScan } from './format-pre-scan.js';

export function buildScanConventionsPrompt(preScan: PreScanContext): string {
  return `You are analyzing an existing codebase to document its coding conventions and patterns.

${formatPreScan(preScan)}

## Task

Produce a **CONVENTIONS.md** document with the following sections. Infer conventions from file names, directory structure, config files (ESLint, Prettier, EditorConfig), and any style guide references in README or contributing docs.

### Required Sections

1. **Naming Conventions** -- Files (kebab-case, camelCase, PascalCase), variables, functions, classes, constants, types/interfaces. Identify the dominant pattern from file tree evidence.
2. **Import Style** -- Absolute vs relative imports, path aliases (tsconfig paths), barrel exports (index.ts), import ordering conventions. Evidence from tsconfig.json and file structure.
3. **Error Handling Patterns** -- Try/catch usage, custom error classes, Result types, error boundaries. Infer from file names (e.g., errors/, error.ts) and directory patterns.
4. **State Management** -- How state is managed: Redux, Zustand, context, SQLite, plain objects. Evidence from dependencies in package.json and directory patterns.
5. **Code Organization Patterns** -- Common structural patterns: one-export-per-file, barrel re-exports, colocation of tests, separation of concerns. Evidence from file tree.

### Output Format

Produce pure markdown. The output IS the document -- no wrapping, no code fences around the whole thing. Start with \`# Conventions\` as the first line.

### Grounding Rule

Only report what the pre-scan data supports. Do NOT hallucinate. If a section has no evidence, write "No evidence found in pre-scan data." for that section.`;
}
