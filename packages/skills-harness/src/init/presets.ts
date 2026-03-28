/**
 * @sunco/skills-harness - Project Presets
 *
 * Auto-select a project preset based on detected ecosystems.
 * Each preset defines which skills are active by default.
 *
 * Decision: D-05 (presets auto-select based on detected ecosystems)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Project preset definition */
export interface ProjectPreset {
  /** Unique preset identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Short description */
  readonly description: string;
  /** Skills enabled by default with this preset */
  readonly activeSkills: string[];
  /** Ecosystems that trigger this preset (matched by overlap count) */
  readonly matchEcosystems: string[];
}

// ---------------------------------------------------------------------------
// Preset Definitions
// ---------------------------------------------------------------------------

/**
 * Built-in project presets. Ordered from most-specific to least-specific.
 * resolvePreset picks the preset with the highest ecosystem overlap.
 */
export const PROJECT_PRESETS: readonly ProjectPreset[] = [
  {
    id: 'typescript-node',
    name: 'TypeScript + Node.js',
    description: 'Full-stack TypeScript project with ESLint harness support',
    activeSkills: ['init', 'lint', 'health', 'agents', 'guard'],
    matchEcosystems: ['typescript', 'nodejs'],
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    description: 'JavaScript/Node.js project with ESLint harness support',
    activeSkills: ['init', 'lint', 'health', 'agents', 'guard'],
    matchEcosystems: ['nodejs'],
  },
  {
    id: 'rust',
    name: 'Rust',
    description: 'Rust project (cargo-based, no ESLint)',
    activeSkills: ['init', 'health', 'agents', 'guard'],
    matchEcosystems: ['rust'],
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python project (ruff/flake8-based, no ESLint)',
    activeSkills: ['init', 'health', 'agents', 'guard'],
    matchEcosystems: ['python'],
  },
  {
    id: 'go',
    name: 'Go',
    description: 'Go project (golangci-lint-based, no ESLint)',
    activeSkills: ['init', 'health', 'agents', 'guard'],
    matchEcosystems: ['go'],
  },
  {
    id: 'generic',
    name: 'Generic',
    description: 'Fallback preset for unrecognized project types',
    activeSkills: ['init', 'health', 'agents'],
    matchEcosystems: [],
  },
] as const;

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the best-matching preset for the detected ecosystems.
 *
 * Scores each preset by counting how many of its `matchEcosystems` appear
 * in the detected list. The preset with the highest overlap wins.
 * Falls back to 'generic' if no preset has any match.
 *
 * @param ecosystems - Detected ecosystem names (e.g., ['nodejs', 'typescript'])
 * @returns Best-matching ProjectPreset
 */
export function resolvePreset(ecosystems: string[]): ProjectPreset {
  if (ecosystems.length === 0) {
    return PROJECT_PRESETS.find((p) => p.id === 'generic')!;
  }

  const ecoSet = new Set(ecosystems);

  let bestPreset: ProjectPreset | null = null;
  let bestScore = -1;

  for (const preset of PROJECT_PRESETS) {
    // Skip generic (it's the fallback)
    if (preset.matchEcosystems.length === 0) continue;

    const matchCount = preset.matchEcosystems.filter((e) => ecoSet.has(e)).length;
    if (matchCount === 0) continue;

    // Score = overlap count * 1000 + match completeness ratio * 100.
    // This ensures a preset that fully matches (all its ecosystems present)
    // beats a preset that only partially matches, even with same overlap count.
    const completeness = matchCount / preset.matchEcosystems.length;
    const score = matchCount * 1000 + completeness * 100;

    if (score > bestScore) {
      bestScore = score;
      bestPreset = preset;
    }
  }

  return bestPreset ?? PROJECT_PRESETS.find((p) => p.id === 'generic')!;
}
