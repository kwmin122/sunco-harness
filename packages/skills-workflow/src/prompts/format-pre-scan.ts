/**
 * Shared helper: formats PreScanContext into markdown for agent prompts.
 * Used by all 7 scan prompt builders.
 */

import type { PreScanContext } from '../shared/pre-scan.js';

export function formatPreScan(ps: PreScanContext): string {
  const keyFilesSection = Object.entries(ps.keyFiles)
    .map(([name, content]) => `#### ${name}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n');

  return `## Pre-scan Data (deterministic, verified)

Detected ecosystems: ${ps.ecosystems.join(', ') || 'none detected'}
Primary ecosystem: ${ps.primaryEcosystem ?? 'unknown'}
Total files: ${ps.fileCount}

### File Tree (truncated)
\`\`\`
${ps.fileTree.slice(0, 200).join('\n')}
\`\`\`

### Key Configuration Files
${keyFilesSection || '(none found)'}`;
}
