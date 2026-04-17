/**
 * Risk classifier — deterministic signals → risk bucket.
 *
 * Inputs: user intent (natural language), changed/touched file paths,
 * and optional diff stats (added/deleted lines, per-file counts).
 *
 * Output: an ordered list of signal codes + a bucket label.
 *
 * Buckets (matches the risk table in the advisor contract):
 *
 *   blocker:
 *     - destructive delete (>N files, delete-heavy diff)
 *     - deploy/publish/merge commands in intent
 *     - migration APPLY intent
 *     - secrets / credentials touched
 *     - payments money movement
 *
 *   guarded:
 *     - auth
 *     - database schema
 *     - public API
 *     - CI/release config
 *     - large deletion
 *     - lockfile / package manager
 *
 *   notice:
 *     - many files
 *     - moderate deletion
 *     - test failures
 *     - config changes
 *
 *   silent:
 *     - docs only
 *     - tests only
 *     - tiny UI copy
 *
 * No LLM calls. Ordered signal list lets the advisor-policy downstream
 * decide the final InterventionLevel.
 */

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface RiskInput {
  /** Raw user intent string. Empty string OK. */
  intent: string;
  /** List of files the task touches (relative or absolute, either OK). */
  files: string[];
  /** Optional diff statistics. */
  diffStats?: DiffStats;
  /** Optional context flags collected upstream. */
  flags?: {
    testFailures?: boolean;
    buildFailing?: boolean;
    /** CI/CD context, meaning "no interactive user present". */
    nonInteractive?: boolean;
  };
}

export interface DiffStats {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  prodFilesChanged: number;
  testFilesChanged: number;
}

// ---------------------------------------------------------------------------
// Signal codes
// ---------------------------------------------------------------------------

export type RiskSignal =
  | 'touchesAuth'
  | 'touchesPayments'
  | 'touchesSchema'
  | 'touchesMigration'
  | 'touchesDatabase'
  | 'touchesPublicApi'
  | 'touchesSecrets'
  | 'touchesConfig'
  | 'touchesCI'
  | 'touchesPackageManager'
  | 'touchesLockfile'
  | 'touchesPermissions'
  | 'touchesGeneratedFiles'
  | 'touchesTestsOnly'
  | 'touchesDocsOnly'
  | 'touchesEnvExample'
  | 'largeDeletion'
  | 'moderateDeletion'
  | 'modifiesManyFiles'
  | 'renamesFiles'
  | 'testFailures'
  | 'buildFailing'
  | 'deploymentIntent'
  | 'destructiveIntent'
  | 'moneyMovementIntent';

export type RiskBucket = 'silent' | 'notice' | 'guarded' | 'blocker';

export interface RiskClassification {
  bucket: RiskBucket;
  signals: RiskSignal[];
  /** Confidence in the bucket assignment. */
  confidence: 'low' | 'medium' | 'high';
  /** Short rationale for logs. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Path patterns
// ---------------------------------------------------------------------------

const AUTH_PATTERNS = [
  /(^|\/)auth(?:\/|\.|$)/i,
  /session/i,
  /(^|\/)login(?:\/|\.|$)/i,
  /(^|\/)logout(?:\/|\.|$)/i,
  /passport/i,
  /jwt/i,
  /oauth/i,
];

const PAYMENTS_PATTERNS = [
  /payment/i,
  /stripe/i,
  /billing/i,
  /invoice/i,
  /checkout/i,
  /subscription/i,
];

const SCHEMA_PATTERNS = [
  /prisma\/schema\.prisma$/i,
  /drizzle\/schema/i,
  /models?\/.+\.(ts|js|py|rb|go|java)$/i,
];

const MIGRATION_PATTERNS = [
  /migrations?\//i,
  /(^|\/)db\/migrate\//i,
  /alembic\//i,
  /flyway\//i,
];

const DATABASE_PATTERNS = [
  /(^|\/)db\//i,
  /database/i,
  /repository/i,
  /\.sql$/i,
];

const PUBLIC_API_PATTERNS = [
  /(^|\/)api\//i,
  /(^|\/)routes\//i,
  /(^|\/)handlers\//i,
  /openapi\.(ya?ml|json)$/i,
];

const SECRETS_PATTERNS = [
  /\.env(?!\.example)/i,
  /credentials/i,
  /secret/i,
  /key\.pem$/i,
  /\.p12$/i,
];

const ENV_EXAMPLE_PATTERNS = [/\.env\.example$/i, /env\.sample$/i];

const CI_PATTERNS = [
  /\.github\/workflows\//i,
  /\.circleci\//i,
  /\.gitlab-ci\.ya?ml$/i,
  /azure-pipelines\.ya?ml$/i,
  /buildkite/i,
];

const PACKAGE_MGR_PATTERNS = [
  /(^|\/)package\.json$/i,
  /requirements\.txt$/i,
  /cargo\.toml$/i,
  /go\.mod$/i,
  /pyproject\.toml$/i,
];

const LOCKFILE_PATTERNS = [
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /cargo\.lock$/i,
  /go\.sum$/i,
  /poetry\.lock$/i,
];

const PERMISSIONS_PATTERNS = [
  /permissions?/i,
  /roles?/i,
  /rbac/i,
  /acl/i,
  /iam/i,
];

const GENERATED_PATTERNS = [
  /(^|\/)dist\//i,
  /(^|\/)build\//i,
  /(^|\/)\.next\//i,
  /(^|\/)node_modules\//i,
  /\.generated\./i,
];

const TEST_PATTERNS = [/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs)$/i, /(^|\/)__tests__\//i];
const DOCS_PATTERNS = [/\.md$/i, /(^|\/)docs\//i, /readme/i, /changelog/i];
const CONFIG_PATTERNS = [
  /\.(ya?ml|toml|ini|conf|cfg|env)$/i,
  /(^|\/)config\//i,
  /tsconfig(\.[^/]+)?\.json$/i,
  /babel\.config/i,
  /eslint\.config/i,
  /vite\.config/i,
];

// ---------------------------------------------------------------------------
// Intent patterns
// ---------------------------------------------------------------------------

const DEPLOY_INTENT = [
  /\bdeploy\b/i,
  /\bpublish\b/i,
  /\brelease\b/i,
  /\bship\s+(it|this|now)\b/i,
  /\bmerge\s+(it|main|master)\b/i,
  /\bpush\s+to\s+prod/i,
  /\bapply\s+.+\bto\s+prod(uction)?\b/i,
  /\bto\s+prod(uction)?\b/i,
  /배포/,
];

const DESTRUCTIVE_INTENT = [
  /\brm\s+-rf\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bdelete\s+everything\b/i,
  /\bforce[-\s]?push\b/i,
  /싹\s*지워/,
];

const MONEY_INTENT = [
  /\brefund\b/i,
  /\bcharge\s+the\s+card\b/i,
  /\bpayout\b/i,
  /\btransfer\s+money\b/i,
];

const MIGRATION_APPLY_INTENT = [
  /\bmigrate\s+(prod|production|staging)\b/i,
  /\brun\s+migrations?\b/i,
  /\bapply\s+migration\b/i,
  /마이그레이션.*적용/,
];

const INTENT_AUTH = [
  /\blogin\b/i,
  /\blogout\b/i,
  /\bauth\b/i,
  /\bsession\b/i,
  /\boauth\b/i,
  /로그인/,
  /인증/,
];

const INTENT_PAYMENTS = [
  /\bpayment/i,
  /\bstripe\b/i,
  /\bbilling\b/i,
  /\bcheckout\b/i,
  /결제/,
];

const INTENT_SCHEMA = [
  /\bschema\s+(change|update)/i,
  /\bmigration\b/i,
  /스키마\s*(변경|수정)/,
];

// ---------------------------------------------------------------------------
// Path matchers
// ---------------------------------------------------------------------------

function matchAny(path: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(path));
}

export function isDocsFile(path: string): boolean {
  return matchAny(path, DOCS_PATTERNS);
}

export function isTestFile(path: string): boolean {
  return matchAny(path, TEST_PATTERNS);
}

export function isGeneratedFile(path: string): boolean {
  return matchAny(path, GENERATED_PATTERNS);
}

// ---------------------------------------------------------------------------
// Signal extraction
// ---------------------------------------------------------------------------

/**
 * Extract every signal code present in the input. Order is stable so
 * downstream snapshots don't drift.
 */
export function extractSignals(input: RiskInput): RiskSignal[] {
  const signals = new Set<RiskSignal>();
  const nonGenerated = input.files.filter((f) => !isGeneratedFile(f));

  // File-path signals
  for (const f of nonGenerated) {
    if (matchAny(f, AUTH_PATTERNS)) signals.add('touchesAuth');
    if (matchAny(f, PAYMENTS_PATTERNS)) signals.add('touchesPayments');
    if (matchAny(f, SCHEMA_PATTERNS)) signals.add('touchesSchema');
    if (matchAny(f, MIGRATION_PATTERNS)) signals.add('touchesMigration');
    if (matchAny(f, DATABASE_PATTERNS)) signals.add('touchesDatabase');
    if (matchAny(f, PUBLIC_API_PATTERNS)) signals.add('touchesPublicApi');
    if (matchAny(f, SECRETS_PATTERNS)) signals.add('touchesSecrets');
    if (matchAny(f, ENV_EXAMPLE_PATTERNS)) signals.add('touchesEnvExample');
    if (matchAny(f, CI_PATTERNS)) signals.add('touchesCI');
    if (matchAny(f, PACKAGE_MGR_PATTERNS)) signals.add('touchesPackageManager');
    if (matchAny(f, LOCKFILE_PATTERNS)) signals.add('touchesLockfile');
    if (matchAny(f, PERMISSIONS_PATTERNS)) signals.add('touchesPermissions');
    if (matchAny(f, CONFIG_PATTERNS) && !matchAny(f, SCHEMA_PATTERNS)) {
      signals.add('touchesConfig');
    }
  }
  if (input.files.some(isGeneratedFile)) signals.add('touchesGeneratedFiles');

  const nonGenNonDocs = nonGenerated.filter((f) => !isDocsFile(f));
  if (nonGenNonDocs.length > 0 && nonGenNonDocs.every(isTestFile)) {
    signals.add('touchesTestsOnly');
  }
  if (nonGenerated.length > 0 && nonGenerated.every(isDocsFile)) {
    signals.add('touchesDocsOnly');
  }

  // Diff-stat signals
  if (input.diffStats) {
    const ds = input.diffStats;
    if (ds.filesChanged >= 10) signals.add('modifiesManyFiles');
    const totalChanges = ds.linesAdded + ds.linesDeleted;
    if (totalChanges > 0) {
      const deleteRatio = ds.linesDeleted / totalChanges;
      if (ds.linesDeleted >= 200 && deleteRatio > 0.5) signals.add('largeDeletion');
      else if (ds.linesDeleted >= 50 && deleteRatio > 0.3) signals.add('moderateDeletion');
    }
  }

  // Flags
  if (input.flags?.testFailures) signals.add('testFailures');
  if (input.flags?.buildFailing) signals.add('buildFailing');

  // Intent signals
  const intent = input.intent ?? '';
  if (DEPLOY_INTENT.some((p) => p.test(intent))) signals.add('deploymentIntent');
  if (DESTRUCTIVE_INTENT.some((p) => p.test(intent))) signals.add('destructiveIntent');
  if (MONEY_INTENT.some((p) => p.test(intent))) signals.add('moneyMovementIntent');
  if (MIGRATION_APPLY_INTENT.some((p) => p.test(intent))) signals.add('touchesMigration');
  // Intent-based guarded signals (used when caller has no files to scan,
  // e.g. /sunco:advisor "<task>" without diff context).
  if (INTENT_AUTH.some((p) => p.test(intent))) signals.add('touchesAuth');
  if (INTENT_PAYMENTS.some((p) => p.test(intent))) signals.add('touchesPayments');
  if (INTENT_SCHEMA.some((p) => p.test(intent))) signals.add('touchesSchema');

  // Stable order
  return SIGNAL_ORDER.filter((s) => signals.has(s));
}

const SIGNAL_ORDER: RiskSignal[] = [
  // blocker-grade first
  'destructiveIntent',
  'deploymentIntent',
  'moneyMovementIntent',
  'touchesSecrets',
  'touchesMigration',
  // guarded
  'touchesAuth',
  'touchesPayments',
  'touchesSchema',
  'touchesDatabase',
  'touchesPublicApi',
  'touchesCI',
  'touchesPermissions',
  'touchesPackageManager',
  'touchesLockfile',
  'largeDeletion',
  // notice
  'modifiesManyFiles',
  'moderateDeletion',
  'testFailures',
  'buildFailing',
  'touchesConfig',
  'touchesEnvExample',
  'renamesFiles',
  // downgrade
  'touchesTestsOnly',
  'touchesDocsOnly',
  'touchesGeneratedFiles',
];

// ---------------------------------------------------------------------------
// Bucket resolution
// ---------------------------------------------------------------------------

const BLOCKER_SIGNALS: Set<RiskSignal> = new Set([
  'destructiveIntent',
  'deploymentIntent',
  'moneyMovementIntent',
  'touchesSecrets',
]);

const GUARDED_SIGNALS: Set<RiskSignal> = new Set([
  'touchesAuth',
  'touchesPayments',
  'touchesSchema',
  'touchesMigration',
  'touchesDatabase',
  'touchesPublicApi',
  'touchesCI',
  'touchesPermissions',
  'touchesPackageManager',
  'touchesLockfile',
  'largeDeletion',
]);

const NOTICE_SIGNALS: Set<RiskSignal> = new Set([
  'modifiesManyFiles',
  'moderateDeletion',
  'testFailures',
  'buildFailing',
  'touchesConfig',
  'touchesEnvExample',
  'renamesFiles',
]);

export function classifyRisk(input: RiskInput): RiskClassification {
  const signals = extractSignals(input);

  // Downgrade: docs-only / tests-only always silent unless blocker present
  const hasBlocker = signals.some((s) => BLOCKER_SIGNALS.has(s));
  if (!hasBlocker && (signals.includes('touchesDocsOnly') || signals.includes('touchesTestsOnly'))) {
    return {
      bucket: 'silent',
      signals,
      confidence: 'high',
      rationale: signals.includes('touchesDocsOnly') ? 'docs-only change' : 'tests-only change',
    };
  }

  if (hasBlocker) {
    return {
      bucket: 'blocker',
      signals,
      confidence: 'high',
      rationale: `blocker signal(s): ${signals.filter((s) => BLOCKER_SIGNALS.has(s)).join(', ')}`,
    };
  }

  const guardedHits = signals.filter((s) => GUARDED_SIGNALS.has(s));
  if (guardedHits.length > 0) {
    return {
      bucket: 'guarded',
      signals,
      confidence: guardedHits.length >= 2 ? 'high' : 'medium',
      rationale: `guarded signal(s): ${guardedHits.join(', ')}`,
    };
  }

  const noticeHits = signals.filter((s) => NOTICE_SIGNALS.has(s));
  if (noticeHits.length > 0) {
    return {
      bucket: 'notice',
      signals,
      confidence: noticeHits.length >= 2 ? 'medium' : 'low',
      rationale: `notice signal(s): ${noticeHits.join(', ')}`,
    };
  }

  return {
    bucket: 'silent',
    signals,
    confidence: 'low',
    rationale: 'no risk signals detected',
  };
}
