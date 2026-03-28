/**
 * Scan prompt: STACK.md
 *
 * Generates the agent prompt for analyzing a codebase's technology stack.
 * Output: a markdown document enumerating runtime, frameworks, build tools,
 * testing, infrastructure, and external services.
 */

import type { PreScanContext } from '../shared/pre-scan.js';
import { formatPreScan } from './format-pre-scan.js';

export function buildScanStackPrompt(preScan: PreScanContext): string {
  return `You are analyzing an existing codebase to document its technology stack.

${formatPreScan(preScan)}

## Task

Produce a **STACK.md** document with the following sections. Use only facts supported by the pre-scan data above. Do NOT hallucinate technologies that are not evidenced by config files, lock files, or directory structure.

### Required Sections

1. **Runtime & Language** -- Table with columns: Technology, Version (if determinable), Purpose, Confidence (high/medium/low based on evidence).
2. **Frameworks** -- Web frameworks, UI frameworks, meta-frameworks detected via package.json, import patterns, or config files.
3. **Build Tools** -- Bundlers, compilers, transpilers, task runners. Include version constraints from package.json if available.
4. **Testing** -- Test runners, assertion libraries, coverage tools, e2e frameworks. Look for test config files (vitest.config, jest.config, .mocharc, etc.).
5. **Infrastructure** -- Docker, CI/CD configs, deployment manifests, cloud provider SDKs.
6. **External Services** -- Databases, message queues, caching layers, third-party APIs. Evidence from env var patterns, SDK imports, config files.

### Output Format

Produce pure markdown. The output IS the document -- no wrapping, no code fences around the whole thing. Start with \`# Technology Stack\` as the first line.

### Grounding Rule

Only report what the pre-scan data supports. Do NOT hallucinate. If a section has no evidence, write "No evidence found in pre-scan data." for that section.`;
}
