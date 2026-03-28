/**
 * @sunco/skills-harness - Init Subsystem Shared Types
 *
 * Types and constants for the init detection modules:
 * ecosystem detection, layer detection, and convention extraction.
 *
 * Decisions: D-01 (ecosystem markers), D-02 (layer patterns),
 * D-03 (AST-free convention extraction), D-04 (.sun/ init), D-05 (presets)
 */

// ---------------------------------------------------------------------------
// Ecosystem Detection (D-01)
// ---------------------------------------------------------------------------

/** Marker file that indicates an ecosystem presence */
export interface EcosystemMarker {
  /** File name or glob pattern to look for */
  readonly file: string;
  /** Ecosystem this file indicates */
  readonly ecosystem: string;
  /** Detection confidence */
  readonly confidence: 'high' | 'medium';
}

/**
 * 19 ecosystem markers covering: Node.js, TypeScript, Deno, Bun, Rust, Go,
 * Python (4 markers), Java/Kotlin (3 markers), Ruby, PHP, Swift, Dart, .NET (2 markers).
 */
export const ECOSYSTEM_MARKERS: readonly EcosystemMarker[] = [
  // JavaScript / TypeScript runtimes
  { file: 'package.json', ecosystem: 'nodejs', confidence: 'high' },
  { file: 'tsconfig.json', ecosystem: 'typescript', confidence: 'high' },
  { file: 'deno.json', ecosystem: 'deno', confidence: 'high' },
  { file: 'bun.lockb', ecosystem: 'bun', confidence: 'high' },

  // Systems languages
  { file: 'Cargo.toml', ecosystem: 'rust', confidence: 'high' },
  { file: 'go.mod', ecosystem: 'go', confidence: 'high' },

  // Python
  { file: 'pyproject.toml', ecosystem: 'python', confidence: 'high' },
  { file: 'requirements.txt', ecosystem: 'python', confidence: 'medium' },
  { file: 'setup.py', ecosystem: 'python', confidence: 'medium' },
  { file: 'Pipfile', ecosystem: 'python', confidence: 'medium' },

  // JVM
  { file: 'build.gradle', ecosystem: 'java', confidence: 'high' },
  { file: 'build.gradle.kts', ecosystem: 'kotlin', confidence: 'high' },
  { file: 'pom.xml', ecosystem: 'java', confidence: 'high' },

  // Other languages
  { file: 'Gemfile', ecosystem: 'ruby', confidence: 'high' },
  { file: 'composer.json', ecosystem: 'php', confidence: 'high' },
  { file: 'Package.swift', ecosystem: 'swift', confidence: 'high' },
  { file: 'pubspec.yaml', ecosystem: 'dart', confidence: 'high' },

  // .NET (glob patterns)
  { file: '*.csproj', ecosystem: 'dotnet', confidence: 'high' },
  { file: '*.sln', ecosystem: 'dotnet', confidence: 'medium' },
] as const;

/** Result of ecosystem detection */
export interface EcosystemResult {
  /** Deduplicated list of detected ecosystem names */
  readonly ecosystems: string[];
  /** All matching markers found */
  readonly markers: EcosystemMarker[];
  /** Primary ecosystem (first high-confidence match), null if none */
  readonly primaryEcosystem: string | null;
}

// ---------------------------------------------------------------------------
// Layer Detection (D-02)
// ---------------------------------------------------------------------------

/** A detected architectural layer in the project */
export interface DetectedLayer {
  /** Layer name (e.g., 'domain', 'ui', 'infra') */
  readonly name: string;
  /** Glob pattern matching this layer's files */
  readonly pattern: string;
  /** Directory name patterns that map to this layer */
  readonly dirPatterns: string[];
  /** Layers this layer is allowed to import from (dependency direction) */
  readonly canImportFrom: string[];
}

/**
 * 7 common architectural layer patterns with dependency direction rules.
 * Order represents abstraction level: types (most abstract) -> infra (most concrete).
 * Each layer can import from layers listed in canImportFrom.
 */
export const COMMON_LAYER_PATTERNS: readonly DetectedLayer[] = [
  {
    name: 'types',
    pattern: '',
    dirPatterns: ['types', 'typings', 'interfaces'],
    canImportFrom: [],
  },
  {
    name: 'config',
    pattern: '',
    dirPatterns: ['config', 'configuration', 'settings'],
    canImportFrom: ['types'],
  },
  {
    name: 'utils',
    pattern: '',
    dirPatterns: ['utils', 'utilities', 'helpers', 'lib', 'shared'],
    canImportFrom: ['types', 'config'],
  },
  {
    name: 'domain',
    pattern: '',
    dirPatterns: ['domain', 'models', 'entities', 'services', 'core'],
    canImportFrom: ['types', 'config', 'utils'],
  },
  {
    name: 'handler',
    pattern: '',
    dirPatterns: ['handlers', 'controllers', 'routes', 'api', 'endpoints'],
    canImportFrom: ['types', 'config', 'utils', 'domain'],
  },
  {
    name: 'ui',
    pattern: '',
    dirPatterns: ['ui', 'views', 'pages', 'components', 'screens'],
    canImportFrom: ['types', 'config', 'utils', 'domain'],
  },
  {
    name: 'infra',
    pattern: '',
    dirPatterns: ['infra', 'infrastructure', 'db', 'database', 'adapters', 'external'],
    canImportFrom: ['types', 'config', 'utils', 'domain'],
  },
] as const;

/** Result of layer detection */
export interface LayerResult {
  /** Detected layers with their patterns and rules */
  readonly layers: DetectedLayer[];
  /** Discovered source root directory (e.g., 'src', 'lib'), null if none */
  readonly sourceRoot: string | null;
}

// ---------------------------------------------------------------------------
// Convention Extraction (D-03)
// ---------------------------------------------------------------------------

/** Detected naming convention */
export type NamingConvention = 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | 'mixed';

/** Detected import style */
export type ImportStyle = 'relative' | 'alias' | 'mixed';

/** Detected export style */
export type ExportStyle = 'named' | 'default' | 'mixed';

/** Detected test file organization */
export type TestOrganization = 'co-located' | '__tests__' | 'top-level-test' | 'unknown';

/** Result of convention extraction */
export interface ConventionResult {
  /** Dominant naming convention */
  readonly naming: NamingConvention;
  /** Dominant import style */
  readonly importStyle: ImportStyle;
  /** Dominant export style */
  readonly exportStyle: ExportStyle;
  /** Test file organization pattern */
  readonly testOrganization: TestOrganization;
  /** Number of files sampled for analysis */
  readonly sampleSize: number;
}

// ---------------------------------------------------------------------------
// Init Result (aggregated)
// ---------------------------------------------------------------------------

/** Complete init detection result combining all three detectors */
export interface InitResult {
  /** Ecosystem detection result */
  readonly ecosystems: EcosystemResult;
  /** Layer detection result */
  readonly layers: LayerResult;
  /** Convention extraction result */
  readonly conventions: ConventionResult;
  /** Absolute path to the project root */
  readonly projectRoot: string;
  /** ISO 8601 timestamp of when detection ran */
  readonly timestamp: string;
}
